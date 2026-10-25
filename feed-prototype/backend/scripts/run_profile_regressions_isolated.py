"""Run profile-related PostgreSQL regressions in a disposable database.

Uses the configured PostgreSQL server and credentials, but never migrates or
modifies the configured application database. The temporary database name is
generated here and removed after all checks finish.
"""

import os
import subprocess
import sys
from uuid import uuid4

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.core.config import get_settings


CHECKS = (
    "scripts.check_profile_ux",
    "scripts.check_account_profile",
    "scripts.check_account_lifecycle",
    "scripts.check_notifications",
    "scripts.check_bookmarks",
    "scripts.check_comments",
    "scripts.check_social_interactions",
)


def run_check_set(source, admin, checks: tuple[str, ...]) -> int:
    database_name = f"feed_profile_check_{uuid4().hex[:12]}"
    created = False
    try:
        with admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{database_name}"'))
        created = True
        test_url = source.set(database=database_name).render_as_string(hide_password=False)
        env = {**os.environ, "DATABASE_URL": test_url, "PROFILE_UX_TEST_DATABASE_URL": test_url}
        for command in ((sys.executable, "-m", "alembic", "upgrade", "head"),
                        *((sys.executable, "-m", check) for check in checks)):
            print("Running", " ".join(command[:3]), flush=True)
            result = subprocess.run(command, env=env, check=False)
            if result.returncode:
                return result.returncode
        return 0
    finally:
        if created:
            with admin.connect() as connection:
                connection.execute(text(f'DROP DATABASE IF EXISTS "{database_name}" WITH (FORCE)'))


def main() -> int:
    source = make_url(get_settings().database_url)
    if not source.drivername.startswith("postgresql"):
        raise RuntimeError("An isolated PostgreSQL database is required")
    admin = create_engine(source.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        for checks in (CHECKS, ("scripts.check_demo_seed",), ("scripts.check_smart_search",)):
            result = run_check_set(source, admin, checks)
            if result:
                return result
        print("Isolated profile regressions and demo seed check passed", flush=True)
        return 0
    finally:
        admin.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
