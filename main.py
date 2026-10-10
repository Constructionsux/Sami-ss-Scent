# import os
# from fastapi import FastAPI, Request, HTTPException, Depends, Header, Query
# from fastapi.staticfiles import StaticFiles
# from fastapi.templating import Jinja2Templates
# from fastapi.responses import HTMLResponse
# from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
# from pathlib import Path
# from dotenv import load_dotenv

# # Import local modules
# from backend.models import Base
# from backend.schemas import SubscribeRequest, PaginatedSubscribers
# from backend.services import SubscriptionService

# load_dotenv()

# app = FastAPI(title="Sami's Scent API", version="2.0.0")

# BASE_DIR = Path(__file__).resolve().parent
# app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
# templates = Jinja2Templates(directory=BASE_DIR / "templates")

# # Database Setup
# DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost:5432/samis_scent")
# engine = create_async_engine(DATABASE_URL, echo=False)
# AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# async def get_db():
#     async with AsyncSessionLocal() as session:
#         yield session

# # --- Security: Admin Auth Dependency ---
# async def verify_admin_token(x_admin_token: str = Header(None)):
#     secret = os.getenv("ADMIN_API_SECRET", "super-secret-admin-key")
#     if x_admin_token != secret:
#         raise HTTPException(status_code=401, detail="Unauthorized")

# # --- Routes ---
# @app.get("/", response_class=HTMLResponse)
# async def home(request: Request):
#     return templates.TemplateResponse("index.html", {"request": request})

# @app.post("/api/subscribe")
# async def subscribe(data: SubscribeRequest, db: AsyncSession = Depends(get_db)):
#     try:
#         return await SubscriptionService.subscribe(db, data)
#     except Exception as e:
#         print(f"Subscription error: {e}")
#         raise HTTPException(status_code=500, detail="An error occurred. Please try again later.")

# @app.get("/api/admin/subscribers", response_model=PaginatedSubscribers)
# async def admin_get_subscribers(
#     page: int = Query(1, ge=1),
#     limit: int = Query(20, ge=1, le=100),
#     status: str = Query("active", regex="^(active|unsubscribed|all)$"),
#     search: str = Query(""),
#     db: AsyncSession = Depends(get_db),
#     _: bool = Depends(verify_admin_token)
# ):
#     return await SubscriptionService.get_subscribers(db, page, limit, status, search)

# @app.on_event("startup")
# async def startup():
#     async with engine.begin() as conn:
#         # In production, use Alembic for migrations. 
#         # This is here for initial setup convenience.
#         await conn.run_sync(Base.metadata.create_all)
from fastapi import FastAPI, Request, Depends, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path

from app.database import engine, Base, get_db
from app.routers import auth, products, cart, wishlist, orders
from app.schemas import SubscribeRequest, PaginatedSubscribers
from app.services import SubscriptionService, verify_admin_token

# ============================================================
# App Initialization
# ============================================================
app = FastAPI(
    title="Sami's Scent",
    description="Luxury Fragrance Store & E-Commerce Platform",
    version="2.0.0"
)

# ============================================================
# Static Files & Templates
# ============================================================
BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

# ============================================================
# Include Routers (E-Commerce)
# ============================================================
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(cart.router)
app.include_router(wishlist.router)
app.include_router(orders.router)

# ============================================================
# Newsletter / Subscription Routes (from earlier implementation)
# ============================================================
@app.post("/api/subscribe")
async def subscribe(data: SubscribeRequest, db: AsyncSession = Depends(get_db)):
    """Handle newsletter subscription via Resend"""
    try:
        return await SubscriptionService.subscribe(data,db)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Subscription error: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred. Please try again later."
        )


@app.get("/api/admin/subscribers", response_model=PaginatedSubscribers)
async def admin_get_subscribers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query("active", regex="^(active|unsubscribed|all)$"),
    search: str = Query(""),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Admin endpoint to retrieve newsletter subscribers"""
    return await SubscriptionService.get_subscribers(db, page, limit, status, search)


# ============================================================
# Health Check
# ============================================================
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": "Sami's Scent",
        "version": "2.0.0"
    }


# ============================================================
# Page Routes
# ============================================================

# Landing Page (Original)
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Shopping Homepage
@app.get("/shop-home", response_class=HTMLResponse)
async def shop_home(request: Request):
    return templates.TemplateResponse("shop_home.html", {"request": request})

# Shop / Catalogue
@app.get("/shop", response_class=HTMLResponse)
async def shop(request: Request):
    return templates.TemplateResponse("shop.html", {"request": request})

# Product Detail
@app.get("/product/{product_id}", response_class=HTMLResponse)
async def product_detail(request: Request, product_id: str):
    return templates.TemplateResponse(
        "product_detail.html",
        {"request": request, "product_id": product_id}
    )

# Cart
@app.get("/cart", response_class=HTMLResponse)
async def cart_page(request: Request):
    return templates.TemplateResponse("cart.html", {"request": request})

# Checkout
@app.get("/checkout", response_class=HTMLResponse)
async def checkout_page(request: Request):
    return templates.TemplateResponse("checkout.html", {"request": request})

# Login / Register
@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

# Wishlist
@app.get("/wishlist", response_class=HTMLResponse)
async def wishlist_page(request: Request):
    return templates.TemplateResponse("wishlist.html", {"request": request})


# ============================================================
# Startup Event (Single, consolidated)
# ============================================================
@app.on_event("startup")
async def startup():
    """Create database tables on startup.
    
    Note: In production, use Alembic for migrations instead.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created / verified.")
    print("🚀 Sami's Scent is running at http://localhost:8000")


# ============================================================
# Run with Uvicorn (for local development)
# ============================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )


