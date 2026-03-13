"""
VSL Dashboard - Main Application

FastAPI backend + Dash frontend, all in one process.
"""
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.wsgi import WSGIMiddleware
from flask import Flask
import dash
import dash_bootstrap_components as dbc

from app.config import settings
from app.models.database import init_db
from app.routes.api import router as api_router
from app.dash_app.layout import create_layout
from app.dash_app.callbacks import register_callbacks


def create_app():
    """Create and configure the application."""
    # Initialize database
    init_db()

    # FastAPI app
    fastapi_app = FastAPI(
        title="VSL Dashboard API",
        description="Dashboard de metricas de VSL com RedTrack e VTurb",
        version="2.0.0",
    )

    # Register API routes
    fastapi_app.include_router(api_router)

    # Dash app
    flask_server = Flask(__name__)
    dash_app = dash.Dash(
        __name__,
        server=flask_server,
        external_stylesheets=[
            dbc.themes.DARKLY,
            dbc.icons.BOOTSTRAP,
            "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
        ],
        suppress_callback_exceptions=True,
        title="VSL Dashboard",
     )

    dash_app.layout = create_layout()
    register_callbacks(dash_app)

    # Mount Dash inside FastAPI
    fastapi_app.mount("/", WSGIMiddleware(dash_app.server))

    return fastapi_app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8050))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=settings.DEBUG,
    )
