from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Property
from ..schemas import PropertyCreate, PropertyRead
from ..utils import next_code

router = APIRouter(prefix="/api/v1/properties", tags=["properties"])


@router.get("", response_model=list[PropertyRead])
def list_properties(db: Session = Depends(get_db)):
    return db.execute(select(Property).order_by(Property.created_at.desc())).scalars().all()


@router.post("", response_model=PropertyRead)
def create_property(payload: PropertyCreate, db: Session = Depends(get_db)):
    property_id = payload.property_id or next_code(db, Property, "property_id", "PROP")
    property_obj = Property(property_id=property_id, **payload.model_dump(exclude={"property_id"}))
    db.add(property_obj)
    db.commit()
    db.refresh(property_obj)
    return property_obj


@router.get("/{property_id}", response_model=PropertyRead)
def get_property(property_id: str, db: Session = Depends(get_db)):
    property_obj = db.scalar(select(Property).where(Property.property_id == property_id))
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")
    return property_obj
