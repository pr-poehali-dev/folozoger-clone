CREATE TABLE t_p20273256_folozoger_clone.sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES t_p20273256_folozoger_clone.users(id),
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)
