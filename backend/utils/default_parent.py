from __future__ import annotations

from typing import Optional

from models import User

DEFAULT_PARENT_EMAIL = "demo-parent@example.com"
DEFAULT_PARENT_PASSWORD = "demo123"
DEFAULT_PARENT_ROLE = "parent"


def ensure_default_parent(session) -> User:
    """Return the fallback demo parent, creating it if needed."""
    parent: Optional[User] = (
        session.query(User)
        .filter(User.email == DEFAULT_PARENT_EMAIL)
        .first()
    )

    if parent:
        return parent

    parent = User(
        email=DEFAULT_PARENT_EMAIL,
        password=DEFAULT_PARENT_PASSWORD,
        role=DEFAULT_PARENT_ROLE,
    )
    session.add(parent)
    session.flush()
    return parent
