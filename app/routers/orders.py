# from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Header
# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy import select
# from sqlalchemy.orm import selectinload
# from typing import Optional
# import os, uuid,shutil
# from datetime import datetime
# import cloudinary
# import cloudinary.uploader
# import asyncio

# from app.database import get_db
# from app.models import Order, OrderItem, Payment, PaymentReceipt, DeliveryPark, CartItem, Product
# from app.schemas import OrderCreate
# from app.services import get_current_user, create_order, User
# from app.emails import send_admin_new_order_email, send_admin_receipt_email

# # Configure Cloudinary
# cloudinary.config(
#     cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
#     api_key=os.getenv("CLOUDINARY_API_KEY"),
#     api_secret=os.getenv("CLOUDINARY_API_SECRET")
# )

# router = APIRouter(prefix="/api/orders", tags=["Orders"])

# @router.get("/parks")
# async def get_delivery_parks(
#     state: str = Query(...),
#     db: AsyncSession = Depends(get_db)
# ):
#     result = await db.execute(
#         select(DeliveryPark).where(DeliveryPark.state.ilike(f"%{state}%"), DeliveryPark.is_active == True)
#     )
#     parks = result.scalars().all()
#     return [{"id": str(p.id), "city": p.city, "park_name": p.park_name, "fee": float(p.fee)} for p in parks]

# @router.post("/")
# async def place_order(
#     order_data: OrderCreate,
#     user: Optional[User] = Depends(get_current_user),
#     x_guest_token: Optional[str] = None,
#     db: AsyncSession = Depends(get_db)
# ):
#     order = await create_order(db, user, order_data, x_guest_token)
    
#     # Reload order with items to send in email
#     await db.refresh(order)
#     await db.execute(select(Order).where(Order.id == order.id).options(selectinload(Order.items)))
#     # Note: create_order already returns the order with items loaded if implemented correctly, 
#     # but if not, the above ensures it.
    
#     # Send email to admin in the background
#     asyncio.create_task(send_admin_new_order_email(order))
    
#     return {
#         "order_number": order.order_number,
#         "total_amount": float(order.total_amount),
#         "shipping_fee": float(order.shipping_fee),
#         "bank_details": {
#             "bank_name": os.getenv("BANK_NAME", "Providus Bank"),
#             "account_name": os.getenv("BANK_ACCOUNT_NAME", "Sami's Scent Ltd"),
#             "account_number": os.getenv("BANK_ACCOUNT_NUMBER", "1234567890")
#         }
#     }

# @router.post("/{order_number}/upload-receipt")
# async def upload_payment_receipt(
#     order_number: str,
#     file: UploadFile = File(...),
#     db: AsyncSession = Depends(get_db)
# ):
#     result = await db.execute(select(Order).where(Order.order_number == order_number))
#     order = result.scalar_one_or_none()
#     if not order:
#         raise HTTPException(status_code=404, detail="Order not found")
    
#     if file.content_type not in ["image/jpeg", "image/png", "image/jpg", "application/pdf"]:
#         raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image or PDF.")
    
#     # Upload to Cloudinary
#     try:
#         upload_result = await asyncio.to_thread(
#             cloudinary.uploader.upload,
#             file.file,
#             folder="samis_scent_receipts",
#             resource_type="auto",
#             public_id=f"{order_number}_{uuid.uuid4().hex[:8]}"
#         )
#         receipt_url = upload_result['secure_url']
#     except Exception as e:
#         print(f"Cloudinary upload error: {e}")
#         raise HTTPException(status_code=500, detail="Failed to upload receipt to cloud storage.")
    
#     # Update database
#     order.payment_receipt_url = receipt_url
#     order.payment_status = "submitted"
#     order.order_status = "payment_under_review"
#     order.updated_at = datetime.utcnow()
    
#     await db.commit()
    
#     # Send email to admin with the Cloudinary link
#     asyncio.create_task(send_admin_receipt_email(order, receipt_url))
    
#     return {"message": "Receipt uploaded successfully. We will verify your payment shortly.", "receipt_url": receipt_url}


# @router.get("/")
# async def get_orders(
#     user: Optional[User] = Depends(get_current_user),
#     db: AsyncSession = Depends(get_db)
# ):
#     # FIX: Explicitly check if user is authenticated
#     if not user:
#         raise HTTPException(status_code=401, detail="Not authenticated. Please log in.")
        
#     result = await db.execute(
#         select(Order).where(Order.user_id == user.id).order_by(Order.created_at.desc()).options(
#             selectinload(Order.items)
#         )
#     )
#     orders = result.scalars().all()
    
#     return [
#         {
#             "id": str(o.id),
#             "order_number": o.order_number,
#             "total_amount": float(o.total_amount),
#             "order_status": o.order_status,
#             "payment_status": o.payment_status,
#             "created_at": o.created_at.isoformat(),
#             "items_count": len(o.items)
#         }
#         for o in orders
#     ]

# @router.get("/{order_number}")
# async def get_order(
#     order_number: str,
#     user: User = Depends(get_current_user),
#     db: AsyncSession = Depends(get_db)
# ):
#     result = await db.execute(
#         select(Order).where(Order.order_number == order_number, Order.user_id == user.id).options(
#             selectinload(Order.items)
#         )
#     )
#     order = result.scalar_one_or_none()
    
#     if not order:
#         raise HTTPException(status_code=404, detail="Order not found")
    
#     return {
#         "id": str(order.id),
#         "order_number": order.order_number,
#         "customer_name": order.customer_name,
#         "customer_email": order.customer_email,
#         "customer_phone": order.customer_phone,
#         "delivery_method": order.delivery_method,
#         "delivery_address": order.delivery_address,
#         "subtotal": float(order.subtotal),
#         "shipping_fee": float(order.shipping_fee),
#         "total_amount": float(order.total_amount),
#         "payment_status": order.payment_status,
#         "order_status": order.order_status,
#         "created_at": order.created_at.isoformat(),
#         "items": [
#             {
#                 "product_name": item.product_name,
#                 "product_price": float(item.product_price),
#                 "quantity": item.quantity,
#                 "total_price": float(item.total_price)
#             }
#             for item in order.items
#         ]
#     }


from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import os, uuid, shutil, asyncio
from datetime import datetime

from app.database import get_db
from app.models import Order, DeliveryPark, User
from app.schemas import OrderCreate
from app.services import get_current_user, create_order
from app.emails import send_admin_new_order_email_from_dict, send_admin_receipt_email_from_dict

router = APIRouter(prefix="/api/orders", tags=["Orders"])

@router.get("/parks")
async def get_delivery_parks(
    state: str = Query(..., description="State to filter parks"),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DeliveryPark).where(DeliveryPark.state.ilike(f"%{state}%"), DeliveryPark.is_active == True)
    )
    parks = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "city": p.city,
            "park_name": p.park_name,
            "fee": float(p.fee)
        } for p in parks
    ]

@router.post("/")
async def place_order(
    order_data: OrderCreate,
    user: Optional[User] = Depends(get_current_user),
    x_guest_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    order = await create_order(db, user, order_data, x_guest_token)
    
    # FIX: Extract data to a plain dict BEFORE the session closes. 
    # This prevents MissingGreenlet errors in background tasks.
    order_dict = {
        "order_number": order.order_number,
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
        "customer_phone": order.customer_phone,
        "delivery_method": order.delivery_method,
        "delivery_address": order.delivery_address,
        "city": order.city,
        "state": order.state,
        "total_amount": float(order.total_amount),
        "items": [
            {
                "product_name": item.product_name,
                "quantity": item.quantity,
                "total_price": float(item.total_price)
            } for item in order.items
        ]
    }
    
    # Send email using the safe dictionary, not the SQLAlchemy model
    asyncio.create_task(send_admin_new_order_email_from_dict(order_dict))
    
    return {
        "order_number": order.order_number,
        "total_amount": float(order.total_amount),
        "shipping_fee": float(order.shipping_fee),
        "bank_details": {
            "bank_name": os.getenv("BANK_NAME", "Providus Bank"),
            "account_name": os.getenv("BANK_ACCOUNT_NAME", "Sami's Scent Ltd"),
            "account_number": os.getenv("BANK_ACCOUNT_NUMBER", "1234567890")
        }
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
    
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg", "application/pdf"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image or PDF.")
    
    upload_dir = "static/uploads/receipts"
    os.makedirs(upload_dir, exist_ok=True)
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{order_number}_{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(upload_dir, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    receipt_url = f"/static/uploads/receipts/{filename}"
    
    order.payment_receipt_url = receipt_url
    order.payment_status = "submitted"
    order.order_status = "payment_under_review"
    order.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # FIX: Pass a safe dictionary to the background email task
    receipt_dict = {
        "order_number": order.order_number,
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
        "total_amount": float(order.total_amount),
        "receipt_url": receipt_url
    }
    asyncio.create_task(send_admin_receipt_email_from_dict(receipt_dict))
    
    return {"message": "Receipt uploaded successfully. We will verify your payment shortly.", "receipt_url": receipt_url}
