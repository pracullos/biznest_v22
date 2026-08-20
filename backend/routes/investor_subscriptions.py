from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from schema.InvestorSubscriptionDto import (
    InvestorSubscriptionCreate,
    InvestorSubscriptionResponse,
    InvestorSubscriptionUpdate,
    SubscriptionPlanResponse,
)
from models.user import User
from services import investor_subscription_service
from services.auth_service import get_authenticated_user
from core.db import get_db

router = APIRouter()


@router.get("/plans", response_model=list[SubscriptionPlanResponse])
def list_plans(db: Session = Depends(get_db)):
    return investor_subscription_service.get_all_plans(db)


@router.get("/", response_model=list[InvestorSubscriptionResponse])
def list_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return investor_subscription_service.get_all(db)


@router.post("/", response_model=InvestorSubscriptionResponse, status_code=status.HTTP_201_CREATED)
def create_subscription(
    payload: InvestorSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return investor_subscription_service.create(payload, db)


@router.get("/me", response_model=InvestorSubscriptionResponse)
def get_my_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return investor_subscription_service.get_by_user_or_404(current_user.id, db)


@router.get("/{user_id}", response_model=InvestorSubscriptionResponse)
def get_subscription(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return investor_subscription_service.get_by_user_or_404(user_id, db)


@router.patch("/{user_id}", response_model=InvestorSubscriptionResponse)
def update_subscription(
    user_id: UUID,
    payload: InvestorSubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return investor_subscription_service.update(user_id, payload, db)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subscription(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    investor_subscription_service.delete(user_id, db)