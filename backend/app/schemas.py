from datetime import datetime

from pydantic import BaseModel


class ItemOut(BaseModel):
    id: int
    filename: str
    image_path: str
    category: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class CollectionCreate(BaseModel):
    name: str


class CollectionOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    item_count: int
    cover_image_path: str | None

    class Config:
        from_attributes = True


class CollectionDetailOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    items: list[ItemOut]

    class Config:
        from_attributes = True


class AddItemToCollection(BaseModel):
    item_id: int
