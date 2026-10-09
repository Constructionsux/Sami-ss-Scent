import os
import asyncio
import resend
from dotenv import load_dotenv

load_dotenv()
resend.api_key = os.getenv("RESEND_API_KEY")

def get_welcome_html() -> str:
    """Clean, premium email template. No discounts."""
    return """
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #FAFAFA; color: #1A1A1A;">
        <div style="padding: 40px 20px; text-align: center; border-bottom: 1px solid #E5E5E5;">
            <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 600; margin: 0; color: #1A1A1A;">
                Sami's <span style="color: #8C735A; font-style: italic;">Scent</span>
            </h1>
        </div>
        
        <div style="padding: 40px 30px; background-color: #FFFFFF; border: 1px solid #E5E5E5; border-radius: 8px; margin: 20px;">
            <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; margin-top: 0; margin-bottom: 20px; color: #1A1A1A;">Welcome to the Inner Circle.</h2>
            
            <p style="font-size: 16px; line-height: 1.6; color: #4A4A5A; margin-bottom: 20px;">
                Thank you for joining us. At Sami's Scent, we believe fragrance is the most intense form of memory. 
            </p>
            <p style="font-size: 16px; line-height: 1.6; color: #4A4A5A; margin-bottom: 20px;">
                As a subscriber, you will be the first to experience our new fragrance launches, discover the craftsmanship behind our blends, and receive exclusive brand stories.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://samisscent.com" style="background-color: #8C735A; color: #FFFFFF; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: 500; font-size: 14px; letter-spacing: 0.5px;">
                    Explore the Collection
                </a>
            </div>
        </div>

        <div style="padding: 20px; text-align: center; font-size: 12px; color: #999999;">
            <p>&copy; 2026 Sami's Scent. All rights reserved.</p>
            <p style="margin-top: 10px;">
                <a href="#" style="color: #8C735A; text-decoration: underline;">Unsubscribe</a> • 
                <a href="#" style="color: #8C735A; text-decoration: underline;">Privacy Policy</a>
            </p>
        </div>
    </div>
    """

async def send_welcome_email(to_email: str):
    """Sends email asynchronously to avoid blocking the API response."""
    params = {
        "from": os.getenv("RESEND_FROM_EMAIL", "Sami's Scent <onboarding@resend.dev>"),
        "to": to_email,
        "subject": "Welcome to Sami's Scent",
        "html": get_welcome_html()
    }
    # Run synchronous Resend SDK in a background thread
    await asyncio.to_thread(resend.Emails.send, params)
