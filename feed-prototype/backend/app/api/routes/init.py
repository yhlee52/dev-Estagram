from fastapi import APIRouter

from app.api.routes.accounts import router as accounts_router
from app.api.routes.feed import router as feed_router
from app.api.routes.follows import router as follows_router
from app.api.routes.health import router as health_router
from app.api.routes.posts import router as posts_router
from app.api.routes.users import router as users_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(users_router)
api_router.include_router(accounts_router)
api_router.include_router(posts_router)
api_router.include_router(follows_router)
api_router.include_router(feed_router)
