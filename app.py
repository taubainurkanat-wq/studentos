"""ASGI entry point. Run: python -m uvicorn app:app --reload."""
from backend.application import create_app

app = create_app()
