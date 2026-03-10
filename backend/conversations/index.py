"""
Чаты, группы и каналы Folozoger: создание, список, вступление, выход, управление
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

        if path.endswith("/list") and method == "GET":
            if not me:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            cur.execute(f"""
                SELECT c.id, c.type, c.name, c.description, c.avatar_url, c.owner_id, c.is_locked,
                       cm.role,
                       (SELECT COUNT(*) FROM {S}.conversation_members WHERE conversation_id = c.id) as member_count,
                       (SELECT u.username FROM {S}.users u WHERE u.id = c.owner_id) as owner_name
                FROM {S}.conversations c
                JOIN {S}.conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = %s
                ORDER BY c.created_at DESC
            """, (me,))
            rows = cur.fetchall()
            result = []
            for r in rows:
                result.append({
                    "id": r[0], "type": r[1], "name": r[2], "description": r[3],
                    "avatar_url": r[4], "owner_id": r[5], "is_locked": r[6],
                    "my_role": r[7], "member_count": r[8], "owner_name": r[9]
                })
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps(result)}

        elif path.endswith("/create") and method == "POST":
            if not me:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            ctype = body.get("type", "group")
            name = (body.get("name") or "").strip()
            description = body.get("description", "")
            if not name:
                return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Укажи название"})}

            cur.execute(
                f"INSERT INTO {S}.conversations (type, name, description, owner_id) VALUES (%s, %s, %s, %s) RETURNING id",
                (ctype, name, description, me)
            )
            conv_id = cur.fetchone()[0]
            cur.execute(
                f"INSERT INTO {S}.conversation_members (conversation_id, user_id, role) VALUES (%s, %s, 'owner')",
                (conv_id, me)
            )
            members = body.get("members", [])
            for uid in members:
                if uid != me:
                    cur.execute(
                        f"INSERT INTO {S}.conversation_members (conversation_id, user_id, role) VALUES (%s, %s, 'member') ON CONFLICT DO NOTHING",
                        (conv_id, uid)
                    )
            conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"id": conv_id, "ok": True})}

        elif path.endswith("/join") and method == "POST":
            if not me:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            conv_id = body.get("conversation_id")
            cur.execute(f"SELECT is_locked FROM {S}.conversations WHERE id = %s", (conv_id,))
            conv = cur.fetchone()
            if not conv:
                return {"statusCode": 404, "headers": cors_headers(), "body": json.dumps({"error": "Чат не найден"})}
            cur.execute(
                f"INSERT INTO {S}.conversation_members (conversation_id, user_id, role) VALUES (%s, %s, 'member') ON CONFLICT DO NOTHING",
                (conv_id, me)
            )
            conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        elif path.endswith("/leave") and method == "POST":
            if not me:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            conv_id = body.get("conversation_id")
            cur.execute(f"SELECT is_locked, owner_id FROM {S}.conversations WHERE id = %s", (conv_id,))
            conv = cur.fetchone()
            if not conv:
                return {"statusCode": 404, "headers": cors_headers(), "body": json.dumps({"error": "Чат не найден"})}
            if conv[0]:
                return {"statusCode": 403, "headers": cors_headers(), "body": json.dumps({"error": "Из этого канала нельзя выйти"})}
            cur.execute(f"DELETE FROM {S}.conversation_members WHERE conversation_id = %s AND user_id = %s", (conv_id, me))
            conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        elif path.endswith("/members") and method == "GET":
            params = event.get("queryStringParameters") or {}
            conv_id = params.get("conversation_id")
            if not conv_id:
                return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Укажи conversation_id"})}
            cur.execute(f"""
                SELECT u.id, u.username, u.display_name, u.avatar_url, cm.role
                FROM {S}.conversation_members cm
                JOIN {S}.users u ON u.id = cm.user_id
                WHERE cm.conversation_id = %s
                ORDER BY cm.joined_at ASC
            """, (int(conv_id),))
            rows = cur.fetchall()
            result = [{"id": r[0], "username": r[1], "display_name": r[2], "avatar_url": r[3], "role": r[4]} for r in rows]
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps(result)}

        elif path.endswith("/kick") and method == "POST":
            if not me:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            conv_id = body.get("conversation_id")
            target_id = body.get("user_id")
            cur.execute(f"SELECT role FROM {S}.conversation_members WHERE conversation_id = %s AND user_id = %s", (conv_id, me))
            my_role = cur.fetchone()
            if not my_role or my_role[0] not in ("owner", "admin"):
                return {"statusCode": 403, "headers": cors_headers(), "body": json.dumps({"error": "Недостаточно прав"})}
            cur.execute(f"DELETE FROM {S}.conversation_members WHERE conversation_id = %s AND user_id = %s", (conv_id, target_id))
            conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        elif path.endswith("/direct") and method == "POST":
            if not me:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            other_id = body.get("user_id")
            if not other_id or other_id == me:
                return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Неверный пользователь"})}

            cur.execute(f"""
                SELECT c.id FROM {S}.conversations c
                JOIN {S}.conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = %s
                JOIN {S}.conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = %s
                WHERE c.type = 'direct'
                LIMIT 1
            """, (me, other_id))
            existing = cur.fetchone()
            if existing:
                return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"id": existing[0], "ok": True})}

            cur.execute(f"SELECT display_name FROM {S}.users WHERE id = %s", (other_id,))
            other_user = cur.fetchone()
            cur.execute(f"SELECT display_name FROM {S}.users WHERE id = %s", (me,))
            my_user = cur.fetchone()
            name = f"{my_user[0] if my_user else 'User'} & {other_user[0] if other_user else 'User'}"

            cur.execute(
                f"INSERT INTO {S}.conversations (type, name, owner_id) VALUES ('direct', %s, %s) RETURNING id",
                (name, me)
            )
            conv_id = cur.fetchone()[0]
            cur.execute(f"INSERT INTO {S}.conversation_members (conversation_id, user_id, role) VALUES (%s, %s, 'member')", (conv_id, me))
            cur.execute(f"INSERT INTO {S}.conversation_members (conversation_id, user_id, role) VALUES (%s, %s, 'member')", (conv_id, other_id))
            conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"id": conv_id, "ok": True})}

        elif path.endswith("/public") and method == "GET":
            cur.execute(f"""
                SELECT c.id, c.type, c.name, c.description, c.avatar_url, c.owner_id,
                       (SELECT COUNT(*) FROM {S}.conversation_members WHERE conversation_id = c.id) as member_count
                FROM {S}.conversations c
                WHERE c.type IN ('group', 'channel')
                ORDER BY member_count DESC
                LIMIT 50
            """)
            rows = cur.fetchall()
            result = [{"id": r[0], "type": r[1], "name": r[2], "description": r[3], "avatar_url": r[4], "owner_id": r[5], "member_count": r[6]} for r in rows]
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps(result)}

        elif path.endswith("/update") and method == "PUT":
            if not me:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
            conv_id = body.get("conversation_id")
            cur.execute(f"SELECT role FROM {S}.conversation_members WHERE conversation_id = %s AND user_id = %s", (conv_id, me))
            my_role = cur.fetchone()
            if not my_role or my_role[0] not in ("owner", "admin"):
                return {"statusCode": 403, "headers": cors_headers(), "body": json.dumps({"error": "Недостаточно прав"})}
            name = body.get("name")
            description = body.get("description")
            if name:
                cur.execute(f"UPDATE {S}.conversations SET name = %s WHERE id = %s", (name, conv_id))
            if description is not None:
                cur.execute(f"UPDATE {S}.conversations SET description = %s WHERE id = %s", (description, conv_id))
            conn.commit()
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        return {"statusCode": 404, "headers": cors_headers(), "body": json.dumps({"error": "Маршрут не найден"})}

    finally:
        cur.close()
        conn.close()
