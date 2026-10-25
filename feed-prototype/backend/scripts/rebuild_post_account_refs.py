"""Rebuild derived post-body mentions after migration 0018.

Use --dry-run to count affected posts without writing; --apply replaces only
derived mention rows. Explicit person tags are never changed.
"""

import argparse

from sqlmodel import select

from app.db.session import create_session
from app.models.post import Post
from app.services.post_account_refs import sync_post_mentions


def main() -> None:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true")
    group.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    count = 0
    last_id = ""
    with create_session() as session:
        while True:
            posts = session.exec(select(Post).where(Post.id > last_id).order_by(Post.id).limit(500)).all()
            if not posts:
                break
            for post in posts:
                if args.apply:
                    sync_post_mentions(session, post)
                count += 1
            if args.apply:
                session.commit()
            last_id = posts[-1].id
    print(f"{count} posts scanned; {'mention references rebuilt' if args.apply else 'no changes made'}")


if __name__ == "__main__":
    main()
