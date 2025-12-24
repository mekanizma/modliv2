import os
import base64
import uuid
from datetime import datetime
from typing import Tuple

from supabase import create_client, Client

# Bu script mevcut verilerdeki base64 görselleri Supabase Storage'a taşıyıp
# tabloları URL ile günceller. Çalıştırmadan önce .env dosyasındaki
# SUPABASE_URL ve SUPABASE_KEY değerlerinin dolu olduğundan emin olun.
#
# KULLANIM:
#   python backend/scripts/migrate_base64_to_storage.py
#
# Not: Script idempotent tasarlandı; image_url alanı data:image ile başlamıyorsa dokunmaz.


SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")


def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL veya SUPABASE_KEY eksik")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def decode_data_url(data_url: str) -> bytes:
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    return base64.b64decode(data_url)


def upload_bytes(
    supabase: Client,
    bucket: str,
    user_id: str,
    prefix: str,
    image_bytes: bytes,
) -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{uuid.uuid4().hex[:8]}.jpg"
    storage_path = f"{user_id}/{prefix}/{filename}"

    res = supabase.storage.from_(bucket).upload(
        path=storage_path,
        file=image_bytes,
        file_options={"content-type": "image/jpeg"},
    )

    if getattr(res, "error", None):
        raise RuntimeError(res.error)

    return supabase.storage.from_(bucket).get_public_url(storage_path)


def migrate_table(
    supabase: Client,
    table: str,
    id_field: str,
    image_field: str,
    bucket: str,
    prefix: str,
    user_field: str = "user_id",
) -> Tuple[int, int]:
    migrated = 0
    skipped = 0

    response = supabase.table(table).select("*").execute()
    rows = response.data or []

    for row in rows:
        image_value = row.get(image_field)
        if not image_value or not str(image_value).startswith("data:image"):
            skipped += 1
            continue

        user_id = row.get(user_field) or "public"
        image_bytes = decode_data_url(image_value)
        url = upload_bytes(supabase, bucket, str(user_id), prefix, image_bytes)

        update_data = {image_field: url}
        supabase.table(table).update(update_data).eq(id_field, row[id_field]).execute()
        migrated += 1

    return migrated, skipped


def main() -> None:
    supabase = get_supabase()

    tasks = [
        ("wardrobe_items", "id", "image_url", "wardrobe", "items"),
        ("wardrobe_items", "id", "thumbnail_url", "wardrobe", "thumbs"),
        ("try_on_results", "id", "result_image_url", "wardrobe", "results"),
        ("profiles", "id", "avatar_url", "profiles", "avatars"),
    ]

    for table, id_field, image_field, bucket, prefix in tasks:
        migrated, skipped = migrate_table(
            supabase,
            table=table,
            id_field=id_field,
            image_field=image_field,
            bucket=bucket,
            prefix=prefix,
        )
        print(f"{table}: migrated={migrated}, skipped={skipped}")


if __name__ == "__main__":
    main()








