"""Vercel serverless entrypoint.

Vercel's Python runtime looks for an ASGI callable named `app` in this file.
The real application lives in `backend/`, so we put that directory on the
import path and re-export its FastAPI instance unchanged.
"""
import os
import sys

BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from server import app  # noqa: E402  (path setup must run first)

__all__ = ["app"]
