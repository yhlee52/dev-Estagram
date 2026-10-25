from typing import ClassVar

from sqlalchemy import Column, ForeignKey, String, UniqueConstraint
from sqlmodel import Field, SQLModel


class PostAccountRef(SQLModel, table=True):
    __tablename__: ClassVar[str] = "post_account_refs"
    __table_args__ = (UniqueConstraint("post_id", "account_id", "kind", name="uq_post_account_refs_triplet"),)

    id: str = Field(primary_key=True)
    post_id: str = Field(sa_column=Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True))
    account_id: str = Field(sa_column=Column(String, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True))
    kind: str = Field(index=True)
