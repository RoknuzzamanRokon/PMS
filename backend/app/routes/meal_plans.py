from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import MealPlan
from ..schemas import MealPlanRead

router = APIRouter(prefix="/api/v1/meal-plans", tags=["meal-plans"])


@router.get("", response_model=list[MealPlanRead])
def list_meal_plans(db: Session = Depends(get_db)):
    return db.execute(select(MealPlan).order_by(MealPlan.id.asc())).scalars().all()
