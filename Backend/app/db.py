from typing import Optional
import re
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.settings import settings

def _normalize_database_url(raw_url: str) -> str:
    """
    Required for async Postgres (e.g. Neon). Produces a clean async SQLAlchemy URL.
    - Strips libpq query params (sslmode, channel_binding) that asyncpg does not support;
      SSL is enabled via connect_args for Neon.
    - Ensures postgresql+asyncpg:// so the async driver is used.
    Also accepts: postgres://, or psql '...' style strings from dashboards.
    """
    url = raw_url.strip()

    # Handle strings copied from dashboards/CLIs like:  psql 'postgresql://...'
    if url.lower().startswith("psql"):
        quoted = re.search(r"'([^']+)'|\"([^\"]+)\"", url)
        if quoted:
            # First non-empty capture group (single or double quoted)
            url = quoted.group(1) or quoted.group(2)
        else:
            # Fallback: drop the leading "psql" and trim
            url = url[4:].strip()

    # Normalize postgres:// to postgresql://
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]

    # Ensure async driver is specified
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    # Normalize query parameters for asyncpg (which doesn't support libpq's sslmode/channel_binding)
    try:
        parts = urlsplit(url)
        query_params = dict(parse_qsl(parts.query, keep_blank_values=True))

        # Make keys case-insensitive for stripping
        lowered = {k.lower(): k for k in list(query_params.keys())}

        # Map/strip libpq params
        sslmode_present = False
        if "sslmode" in lowered:
            sslmode_present = True
            query_params.pop(lowered["sslmode"], None)
        # channel_binding is not an asyncpg param; remove if present
        if "channel_binding" in lowered:
            query_params.pop(lowered["channel_binding"], None)

        # We will drop ALL remaining query params to avoid leaking unknown kwargs like sslmode
        # Explicit SSL will be provided via connect_args (see _build_connect_args)
        new_query = ""
        url = urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))

    except Exception:
        # If parsing fails, fall back to original url
        pass

    return url


def _build_connect_args(normalized_url: str) -> dict:
    try:
        parts = urlsplit(normalized_url)
        hostname = parts.hostname or ""
        # Enable SSL for Neon
        if ".neon.tech" in hostname:
            return {"ssl": True}
    except Exception:
        pass
    return {}

_NORMALIZED_URL = _normalize_database_url(settings.database_url)
engine = create_async_engine(_NORMALIZED_URL, pool_pre_ping=True, connect_args=_build_connect_args(_NORMALIZED_URL))
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_db():
    async with SessionLocal() as session:
        yield session
