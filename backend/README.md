# Backend API – Authism MVP

Flask + SQLAlchemy backend that powers the Authism prototype. The service now persists data in a SQL database (SQLite by default) instead of the previous in-memory mock store, so users/children/avatars survive process restarts.

---

## 1. Requirements
- Python 3.10+
- Up-to-date `pip` (`python3 -m pip install --upgrade pip`)

---

## 2. Environment Setup
```bash
cd backend

# 1. Create & activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate

# 2. Install dependencies (Flask, SQLAlchemy, OpenAI client, etc.)


# 3. (optional) check versions
python -c "import flask, sqlalchemy; print(flask.__version__, sqlalchemy.__version__)"
```

### Required `.env` keys
Create a `.env` file in `backend/` (or export the variables) with:

```
OPENAI_API_KEY=sk-...
# Optional. Defaults to sqlite:///path/to/backend/autism.db
DATABASE_URL=sqlite:///absolute/path/to/autism.db
```

If `DATABASE_URL` is omitted the app writes to `backend/autism.db`. Any SQLAlchemy-compatible URL (Postgres, MySQL, etc.) works.

On first boot the service automatically creates the schema and seeds `advice_docs` from `data/advice_docs.json`.

---

## 3. Run the Backend
```bash
cd backend
source .venv/bin/activate
python app.py
```

The API listens on `http://127.0.0.1:5000`. Set this helper for cURL samples:

```bash
export BASE_URL="http://127.0.0.1:5000"
```

---

## 4. Database Schema (summary)
| Table | Purpose | Notable fields |
| --- | --- | --- |
| `users` | Parents/therapists/admins | `email`, `password`, `role` |
| `children` | Core child profile | `parent_id`, `name`, `age`, `level`, `disability` |
| `child_profiles` | Extended notes + physical traits used by avatar generator | `notes`, `traits` (JSON) |
| `avatars` | Cached avatar + emotion URLs returned by OpenAI | `base_avatar`, `emotions` (JSON) |
| `child_events` | Gameplay/therapy telemetry | `event_type`, `payload` (JSON), `timestamp` |
| `advice_docs` | Knowledge base surfaced in `/parent/ai_summary` | `category`, `title`, `advice` |

All models live in `models.py`; `database.py` exposes `db_session()` for transactional scopes.

---

## 5. REST Endpoints

### 5.1 Authentication (`/auth`)

**POST `/auth/register`** – create a user.

```bash
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ana.parent@example.com",
    "password": "pass123",
    "role": "parent"
  }'
```

**POST `/auth/login`** – returns `{ user_id, role }` on success.

```bash
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ana.parent@example.com",
    "password": "pass123"
  }'
```

### 5.2 Child Management (`/child`)

**POST `/child/create`** – persists a child + baseline profile for avatar generation.

```bash
curl -X POST "$BASE_URL/child/create" \
  -H "Content-Type: application/json" \
  -d '{
    "parent_id": 1,
    "name": "Matei",
    "age": 7,
    "disability": "sensory seeking",
    "level": "intermediate",
    "traits": {"gender": "male", "hair": "short_brown", "skin": "light", "glasses": false}
  }'
```

**GET `/child?parent_id=1`** – list children for a parent (includes profile + avatar metadata when available).

**GET `/child/<child_id>`** – retrieve a single child.

**POST `/child/<child_id>/event`** – log telemetry (`event_type` + optional JSON `payload`).

**GET `/child/<child_id>/stats?days=14`** – aggregates `child_events` in the requested window.

**GET `/child/<child_id>/profile`** and **PUT `/child/<child_id>/profile`** – view/update notes + avatar traits. Updating also keeps the base child table in sync.

### 5.3 Avatar AI (`/child/<child_id>/avatar`)

**POST `/child/<child_id>/avatar/create`** – triggers OpenAI image generation and stores the resulting URLs in SQL for reuse:

```bash
curl -X POST "$BASE_URL/child/1/avatar/create" \
  -H "Content-Type: application/json" \
  -d '{
    "traits": {"gender": "male", "hair": "short_brown", "skin": "light", "glasses": false}
  }'
```

**GET `/child/<child_id>/avatar`** – fetches the cached avatar payload (404 until generated).

### 5.4 Parent Insights (`/parent`)

**POST `/parent/ai_summary`** – merges `child_stats` with the top knowledge-base docs and forwards everything to `services/rag_service.py` (currently mocked).

```bash
curl -X POST "$BASE_URL/parent/ai_summary" \
  -H "Content-Type: application/json" \
  -d '{
    "child_id": 1,
    "question": "How can I support emotional regulation at home?",
    "days": 14
  }'
```

---

## 6. Development Notes
- Tables auto-create on import; delete `backend/autism.db` to reset when using SQLite.
- `database.db_session()` automatically commits on success and rolls back on error—wrap every DB interaction in this context manager.
- Replace the placeholder logic in `services/avatar_service.py` / `services/rag_service.py` with production integrations when ready.
- For deployment, point `DATABASE_URL` at a managed Postgres instance and run the app with `gunicorn app:app` or another WSGI server.
