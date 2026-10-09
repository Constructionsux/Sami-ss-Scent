from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from backend.schemas import SubscribeRequest, SubscriberResponse, PaginatedSubscribers
from backend.emails import send_welcome_email
from uuid import UUID

class SubscriptionService:
    
    @staticmethod
    async def subscribe(db: AsyncSession, data: SubscribeRequest) -> dict:
        """
        Atomic Upsert: 
        1. Inserts user or updates timestamp if exists.
        2. Inserts subscription or reactivates if exists.
        Prevents race conditions and duplicates.
        """
        query = text("""
            WITH upserted_user AS (
                INSERT INTO users (email)
                VALUES (:email)
                ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
                RETURNING id, email
            )
            INSERT INTO newsletter_subscriptions (user_id, status, subscribed_at, unsubscribed_at)
            SELECT id, 'active', NOW(), NULL FROM upserted_user
            ON CONFLICT (user_id) DO UPDATE 
            SET status = 'active', 
                subscribed_at = NOW(), 
                unsubscribed_at = NULL,
                updated_at = NOW()
            RETURNING user_id, status
        """)
        
        result = await db.execute(query, {"email": data.email})
        row = result.fetchone()
        await db.commit()
        
        # Send email asynchronously (fire and forget, or await if strict delivery is needed)
        # Using asyncio.create_task ensures the API responds instantly
        import asyncio
        asyncio.create_task(send_welcome_email(data.email))
        
        return {"status": "success", "message": "Welcome to the inner circle."}

    @staticmethod
    async def get_subscribers(db: AsyncSession, page: int, limit: int, status: str, search: str) -> PaginatedSubscribers:
        offset = (page - 1) * limit
        
        # Base queries
        count_query = text("""
            SELECT COUNT(*) FROM newsletter_subscriptions ns 
            JOIN users u ON ns.user_id = u.id 
            WHERE (:status = 'all' OR ns.status = :status)
            AND (:search = '' OR u.email ILIKE :search_pattern)
        """)
        
        data_query = text("""
            SELECT ns.id, ns.user_id, u.email, ns.status, ns.subscribed_at, ns.unsubscribed_at 
            FROM newsletter_subscriptions ns 
            JOIN users u ON ns.user_id = u.id 
            WHERE (:status = 'all' OR ns.status = :status)
            AND (:search = '' OR u.email ILIKE :search_pattern)
            ORDER BY ns.subscribed_at DESC
            LIMIT :limit OFFSET :offset
        """)
        
        params = {
            "status": status,
            "search": search,
            "search_pattern": f"%{search}%",
            "limit": limit,
            "offset": offset
        }
        
        total_result = await db.execute(count_query, params)
        total = total_result.scalar()
        
        data_result = await db.execute(data_query, params)
        rows = data_result.fetchall()
        
        subscribers = [
            SubscriberResponse(
                id=row[0], user_id=row[1], email=row[2], status=row[3],
                subscribed_at=row[4], unsubscribed_at=row[5]
            ) for row in rows
        ]
        
        return PaginatedSubscribers(total=total, page=page, limit=limit, data=subscribers)
