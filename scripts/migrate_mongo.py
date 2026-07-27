#!/usr/bin/env python3
"""Copy every collection from Emergent's MongoDB to a database you own.

Written in pure pymongo so it needs no mongodump/mongorestore binaries.

    python3 scripts/migrate_mongo.py --dry-run     # count docs, touch nothing
    python3 scripts/migrate_mongo.py               # perform the copy
    python3 scripts/migrate_mongo.py --verify      # compare counts after

Reads SOURCE_MONGO_URL / SOURCE_DB_NAME and TARGET_MONGO_URL / TARGET_DB_NAME
from the environment so credentials never land in the repo or shell history.

Safe to re-run: documents are upserted by _id, so an interrupted run can simply
be started again.
"""
import argparse
import os
import sys
from datetime import datetime

try:
    from pymongo import MongoClient, ReplaceOne
    from pymongo.errors import BulkWriteError, PyMongoError
except ImportError:
    sys.exit("pymongo is required:  pip install pymongo dnspython")

BATCH = 500


def env(name):
    value = os.environ.get(name)
    if not value:
        sys.exit(f"Missing required environment variable: {name}")
    return value


def copy_collection(src_db, dst_db, name, dry_run=False):
    src = src_db[name]
    total = src.estimated_document_count()
    if dry_run:
        print(f"  {name:<28} {total:>8} docs  (dry run, nothing written)")
        return total, 0

    dst = dst_db[name]
    copied, batch = 0, []
    for doc in src.find({}, no_cursor_timeout=True):
        batch.append(ReplaceOne({"_id": doc["_id"]}, doc, upsert=True))
        if len(batch) >= BATCH:
            try:
                dst.bulk_write(batch, ordered=False)
            except BulkWriteError as e:
                print(f"    ! partial write in {name}: {e.details.get('nErrors', '?')} errors")
            copied += len(batch)
            batch = []
            print(f"  {name:<28} {copied:>8}/{total} …", end="\r")
    if batch:
        try:
            dst.bulk_write(batch, ordered=False)
        except BulkWriteError as e:
            print(f"    ! partial write in {name}: {e.details.get('nErrors', '?')} errors")
        copied += len(batch)

    print(f"  {name:<28} {copied:>8}/{total} copied      ")
    return total, copied


def copy_indexes(src_db, dst_db, name):
    """Recreate non-_id indexes on the target."""
    created = 0
    for spec in src_db[name].list_indexes():
        if spec["name"] == "_id_":
            continue
        keys = list(spec["key"].items())
        opts = {k: v for k, v in spec.items()
                if k not in ("key", "v", "ns", "background")}
        opts.pop("name", None)
        try:
            dst_db[name].create_index(keys, name=spec["name"], **opts)
            created += 1
        except PyMongoError as e:
            print(f"    ! index {spec['name']} on {name}: {str(e)[:120]}")
    return created


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="count only, write nothing")
    ap.add_argument("--verify", action="store_true", help="compare source/target counts")
    ap.add_argument("--skip-indexes", action="store_true")
    args = ap.parse_args()

    src_client = MongoClient(env("SOURCE_MONGO_URL"), serverSelectionTimeoutMS=20000)
    dst_client = MongoClient(env("TARGET_MONGO_URL"), serverSelectionTimeoutMS=20000)
    src_db = src_client[env("SOURCE_DB_NAME")]
    dst_db = dst_client[env("TARGET_DB_NAME")]

    # Fail fast on bad credentials rather than mid-copy.
    src_client.admin.command("ping")
    dst_client.admin.command("ping")

    collections = sorted(src_db.list_collection_names())
    print(f"\n{datetime.now():%H:%M:%S}  {len(collections)} collections in "
          f"source db '{src_db.name}' -> '{dst_db.name}'\n")

    if args.verify:
        ok = True
        for name in collections:
            s = src_db[name].count_documents({})
            t = dst_db[name].count_documents({})
            flag = "OK " if s == t else "MISMATCH"
            if s != t:
                ok = False
            print(f"  {flag:<9} {name:<28} source={s:<8} target={t}")
        print("\nVerification:", "all collections match" if ok else "MISMATCHES FOUND")
        return 0 if ok else 1

    grand_src = grand_copied = grand_idx = 0
    for name in collections:
        total, copied = copy_collection(src_db, dst_db, name, args.dry_run)
        grand_src += total
        grand_copied += copied
        if not args.dry_run and not args.skip_indexes:
            grand_idx += copy_indexes(src_db, dst_db, name)

    print(f"\nSource documents: {grand_src}")
    if not args.dry_run:
        print(f"Documents copied: {grand_copied}")
        print(f"Indexes created:  {grand_idx}")
        print("\nRe-run with --verify to confirm counts match.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
