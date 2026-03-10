CREATE TABLE t_p20273256_folozoger_clone.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
)
