from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models import User
from app.services import verify_password, create_access_token

router = APIRouter(prefix="/api/admin", tags=["Admin Auth"])

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str

@router.post("/login")
async def admin_login(data: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    
    # Include role in token to easily verify admin status later
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}
