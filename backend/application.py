"""Compose the API routers and serve the browser application."""
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .config import ROOT, public_demo
from .database import setup_db
from .routes import auth, workspace


def create_app() -> FastAPI:
    setup_db()
    app = FastAPI(title='StudentOS API', version='1.0.0', docs_url='/api/docs', redoc_url=None)
    app.include_router(auth.router)
    app.include_router(workspace.router)

    @app.get('/api/config')
    def config():
        return {'public_demo': public_demo()}

    @app.get('/api/health')
    def health():
        return {'status': 'ok'}

    app.mount('/assets', StaticFiles(directory=ROOT / 'frontend'), name='assets')

    @app.get('/')
    def index():
        return FileResponse(ROOT / 'frontend' / 'index.html')

    return app
