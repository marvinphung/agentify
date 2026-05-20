from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent.chat_router import router as agent_router
from app.chat.router import router as chat_router
from app.config import get_settings
from app.database import SessionLocal, create_tables
from app.demo_seed import seed_demo_data
from app.errors import AppError, app_error_handler
from app.integrations.kiotviet.router import router as kiotviet_router
from app.orders.router import router as orders_router
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
    app.include_router(chat_router)
    app.include_router(orders_router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
