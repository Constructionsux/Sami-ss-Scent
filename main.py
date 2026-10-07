"""
Sami's Scent — FastAPI Backend
Handles static files, API routes, and Resend email integration
"""

import os
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Sami's Scent",
    description="Luxury Perfume Store API",
    version="1.0.0"
)

# Paths
BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


# ---------- Models ----------
class SubscribeRequest(BaseModel):
    email: EmailStr


# ---------- Resend Integration ----------
def get_resend_client():
    """Lazy import and initialize Resend client"""
    try:
        import resend
        api_key = os.getenv("RESEND_API_KEY")
        if not api_key:
            raise ValueError("RESEND_API_KEY not found in environment variables")
        resend.api_key = api_key
        return resend
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Resend package not installed. Run: pip install resend"
        )


# ---------- Routes ----------
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Serve the main home page"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/api/subscribe")
async def subscribe(data: SubscribeRequest):
    """
    Handle newsletter subscription via Resend
    Sends a welcome email to the subscriber
    """
    try:
        resend = get_resend_client()

        from_email = os.getenv("RESEND_FROM_EMAIL", "Sami's Scent <onboarding@resend.dev>")
        admin_email = os.getenv("ADMIN_EMAIL", "")

        # Send welcome email to subscriber
        params = {
            "from": from_email,
            "to": data.email,
            "subject": "✨ Welcome to Sami's Scent Family!",
            "html": f"""
            <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <h1 style="color: #C9A96E; font-size: 2rem;">✦ Sami's Scent ✦</h1>
                    <p style="color: #666; font-style: italic;">Luxury Fragrances, Timeless Elegance</p>
                </div>

                <div style="background: #FDFBF7; padding: 2rem; border-radius: 12px; border: 1px solid #E8D5A3;">
                    <h2 style="color: #1A1A2E;">Welcome to the Family! 🎉</h2>
                    <p style="color: #4A4A5A; line-height: 1.8;">
                        Thank you for subscribing to <strong>Sami's Scent</strong>!
                    </p>
                    <p style="color: #4A4A5A; line-height: 1.8;">
                        As a welcome gift, here's <strong>10% OFF</strong> your first order.
                        Use code: <span style="background: #C9A96E; color: white; padding: 0.2rem 0.8rem; border-radius: 4px; font-weight: bold;">WELCOME10</span>
                    </p>
                    <p style="color: #4A4A5A; line-height: 1.8;">
                        You'll be the first to know about:
                    </p>
                    <ul style="color: #4A4A5A; line-height: 2;">
                        <li>✨ New fragrance launches</li>
                        <li>🔥 Flash sales & exclusive discounts</li>
                        <li>💎 VIP early access to limited editions</li>
                    </ul>
                    <p style="color: #4A4A5A; line-height: 1.8;">
                        Stay scented, stay elegant.
                    </p>
                </div>

                <div style="text-align: center; margin-top: 2rem; color: #8A8A9A; font-size: 0.85rem;">
                    <p>© 2026 Sami's Scent. All rights reserved.</p>
                    <p>
                        <a href="https://instagram.com/samisscent" style="color: #C9A96E;">Instagram</a> •
                        <a href="https://t.me/samisscent" style="color: #C9A96E;">Telegram</a> •
                        <a href="https://wa.me/2348000000000" style="color: #C9A96E;">WhatsApp</a>
                    </p>
                </div>
            </div>
            """
        }

        resend.Emails.send(params)

        # Optionally notify admin
        if admin_email:
            admin_params = {
                "from": from_email,
                "to": admin_email,
                "subject": f"📧 New Subscriber: {data.email}",
                "html": f"""
                <div style="font-family: Arial, sans-serif; padding: 1rem;">
                    <h2>New Newsletter Subscriber</h2>
                    <p><strong>Email:</strong> {data.email}</p>
                    <p>A new user has subscribed to Sami's Scent newsletter.</p>
                </div>
                """
            }
            resend.Emails.send(admin_params)

        return {
            "status": "success",
            "message": "🎉 Welcome to Sami's Scent family! Check your email for a special gift."
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Subscription error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process subscription. Please try again later."
        )


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": "Sami's Scent",
        "version": "1.0.0"
    }


# ---------- Run with uvicorn ----------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
