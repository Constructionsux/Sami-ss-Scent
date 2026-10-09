from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class SubscribeRequest(BaseModel):
    email: EmailStr

class SubscriberResponse(BaseModel):
    id: UUID
    user_id: UUID
    email: str
    status: str
    subscribed_at: datetime
    unsubscribed_at: Optional[datetime]

    class Config:
        from_attributes = True

class PaginatedSubscribers(BaseModel):
    total: int
    page: int
    limit: int
    data: List[SubscriberResponse]
