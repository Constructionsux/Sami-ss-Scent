from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional
import os
import uuid
import shutil
from datetime import datetime
from app.database import get_db
from app.models import Order, User
from app.schemas import OrderCreate, OrderResponse
from app.services import get_current_user, create_order

router = APIRouter(prefix="/api/orders", tags=["Orders"])

@router.post("/")
async def place_order(
    order_data: OrderCreate,
    user: Optional[User] = Depends(get_current_user),
    x_guest_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    # Create order
    order = await create_order(db, user, order_data, x_guest_token)
    
    # TODO: Send email notification to CEO
    # TODO: Send confirmation email to customer
    
    return {
        "order_number": order.order_number,
        "total_amount": float(order.total_amount),
        "message": "Order placed successfully"
    }

@router.get("/")
async def get_orders(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Order).where(Order.user_id == user.id).order_by(Order.created_at.desc()).options(
            selectinload(Order.items)
        )
    )
    orders = result.scalars().all()
    
    return [
        {
            "id": str(o.id),
            "order_number": o.order_number,
            "total_amount": float(o.total_amount),
            "order_status": o.order_status,
            "payment_status": o.payment_status,
            "created_at": o.created_at.isoformat(),
            "items_count": len(o.items)
        }
        for o in orders
    ]

@router.get("/{order_number}")
async def get_order(
    order_number: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Order).where(Order.order_number == order_number, Order.user_id == user.id).options(
            selectinload(Order.items)
        )
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {
        "id": str(order.id),
        "order_number": order.order_number,
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
        "customer_phone": order.customer_phone,
        "delivery_method": order.delivery_method,
        "delivery_address": order.delivery_address,
        "subtotal": float(order.subtotal),
        "shipping_fee": float(order.shipping_fee),
        "total_amount": float(order.total_amount),
        "payment_status": order.payment_status,
        "order_status": order.order_status,
        "created_at": order.created_at.isoformat(),
        "items": [
            {
                "product_name": item.product_name,
                "product_price": float(item.product_price),
                "quantity": item.quantity,
                "total_price": float(item.total_price)
            }
            for item in order.items
        ]
    }

@router.post("/{order_number}/upload-receipt")
async def upload_payment_receipt(
    order_number: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Order).where(Order.order_number == order_number))
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Save file
    upload_dir = "static/uploads/receipts"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{order_number}_{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(upload_dir, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update order
    order.payment_receipt_url = f"/static/uploads/receipts/{filename}"
    order.payment_status = "submitted"
    order.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # TODO: Send notification to CEO
    
    return {"message": "Receipt uploaded successfully", "receipt_url": order.payment_receipt_url}
