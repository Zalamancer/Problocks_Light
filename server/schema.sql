-- Multi-tenancy
CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id),
  teacher_id INT NOT NULL,
  name TEXT NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL DEFAULT 'math',
  grade_level INT NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id),
  role TEXT NOT NULL CHECK (role IN ('admin', 'school_admin', 'teacher', 'student')),
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT,
  pin_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (school_id, username)
);

CREATE TABLE IF NOT EXISTS class_members (
  class_id INT NOT NULL REFERENCES classes(id),
  user_id INT NOT NULL REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (class_id, user_id)
);

-- Player state
CREATE TABLE IF NOT EXISTS player_profiles (
  user_id INT PRIMARY KEY REFERENCES users(id),
  coins INT NOT NULL DEFAULT 0,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  login_streak INT NOT NULL DEFAULT 0,
  last_login DATE
);

CREATE TABLE IF NOT EXISTS player_positions (
  user_id INT PRIMARY KEY REFERENCES users(id),
  map_id TEXT NOT NULL DEFAULT 'dungeon-math',
  x INT NOT NULL DEFAULT 5,
  y INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items & Shop
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cosmetic')),
  category TEXT NOT NULL,
  cost_coins INT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common',
  sprite_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_inventory (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  item_id INT NOT NULL REFERENCES items(id),
  equipped BOOLEAN NOT NULL DEFAULT false,
  acquired_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_featured (
  id SERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES items(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL
);

-- Learning
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  subject_id INT NOT NULL REFERENCES subjects(id),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subtopics (
  id SERIAL PRIMARY KEY,
  topic_id INT NOT NULL REFERENCES topics(id),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_mastery (
  user_id INT NOT NULL REFERENCES users(id),
  subtopic_id INT NOT NULL REFERENCES subtopics(id),
  mastery_pct REAL NOT NULL DEFAULT 0,
  difficulty_level INT NOT NULL DEFAULT 1,
  correct_count INT NOT NULL DEFAULT 0,
  incorrect_count INT NOT NULL DEFAULT 0,
  avg_response_ms INT NOT NULL DEFAULT 0,
  last_attempted TIMESTAMPTZ,
  PRIMARY KEY (user_id, subtopic_id)
);

-- Question Cache
CREATE TABLE IF NOT EXISTS question_cache (
  id SERIAL PRIMARY KEY,
  subtopic_id INT NOT NULL REFERENCES subtopics(id),
  difficulty_level INT NOT NULL,
  question_text TEXT NOT NULL,
  choices_json JSONB NOT NULL,
  correct_index INT NOT NULL,
  explanation TEXT NOT NULL,
  encounter_type TEXT NOT NULL DEFAULT 'npc',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS answer_log (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  question_id INT REFERENCES question_cache(id),
  subtopic_id INT NOT NULL REFERENCES subtopics(id),
  is_correct BOOLEAN NOT NULL,
  response_ms INT NOT NULL DEFAULT 0,
  coins_earned INT NOT NULL DEFAULT 0,
  xp_earned INT NOT NULL DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leaderboard (materialized, refreshed on demand)
CREATE TABLE IF NOT EXISTS leaderboard (
  user_id INT PRIMARY KEY REFERENCES users(id),
  class_id INT NOT NULL,
  school_id INT NOT NULL,
  total_xp INT NOT NULL DEFAULT 0,
  total_coins_earned INT NOT NULL DEFAULT 0,
  questions_answered INT NOT NULL DEFAULT 0,
  accuracy_pct REAL NOT NULL DEFAULT 0,
  rank_class INT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_mastery_user ON student_mastery(user_id, subtopic_id);
CREATE INDEX IF NOT EXISTS idx_question_cache_lookup ON question_cache(subtopic_id, difficulty_level);
CREATE INDEX IF NOT EXISTS idx_answer_log_user ON answer_log(user_id, answered_at);
CREATE INDEX IF NOT EXISTS idx_leaderboard_class ON leaderboard(class_id, total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_class_members_class ON class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_classes_join_code ON classes(join_code);
