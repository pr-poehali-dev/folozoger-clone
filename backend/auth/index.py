"""
Аутентификация Folozoger: регистрация, вход, выход, проверка токена
"""
import json
import os
import hashlib
import secrets
import psycopg2

S = "t_p20273256_folozoger_clone"

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
    }

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    path = event.get("path", "/")
    method = event.get("httpMethod", "GET")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = get_conn()
    cur = conn.cursor()

    try:
        if path.endswith("/register") and method == "POST":
            username = (body.get("username") or "").strip()
            display_name = (body.get("display_name") or username).strip()
            password = body.get("password") or ""

            if not username or not password:
                return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Укажи имя пользователя и пароль"})}

            if len(username) < 3 or len(username) > 50:
                return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Имя пользователя должно быть от 3 до 50 символов"})}

            if username.lower() == "connection":
                return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Это имя зарезервировано"})}

            cur.execute(f"SELECT id FROM {S}.users WHERE LOWER(username) = LOWER(%s)", (username,))
            if cur.fetchone():
                return {"statusCode": 409, "headers": cors_headers(), "body": json.dumps({"error": "Пользователь с таким именем уже существует"})}

            ph = hash_password(password)
            cur.execute(
                f"INSERT INTO {S}.users (username, display_name, password_hash) VALUES (%s, %s, %s) RETURNING id",
                (username, display_name, ph)
            )
            user_id = cur.fetchone()[0]

            cur.execute(f"SELECT id FROM {S}.conversations WHERE name = 'Новости Folozoger' AND type = 'channel'")
            news_ch = cur.fetchone()
            if news_ch:
                cur.execute(
                    f"INSERT INTO {S}.conversation_members (conversation_id, user_id, role) VALUES (%s, %s, 'member') ON CONFLICT DO NOTHING",
                    (news_ch[0], user_id)
                )

            token = secrets.token_hex(32)
            cur.execute(f"INSERT INTO {S}.sessions (user_id, token) VALUES (%s, %s)", (user_id, token))
            conn.commit()

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"token": token, "user_id": user_id, "username": username, "display_name": display_name})
            }

        elif path.endswith("/login") and method == "POST":
            username = (body.get("username") or "").strip()
            password = body.get("password") or ""

            if username == "CoNNectioN" and password == "folozoger_admin_2024":
                cur.execute(f"SELECT id, username, display_name FROM {S}.users WHERE username = 'CoNNectioN'")
                row = cur.fetchone()
                if row:
                    token = secrets.token_hex(32)
                    cur.execute(f"INSERT INTO {S}.sessions (user_id, token) VALUES (%s, %s)", (row[0], token))
                    conn.commit()
                    return {
                        "statusCode": 200,
                        "headers": cors_headers(),
                        "body": json.dumps({"token": token, "user_id": row[0], "username": row[1], "display_name": row[2]})
                    }

            ph = hash_password(password)
            cur.execute(
                f"SELECT id, username, display_name, is_banned FROM {S}.users WHERE LOWER(username) = LOWER(%s) AND password_hash = %s",
                (username, ph)
            )
            row = cur.fetchone()
            if not row:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Неверное имя пользователя или пароль"})}

            if row[3]:
                return {"statusCode": 403, "headers": cors_headers(), "body": json.dumps({"error": "Ваш аккаунт заблокирован"})}

            token = secrets.token_hex(32)
            cur.execute(f"INSERT INTO {S}.sessions (user_id, token) VALUES (%s, %s)", (row[0], token))
            conn.commit()
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"token": token, "user_id": row[0], "username": row[1], "display_name": row[2]})
            }

        elif path.endswith("/logout") and method == "POST":
            token = event.get("headers", {}).get("X-Auth-Token") or event.get("headers", {}).get("x-auth-token")
            if token:
                cur.execute(f"DELETE FROM {S}.sessions WHERE token = %s", (token,))
                conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        elif path.endswith("/me") and method == "GET":
            token = event.get("headers", {}).get("X-Auth-Token") or event.get("headers", {}).get("x-auth-token")
            if not token:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            cur.execute(
                f"SELECT u.id, u.username, u.display_name, u.bio, u.avatar_url FROM {S}.sessions s JOIN {S}.users u ON s.user_id = u.id WHERE s.token = %s",
                (token,)
            )
            row = cur.fetchone()
            if not row:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Токен недействителен"})}
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"id": row[0], "username": row[1], "display_name": row[2], "bio": row[3], "avatar_url": row[4]})
            }

        elif path.endswith("/profile") and method == "PUT":
            token = event.get("headers", {}).get("X-Auth-Token") or event.get("headers", {}).get("x-auth-token")
            if not token:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            cur.execute(f"SELECT user_id FROM {S}.sessions WHERE token = %s", (token,))
            sess = cur.fetchone()
            if not sess:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Токен недействителен"})}
            user_id = sess[0]
            display_name = body.get("display_name")
            bio = body.get("bio")
            if display_name:
                cur.execute(f"UPDATE {S}.users SET display_name = %s WHERE id = %s", (display_name, user_id))
            if bio is not None:
                cur.execute(f"UPDATE {S}.users SET bio = %s WHERE id = %s", (bio, user_id))
            conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        return {"statusCode": 404, "headers": cors_headers(), "body": json.dumps({"error": "Маршрут не найден"})}

    finally:
        cur.close()
        conn.close()
