import uuid
from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from models.base import Base


class InvestorCityAccess(Base):
    __tablename__ = "investor_city_access"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE"), nullable=False)

    granted_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User", backref="city_access")
    city = relationship("City", backref="investor_access")

    __table_args__ = (UniqueConstraint("user_id", "city_id", name="uq_investor_city_access"),)

    def __repr__(self) -> str:
        return f"InvestorCityAccess(user_id={self.user_id!r}, city_id={self.city_id!r})"