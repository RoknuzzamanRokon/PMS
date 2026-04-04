from fastapi import APIRouter

from .available_rooms import router as available_rooms_router
from .auth import router as auth_router
from .dashboard import router as dashboard_router
from .features import router as features_router
from .guests import router as guests_router
from .inventory import router as inventory_router
from .live_project_push import router as live_project_push_router
from .meal_plans import router as meal_plans_router
from .properties import router as properties_router
from .rate_plans import router as rate_plans_router
from .reservations import router as reservations_router
from .room_inventory import router as room_inventory_router
from .rooms import router as rooms_router
from .search import router as search_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(available_rooms_router)
api_router.include_router(properties_router)
api_router.include_router(meal_plans_router)
api_router.include_router(features_router)
api_router.include_router(live_project_push_router)
api_router.include_router(rooms_router)
api_router.include_router(rate_plans_router)
api_router.include_router(guests_router)
api_router.include_router(reservations_router)
api_router.include_router(room_inventory_router)
api_router.include_router(search_router)
api_router.include_router(dashboard_router)
api_router.include_router(inventory_router)
