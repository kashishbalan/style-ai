# StyleAI

A tiny Pinterest-style outfit discovery app. Upload outfit photos, find
visually similar looks via CLIP embeddings, and save favorites into
Pinterest-style collections (boards).

**Live demo:** https://frontend-beige-six-40.vercel.app
**API:** https://kashbalan-style-ai-backend.hf.space

> Note: the backend runs on Hugging Face Spaces' free CPU tier, which has no
> persistent disk — uploaded images and the database reset whenever the Space
> restarts or sleeps from inactivity. Fine for a demo, not for real data.

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
  styling, no auth/SSR complexity — this is a demo, not a multi-tenant
  product.
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

## Deployment

**Backend** is deployed as a Docker Space on Hugging Face Spaces (free CPU
tier, no card required):
- `backend/Dockerfile` builds a `python:3.13-slim` image, installs the
  CPU-only torch wheel, and runs `uvicorn` on port 7860 (HF's expected port).
- `backend/README.md` carries the required Space metadata frontmatter
  (`sdk: docker`, `app_port: 7860`).
- CORS is controlled by a `FRONTEND_URL` env var set in the Space's
  "Variables and secrets" settings, so it can allow the deployed frontend
  origin without a code change.
- Push updates with `git push` to the Space's git remote
  (`git@hf.co:spaces/kashbalan/style-ai-backend`).

**Frontend** is deployed to Vercel:
```bash
cd frontend
vercel --prod
```
`NEXT_PUBLIC_API_URL` is set in the Vercel project's environment variables to
the Space's URL above.

For anything beyond a demo: swap SQLite for Postgres and image storage for
S3/R2 (both small, contained changes in `database.py` and `main.py`), and move
the backend to a host with persistent disk (Render/Fly.io) so data survives
restarts.
