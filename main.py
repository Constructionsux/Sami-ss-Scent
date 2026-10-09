import os
from fastapi import FastAPI, Request, HTTPException, Depends, Header, Query
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from pathlib import Path
from dotenv import load_dotenv

# Import local modules
from backend.models import Base
from backend.schemas import SubscribeRequest, PaginatedSubscribers
from backend.services import SubscriptionService

load_dotenv()

app = FastAPI(title="Sami's Scent API", version="2.0.0")

BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

# Database Setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost:5432/samis_scent")
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# --- Security: Admin Auth Dependency ---
async def verify_admin_token(x_admin_token: str = Header(None)):
    secret = os.getenv("ADMIN_API_SECRET", "super-secret-admin-key")
    if x_admin_token != secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

# --- Routes ---
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/subscribe")
async def subscribe(data: SubscribeRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await SubscriptionService.subscribe(db, data)
    except Exception as e:
        print(f"Subscription error: {e}")
        raise HTTPException(status_code=500, detail="An error occurred. Please try again later.")

@app.get("/api/admin/subscribers", response_model=PaginatedSubscribers)
async def admin_get_subscribers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query("active", regex="^(active|unsubscribed|all)$"),
    search: str = Query(""),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    return await SubscriptionService.get_subscribers(db, page, limit, status, search)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        # In production, use Alembic for migrations. 
        # This is here for initial setup convenience.
        await conn.run_sync(Base.metadata.create_all)
