from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional
from app.database import get_db
from app.models import Product, Brand, Category

router = APIRouter(prefix="/api/products", tags=["Products"])

@router.get("/")
async def get_products(
    search: Optional[str] = None,
    brand_slug: Optional[str] = None,
    category_slug: Optional[str] = None,
    sort: str = "newest",
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    # FIX: Changed Product.category to Product.categories
    query = select(Product).where(Product.is_active == True).options(
        selectinload(Product.brand),
        selectinload(Product.categories)
    )
    
    if search:
        search_term = f"%{search}%"
        query = query.where(Product.name.ilike(search_term))
        
    if brand_slug:
        query = query.where(Product.brand.has(Brand.slug == brand_slug))
        
    if category_slug:
        query = query.where(Product.categories.any(Category.slug == category_slug))
        
    if sort == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort == "bestselling":
        query = query.order_by(Product.sales_count.desc())
    else:
        query = query.order_by(Product.created_at.desc())
        
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    
    result = await db.execute(query)
    products = result.scalars().all()
    
    return [
        {
            "id": str(p.id), "name": p.name, "slug": p.slug, 
            "description": p.description, "price": float(p.price), 
            "compare_at_price": float(p.compare_at_price) if p.compare_at_price else None,
            "stock_quantity": p.stock_quantity, "image_url": p.image_url,
            "brand": {"name": p.brand.name, "slug": p.brand.slug} if p.brand else None,
            "categories": [{"name": c.name, "slug": c.slug} for c in p.categories] if p.categories else []
        }
        for p in products
    ]

@router.get("/featured")
async def get_featured_products(db: AsyncSession = Depends(get_db)):
    query = select(Product).where(Product.is_active == True, Product.is_featured == True).options(
        selectinload(Product.brand)
    ).limit(3)
    result = await db.execute(query)
    products = result.scalars().all()
    return [
        {
            "id": str(p.id), "name": p.name, "description": p.description, 
            "image_url": p.image_url, "brand": {"name": p.brand.name} if p.brand else None
        } for p in products
    ]

@router.get("/new-arrivals")
async def get_new_arrivals(db: AsyncSession = Depends(get_db)):
    query = select(Product).where(Product.is_active == True).options(
        selectinload(Product.brand)
    ).order_by(Product.created_at.desc()).limit(8)
    result = await db.execute(query)
    products = result.scalars().all()
    return [
        {
            "id": str(p.id), "name": p.name, "price": float(p.price), 
            "image_url": p.image_url, "brand": {"name": p.brand.name} if p.brand else None
        } for p in products
    ]

@router.get("/bestsellers")
async def get_bestsellers(db: AsyncSession = Depends(get_db)):
    query = select(Product).where(Product.is_active == True).options(
        selectinload(Product.brand)
    ).order_by(Product.sales_count.desc()).limit(8)
    result = await db.execute(query)
    products = result.scalars().all()
    return [
        {
            "id": str(p.id), "name": p.name, "price": float(p.price), 
            "image_url": p.image_url, "brand": {"name": p.brand.name} if p.brand else None
        } for p in products
    ]

@router.get("/brands/list")
async def get_brands(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Brand).where(Brand.is_active == True))
    brands = result.scalars().all()
    return [{"name": b.name, "slug": b.slug, "logo_url": b.logo_url} for b in brands]

@router.get("/categories/list")
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).where(Category.is_active == True))
    categories = result.scalars().all()
    return [{"name": c.name, "slug": c.slug, "image_url": c.image_url} for c in categories]
