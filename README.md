# StyleAI

A tiny Pinterest-style outfit discovery app. Upload outfit photos, find
visually similar looks via CLIP embeddings, and save favorites into
Pinterest-style collections (boards).

## Architecture

```
Next.js (React, Tailwind)        FastAPI backend
  feed / collections UI   <--->    REST API
        |                            |
        |                     SQLite (items, collections)
        |                            |
        +------ /images/* ---- CLIP embeddings (transformers + torch)
```

- **Frontend**: Next.js App Router, client-side data fetching, Tailwind for
  styling, no auth/SSR complexity — this is a local demo, not a deployed
  multi-tenant product.
- **Backend**: FastAPI + SQLAlchemy + SQLite. Every uploaded image is embedded
  with `openai/clip-vit-base-patch32` on upload; "find similar" is brute-force
  cosine similarity over stored embeddings (fine at this scale — hundreds to
  low thousands of items).
- **Collections**: a many-to-many join table (`collection_items`) between
  `items` and `collections`, mirroring Pinterest boards.

## Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

First startup downloads the CLIP weights (`openai/clip-vit-base-patch32`,
~600MB) if not already cached.

Endpoints:
- `POST /upload` — multipart form upload (`file`, optional `category`); embeds
  the image with CLIP and stores the vector alongside it
- `GET /items` — list stored items, newest first
- `DELETE /items/<id>` — delete an item (and its image file)
- `GET /items/<id>/similar?limit=` — ranked list of visually similar items
- `POST /collections` `{name}` — create a collection
- `GET /collections` — list collections with item count + cover image
- `GET /collections/<id>` — collection detail with its items
- `POST /collections/<id>/items` `{item_id}` — save an item to a collection
- `DELETE /collections/<id>/items/<item_id>` — remove an item from a collection
- `DELETE /collections/<id>` — delete a collection
- `GET /images/<name>` — static image serving
- `GET /health` — health check

To bulk-load sample images: drop files into `backend/data/seed_images/`
(optionally in subfolders named by category), then:

```bash
python scripts/seed.py
```

If you add items some other way (or upgrade from a version without
embeddings), backfill any missing vectors:

```bash
python scripts/backfill_embeddings.py
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:3000, talks to the API on http://localhost:8000
(configurable via `frontend/.env.local`, `NEXT_PUBLIC_API_URL`).

## Deploying (not done yet — do this yourself when ready)

This has only been run locally so far. To put it online:

**Backend** — needs a host that can run a long-lived Python process with
enough memory/disk for the CLIP model (~600MB) and persistent storage for
`data/app.db` + `data/images/` (SQLite + local files won't survive on
ephemeral/serverless platforms). Reasonable options:
- **Render** or **Fly.io**: attach a persistent volume for `backend/data`,
  set the start command to `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- For anything beyond a demo, swap SQLite for Postgres and image storage for
  S3/R2 — both are small, contained changes (`database.py` and `main.py`).

**Frontend** — Vercel is the path of least resistance for Next.js:
```bash
cd frontend
npx vercel
```
Set `NEXT_PUBLIC_API_URL` in the Vercel project settings to point at wherever
the backend ends up, and update the backend's CORS `allow_origins`
(`backend/app/main.py`) to include the deployed frontend URL.

## Resume bullets

- Built an AI-powered fashion discovery platform (Next.js, FastAPI, SQLAlchemy)
  using CLIP embeddings for content-based image similarity search.
- Implemented a Pinterest-style collections feature with a many-to-many data
  model, supporting saving/organizing items across multiple boards.
- Designed a REST API with async image upload, on-upload embedding
  computation, and ranked similarity search over stored vectors.

## Roadmap

- ~~Week 2: CLIP embeddings + similarity search~~ — done
- ~~Week 3: feed grid + upload UI polish~~ — done
- ~~Week 4: collections, aesthetic redesign, write-up~~ — done
- Not done: live deployment (see above), auth/multi-user support, swapping
  brute-force similarity for a real vector index (FAISS/pgvector) if the
  catalog grows past a few thousand items
