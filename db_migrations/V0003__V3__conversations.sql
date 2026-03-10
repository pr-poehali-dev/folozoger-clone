CREATE TABLE t_p20273256_folozoger_clone.conversations (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  description TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  owner_id INTEGER REFERENCES t_p20273256_folozoger_clone.users(id),
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
)
