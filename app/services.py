import os
import uuid
import asyncio
import resend
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, text
from sqlalchemy.orm import selectinload
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import HTTPException, Header, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models import (
    User, Product, Cart, CartItem, Wishlist, WishlistItem, 
    Order, OrderItem, DeliveryZone
)
from app.schemas import OrderCreate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "your-fallback-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ADMIN_API_SECRET = os.getenv("ADMIN_API_SECRET", "super-secret-admin-key")

# Use HTTPBearer to correctly read the "Authorization: Bearer <token>" header
security = HTTPBearer(auto_error=False)

# ============================================================
# 1. Authentication Services
# ============================================================
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db) # Depends is OKAY here because it's used by route handlers
):
    if not credentials:
        return None
    
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def verify_admin_token(x_admin_token: str = Header(None)):
    if x_admin_token != ADMIN_API_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# ============================================================
# 2. E-Commerce Services (NO Depends allowed here!)
# ============================================================
async def get_or_create_cart(
    db: AsyncSession, 
    user_id: Optional[uuid.UUID] = None, 
    guest_token: Optional[str] = None
):
    if user_id:
        result = await db.execute(select(Cart).where(Cart.user_id == user_id))
        cart = result.scalar_one_or_none()
        if not cart:
            cart = Cart(user_id=user_id)
            db.add(cart)
            await db.commit()
            await db.refresh(cart)
    else:
        if not guest_token:
            guest_token = str(uuid.uuid4())
        result = await db.execute(select(Cart).where(Cart.guest_token == guest_token))
        cart = result.scalar_one_or_none()
        if not cart:
            cart = Cart(guest_token=guest_token)
            db.add(cart)
            await db.commit()
            await db.refresh(cart)
    return cart

async def add_to_cart(db: AsyncSession, cart_id: uuid.UUID, product_id: uuid.UUID, quantity: int):
    result = await db.execute(select(Product).where(Product.id == product_id, Product.is_active == True))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.stock_quantity < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    result = await db.execute(
        select(CartItem).where(CartItem.cart_id == cart_id, CartItem.product_id == product_id)
    )
    cart_item = result.scalar_one_or_none()
    
    if cart_item:
        cart_item.quantity += quantity
    else:
        cart_item = CartItem(cart_id=cart_id, product_id=product_id, quantity=quantity)
        db.add(cart_item)
    
    await db.commit()
    return cart_item

async def calculate_shipping(db: AsyncSession, state: str) -> float:
    result = await db.execute(
        select(DeliveryZone).where(DeliveryZone.state.ilike(f"%{state}%"))
    )
    zone = result.scalar_one_or_none()
    return float(zone.base_fee) if zone else 3500.0

async def create_order(db: AsyncSession, user: Optional[User], request: OrderCreate, guest_token: Optional[str] = None):
    # Notice: We pass db=db explicitly, NO Depends here
    cart = await get_or_create_cart(db=db, user_id=user.id if user else None, guest_token=guest_token)
    
    if not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    subtotal = 0.0
    order_items = []
    
    for cart_item in cart.items:
        result = await db.execute(select(Product).where(Product.id == cart_item.product_id))
        product = result.scalar_one_or_none()
        
        if not product or not product.is_active:
            raise HTTPException(status_code=400, detail=f"Product {product.name if product else 'Unknown'} is no longer available")
        if product.stock_quantity < cart_item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name}")
        
        line_total = float(product.price) * cart_item.quantity
        subtotal += line_total
        
        order_items.append(OrderItem(
            product_id=product.id,
            product_name=product.name,
            product_price=product.price,
            quantity=cart_item.quantity,
            total_price=line_total
        ))
        
        product.stock_quantity -= cart_item.quantity
        product.sales_count += cart_item.quantity
    
    shipping_fee = await calculate_shipping(db, request.state or "")
    total_amount = subtotal + shipping_fee
    
    order_number = f"SS-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    
    order = Order(
        order_number=order_number,
        user_id=user.id if user else None,
        customer_name=request.customer_name,
        customer_email=request.customer_email,
        customer_phone=request.customer_phone,
        delivery_method=request.delivery_method,
        delivery_address=request.delivery_address,
        city=request.city,
        state=request.state,
        subtotal=subtotal,
        shipping_fee=shipping_fee,
        total_amount=total_amount,
        payment_status="pending",
        order_status="pending",
        items=order_items
    )
    db.add(order)
    
    await db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))
    await db.commit()
    await db.refresh(order)
    
    return order

async def get_or_create_wishlist(db: AsyncSession, user_id: uuid.UUID):
    result = await db.execute(select(Wishlist).where(Wishlist.user_id == user_id))
    wishlist = result.scalar_one_or_none()
    if not wishlist:
        wishlist = Wishlist(user_id=user_id)
        db.add(wishlist)
        await db.commit()
        await db.refresh(wishlist)
    return wishlist

# ============================================================
# 3. Newsletter / Subscription Services
# ============================================================
async def send_welcome_email_async(to_email: str):
    try:
        resend.api_key = os.getenv("RESEND_API_KEY")
        params = {
            "from": os.getenv("RESEND_FROM_EMAIL", "Sami's Scent <onboarding@resend.dev>"),
            "to": to_email,
            "subject": "Welcome to Sami's Scent",
            "html": """
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem; color: #1A1A1A;">
                <h2 style="font-family: 'Playfair Display', serif; color: #8C735A;">Welcome to Sami's Scent</h2>
                <p>Thank you for joining our inner circle. You will be the first to know about new fragrance launches and exclusive brand stories.</p>
                <p>Stay scented, stay elegant.</p>
            </div>
            """
        }
        await asyncio.to_thread(resend.Emails.send, params)
    except Exception as e:
        print(f"Failed to send welcome email: {e}")

class SubscriptionService:
    @staticmethod
    async def subscribe(db: AsyncSession, data) -> dict:
        query = text("""
            WITH upserted_user AS (
                INSERT INTO users (email, full_name)
                VALUES (:email, :full_name)
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
        
        await db.execute(query, {"email": data.email, "full_name": getattr(data, 'full_name', 'Newsletter Subscriber')})
        await db.commit()
        
        asyncio.create_task(send_welcome_email_async(data.email))
        return {"status": "success", "message": "Welcome to the inner circle."}

    @staticmethod
    async def get_subscribers(db: AsyncSession, page: int, limit: int, status: str, search: str):
        offset = (page - 1) * limit
        
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
            "status": status, "search": search, 
            "search_pattern": f"%{search}%", "limit": limit, "offset": offset
        }
        
        total = (await db.execute(count_query, params)).scalar()
        rows = (await db.execute(data_query, params)).fetchall()
        
        return {
            "total": total, "page": page, "limit": limit,
            "data": [
                {
                    "id": row[0], "user_id": row[1], "email": row[2], 
                    "status": row[3], "subscribed_at": row[4], "unsubscribed_at": row[5]
                } for row in rows
            ]
        }
