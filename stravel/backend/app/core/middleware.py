import structlog
from fastapi import FastAPI, Request
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider

from app.core.config import settings


def setup_structlog() -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(settings.log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def setup_opentelemetry(app: FastAPI) -> None:
    provider = TracerProvider()
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)


async def request_logging_middleware(request: Request, call_next):
    logger = structlog.get_logger()
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request.headers.get("x-request-id", "")[:64],
        method=request.method,
        path=request.url.path,
    )
    logger.info("request.started")
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("request.failed")
        raise
    logger.info("request.completed", status_code=response.status_code)
    return response
