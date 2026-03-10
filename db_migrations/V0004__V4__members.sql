CREATE TABLE t_p20273256_folozoger_clone.conversation_members (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES t_p20273256_folozoger_clone.conversations(id),
  user_id INTEGER REFERENCES t_p20273256_folozoger_clone.users(id),
  role VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
)
