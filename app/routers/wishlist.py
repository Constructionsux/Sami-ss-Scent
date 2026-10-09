from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Wishlist, WishlistItem, User
from app.schemas import WishlistItemAdd
from app.services import get_current_user, get_or_create_wishlist

router = APIRouter(prefix="/api/wishlist", tags=["Wishlist"])

@router.get("/")
async def get_wishlist(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    wishlist = await get_or_create_wishlist(db, user.id)
    
    result = await db.execute(
        select(Wishlist).where(Wishlist.id == wishlist.id).options(
            selectinload(Wishlist.items).selectinload(WishlistItem.product)
        )
    )
    wishlist = result.scalar_one()
    
    return {
        "id": str(wishlist.id),
        "items": [
            {
                "id": str(item.id),
                "product_id": str(item.product_id),
                "product": {
                    "id": str(item.product.id),
                    "name": item.product.name,
                    "price": float(item.product.price),
                    "image_url": item.product.image_url
                } if item.product else None
            }
            for item in wishlist.items
        ]
    }

@router.post("/items")
async def add_to_wishlist(
    item_data: WishlistItemAdd,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    wishlist = await get_or_create_wishlist(db, user.id)
    
    # Check if already in wishlist
    result = await db.execute(
        select(WishlistItem).where(WishlistItem.wishlist_id == wishlist.id, WishlistItem.product_id == item_data.product_id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Product already in wishlist")
    
    wishlist_item = WishlistItem(wishlist_id=wishlist.id, product_id=item_data.product_id)
    db.add(wishlist_item)
    await db.commit()
    
    return {"message": "Added to wishlist"}

@router.delete("/items/{product_id}")
async def remove_from_wishlist(
    product_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    wishlist = await get_or_create_wishlist(db, user.id)
    
    result = await db.execute(
        select(WishlistItem).where(WishlistItem.wishlist_id == wishlist.id, WishlistItem.product_id == product_id)
    )
    wishlist_item = result.scalar_one_or_none()
    
    if not wishlist_item:
        raise HTTPException(status_code=404, detail="Product not in wishlist")
    
    await db.delete(wishlist_item)
    await db.commit()
    
    return {"message": "Removed from wishlist"}
