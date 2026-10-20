"""Vercel Python entry point.

Vercel imports this module for every request routed to it. The project root is
added to sys.path so the `app` package (FastAPI) resolves the same way it does
locally with `uvicorn app.main:app`.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa: E402,F401  (Vercel expects a module-level `app`)

__all__ = ["app"]
