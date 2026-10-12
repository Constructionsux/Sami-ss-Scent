from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
import os, cloudinary, cloudinary.uploader
from app.database import get_db
from app.models import User, Order, Product, Brand, Category, OrderItem
from app.services import get_current_user


router = APIRouter(prefix="/api/admin", tags=["Admin"])

# Dependency to ensure user is admin
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

@router.get("/recent-orders")
async def get_recent_orders(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).where(Order.payment_status.in_(["submitted", "pending", "verified"]))
        .order_by(Order.created_at.desc())
        .limit(10)
    )
    orders = result.scalars().all()
    
    return [
        {
            "id": str(o.id),
            "order_number": o.order_number,
            "customer_name": o.customer_name,
            "total_amount": float(o.total_amount),
            "payment_status": o.payment_status,
            "order_status": o.order_status,
            "created_at": o.created_at.strftime("%Y-%m-%d %H:%M"),
            "receipt_url": o.payment_receipt_url
        } for o in orders
    ]

@router.patch("/orders/{order_id}/payment-status")
async def update_payment_status(
    order_id: str,
    status: str = Form(...),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    if status not in ["verified", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    order.payment_status = status
    order.order_status = "confirmed" if status == "verified" else "cancelled"
    await db.commit()
    return {"message": f"Order payment marked as {status}"}

@router.post("/products")
async def create_product(
    name: str = Form(...),
    brand_id: str = Form(...),
    category_id: str = Form(...),
    price: float = Form(...),
    stock_quantity: int = Form(...),
    description: str = Form(""),
    image: UploadFile = File(None),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    image_url = None
    if image:
        try:
            upload_result = await cloudinary.uploader.upload(
                image.file,
                folder="samis_scent_products",
                resource_type="image"
            )
            image_url = upload_result['secure_url']
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")
            
    slug = name.lower().replace(" ", "-").replace("'", "")
    product = Product(
        name=name, slug=slug, brand_id=brand_id, category_id=category_id,
        price=price, stock_quantity=stock_quantity, description=description,
        image_url=image_url, is_active=True
    )
    db.add(product)
    await db.commit()
    return {"message": "Product created successfully"}

@router.get("/brands/list")
async def get_brands(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Brand))
    return [{"id": str(b.id), "name": b.name} for b in result.scalars().all()]

@router.get("/categories/list")
async def get_categories(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category))
    return [{"id": str(c.id), "name": c.name} for c in result.scalars().all()]

@router.post("/newsletter/send")
async def send_newsletter(
    subject: str = Form(...),
    message: str = Form(...),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    # TODO: Integrate with Resend batch API to send to all newsletter_subscriptions
    return {"message": "Newsletter queued for sending to all subscribers."}




@router.get("/products/stats")
async def get_product_stats(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    # Total Products
    total_products = (await db.execute(select(func.count(Product.id)))).scalar() or 0
    
    # Most Purchased Product
    top_product_query = select(Product.name, func.sum(OrderItem.quantity).label('total_qty')) \
        .join(OrderItem, Product.id == OrderItem.product_id) \
        .group_by(Product.id, Product.name) \
        .order_by(desc('total_qty')) \
        .limit(1)
    top_product_result = (await db.execute(top_product_query)).first()
    top_product = top_product_result.name if top_product_result else "N/A"
    
    # Most Purchased Brand
    top_brand_query = select(Brand.name, func.sum(OrderItem.quantity).label('total_qty')) \
        .join(Product, Brand.id == Product.brand_id) \
        .join(OrderItem, Product.id == OrderItem.product_id) \
        .group_by(Brand.id, Brand.name) \
        .order_by(desc('total_qty')) \
        .limit(1)
    top_brand_result = (await db.execute(top_brand_query)).first()
    top_brand = top_brand_result.name if top_brand_result else "N/A"
    
    return {
        "total_products": total_products,
        "top_product": top_product,
        "top_brand": top_brand
    }

@router.get("/products")
async def get_admin_products(
    search: str = Query(""),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Product).options(selectinload(Product.brand), selectinload(Product.category))
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            (Product.name.ilike(search_term)) | 
            (Product.brand.has(Brand.name.ilike(search_term)))
        )
    
    query = query.order_by(Product.created_at.desc())
    result = await db.execute(query)
    products = result.scalars().all()
    
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "brand": p.brand.name if p.brand else "Unknown",
            "category": p.category.name if p.category else "Unknown",
            "price": float(p.price),
            "stock_quantity": p.stock_quantity,
            "image_url": p.image_url,
            "is_active": p.is_active
        } for p in products
    ]

@router.patch("/products/{product_id}")
async def update_product(
    product_id: str,
    name: str = Form(None),
    price: float = Form(None),
    stock_quantity: int = Form(None),
    is_active: bool = Form(None),
    image: UploadFile = File(None),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if name is not None: product.name = name
    if price is not None: product.price = price
    if stock_quantity is not None: product.stock_quantity = stock_quantity
    if is_active is not None: product.is_active = is_active
    
    if image and image.filename:
        try:
            upload_result = await cloudinary.uploader.upload(
                image.file,
                folder="samis_scent_products",
                resource_type="image"
            )
            product.image_url = upload_result['secure_url']
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")
            
    await db.commit()
    await db.refresh(product)
    return {"message": "Product updated successfully"}

@router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    await db.delete(product)
    await db.commit()
    return {"message": "Product deleted successfully"}
