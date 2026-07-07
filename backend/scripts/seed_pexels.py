"""Seed the backend with real outfit photos from Pexels.

Usage:
    PEXELS_API_KEY=... API_URL=https://your-backend python scripts/seed_pexels.py

API_URL defaults to http://localhost:8000. Get a free key at pexels.com/api.
"""

import json
import os
import time
import urllib.parse
import urllib.request

PEXELS_API_KEY = os.environ["PEXELS_API_KEY"]
API_URL = os.environ.get("API_URL", "http://localhost:8000")
PER_QUERY = int(os.environ.get("PER_QUERY", "10"))

QUERIES = {
    "street style outfit": "street style",
    "old money aesthetic outfit": "old money",
    "casual outfit women": "casual",
    "formal outfit fashion": "formal",
    "denim outfit fashion": "denim",
    "summer dress fashion": "summer",
    "winter coat outfit fashion": "winter",
    "streetwear fashion": "streetwear",
    "business casual outfit": "business casual",
    "athleisure outfit fashion": "athleisure",
    "minimalist outfit fashion": "minimalist",
    "boho outfit fashion": "boho",
}


USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def pexels_search(query: str, per_page: int) -> list[dict]:
    url = f"https://api.pexels.com/v1/search?query={urllib.parse.quote(query)}&per_page={per_page}"
    req = urllib.request.Request(
        url, headers={"Authorization": PEXELS_API_KEY, "User-Agent": USER_AGENT}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())["photos"]


def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def upload(image_bytes: bytes, filename: str, category: str) -> dict:
    boundary = "----styleaiseed"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode() + image_bytes + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"{API_URL}/upload?category={urllib.parse.quote(category)}",
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def main() -> None:
    total = 0
    for query, category in QUERIES.items():
        try:
            photos = pexels_search(query, PER_QUERY)
        except Exception as e:
            print(f"search failed for {query!r}: {e}")
            continue

        for photo in photos:
            src = photo["src"]["medium"]
            try:
                image_bytes = download(src)
                result = upload(image_bytes, f"pexels-{photo['id']}.jpeg", category)
                total += 1
                print(f"[{total}] {category}: item {result['id']}")
            except Exception as e:
                print(f"upload failed for photo {photo['id']}: {e}")
            time.sleep(0.2)

    print(f"Done. Seeded {total} items.")


if __name__ == "__main__":
    main()
