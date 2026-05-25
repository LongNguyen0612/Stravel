from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import AppError, app_error_handler, unhandled_error_handler
from app.core.middleware import request_logging_middleware, setup_opentelemetry, setup_structlog


def create_app() -> FastAPI:
    setup_structlog()

    app = FastAPI(
        title="STravel API",
        description="AI Travel Advisory Platform for Vietnam",
        version="0.1.0",
    )

    cors_origins = ["*"] if settings.environment == "development" else settings.cors_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=settings.environment != "development",
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.middleware("http")(request_logging_middleware)

    setup_opentelemetry(app)

    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    return app


app = create_app()
