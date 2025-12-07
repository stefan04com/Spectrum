from __future__ import annotations

import json
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker


from config import DATABASE_URL

Base = declarative_base()
engine = create_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@contextmanager
def db_session() -> Iterator[Session]:
    """Provide a transactional scope around a series of operations."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    """Create tables and seed static data on first run."""
    # Import inside function to avoid circular imports

    Base.metadata.create_all(bind=engine)
    _ensure_child_profile_guidance_column()
    _seed_advice_docs()


def _ensure_child_profile_guidance_column() -> None:
    """Add the guidance column to child_profiles if it is missing."""
    try:
        inspector = inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("child_profiles")}
    except Exception:
        return

    if "guidance" in columns:
        return

    try:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE child_profiles ADD COLUMN guidance TEXT"))
    except Exception:
        # On SQLite the ALTER command fails if the column already exists or table absent; swallow gracefully.
        return


def _seed_advice_docs() -> None:
    from models import AdviceDoc

    advice_path = Path(__file__).resolve().parent / "data" / "advice_docs.json"
    if not advice_path.exists():
        return

    with db_session() as session:
        existing_count = session.query(AdviceDoc).count()
        if existing_count:
            return

        docs = json.loads(advice_path.read_text(encoding="utf-8"))
        for doc in docs:
            session.add(AdviceDoc(
                id=doc.get("id"),
                category=doc.get("category"),
                title=doc.get("title"),
                advice=doc.get("advice")
            ))

