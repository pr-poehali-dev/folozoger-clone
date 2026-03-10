CREATE TABLE t_p20273256_folozoger_clone.blocked_users (id SERIAL PRIMARY KEY, blocker_id INTEGER, blocked_id INTEGER, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(blocker_id, blocked_id))
