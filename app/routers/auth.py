from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
import os
from jose import jwt, JWTError

from app.database import get_db
from app.models import User
from app.services import create_access_token, create_login_token, send_login_email, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class EmailRequest(BaseModel):
    email: EmailStr

class VerifyTokenRequest(BaseModel):
    token: str

# --- FIX: Added the missing /me endpoint ---
@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role
    }

@router.post("/request-login")
async def request_login(data: EmailRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user:
        user = User(
            email=data.email, 
            full_name=data.email.split('@')[0], 
            role="customer"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    login_token = create_login_token(str(user.id))
    await send_login_email(data.email, login_token)
    
    return {"message": "If an account exists with this email, a secure login link has been sent."}

@router.post("/verify-login")
async def verify_login(data: VerifyTokenRequest, db: AsyncSession = Depends(get_db)):
    SECRET_KEY = os.getenv("SECRET_KEY", "your-fallback-secret-key")
    ALGORITHM = os.getenv("ALGORITHM", "HS256")
    
    try:
        payload = jwt.decode(data.token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "login":
            raise HTTPException(status_code=400, detail="Invalid token purpose")
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid token")
            
        access_token = create_access_token(data={"sub": user_id})
        
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name
            }
        }
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired login link")
