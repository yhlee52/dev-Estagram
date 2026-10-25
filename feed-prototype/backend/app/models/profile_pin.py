from typing import ClassVar

from sqlalchemy import Column, ForeignKey, String, UniqueConstraint
from sqlmodel import Field, SQLModel


class ProfilePin(SQLModel, table=True):
    __tablename__: ClassVar[str] = "profile_pins"
    __table_args__ = (
        UniqueConstraint("account_id", "post_id", name="uq_profile_pins_account_post"),
        UniqueConstraint("account_id", "position", name="uq_profile_pins_account_position"),
    )

    id: str = Field(primary_key=True)
    account_id: str = Field(sa_column=Column(String, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True))
    post_id: str = Field(sa_column=Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True))
    position: int
