"""Operator / dev password reset (v0.6.3).

V0_6_0 Password Policy makes no self-serve recovery; an operator resets a
password directly instead. Seed uses `ensure_user_password` (write-once), so
re-seeding never overwrites an existing password — this CLI is the actual reset
path it promised.

Usage (from `feed-prototype/backend`, with DATABASE_URL set):

    python -m scripts.reset_password --user ari --password newpass
    python -m scripts.reset_password --user demo-user-ari --password newpass

`--user` is resolved by id or handle (same rule as login). This writes directly
to the DB (no API/session) and is meant for local/operator use. Exit code is
non-zero if the user is not found or the password is too short.
"""

from __future__ import annotations

import argparse
import sys

from app.db.session import create_session
from app.services.auth import find_user_by_login, set_user_password


MIN_PASSWORD_LENGTH = 4


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reset a user's password (operator/dev tool)."
    )
    parser.add_argument("--user", required=True, help="User id or handle.")
    parser.add_argument(
        "--password",
        required=True,
        help=f"New password (min {MIN_PASSWORD_LENGTH} characters).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if len(args.password) < MIN_PASSWORD_LENGTH:
        print(
            f"New password must be at least {MIN_PASSWORD_LENGTH} characters.",
            file=sys.stderr,
        )
        return 2

    with create_session() as session:
        user = find_user_by_login(session, args.user)
        if user is None:
            print(f"User not found: {args.user}", file=sys.stderr)
            return 1

        set_user_password(session, user.id, args.password)
        session.commit()
        print(f"Password reset for {user.id} (@{user.handle}).")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
