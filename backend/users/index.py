"""
Пользователи Folozoger: поиск, получение профиля, блокировка
"""
import json
import os
import psycopg2

S = "t_p20273256_folozoger_clone"

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
    }

def get_user_from_token(cur, token):
    if not token:
        return None
    cur.execute(f"SELECT user_id FROM {S}.sessions WHERE token = %s", (token,))
    row = cur.fetchone()
    return row[0] if row else None

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    path = event.get("path", "/")
    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    token = event.get("headers", {}).get("X-Auth-Token") or event.get("headers", {}).get("x-auth-token")

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = get_conn()
    cur = conn.cursor()

    try:
        if path.endswith("/search") and method == "GET":
            q = params.get("q", "").strip()
            if not q:
                return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps([])}
            cur.execute(
                f"SELECT id, username, display_name, bio, avatar_url FROM {S}.users WHERE (LOWER(username) LIKE LOWER(%s) OR LOWER(display_name) LIKE LOWER(%s)) AND is_banned = FALSE LIMIT 20",
                (f"%{q}%", f"%{q}%")
            )
            rows = cur.fetchall()
            result = [{"id": r[0], "username": r[1], "display_name": r[2], "bio": r[3], "avatar_url": r[4]} for r in rows]
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps(result)}

        elif path.endswith("/all") and method == "GET":
            me = get_user_from_token(cur, token)
            cur.execute(
                f"SELECT id, username, display_name, bio, avatar_url FROM {S}.users WHERE is_banned = FALSE ORDER BY created_at DESC LIMIT 50"
            )
            rows = cur.fetchall()
            result = [{"id": r[0], "username": r[1], "display_name": r[2], "bio": r[3], "avatar_url": r[4]} for r in rows]
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps(result)}

        elif path.endswith("/block") and method == "POST":
            me = get_user_from_token(cur, token)
            if not me:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            blocked_id = body.get("user_id")
            if not blocked_id:
                return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Укажи user_id"})}
            cur.execute(
                f"INSERT INTO {S}.blocked_users (blocker_id, blocked_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (me, blocked_id)
            )
            conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        elif path.endswith("/unblock") and method == "POST":
            me = get_user_from_token(cur, token)
            if not me:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            blocked_id = body.get("user_id")
            cur.execute(f"DELETE FROM {S}.blocked_users WHERE blocker_id = %s AND blocked_id = %s", (me, blocked_id))
            conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        parts = path.rstrip("/").split("/")
        if len(parts) >= 1 and method == "GET":
            user_id = parts[-1]
            if user_id.isdigit():
                cur.execute(f"SELECT id, username, display_name, bio, avatar_url FROM {S}.users WHERE id = %s", (int(user_id),))
                row = cur.fetchone()
                if not row:
                    return {"statusCode": 404, "headers": cors_headers(), "body": json.dumps({"error": "Пользователь не найден"})}
                return {
                    "statusCode": 200,
                    "headers": cors_headers(),
                    "body": json.dumps({"id": row[0], "username": row[1], "display_name": row[2], "bio": row[3], "avatar_url": row[4]})
                }

        return {"statusCode": 404, "headers": cors_headers(), "body": json.dumps({"error": "Маршрут не найден"})}

    finally:
        cur.close()
        conn.close()
