from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.core.config import get_settings


app = FastAPI(title="Feed Prototype Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_allow_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(api_router)
