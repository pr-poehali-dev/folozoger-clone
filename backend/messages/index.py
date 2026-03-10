"""
Сообщения Folozoger: отправка, получение, удаление сообщений
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
    token = event.get("headers", {}).get("X-Auth-Token") or event.get("headers", {}).get("x-auth-token")
    params = event.get("queryStringParameters") or {}

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = get_conn()
    cur = conn.cursor()

    try:
        me = get_user_from_token(cur, token)

        if path.endswith("/send") and method == "POST":
            if not me:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            conv_id = body.get("conversation_id")
            content = (body.get("content") or "").strip()
            if not content:
                return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Сообщение не может быть пустым"})}

            cur.execute(f"SELECT id, type, owner_id, is_locked FROM {S}.conversations WHERE id = %s", (conv_id,))
            conv = cur.fetchone()
            if not conv:
                return {"statusCode": 404, "headers": cors_headers(), "body": json.dumps({"error": "Чат не найден"})}

            cur.execute(f"SELECT role FROM {S}.conversation_members WHERE conversation_id = %s AND user_id = %s", (conv_id, me))
            membership = cur.fetchone()
            if not membership:
                return {"statusCode": 403, "headers": cors_headers(), "body": json.dumps({"error": "Вы не состоите в этом чате"})}

            if conv[1] == "channel":
                cur.execute(f"SELECT username FROM {S}.users WHERE id = %s", (me,))
                uname = cur.fetchone()
                if not uname or uname[0] != "CoNNectioN":
                    return {"statusCode": 403, "headers": cors_headers(), "body": json.dumps({"error": "В этом канале писать может только администратор"})}

            cur.execute(
                f"INSERT INTO {S}.messages (conversation_id, sender_id, content) VALUES (%s, %s, %s) RETURNING id, created_at",
                (conv_id, me, content)
            )
            row = cur.fetchone()
            conn.commit()
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"id": row[0], "created_at": str(row[1]), "ok": True})
            }

        elif path.endswith("/list") and method == "GET":
            if not me:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            conv_id = params.get("conversation_id")
            if not conv_id:
                return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Укажи conversation_id"})}

            cur.execute(f"SELECT id FROM {S}.conversation_members WHERE conversation_id = %s AND user_id = %s", (int(conv_id), me))
            if not cur.fetchone():
                return {"statusCode": 403, "headers": cors_headers(), "body": json.dumps({"error": "Нет доступа"})}

            offset = int(params.get("offset", 0))
            cur.execute(f"""
                SELECT m.id, m.content, m.is_removed, m.created_at,
                       u.id as uid, u.username, u.display_name, u.avatar_url
                FROM {S}.messages m
                LEFT JOIN {S}.users u ON u.id = m.sender_id
                WHERE m.conversation_id = %s
                ORDER BY m.created_at ASC
                LIMIT 100 OFFSET %s
            """, (int(conv_id), offset))
            rows = cur.fetchall()
            result = []
            for r in rows:
                result.append({
                    "id": r[0],
                    "content": "[Сообщение удалено]" if r[2] else r[1],
                    "is_removed": r[2],
                    "created_at": str(r[3]),
                    "sender": {"id": r[4], "username": r[5], "display_name": r[6], "avatar_url": r[7]} if r[4] else None
                })
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps(result)}

        elif path.endswith("/remove") and method == "POST":
            if not me:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            msg_id = body.get("message_id")
            cur.execute(f"SELECT sender_id, conversation_id FROM {S}.messages WHERE id = %s", (msg_id,))
            msg = cur.fetchone()
            if not msg:
                return {"statusCode": 404, "headers": cors_headers(), "body": json.dumps({"error": "Сообщение не найдено"})}

            cur.execute(f"SELECT role FROM {S}.conversation_members WHERE conversation_id = %s AND user_id = %s", (msg[1], me))
            my_role = cur.fetchone()
            cur.execute(f"SELECT username FROM {S}.users WHERE id = %s", (me,))
            my_uname = cur.fetchone()

            is_owner = msg[0] == me
            is_admin = my_role and my_role[0] in ("owner", "admin")
            is_superadmin = my_uname and my_uname[0] == "CoNNectioN"

            if not (is_owner or is_admin or is_superadmin):
                return {"statusCode": 403, "headers": cors_headers(), "body": json.dumps({"error": "Нет прав удалять это сообщение"})}

            cur.execute(f"UPDATE {S}.messages SET is_removed = TRUE WHERE id = %s", (msg_id,))
            conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        return {"statusCode": 404, "headers": cors_headers(), "body": json.dumps({"error": "Маршрут не найден"})}

    finally:
        cur.close()
        conn.close()
