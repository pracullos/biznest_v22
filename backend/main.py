from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.db import engine, SessionLocal
from core.redis import get_redis_client
from models.base import Base
import models  # registers all models with Base.metadata
from core.seed import seed

from core.middleware import auth_enforcement_middleware
from routes.auth import router as auth_router
from routes.users import router as users_router
from routes.test import test_route
from routes.files import router as files_router
from routes.cities import router as cities_router
from routes.zoning_areas import router as zoning_router
from routes.hazard_areas import router as hazard_router
from routes.establishments import router as establishments_router
from routes.alerts import router as alerts_router
from routes.investor_subscriptions import router as subscriptions_router
from routes.lgu_assignments import router as lgu_router
from routes.investor_city_access import router as city_access_router
from routes.permissions import router as permissions_router
from routes.roles import router as roles_router
from routes.user_roles import router as user_roles_router
from routes.saved_locations import router as saved_locations_router
from routes.audit_logs import router as audit_logs_router
from routes.analyze import router as analyze_router
from routes.regions import router as regions_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- startup ---
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)

    app.state.redis = get_redis_client()
    app.state.db_engine = engine

    print("RUNNING MAIN FILE:  ", __file__)
    yield

    # --- shutdown ---
    app.state.redis.close()
    engine.dispose()


app = FastAPI(title="BizNest Geo-Intelligence API", lifespan=lifespan)

app.middleware("http")(auth_enforcement_middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3001", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(test_route, tags=["test"])
app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(files_router, prefix="/files", tags=["files"])
app.include_router(cities_router, prefix="/cities", tags=["cities"])
app.include_router(zoning_router, prefix="/cities", tags=["zoning"])
app.include_router(hazard_router, prefix="/cities", tags=["hazards"])
app.include_router(establishments_router, prefix="/cities", tags=["establishments"])
app.include_router(alerts_router, prefix="/cities", tags=["alerts"])
app.include_router(subscriptions_router, prefix="/subscriptions", tags=["subscriptions"])
app.include_router(lgu_router, prefix="/lgu-assignments", tags=["lgu-assignments"])
app.include_router(city_access_router, prefix="/city-access", tags=["city-access"])
app.include_router(permissions_router, prefix="/permissions", tags=["permissions"])
app.include_router(roles_router, prefix="/roles", tags=["roles"])
app.include_router(user_roles_router, prefix="/user-roles", tags=["user-roles"])
app.include_router(saved_locations_router, prefix="/saved-locations", tags=["saved-locations"])
app.include_router(audit_logs_router, prefix="/audit-logs", tags=["audit-logs"])
app.include_router(analyze_router, tags=["analyze"])
app.include_router(regions_router, tags=["regions"])

@app.get("/")
def root():
    return {"message": "BizNest API running"}