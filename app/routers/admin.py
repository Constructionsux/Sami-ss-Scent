from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, text
from sqlalchemy.orm import selectinload
import os, uuid, cloudinary, cloudinary.uploader, asyncio, resend
from datetime import datetime

from app.database import get_db
from app.models import User, Order, OrderItem, Product, Brand, Category
from app.services import get_current_user

router = APIRouter(prefix="/api/admin", tags=["Admin"])

async def get_admin_user(user: User = Depends(get_current_user)):
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

resend.api_key = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "Sami's Scent <onboarding@resend.dev>")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@samisscent.com")

# ================= ORDERS & PAYMENTS =================

@router.get("/orders/stats")
async def get_order_stats(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    total_orders = (await db.execute(select(func.count(Order.id)))).scalar() or 0
    
    top_client_query = select(Order.customer_name, func.count(Order.id).label('order_count')) \
        .group_by(Order.customer_name).order_by(desc('order_count')).limit(1)
    top_client_result = (await db.execute(top_client_query)).first()
    top_client = top_client_result.customer_name if top_client_result else "N/A"
    
    top_brand_query = select(Brand.name, func.sum(OrderItem.quantity).label('total_qty')) \
        .join(Product, OrderItem.product_id == Product.id) \
        .join(Brand, Product.brand_id == Brand.id) \
        .group_by(Brand.id, Brand.name).order_by(desc('total_qty')).limit(1)
    top_brand_result = (await db.execute(top_brand_query)).first()
    top_brand = top_brand_result.name if top_brand_result else "N/A"
    
    top_product_query = select(Product.name, func.sum(OrderItem.quantity).label('total_qty')) \
        .join(OrderItem, Product.id == OrderItem.product_id) \
        .group_by(Product.id, Product.name).order_by(desc('total_qty')).limit(1)
    top_product_result = (await db.execute(top_product_query)).first()
    top_product = top_product_result.name if top_product_result else "N/A"
    
    return {"total_orders": total_orders, "top_client": top_client, "top_brand": top_brand, "top_product": top_product}

@router.get("/orders")
async def get_admin_orders(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    query = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc()).limit(50)
    result = await db.execute(query)
    orders = result.scalars().all()
    
    return [
        {
            "id": str(o.id), "order_number": o.order_number, "customer_name": o.customer_name,
            "customer_email": o.customer_email, "total_amount": float(o.total_amount),
            "payment_status": o.payment_status, "order_status": o.order_status,
            "created_at": o.created_at.strftime("%Y-%m-%d %H:%M"), "items_count": len(o.items)
        } for o in orders
    ]

@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, status_data: dict, admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    new_status = status_data.get("status")
    if new_status not in ["pending", "processing", "shipped", "delivered", "completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid order status")
        
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order: raise HTTPException(status_code=404, detail="Order not found")
        
    order.order_status = new_status
    await db.commit()
    return {"message": f"Order status updated to {new_status}"}

@router.get("/payments/stats")
async def get_payment_stats(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    revenue_result = await db.execute(select(func.sum(Order.total_amount)).where(Order.payment_status == "verified"))
    total_revenue = float(revenue_result.scalar() or 0)
    pending = (await db.execute(select(func.count(Order.id)).where(Order.payment_status == "submitted"))).scalar() or 0
    verified = (await db.execute(select(func.count(Order.id)).where(Order.payment_status == "verified"))).scalar() or 0
    rejected = (await db.execute(select(func.count(Order.id)).where(Order.payment_status == "rejected"))).scalar() or 0
    
    return {"total_revenue": total_revenue, "pending": pending, "verified": verified, "rejected": rejected}

@router.get("/payments")
async def get_admin_payments(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    query = select(Order).order_by(Order.created_at.desc()).limit(100)
    result = await db.execute(query)
    orders = result.scalars().all()
    
    return [
        {
            "id": str(o.id), "order_number": o.order_number, "customer_name": o.customer_name,
            "amount": float(o.total_amount), "payment_status": o.payment_status,
            "receipt_url": o.payment_receipt_url, "created_at": o.created_at.strftime("%Y-%m-%d %H:%M")
        } for o in orders
    ]

@router.patch("/payments/{order_id}/status")
async def update_payment_status(order_id: str, status_data: dict, admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    new_status = status_data.get("status")
    if new_status not in ["verified", "rejected", "pending"]:
        raise HTTPException(status_code=400, detail="Invalid payment status")
        
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order: raise HTTPException(status_code=404, detail="Order not found")
        
    order.payment_status = new_status
    order.order_status = "processing" if new_status == "verified" else ("cancelled" if new_status == "rejected" else order.order_status)
    await db.commit()
    return {"message": f"Payment marked as {new_status}"}

# ================= PRODUCTS =================

@router.get("/products/stats")
async def get_product_stats(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    total_products = (await db.execute(select(func.count(Product.id)))).scalar() or 0
    
    top_product_query = select(Product.name, func.sum(OrderItem.quantity).label('total_qty')) \
        .join(OrderItem, Product.id == OrderItem.product_id).group_by(Product.id, Product.name).order_by(desc('total_qty')).limit(1)
    top_product_result = (await db.execute(top_product_query)).first()
    
    top_brand_query = select(Brand.name, func.sum(OrderItem.quantity).label('total_qty')) \
        .join(Product, OrderItem.product_id == Product.id).join(Brand, Product.brand_id == Brand.id) \
        .group_by(Brand.id, Brand.name).order_by(desc('total_qty')).limit(1)
    top_brand_result = (await db.execute(top_brand_query)).first()
    
    return {
        "total_products": total_products,
        "top_product": top_product_result.name if top_product_result else "N/A",
        "top_brand": top_brand_result.name if top_brand_result else "N/A"
    }

@router.get("/products")
async def get_admin_products(search: str = Query(""), admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    # FIX: Explicitly selectinload BOTH brand and categories
    query = select(Product).options(
        selectinload(Product.brand), 
        selectinload(Product.categories)
    )
    
    if search:
        search_term = f"%{search}%"
        query = query.where((Product.name.ilike(search_term)) | (Product.brand.has(Brand.name.ilike(search_term))))
    
    query = query.order_by(Product.created_at.desc())
    result = await db.execute(query)
    products = result.scalars().all()
    
    return [
        {
            "id": str(p.id), "name": p.name,
            "brand": p.brand.name if p.brand else "Unknown",
            "brand_id": str(p.brand_id) if p.brand_id else "",
            "category": p.categories[0].name if p.categories else "Unknown",
            "category_id": str(p.categories[0].id) if p.categories else "",
            "price": float(p.price), "stock_quantity": p.stock_quantity,
            "image_url": p.image_url, "is_active": p.is_active
        } for p in products
    ]

@router.post("/products")
async def create_product(
    name: str = Form(...), brand_id: str = Form(...), category_id: str = Form(...),
    price: float = Form(...), stock_quantity: int = Form(...), description: str = Form(""),
    image: UploadFile = File(None), admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)
):
    image_url = None
    if image and image.filename:
        try:
            upload_result =  cloudinary.uploader.upload(image.file, folder="samis_scent_products", resource_type="image")
            image_url = upload_result['secure_url']
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")
            
    slug = name.lower().replace(" ", "-").replace("'", "")
    product = Product(name=name, slug=slug, brand_id=brand_id, price=price, stock_quantity=stock_quantity, description=description, image_url=image_url, is_active=True)
    db.add(product)
    
    await db.flush() # Generate ID
    
    if category_id:
        cat_result = await db.execute(select(Category).where(Category.id == category_id))
        category = cat_result.scalar_one_or_none()
        if category:
            product.categories.append(category) # FIX: Append to relationship, don't pass as kwarg
            
    await db.commit()
    return {"message": "Product created successfully"}

@router.patch("/products/{product_id}")
async def update_product(
    product_id: str, name: str = Form(None), price: float = Form(None), stock_quantity: int = Form(None),
    is_active: bool = Form(None), image: UploadFile = File(None), admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product: raise HTTPException(status_code=404, detail="Product not found")
        
    if name is not None: product.name = name
    if price is not None: product.price = price
    if stock_quantity is not None: product.stock_quantity = stock_quantity
    if is_active is not None: product.is_active = is_active
    
    if image and image.filename:
        try:
            upload_result = await cloudinary.uploader.upload(image.file, folder="samis_scent_products", resource_type="image")
            product.image_url = upload_result['secure_url']
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")
            
    await db.commit()
    return {"message": "Product updated successfully"}

@router.delete("/products/{product_id}")
async def delete_product(product_id: str, admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product: raise HTTPException(status_code=404, detail="Product not found")
        
    await db.delete(product)
    await db.commit()
    return {"message": "Product deleted successfully"}

@router.get("/brands/list")
async def get_brands(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Brand))
    return [{"id": str(b.id), "name": b.name} for b in result.scalars().all()]

@router.get("/categories/list")
async def get_categories(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category))
    return [{"id": str(c.id), "name": c.name} for c in result.scalars().all()]

# ================= NEWSLETTER =================

@router.get("/newsletter/stats")
async def get_newsletter_stats(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    total = (await db.execute(text("SELECT COUNT(*) FROM newsletter_subscriptions"))).scalar() or 0
    active = (await db.execute(text("SELECT COUNT(*) FROM newsletter_subscriptions WHERE status = 'active'"))).scalar() or 0
    unsubscribed = (await db.execute(text("SELECT COUNT(*) FROM newsletter_subscriptions WHERE status = 'unsubscribed'"))).scalar() or 0
    return {"total": total, "active": active, "unsubscribed": unsubscribed}

@router.get("/newsletter/subscribers")
async def get_newsletter_subscribers(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    query = text("SELECT ns.id, u.email, ns.status, ns.subscribed_at, ns.unsubscribed_at FROM newsletter_subscriptions ns JOIN users u ON ns.user_id = u.id ORDER BY ns.subscribed_at DESC LIMIT 100")
    result = await db.execute(query)
    return [{"id": r[0], "email": r[1], "status": r[2], "subscribed_at": r[3].strftime("%Y-%m-%d") if r[3] else "N/A", "unsubscribed_at": r[4].strftime("%Y-%m-%d") if r[4] else None} for r in result.fetchall()]

@router.post("/newsletter/send")
async def send_newsletter(subject: str = Form(...), message: str = Form(...), admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    query = text("SELECT u.email FROM newsletter_subscriptions ns JOIN users u ON ns.user_id = u.id WHERE ns.status = 'active'")
    result = await db.execute(query)
    subscribers = [row[0] for row in result.fetchall()]

    if not subscribers:
        raise HTTPException(status_code=400, detail="No active subscribers found.")

    try:
        params = {
            "from": FROM_EMAIL, "to": subscribers, "subject": subject,
            "html": f"<div style='font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;'><h2 style='color: #8C735A;'>Sami's Scent</h2><div style='line-height: 1.6;'>{message}</div></div>"
        }
        await asyncio.to_thread(resend.Emails.send, params)
        return {"message": f"Newsletter sent to {len(subscribers)} subscribers."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send: {str(e)}")

@router.get("/stats")
async def get_admin_stats(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    total_orders = (await db.execute(select(func.count(Order.id)))).scalar() or 0
    
    revenue_result = await db.execute(
        select(func.sum(Order.total_amount)).where(Order.payment_status == "verified")
    )
    total_revenue = float(revenue_result.scalar() or 0)
    
    pending_payments = (await db.execute(
        select(func.count(Order.id)).where(Order.payment_status == "submitted")
    )).scalar() or 0
    
    return {
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "pending_payments": pending_payments
    }
