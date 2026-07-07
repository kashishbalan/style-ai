import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
from fastapi import Depends, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.embeddings import embedding_from_json, embedding_to_json, embed_image, preload_model
from app.models import Collection, Item
from app.schemas import (
    AddItemToCollection,
    CollectionCreate,
    CollectionDetailOut,
    CollectionOut,
    ItemOut,
)

IMAGES_DIR = Path(__file__).resolve().parent.parent / "data" / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    preload_model()
    yield


app = FastAPI(title="StyleAI API", lifespan=lifespan)

allow_origins = ["http://localhost:3000"]
if frontend_url := os.environ.get("FRONTEND_URL"):
    allow_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")


@app.get("/")
def root():
    return {"message": "StyleAI API — see /docs. The app UI is on http://localhost:3000"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload", response_model=ItemOut)
async def upload_item(
    file: UploadFile,
    category: str | None = None,
    db: Session = Depends(get_db),
):
    ext = Path(file.filename or "").suffix or ".jpg"
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest = IMAGES_DIR / stored_name

    contents = await file.read()
    dest.write_bytes(contents)

    item = Item(
        filename=file.filename or stored_name,
        image_path=f"/images/{stored_name}",
        category=category,
        embedding=embedding_to_json(embed_image(dest)),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/items", response_model=list[ItemOut])
def list_items(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    items = db.execute(
        select(Item).order_by(Item.id.desc()).offset(skip).limit(limit)
    ).scalars().all()
    return items


@app.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    image_file = IMAGES_DIR / Path(item.image_path).name
    image_file.unlink(missing_ok=True)

    db.delete(item)
    db.commit()


@app.get("/items/{item_id}/similar", response_model=list[ItemOut])
def similar_items(item_id: int, limit: int = 10, db: Session = Depends(get_db)):
    target = db.get(Item, item_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Item not found")
    if not target.embedding:
        raise HTTPException(status_code=409, detail="Item has no embedding yet")

    target_vec = embedding_from_json(target.embedding)

    candidates = db.execute(
        select(Item).where(Item.id != item_id, Item.embedding.is_not(None))
    ).scalars().all()

    scored = [
        (float(np.dot(target_vec, embedding_from_json(c.embedding))), c)
        for c in candidates
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in scored[:limit]]


def _to_collection_out(collection: Collection) -> CollectionOut:
    return CollectionOut(
        id=collection.id,
        name=collection.name,
        created_at=collection.created_at,
        item_count=len(collection.items),
        cover_image_path=collection.items[0].image_path if collection.items else None,
    )


@app.post("/collections", response_model=CollectionOut)
def create_collection(payload: CollectionCreate, db: Session = Depends(get_db)):
    collection = Collection(name=payload.name)
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return _to_collection_out(collection)


@app.get("/collections", response_model=list[CollectionOut])
def list_collections(db: Session = Depends(get_db)):
    collections = db.execute(
        select(Collection).order_by(Collection.id.desc())
    ).scalars().all()
    return [_to_collection_out(c) for c in collections]


@app.get("/collections/{collection_id}", response_model=CollectionDetailOut)
def get_collection(collection_id: int, db: Session = Depends(get_db)):
    collection = db.get(Collection, collection_id)
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection


@app.delete("/collections/{collection_id}", status_code=204)
def delete_collection(collection_id: int, db: Session = Depends(get_db)):
    collection = db.get(Collection, collection_id)
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    db.delete(collection)
    db.commit()


@app.post("/collections/{collection_id}/items", response_model=CollectionOut)
def add_item_to_collection(
    collection_id: int, payload: AddItemToCollection, db: Session = Depends(get_db)
):
    collection = db.get(Collection, collection_id)
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    item = db.get(Item, payload.item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    if item not in collection.items:
        collection.items.append(item)
        db.commit()
        db.refresh(collection)
    return _to_collection_out(collection)


@app.delete("/collections/{collection_id}/items/{item_id}", response_model=CollectionOut)
def remove_item_from_collection(
    collection_id: int, item_id: int, db: Session = Depends(get_db)
):
    collection = db.get(Collection, collection_id)
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    item = db.get(Item, item_id)
    if item is not None and item in collection.items:
        collection.items.remove(item)
        db.commit()
        db.refresh(collection)
    return _to_collection_out(collection)
