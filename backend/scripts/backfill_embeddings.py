"""Compute embeddings for any items that don't have one yet.

Usage:
    python scripts/backfill_embeddings.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.embeddings import embed_image, embedding_to_json  # noqa: E402
from app.models import Item  # noqa: E402

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def backfill() -> None:
    db = SessionLocal()
    items = db.execute(select(Item).where(Item.embedding.is_(None))).scalars().all()

    for item in items:
        # item.image_path looks like "/images/<name>", served from data/images/<name>
        image_path = DATA_DIR / item.image_path.lstrip("/")
        item.embedding = embedding_to_json(embed_image(image_path))
        print(f"Embedded item {item.id} ({item.filename})")

    db.commit()
    db.close()
    print(f"Backfilled {len(items)} item(s)")


if __name__ == "__main__":
    backfill()
