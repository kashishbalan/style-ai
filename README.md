# StyleAI

StyleAI is a full-stack Pinterest-style outfit discovery app for exploring
content-based image similarity in fashion. It uses CLIP image embeddings to
estimate visual similarity between outfit photos, presents the results in a
Next.js feed, stores items and embeddings in SQLite, and lets users organize
saved looks into Pinterest-style collections (boards).

The project is designed as a learning and software-engineering portfolio
piece exploring multimodal embeddings and vector similarity search.
Similarity rankings come from a general-purpose vision-language model rather
than fashion-specific training, so results are approximate, not authoritative
style advice.

**Live demo:** https://frontend-beige-six-40.vercel.app
**API:** https://kashbalan-style-ai-backend.hf.space
(backend runs on a free, disk-less tier — uploaded data resets when it
restarts or sleeps from inactivity)

## Features

- Upload outfit photos; each is embedded with CLIP on ingest
- Rank stored items by cosine similarity to find visually similar looks
- Organize items into Pinterest-style collections (boards), with add/remove
- Filter the feed by category
- Drag-and-drop upload with inline success/error feedback
- Seed a real demo catalog from the Pexels API across a dozen style
  categories (streetwear, old money, minimalist, boho, athleisure, ...)
- Persist items, categories, embeddings, and collections in SQLite
- Serve uploaded images statically from the API
- Deploy backend as a Docker container (Hugging Face Spaces) and frontend
  to Vercel

## Tech Stack

**Backend**
- Python 3.13
- FastAPI and Uvicorn
- SQLAlchemy 2
- SQLite
- Pydantic 2
- Transformers (CLIP) and PyTorch (CPU)
- Pillow, NumPy

**Frontend**
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4

**Infrastructure**
- Docker
- Hugging Face Spaces (backend hosting)
- Vercel (frontend hosting)

## Architecture

```
Next.js + Tailwind frontend
        |
        | HTTP / JSON
        v
FastAPI application
  |-- upload + embedding route
  |-- items and similarity routes
  |-- collections routes
        |
        v
      SQLite
        |
        v
CLIP (transformers + torch) -- image embeddings
```

The backend separates HTTP routing from the embedding/ML logic:
- `backend/app/main.py` contains FastAPI routes, upload handling, and
  similarity/collections endpoints.
- `backend/app/embeddings.py` contains CLIP model loading and image
  embedding.
- `backend/app/models.py` / `schemas.py` contain the SQLAlchemy models
  (`Item`, `Collection`) and Pydantic schemas.
- `frontend/src/app/` contains the Next.js feed/collections UI;
  `frontend/src/lib/api.ts` is the API client.

Database tables are created automatically when the FastAPI application
starts.

## CLIP Similarity Search

For each uploaded image, StyleAI:
1. Loads the image and preprocesses it with the CLIP processor.
2. Computes image features with `openai/clip-vit-base-patch32`.
3. L2-normalizes the resulting vector.
4. Stores the vector as JSON alongside the item.

For a similarity query, StyleAI:
1. Loads the target item's stored embedding.
2. Computes cosine similarity (dot product of normalized vectors) against
   every other item's embedding.
3. Ranks items by similarity score, descending.
4. Returns the top N matches.

This is brute-force search — fine at the hundreds-to-low-thousands scale,
but would need a proper vector index (FAISS, pgvector) for larger catalogs.

## Install Without Docker

Prerequisites: Python 3.13, Node.js 20+

**1. Start the backend**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- API: http://127.0.0.1:8000
- Interactive docs: http://127.0.0.1:8000/docs

First startup downloads the CLIP weights (~600MB) if not already cached.

**2. Start the frontend**

In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:3000. The frontend defaults to
`http://localhost:8000`; to use another backend, set
`NEXT_PUBLIC_API_URL` in `frontend/.env.local`.

## Run the Backend with Docker

```bash
cd backend
docker build -t style-ai-backend .
docker run -p 7860:7860 style-ai-backend
```
Then point the frontend at it: `NEXT_PUBLIC_API_URL=http://localhost:7860 npm run dev`.

There's no `docker-compose.yml` yet — the frontend isn't containerized
(it's deployed straight to Vercel), so this only builds the backend.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | API status message |
| GET | `/health` | Health check |
| POST | `/upload` | Upload an image (`file`, optional `category`); computes and stores its CLIP embedding |
| GET | `/items` | List stored items, newest first |
| DELETE | `/items/<id>` | Delete an item and its image file |
| GET | `/items/<id>/similar?limit=` | Ranked list of visually similar items |
| POST | `/collections` | Create a collection (`{name}`) |
| GET | `/collections` | List collections with item count + cover image |
| GET | `/collections/<id>` | Collection detail with its items |
| POST | `/collections/<id>/items` | Save an item to a collection (`{item_id}`) |
| DELETE | `/collections/<id>/items/<item_id>` | Remove an item from a collection |
| DELETE | `/collections/<id>` | Delete a collection |
| GET | `/images/<name>` | Static image serving |

Example upload request:
```bash
curl -X POST "http://127.0.0.1:8000/upload?category=streetwear" \
  -F "file=@outfit.jpg"
```

## Frontend Usage

- Drag an image onto the upload zone, or click "Upload image" (optionally
  set a category first)
- Click any item's image (or its "Find similar" link) to see visually
  similar looks ranked by CLIP similarity
- Filter the feed by category using the chips
- Hover an item and click the bookmark icon to save it to a collection, or
  create a new one inline
- Switch to the Collections tab to browse boards and remove saved items

## Seeding a Demo Catalog

Find-similar needs a real catalog to be meaningful — a database of one or
two items has nothing to rank against. To seed one from Pexels:

```bash
cd backend
export PEXELS_API_KEY=your_free_key   # from pexels.com/api
export API_URL=http://127.0.0.1:8000  # or a deployed backend URL
python scripts/seed_pexels.py
```
This pulls diverse outfit photos across a dozen style categories and
uploads them through the API, so each gets a real CLIP embedding.

To load your own images instead, drop them into
`backend/data/seed_images/` and run `python scripts/seed.py`. If you ever
add items some other way, backfill missing vectors with
`python scripts/backfill_embeddings.py`.


