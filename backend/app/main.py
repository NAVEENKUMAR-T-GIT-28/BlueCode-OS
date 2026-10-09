import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.auth.router import me_router
from app.auth.router import router as auth_router
from app.config import get_settings
from app.core.errors import install_error_handlers
from app.db import get_engine
from app.modules.icp.router import router as icp_router
from app.modules.settings.router import router as settings_router
from app.routers import jobs, usage

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    get_settings().validate_for_runtime()
    yield


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="AI Founder OS: Sales Copilot API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None if s.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if s.is_production else "/openapi.json",
    )
    install_error_handlers(app)

    for router in (auth_router, me_router, jobs.router, usage.router, icp_router, settings_router):
        app.include_router(router, prefix="/api/v1")

    @app.get("/healthz", tags=["health"])
    def healthz() -> JSONResponse:
        try:
            with get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception:
            return JSONResponse({"status": "unavailable"}, status_code=503)
        return JSONResponse({"status": "ok"})

    return app


app = create_app()
