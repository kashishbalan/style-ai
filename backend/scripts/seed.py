"""Bulk-load images from data/seed_images into the DB and data/images.

Usage:
    python scripts/seed.py [category]

Drop images into backend/data/seed_images/ first (subfolders are treated
as category names if no category arg is given).
"""

import shutil
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import Item  # noqa: E402

SEED_DIR = Path(__file__).resolve().parent.parent / "data" / "seed_images"
IMAGES_DIR = Path(__file__).resolve().parent.parent / "data" / "images"
VALID_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def seed(default_category: str | None = None) -> None:
    Base.metadata.create_all(bind=engine)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    db = SessionLocal()
    count = 0
    for path in SEED_DIR.rglob("*"):
        if path.suffix.lower() not in VALID_EXT:
            continue

        category = default_category or (
            path.parent.name if path.parent != SEED_DIR else None
        )
        stored_name = f"{uuid.uuid4().hex}{path.suffix.lower()}"
        shutil.copy(path, IMAGES_DIR / stored_name)

        db.add(
            Item(
                filename=path.name,
                image_path=f"/images/{stored_name}",
                category=category,
            )
        )
        count += 1

    db.commit()
    db.close()
    print(f"Seeded {count} items from {SEED_DIR}")


if __name__ == "__main__":
    arg_category = sys.argv[1] if len(sys.argv) > 1 else None
    seed(arg_category)
