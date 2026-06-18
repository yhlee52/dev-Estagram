"""Operator account reactivation (v0.6.4).

Deactivation (POST /api/accounts/{id}/deactivate) is self-service, but a
deactivated user cannot log in, so reactivation is operator-only. This clears
the paired account's `deactivated_at`, restoring login and discovery. Posts were
never deleted, so nothing else needs restoring.

Usage (from `feed-prototype/backend`, with DATABASE_URL set):

    python -m scripts.reactivate_user --user ari
    python -m scripts.reactivate_user --user demo-user-ari

`--user` is resolved by id or handle (same rule as login). Exit code is non-zero
if the user or their account is not found.
"""

from __future__ import annotations

import argparse
import sys

from sqlmodel import select

from app.db.session import create_session
from app.models.account import Account
from app.services.auth import find_user_by_login


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reactivate a deactivated account (operator tool)."
    )
    parser.add_argument("--user", required=True, help="User id or handle.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    with create_session() as session:
        user = find_user_by_login(session, args.user)
        if user is None:
            print(f"User not found: {args.user}", file=sys.stderr)
            return 1

        account = session.exec(
            select(Account).where(Account.user_id == user.id)
        ).first()
        if account is None:
            print(f"No account found for user: {user.id}", file=sys.stderr)
            return 1

        if account.deactivated_at is None:
            print(f"Account already active: {account.id} (@{account.handle}).")
            return 0

        account.deactivated_at = None
        session.add(account)
        session.commit()
        print(f"Reactivated {account.id} (@{account.handle}) for user {user.id}.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
