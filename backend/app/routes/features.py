from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import BedType, MealPlan
from ..schemas import BedTypeRead, MealPlanRead

router = APIRouter(prefix="/api/v1/feature", tags=["feature"])


@router.get("/meal-plans", response_model=list[MealPlanRead])
def list_feature_meal_plans(db: Session = Depends(get_db)):
    return db.execute(select(MealPlan).order_by(MealPlan.id.asc())).scalars().all()


@router.get("/bed-type", response_model=list[BedTypeRead])
def list_bed_types(db: Session = Depends(get_db)):
    return db.execute(select(BedType).order_by(BedType.id.asc())).scalars().all()
