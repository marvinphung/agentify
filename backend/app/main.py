from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.agent.chat_router import router as agent_router
from app.chat.router import router as chat_router
from app.config import get_settings
from app.database import SessionLocal, create_tables
from app.demo_seed import seed_demo_data
from app.errors import AppError, app_error_handler
from app.integrations.kiotviet.router import router as kiotviet_router
from app.integrations.zalo.router import router as zalo_router
from app.orders.router import router as orders_router
from app.shipments.router import router as shipments_router
from app.shared.workspace import ensure_default_workspace


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_tables()
    with SessionLocal() as db:
        ensure_default_workspace(db)
        seed_demo_data(db)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Agentify MVP API", version="0.1.0", lifespan=lifespan)
    app.add_exception_handler(AppError, app_error_handler)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(agent_router)
    app.include_router(kiotviet_router)
    app.include_router(zalo_router)
    app.include_router(chat_router)
    app.include_router(orders_router)
    app.include_router(shipments_router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    def root() -> str:
        meta = ""
        if settings.zalo_site_verification:
            meta = f'<meta name="zalo-platform-site-verification" content="{settings.zalo_site_verification}" />'
        return (
            "<!doctype html>"
            '<html lang="vi">'
            "<head>"
            '<meta charset="utf-8" />'
            f"{meta}"
            "<title>Agentify API</title>"
            "</head>"
            "<body>Agentify API is running.</body>"
            "</html>"
        )

    return app


app = create_app()
