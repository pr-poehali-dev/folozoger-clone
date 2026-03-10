"""
Админ-панель Folozoger — доступна только CoNNectioN: управление пользователями, чатами, сообщениями
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
        return None, None
    cur.execute(f"SELECT u.id, u.username FROM {S}.sessions s JOIN {S}.users u ON s.user_id = u.id WHERE s.token = %s", (token,))
    row = cur.fetchone()
    return (row[0], row[1]) if row else (None, None)

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    path = event.get("path", "/")
    method = event.get("httpMethod", "GET")
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
        user_id, username = get_user_from_token(cur, token)
        if not user_id or username != "CoNNectioN":
            return {"statusCode": 403, "headers": cors_headers(), "body": json.dumps({"error": "Доступ запрещён"})}

        if path.endswith("/stats") and method == "GET":
            cur.execute(f"SELECT COUNT(*) FROM {S}.users")
            users_count = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {S}.messages WHERE is_removed = FALSE")
            messages_count = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {S}.conversations WHERE type = 'group'")
            groups_count = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {S}.conversations WHERE type = 'channel'")
            channels_count = cur.fetchone()[0]
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({
                    "users": users_count,
                    "messages": messages_count,
                    "groups": groups_count,
                    "channels": channels_count
                })
            }

        elif path.endswith("/users") and method == "GET":
            cur.execute(f"SELECT id, username, display_name, bio, is_banned, created_at FROM {S}.users ORDER BY created_at DESC")
            rows = cur.fetchall()
            result = [{"id": r[0], "username": r[1], "display_name": r[2], "bio": r[3], "is_banned": r[4], "created_at": str(r[5])} for r in rows]
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps(result)}

        elif path.endswith("/ban") and method == "POST":
            target_id = body.get("user_id")
            cur.execute(f"SELECT username FROM {S}.users WHERE id = %s", (target_id,))
            u = cur.fetchone()
            if u and u[0] == "CoNNectioN":
                return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Нельзя заблокировать администратора"})}
            cur.execute(f"UPDATE {S}.users SET is_banned = TRUE WHERE id = %s", (target_id,))
            cur.execute(f"UPDATE {S}.sessions SET token = 'REVOKED_' || token WHERE user_id = %s", (target_id,))
            conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        elif path.endswith("/unban") and method == "POST":
            target_id = body.get("user_id")
            cur.execute(f"UPDATE {S}.users SET is_banned = FALSE WHERE id = %s", (target_id,))
            conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        elif path.endswith("/conversations") and method == "GET":
            cur.execute(f"""
                SELECT c.id, c.type, c.name, c.description, c.owner_id, c.is_locked, c.created_at,
                       (SELECT COUNT(*) FROM {S}.conversation_members WHERE conversation_id = c.id) as mc,
                       (SELECT COUNT(*) FROM {S}.messages WHERE conversation_id = c.id) as msgc
                FROM {S}.conversations c ORDER BY c.created_at DESC
            """)
            rows = cur.fetchall()
            result = [{"id": r[0], "type": r[1], "name": r[2], "description": r[3], "owner_id": r[4], "is_locked": r[5], "created_at": str(r[6]), "member_count": r[7], "message_count": r[8]} for r in rows]
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps(result)}

        elif path.endswith("/delete_message") and method == "POST":
            msg_id = body.get("message_id")
            cur.execute(f"UPDATE {S}.messages SET is_removed = TRUE WHERE id = %s", (msg_id,))
            conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        elif path.endswith("/all_messages") and method == "GET":
            params = event.get("queryStringParameters") or {}
            conv_id = params.get("conversation_id")
            if not conv_id:
                return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Укажи conversation_id"})}
            cur.execute(f"""
                SELECT m.id, m.content, m.is_removed, m.created_at,
                       u.id, u.username, u.display_name
                FROM {S}.messages m
                LEFT JOIN {S}.users u ON u.id = m.sender_id
                WHERE m.conversation_id = %s
                ORDER BY m.created_at ASC
            """, (int(conv_id),))
            rows = cur.fetchall()
            result = [{"id": r[0], "content": r[1], "is_removed": r[2], "created_at": str(r[3]),
                       "sender": {"id": r[4], "username": r[5], "display_name": r[6]} if r[4] else None} for r in rows]
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps(result)}

        return {"statusCode": 404, "headers": cors_headers(), "body": json.dumps({"error": "Маршрут не найден"})}

    finally:
        cur.close()
        conn.close()
