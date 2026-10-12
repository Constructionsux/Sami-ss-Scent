import os
import asyncio
import resend
from app.models import Order

resend.api_key = os.getenv("RESEND_API_KEY")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@samisscent.com")
FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "Sami's Scent <onboarding@resend.dev>")

def get_order_html(order: Order) -> str:
    items_html = "".join([
        f"<tr><td style='padding: 8px; border-bottom: 1px solid #eee;'>{item.product_name}</td>"
        f"<td style='padding: 8px; border-bottom: 1px solid #eee; text-align: center;'>{item.quantity}</td>"
        f"<td style='padding: 8px; border-bottom: 1px solid #eee; text-align: right;'>₦{float(item.total_price):,.2f}</td></tr>"
        for item in order.items
    ])

    return f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #8C735A; text-align: center;">New Order Placed: #{order.order_number}</h2>
        <p><strong>Customer:</strong> {order.customer_name} ({order.customer_email})</p>
        <p><strong>Phone:</strong> {order.customer_phone}</p>
        <p><strong>Delivery Method:</strong> {order.delivery_method.upper()}</p>
        <p><strong>Address:</strong> {order.delivery_address}, {order.city}, {order.state}</p>
        
        <h3>Order Items</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
                <tr style="background: #f4f4f4;">
                    <th style="padding: 8px; text-align: left;">Product</th>
                    <th style="padding: 8px; text-align: center;">Qty</th>
                    <th style="padding: 8px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>{items_html}</tbody>
        </table>
        
        <div style="text-align: right; font-size: 1.2rem; font-weight: bold;">
            Total: ₦{float(order.total_amount):,.2f}
        </div>
    </div>
    """

def get_receipt_html(order: Order, receipt_url: str) -> str:
    return f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #2d6a4f; text-align: center;">New Payment Receipt Uploaded</h2>
        <p><strong>Order Number:</strong> #{order.order_number}</p>
        <p><strong>Customer:</strong> {order.customer_name} ({order.customer_email})</p>
        <p><strong>Amount:</strong> {float(order.total_amount):,.2f}</p>
        
        <h3>View Receipt</h3>
        <a href="{receipt_url}" target="_blank" style="display: inline-block; background: #8C735A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Receipt Image
        </a>
        <p style="font-size: 0.8rem; color: #666; margin-top: 10px;">Please verify the transfer in your bank account before confirming the order.</p>
    </div>
    """

async def send_admin_new_order_email(order: Order):
    try:
        params = {
            "from": FROM_EMAIL,
            "to": [ADMIN_EMAIL],
            "subject": f"🛍️ New Order: #{order.order_number}",
            "html": get_order_html(order)
        }
        await asyncio.to_thread(resend.Emails.send, params)
    except Exception as e:
        print(f"Failed to send admin order email: {e}")

async def send_admin_receipt_email(order: Order, receipt_url: str):
    try:
        params = {
            "from": FROM_EMAIL,
            "to": [ADMIN_EMAIL],
            "subject": f" Receipt Uploaded: #{order.order_number}",
            "html": get_receipt_html(order, receipt_url)
        }
        await asyncio.to_thread(resend.Emails.send, params)
    except Exception as e:
        print(f"Failed to send admin receipt email: {e}")
