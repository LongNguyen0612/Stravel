from fastapi import APIRouter

from app.api.v1 import auth, demo, health, passport, sessions, streaming

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(sessions.router)
api_router.include_router(streaming.router)
api_router.include_router(demo.router)
api_router.include_router(passport.router)
