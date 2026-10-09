from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime

# User schemas
class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: UUID
    full_name: str
    email: str
    phone: Optional[str]
    role: str
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# Product schemas
class ProductResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    price: float
    compare_at_price: Optional[float]
    stock_quantity: int
    image_url: Optional[str]
    is_featured: bool
    rating: float
    sales_count: int
    brand: Optional[dict]
    category: Optional[dict]
    
    class Config:
        from_attributes = True

# Cart schemas
class CartItemAdd(BaseModel):
    product_id: UUID
    quantity: int = 1

class CartItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    quantity: int
    product: Optional[ProductResponse]
    
    class Config:
        from_attributes = True

class CartResponse(BaseModel):
    id: UUID
    items: List[CartItemResponse]
    
    class Config:
        from_attributes = True

# Order schemas
class OrderCreate(BaseModel):
    customer_name: str
    customer_email: EmailStr
    customer_phone: str
    delivery_method: str
    delivery_address: str
    city: Optional[str]
    state: Optional[str]
    guest_token: Optional[str]

class OrderItemResponse(BaseModel):
    id: UUID
    product_name: str
    product_price: float
    quantity: int
    total_price: float
    
    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: UUID
    order_number: str
    customer_name: str
    customer_email: str
    customer_phone: str
    delivery_method: str
    delivery_address: str
    subtotal: float
    shipping_fee: float
    total_amount: float
    payment_status: str
    order_status: str
    items: List[OrderItemResponse]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Wishlist schemas
class WishlistItemAdd(BaseModel):
    product_id: UUID

class WishlistItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    product: Optional[ProductResponse]
    
    class Config:
        from_attributes = True

class WishlistResponse(BaseModel):
    id: UUID
    items: List[WishlistItemResponse]
    
    class Config:
        from_attributes = True
