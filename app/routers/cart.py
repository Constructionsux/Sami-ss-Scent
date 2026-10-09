from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import Optional
from app.database import get_db
from app.models import Cart, CartItem, User
from app.schemas import CartItemAdd, CartResponse
from app.services import get_current_user, get_or_create_cart, add_to_cart

router = APIRouter(prefix="/api/cart", tags=["Cart"])

async def get_cart_from_request(
    user: Optional[User],
    x_guest_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if user:
        return await get_or_create_cart(db, user_id=user.id)
    elif x_guest_token:
        return await get_or_create_cart(db, guest_token=x_guest_token)
    else:
        raise HTTPException(status_code=400, detail="Authentication required or guest token missing")

@router.get("/")
async def get_cart(
    user: Optional[User] = Depends(get_current_user),
    x_guest_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    cart = await get_cart_from_request(user, x_guest_token, db)
    
    # Load items with products
    result = await db.execute(
        select(Cart).where(Cart.id == cart.id).options(
            selectinload(Cart.items).selectinload(CartItem.product)
        )
    )
    cart = result.scalar_one()
    
    return {
        "id": str(cart.id),
        "items": [
            {
                "id": str(item.id),
                "product_id": str(item.product_id),
                "quantity": item.quantity,
                "product": {
                    "id": str(item.product.id),
                    "name": item.product.name,
                    "price": float(item.product.price),
                    "image_url": item.product.image_url,
                    "stock_quantity": item.product.stock_quantity
                } if item.product else None
            }
            for item in cart.items
        ]
    }

@router.post("/items")
async def add_item(
    item_data: CartItemAdd,
    user: Optional[User] = Depends(get_current_user),
    x_guest_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    cart = await get_cart_from_request(user, x_guest_token, db)
    cart_item = await add_to_cart(db, cart.id, item_data.product_id, item_data.quantity)
    return {"message": "Item added to cart", "cart_item_id": str(cart_item.id)}

@router.patch("/items/{item_id}")
async def update_item_quantity(
    item_id: str,
    quantity: int,
    user: Optional[User] = Depends(get_current_user),
    x_guest_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    cart = await get_cart_from_request(user, x_guest_token, db)
    
    result = await db.execute(select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id))
    cart_item = result.scalar_one_or_none()
    
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    
    if quantity <= 0:
        await db.delete(cart_item)
    else:
        # Check stock
        result = await db.execute(select(CartItem.product).where(CartItem.id == item_id))
        product = result.scalar_one_or_none()
        if product.stock_quantity < quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock")
        cart_item.quantity = quantity
    
    await db.commit()
    return {"message": "Cart updated"}

@router.delete("/items/{item_id}")
async def remove_item(
    item_id: str,
    user: Optional[User] = Depends(get_current_user),
    x_guest_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    cart = await get_cart_from_request(user, x_guest_token, db)
    
    result = await db.execute(select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id))
    cart_item = result.scalar_one_or_none()
    
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    
    await db.delete(cart_item)
    await db.commit()
    return {"message": "Item removed from cart"}

@router.delete("/")
async def clear_cart(
    user: Optional[User] = Depends(get_current_user),
    x_guest_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    cart = await get_cart_from_request(user, x_guest_token, db)
    await db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))
    await db.commit()
    return {"message": "Cart cleared"}
