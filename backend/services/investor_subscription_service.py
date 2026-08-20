from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from schema.InvestorSubscriptionDto import InvestorSubscriptionCreate, InvestorSubscriptionUpdate
from models.investor_subscription import InvestorSubscription
from models.subscription_plan import SubscriptionPlan


def get_all_plans(db: Session) -> list[SubscriptionPlan]:
    return db.query(SubscriptionPlan).all()


def get_all(db: Session) -> list[InvestorSubscription]:
    return db.query(InvestorSubscription).all()


def get_by_user_or_404(user_id: UUID, db: Session) -> InvestorSubscription:
    sub = db.query(InvestorSubscription).filter(InvestorSubscription.user_id == user_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return sub


def create(payload: InvestorSubscriptionCreate, db: Session) -> InvestorSubscription:
    existing = db.query(InvestorSubscription).filter(InvestorSubscription.user_id == payload.user_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Subscription already exists for this user")
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == payload.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    sub = InvestorSubscription(**payload.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def update(user_id: UUID, payload: InvestorSubscriptionUpdate, db: Session) -> InvestorSubscription:
    sub = get_by_user_or_404(user_id, db)
    if payload.plan_id is not None:
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == payload.plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(sub, field, value)
    db.commit()
    db.refresh(sub)
    return sub


def delete(user_id: UUID, db: Session) -> None:
    sub = get_by_user_or_404(user_id, db)
    db.delete(sub)
    db.commit()