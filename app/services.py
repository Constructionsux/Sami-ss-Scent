import uuid
import os
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, text 
from sqlalchemy.orm import selectinload
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Header, HTTPException, Depends
from app.models import User, Product, Cart, CartItem, Wishlist, WishlistItem, Order, OrderItem, DeliveryZone
from app.schemas import UserCreate, UserLogin, OrderCreate
from app.database import get_db
import asyncio
import resend

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"

# Auth functions
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str, db: AsyncSession = Depends(get_db)):
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

# Cart functions
async def get_or_create_cart(user_id: uuid.UUID = None, guest_token: str = None,db: AsyncSession = Depends(get_db)):
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

async def add_to_cart(cart_id: uuid.UUID, product_id: uuid.UUID, quantity: int,db: AsyncSession = Depends(get_db)):
    # Check product exists and has stock
    result = await db.execute(select(Product).where(Product.id == product_id, Product.is_active == True))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.stock_quantity < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    # Check if item already in cart
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

# Order functions
async def calculate_shipping(state: str,db: AsyncSession = Depends(get_db), city: str = None) -> float:
    """Calculate shipping fee based on state/city"""
    result = await db.execute(
        select(DeliveryZone).where(DeliveryZone.state.ilike(f"%{state}%"))
    )
    zone = result.scalar_one_or_none()
    
    if zone:
        return float(zone.base_fee)
    return 3500.0  # Default shipping fee

async def create_order( user: User, request: OrderCreate,db: AsyncSession = Depends(get_db), guest_token: str = None):
    # Get cart
    cart = await get_or_create_cart(db, user.id if user else None, guest_token)
    
    if not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Calculate totals
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
        
        # Deduct stock
        product.stock_quantity -= cart_item.quantity
        product.sales_count += cart_item.quantity
    
    # Calculate shipping
    shipping_fee = await calculate_shipping(db, request.state or "", request.city)
    total_amount = subtotal + shipping_fee
    
    # Create order
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
    
    # Clear cart
    await db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))
    
    await db.commit()
    await db.refresh(order)
    
    return order



async def verify_admin_token(x_admin_token: str = Header(None)):
    """Verify admin API secret token"""
    secret = os.getenv("ADMIN_API_SECRET", "super-secret-admin-key")
    if x_admin_token != secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True




# ============================================================
# Email Template & Background Sender
# ============================================================
def get_welcome_email_html() -> str:
    """Returns the professional HTML email template."""
    return """
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #FAFAFA; color: #1A1A1A;">
        <!-- Header -->
        <div style="padding: 40px 20px; text-align: center; border-bottom: 1px solid #E5E5E5; background-color: #FFFFFF;">
            <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; margin: 0; color: #1A1A1A; letter-spacing: -0.5px;">
                Sami's <span style="color: #8C735A; font-style: italic;">Scent</span>
            </h1>
        </div>
        
        <!-- Body -->
        <div style="padding: 40px 30px; background-color: #FFFFFF; border: 1px solid #E5E5E5; border-top: none;">
            <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 24px; margin-top: 0; margin-bottom: 20px; color: #1A1A1A;">Welcome to the Inner Circle.</h2>
            
            <p style="font-size: 16px; line-height: 1.6; color: #4A4A5A; margin-bottom: 20px;">
                Thank you for joining us. At Sami's Scent, we believe fragrance is the most intense form of memory. 
            </p>
            <p style="font-size: 16px; line-height: 1.6; color: #4A4A5A; margin-bottom: 20px;">
                As a subscriber, you will be the first to experience our new fragrance launches, discover the craftsmanship behind our blends, and receive exclusive brand stories.
            </p>
            
            <div style="text-align: center; margin: 35px 0;">
                <a href="https://samisscent.com/shop" style="background-color: #8C735A; color: #FFFFFF; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: 500; font-size: 14px; letter-spacing: 0.5px; display: inline-block;">
                    Explore the Collection
                </a>
            </div>
        </div>

        <!-- Footer -->
        <div style="padding: 30px 20px; text-align: center; font-size: 12px; color: #999999; background-color: #FAFAFA;">
            <p style="margin-bottom: 10px;">&copy; 2026 Sami's Scent. All rights reserved.</p>
            <p style="margin: 0;">
                <a href="#" style="color: #8C735A; text-decoration: underline;">Unsubscribe</a> &nbsp;•&nbsp; 
                <a href="#" style="color: #8C735A; text-decoration: underline;">Privacy Policy</a>
            </p>
        </div>
    </div>
    """

async def send_welcome_email_async(to_email: str):
    """Sends the email in a background thread to prevent blocking the API."""
    try:
        resend.api_key = os.getenv("RESEND_API_KEY")
        params = {
            "from": os.getenv("RESEND_FROM_EMAIL", "Sami's Scent <onboarding@resend.dev>"),
            "to": to_email,
            "subject": "Welcome to Sami's Scent",
            "html": get_welcome_email_html()
        }
        # Run the synchronous Resend SDK in a background thread
        await asyncio.to_thread(resend.Emails.send, params)
    except Exception as e:
        print(f"Failed to send welcome email to {to_email}: {e}")


# ============================================================
# Subscription Service
# ============================================================
class SubscriptionService:
    
    @staticmethod
    async def subscribe(data, db: AsyncSession) -> dict:
        """Atomic Upsert for newsletter subscription"""
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
        
        # Execute DB transaction
        await db.execute(query, {"email": data.email, "full_name": "Newsletter Subscriber"})
        await db.commit()
        
        # Trigger email in the background (Fire and forget)
        asyncio.create_task(send_welcome_email_async(data.email))
        
        return {"status": "success", "message": "Welcome to the inner circle."}

    @staticmethod
    async def get_subscribers(page: int, limit: int, status: str, search: str, db: AsyncSession):
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
    
# Wishlist functions
async def get_or_create_wishlist(user_id: uuid.UUID,db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Wishlist).where(Wishlist.user_id == user_id))
    wishlist = result.scalar_one_or_none()
    if not wishlist:
        wishlist = Wishlist(user_id=user_id)
        db.add(wishlist)
        await db.commit()
        await db.refresh(wishlist)
    return wishlist
