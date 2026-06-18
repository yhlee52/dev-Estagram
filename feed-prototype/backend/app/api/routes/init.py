from fastapi import APIRouter

from app.api.routes.accounts import router as accounts_router
from app.api.routes.auth import router as auth_router
from app.api.routes.bookmarks import router as bookmarks_router
from app.api.routes.comments import router as comments_router
from app.api.routes.feed import router as feed_router
from app.api.routes.follows import router as follows_router
from app.api.routes.health import router as health_router
from app.api.routes.imports import router as imports_router
from app.api.routes.metadata import router as metadata_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.posts import router as posts_router
from app.api.routes.tags import router as tags_router
from app.api.routes.users import router as users_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(accounts_router)
api_router.include_router(posts_router)
api_router.include_router(comments_router)
api_router.include_router(bookmarks_router)
api_router.include_router(notifications_router)
api_router.include_router(imports_router)
api_router.include_router(tags_router)
api_router.include_router(metadata_router)
api_router.include_router(follows_router)
api_router.include_router(feed_router)
