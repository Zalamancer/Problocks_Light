# Problocks Light Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable demo of an educational RPG — single dungeon map, AI-adaptive math questions via NPC encounters, coin economy with basic shop, classroom leaderboard, and teacher dashboard — targeting Chromebooks at Harmony Science Academy.

**Architecture:** Node.js + Express monolith with PostgreSQL. PixiJS renders the 2D top-down RPG client-side. REST API for all Phase 1 interactions (no WebSocket needed — NPC encounters are request/response). Server-authoritative: all rewards and answers validated server-side.

**Tech Stack:** Node.js 20+, Express, PostgreSQL 15+, PixiJS 8, bcrypt, pino (logging), Chart.js, vitest (testing), supertest (HTTP testing)

**Spec Reference:** `docs/superpowers/specs/2026-04-04-problocks-light-mvp-design.md`

---

## File Structure

```
Problocks_Light/
├── package.json
├── .env.example
├── .gitignore
├── vitest.config.js
├── server/
│   ├── index.js                  # Express app setup + server start
│   ├── app.js                    # Express app (exported for testing)
│   ├── db.js                     # PostgreSQL pool connection
│   ├── schema.sql                # Full database schema DDL
│   ├── seed.sql                  # Seed data (math subtopics, shop items)
│   ├── middleware/
│   │   ├── auth.js               # Cookie session auth + role guard
│   │   └── errors.js             # Global error handler + pino logging
│   ├── routes/
│   │   ├── auth.js               # POST login/join/logout
│   │   ├── game.js               # GET map, POST encounter/answer, GET profile
│   │   ├── shop.js               # GET catalog/featured, POST buy
│   │   ├── inventory.js          # GET list, POST equip
│   │   ├── leaderboard.js        # GET /:classId
│   │   ├── teacher.js            # Class management, roster, analytics, PIN reset
│   │   └── health.js             # GET /health
│   └── services/
│       ├── ai.js                 # Gemini API client + fallback provider
│       ├── adaptive.js           # Subtopic selection + difficulty ladder
│       ├── questions.js          # Question cache + generation orchestration
│       └── economy.js            # Coin rewards + purchase validation
├── public/
│   ├── index.html                # Game shell (loads PixiJS app)
│   ├── login.html                # Student join/login page
│   ├── teacher.html              # Teacher dashboard shell
│   ├── css/
│   │   ├── game.css              # Game UI styles (HUD, dialogue, shop)
│   │   ├── login.css             # Login page styles
│   │   └── teacher.css           # Dashboard styles
│   ├── js/
│   │   ├── api.js                # Thin REST client (fetch wrapper)
│   │   ├── auth.js               # Login/join form handlers
│   │   ├── game/
│   │   │   ├── engine.js         # PixiJS app init, game loop, scene management
│   │   │   ├── map.js            # Tilemap loader + renderer + collision
│   │   │   ├── player.js         # Player sprite, movement, input handling
│   │   │   ├── npc.js            # NPC sprites, interaction zones
│   │   │   ├── dialogue.js       # Question dialogue box UI
│   │   │   ├── hud.js            # Coins, XP, level display
│   │   │   └── shop-ui.js        # Shop overlay UI
│   │   └── teacher/
│   │       ├── dashboard.js      # Dashboard page logic
│   │       └── charts.js         # Chart.js leaderboard + accuracy charts
│   └── assets/
│       ├── sprites/              # Character + NPC spritesheets (PNG + JSON)
│       ├── tiles/                # Tileset PNGs
│       ├── maps/
│       │   └── dungeon-math.json # The Phase 1 dungeon map (Tiled export)
│       └── ui/                   # Dialogue box frames, buttons, icons
└── tests/
    ├── setup.js                  # Test DB creation + teardown helpers
    ├── auth.test.js
    ├── game.test.js
    ├── shop.test.js
    ├── adaptive.test.js
    ├── economy.test.js
    ├── leaderboard.test.js
    └── teacher.test.js
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `vitest.config.js`
- Create: `server/app.js`
- Create: `server/index.js`
- Create: `server/routes/health.js`
- Create: `server/middleware/errors.js`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/ihsanduru/Problocks_Light
git init
```

- [ ] **Step 2: Create package.json with dependencies**

```bash
npm init -y
npm install express pg bcrypt cookie-parser pino pino-pretty
npm install -D vitest supertest
```

Key dependencies:
- `express` — HTTP server
- `pg` — PostgreSQL client
- `bcrypt` — password/PIN hashing
- `cookie-parser` — session cookies
- `pino` + `pino-pretty` — structured logging
- `vitest` — test runner
- `supertest` — HTTP assertion testing

- [ ] **Step 3: Create .gitignore**

```
node_modules/
.env
*.log
```

- [ ] **Step 4: Create .env.example**

```
DATABASE_URL=postgresql://localhost:5432/problocks
GEMINI_API_KEY=your-gemini-key
SESSION_SECRET=change-me-to-random-string
PORT=3000
NODE_ENV=development
```

- [ ] **Step 5: Create vitest.config.js**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.js'],
  },
});
```

- [ ] **Step 6: Create error handling middleware**

Create `server/middleware/errors.js`:
```js
import pino from 'pino';

export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
});

export function errorHandler(err, req, res, next) {
  logger.error({ err, method: req.method, url: req.url }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
}
```

- [ ] **Step 7: Create health route**

Create `server/routes/health.js`:
```js
import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unhealthy' });
  }
});

export default router;
```

- [ ] **Step 8: Create Express app (server/app.js)**

```js
import express from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errors.js';
import healthRouter from './routes/health.js';

const app = express();

app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET || 'dev-secret-change-me'));
app.use(express.static('public'));
app.use(healthRouter);
app.use(errorHandler);

export default app;
```

- [ ] **Step 9: Create server entry point (server/index.js)**

```js
import app from './app.js';
import { logger } from './middleware/errors.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Problocks Light server started');
});
```

- [ ] **Step 10: Add scripts to package.json**

Add to `package.json`:
```json
{
  "type": "module",
  "scripts": {
    "start": "node server/index.js",
    "dev": "node --watch server/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 11: Create test setup stub**

Create `tests/setup.js`:
```js
// Test database setup — will be populated in Task 2
```

- [ ] **Step 12: Verify server starts**

```bash
node server/index.js
# Should log: Problocks Light server started on port 3000
# Ctrl+C to stop
```

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Express, health check, error handling"
```

---

## Task 2: Database Schema + Connection

**Files:**
- Create: `server/db.js`
- Create: `server/schema.sql`
- Create: `server/seed.sql`
- Modify: `tests/setup.js`

- [ ] **Step 1: Create PostgreSQL connection pool**

Create `server/db.js`:
```js
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/problocks',
});
```

- [ ] **Step 2: Create schema.sql (Phase 1 tables only)**

Create `server/schema.sql`:
```sql
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

-- Leaderboard (materialized view, refreshed on demand)
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
```

- [ ] **Step 3: Create seed.sql (math curriculum + shop items)**

Create `server/seed.sql`:
```sql
-- School for testing
INSERT INTO schools (name) VALUES ('Harmony Science Academy') ON CONFLICT DO NOTHING;

-- Math subject + topics + subtopics
INSERT INTO subjects (name) VALUES ('Math') ON CONFLICT (name) DO NOTHING;

INSERT INTO topics (subject_id, name) VALUES
  (1, 'Arithmetic'),
  (1, 'Fractions'),
  (1, 'Decimals'),
  (1, 'Percentages'),
  (1, 'Algebra Basics'),
  (1, 'Geometry Basics')
ON CONFLICT DO NOTHING;

-- Arithmetic subtopics
INSERT INTO subtopics (topic_id, name) VALUES
  (1, 'Addition and Subtraction'),
  (1, 'Multiplication'),
  (1, 'Division'),
  (1, 'Order of Operations'),
  (1, 'Word Problems - Arithmetic');

-- Fractions subtopics
INSERT INTO subtopics (topic_id, name) VALUES
  (2, 'Adding Fractions'),
  (2, 'Subtracting Fractions'),
  (2, 'Multiplying Fractions'),
  (2, 'Dividing Fractions'),
  (2, 'Mixed Numbers');

-- Decimals subtopics
INSERT INTO subtopics (topic_id, name) VALUES
  (3, 'Decimal Addition and Subtraction'),
  (3, 'Decimal Multiplication'),
  (3, 'Converting Decimals to Fractions');

-- Percentages subtopics
INSERT INTO subtopics (topic_id, name) VALUES
  (4, 'Finding Percentages'),
  (4, 'Percent Increase and Decrease'),
  (4, 'Percent Word Problems');

-- Algebra subtopics
INSERT INTO subtopics (topic_id, name) VALUES
  (5, 'Variables and Expressions'),
  (5, 'Solving One-Step Equations'),
  (5, 'Solving Two-Step Equations');

-- Geometry subtopics
INSERT INTO subtopics (topic_id, name) VALUES
  (6, 'Area and Perimeter'),
  (6, 'Volume'),
  (6, 'Angles');

-- Shop items (10 cosmetic items for Phase 1)
INSERT INTO items (name, type, category, cost_coins, rarity, sprite_key) VALUES
  ('Blue Wizard Hat', 'cosmetic', 'hat', 50, 'common', 'hat_blue_wizard'),
  ('Red Cape', 'cosmetic', 'outfit', 100, 'common', 'outfit_red_cape'),
  ('Green Hood', 'cosmetic', 'hat', 75, 'common', 'hat_green_hood'),
  ('Gold Armor', 'cosmetic', 'outfit', 500, 'rare', 'outfit_gold_armor'),
  ('Shadow Cloak', 'cosmetic', 'outfit', 300, 'uncommon', 'outfit_shadow_cloak'),
  ('Crystal Crown', 'cosmetic', 'hat', 1000, 'epic', 'hat_crystal_crown'),
  ('Flame Boots', 'cosmetic', 'accessory', 200, 'uncommon', 'acc_flame_boots'),
  ('Pixel Cat', 'cosmetic', 'pet', 400, 'rare', 'pet_pixel_cat'),
  ('Dragon Egg', 'cosmetic', 'pet', 2000, 'epic', 'pet_dragon_egg'),
  ('Starter Pack', 'cosmetic', 'outfit', 25, 'common', 'outfit_starter')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 4: Create test database and run schema**

```bash
createdb problocks_test
psql problocks_test < server/schema.sql
psql problocks_test < server/seed.sql
```

- [ ] **Step 5: Create production database and run schema**

```bash
createdb problocks
psql problocks < server/schema.sql
psql problocks < server/seed.sql
```

- [ ] **Step 6: Update tests/setup.js with test DB helpers**

```js
import pg from 'pg';

const testPool = new pg.Pool({
  connectionString: 'postgresql://localhost:5432/problocks_test',
});

export async function resetTestDb() {
  await testPool.query(`
    TRUNCATE answer_log, leaderboard, player_inventory, shop_featured,
    player_positions, player_profiles, student_mastery, class_members,
    question_cache, classes, users RESTART IDENTITY CASCADE
  `);
}

export async function seedTestSchool() {
  const { rows } = await testPool.query(
    `SELECT id FROM schools WHERE name = 'Harmony Science Academy'`
  );
  return rows[0].id;
}

export { testPool };
```

- [ ] **Step 7: Write test verifying DB connection + schema**

Create `tests/db.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { testPool } from './setup.js';

describe('Database', () => {
  it('connects and has tables', async () => {
    const { rows } = await testPool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    const tables = rows.map(r => r.table_name);
    expect(tables).toContain('users');
    expect(tables).toContain('classes');
    expect(tables).toContain('player_profiles');
    expect(tables).toContain('question_cache');
    expect(tables).toContain('student_mastery');
  });

  it('has seeded math subtopics', async () => {
    const { rows } = await testPool.query('SELECT COUNT(*) as count FROM subtopics');
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(20);
  });

  it('has seeded shop items', async () => {
    const { rows } = await testPool.query('SELECT COUNT(*) as count FROM items');
    expect(Number(rows[0].count)).toBe(10);
  });
});
```

- [ ] **Step 8: Run tests**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/db.test.js
```
Expected: 3 tests PASS

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: database schema, seed data (math curriculum + shop items), DB connection pool"
```

---

## Task 3: Authentication System

**Files:**
- Create: `server/middleware/auth.js`
- Create: `server/routes/auth.js`
- Create: `tests/auth.test.js`
- Modify: `server/app.js` — mount auth routes

- [ ] **Step 1: Write failing auth tests**

Create `tests/auth.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server/app.js';
import { resetTestDb, seedTestSchool, testPool } from './setup.js';
import bcrypt from 'bcrypt';

describe('Auth', () => {
  let schoolId;

  beforeEach(async () => {
    await resetTestDb();
    schoolId = await seedTestSchool();
  });

  describe('POST /api/auth/teacher/login', () => {
    it('logs in teacher with correct credentials', async () => {
      const hash = await bcrypt.hash('password123', 10);
      await testPool.query(
        `INSERT INTO users (school_id, role, username, display_name, email, password_hash)
         VALUES ($1, 'teacher', 'msmith', 'Mr Smith', 'msmith@hsa.edu', $2)`,
        [schoolId, hash]
      );

      const res = await request(app)
        .post('/api/auth/teacher/login')
        .send({ email: 'msmith@hsa.edu', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('teacher');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejects wrong password', async () => {
      const hash = await bcrypt.hash('password123', 10);
      await testPool.query(
        `INSERT INTO users (school_id, role, username, display_name, email, password_hash)
         VALUES ($1, 'teacher', 'msmith', 'Mr Smith', 'msmith@hsa.edu', $2)`,
        [schoolId, hash]
      );

      const res = await request(app)
        .post('/api/auth/teacher/login')
        .send({ email: 'msmith@hsa.edu', password: 'wrong' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/student/join', () => {
    it('creates student account with class code + username + PIN', async () => {
      const hash = await bcrypt.hash('password123', 10);
      const { rows: [teacher] } = await testPool.query(
        `INSERT INTO users (school_id, role, username, display_name, email, password_hash)
         VALUES ($1, 'teacher', 'msmith', 'Mr Smith', 'msmith@hsa.edu', $2) RETURNING id`,
        [schoolId, hash]
      );
      await testPool.query(
        `INSERT INTO classes (school_id, teacher_id, name, join_code, subject, grade_level)
         VALUES ($1, $2, 'Math 6A', 'ABC123', 'math', 6)`,
        [schoolId, teacher.id]
      );

      const res = await request(app)
        .post('/api/auth/student/join')
        .send({ joinCode: 'ABC123', username: 'johnny', displayName: 'Johnny', pin: '1234' });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('student');
      expect(res.body.user.username).toBe('johnny');
    });

    it('rejects invalid join code', async () => {
      const res = await request(app)
        .post('/api/auth/student/join')
        .send({ joinCode: 'INVALID', username: 'johnny', displayName: 'Johnny', pin: '1234' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/auth/student/login', () => {
    it('logs in student with username + PIN', async () => {
      const teacherHash = await bcrypt.hash('password123', 10);
      const { rows: [teacher] } = await testPool.query(
        `INSERT INTO users (school_id, role, username, display_name, email, password_hash)
         VALUES ($1, 'teacher', 'msmith', 'Mr Smith', 'msmith@hsa.edu', $2) RETURNING id`,
        [schoolId, teacherHash]
      );
      const { rows: [cls] } = await testPool.query(
        `INSERT INTO classes (school_id, teacher_id, name, join_code) VALUES ($1, $2, 'Math 6A', 'ABC123') RETURNING id`,
        [schoolId, teacher.id]
      );
      const pinHash = await bcrypt.hash('1234', 10);
      const { rows: [student] } = await testPool.query(
        `INSERT INTO users (school_id, role, username, display_name, pin_hash)
         VALUES ($1, 'student', 'johnny', 'Johnny', $2) RETURNING id`,
        [schoolId, pinHash]
      );
      await testPool.query(
        `INSERT INTO class_members (class_id, user_id) VALUES ($1, $2)`,
        [cls.id, student.id]
      );

      const res = await request(app)
        .post('/api/auth/student/login')
        .send({ username: 'johnny', pin: '1234', schoolId });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('student');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears session cookie', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/auth.test.js
```
Expected: FAIL — routes don't exist yet

- [ ] **Step 3: Create auth middleware**

Create `server/middleware/auth.js`:
```js
import jwt from 'jsonwebtoken'; // We'll use signed cookies instead — simpler

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

export function createSession(res, user) {
  const payload = JSON.stringify({
    id: user.id,
    role: user.role,
    schoolId: user.school_id,
  });
  // Base64 + HMAC signature via cookie-parser's signed cookies
  res.cookie('session', payload, {
    httpOnly: true,
    signed: true,
    maxAge: user.role === 'student' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  });
}

export function requireAuth(req, res, next) {
  const session = req.signedCookies?.session;
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = JSON.parse(session);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

Note: Add `cookie-parser` with secret. Update `server/app.js`:
```js
app.use(cookieParser(process.env.SESSION_SECRET || 'dev-secret-change-me'));
```

- [ ] **Step 4: Create auth routes**

Create `server/routes/auth.js`:
```js
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db.js';
import { createSession } from '../middleware/auth.js';
import { logger } from '../middleware/errors.js';
import crypto from 'crypto';

const router = Router();

// Teacher login
router.post('/api/auth/teacher/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      `SELECT id, school_id, role, username, display_name, password_hash
       FROM users WHERE email = $1 AND role = 'teacher'`,
      [email]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    logger.info({ userId: user.id }, 'Teacher login');
    createSession(res, user);
    res.json({ user: { id: user.id, role: user.role, displayName: user.display_name } });
  } catch (err) { next(err); }
});

// Student join (create account)
router.post('/api/auth/student/join', async (req, res, next) => {
  try {
    const { joinCode, username, displayName, pin } = req.body;

    // Find class by join code
    const { rows: classes } = await pool.query(
      `SELECT id, school_id FROM classes WHERE join_code = $1`,
      [joinCode]
    );
    if (classes.length === 0) return res.status(404).json({ error: 'Invalid class code' });

    const cls = classes[0];
    const pinHash = await bcrypt.hash(pin, 10);

    // Create student
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (school_id, role, username, display_name, pin_hash)
       VALUES ($1, 'student', $2, $3, $4) RETURNING id, school_id, role, username, display_name`,
      [cls.school_id, username, displayName, pinHash]
    );

    // Add to class
    await pool.query(
      `INSERT INTO class_members (class_id, user_id) VALUES ($1, $2)`,
      [cls.id, user.id]
    );

    // Create player profile
    await pool.query(
      `INSERT INTO player_profiles (user_id) VALUES ($1)`,
      [user.id]
    );

    // Create player position
    await pool.query(
      `INSERT INTO player_positions (user_id) VALUES ($1)`,
      [user.id]
    );

    logger.info({ userId: user.id, classId: cls.id }, 'Student joined');
    createSession(res, user);
    res.status(201).json({ user: { id: user.id, role: user.role, username: user.username, displayName: user.display_name } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already taken' });
    next(err);
  }
});

// Student login
router.post('/api/auth/student/login', async (req, res, next) => {
  try {
    const { username, pin, schoolId } = req.body;
    const { rows } = await pool.query(
      `SELECT id, school_id, role, username, display_name, pin_hash
       FROM users WHERE username = $1 AND school_id = $2 AND role = 'student'`,
      [username, schoolId]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Update login streak and award streak bonus coins
    const { rows: [profile] } = await pool.query(
      `UPDATE player_profiles
       SET login_streak = CASE
         WHEN last_login = CURRENT_DATE - INTERVAL '1 day' THEN login_streak + 1
         WHEN last_login = CURRENT_DATE THEN login_streak
         ELSE 1
       END,
       last_login = CURRENT_DATE
       WHERE user_id = $1
       RETURNING login_streak, last_login`,
      [user.id]
    );
    // Award streak bonus coins (10/20/30/50/100 at days 1/3/7/14/30)
    const STREAK_BONUSES = { 30: 100, 14: 50, 7: 30, 3: 20, 1: 10 };
    const streak = profile.login_streak;
    for (const [day, bonus] of Object.entries(STREAK_BONUSES)) {
      if (streak >= Number(day)) {
        await pool.query('UPDATE player_profiles SET coins = coins + $1 WHERE user_id = $2', [bonus, user.id]);
        break;
      }
    }

    logger.info({ userId: user.id }, 'Student login');
    createSession(res, user);
    res.json({ user: { id: user.id, role: user.role, username: user.username, displayName: user.display_name } });
  } catch (err) { next(err); }
});

// Logout
router.post('/api/auth/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 5: Mount auth routes in app.js**

Update `server/app.js` to import and use `authRouter`:
```js
import authRouter from './routes/auth.js';
// ...
app.use(authRouter);
```

- [ ] **Step 6: Run tests**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/auth.test.js
```
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: auth system — teacher login, student join/login, session cookies, role guards"
```

---

## Task 4: Adaptive Learning Engine

**Files:**
- Create: `server/services/ai.js`
- Create: `server/services/adaptive.js`
- Create: `server/services/questions.js`
- Create: `tests/adaptive.test.js`

- [ ] **Step 1: Write failing adaptive algorithm tests**

Create `tests/adaptive.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { pickSubtopic, adjustDifficulty } from '../server/services/adaptive.js';

describe('Adaptive Algorithm', () => {
  describe('pickSubtopic', () => {
    it('picks weakest subtopic most often (60% weight)', () => {
      const mastery = [
        { subtopic_id: 1, mastery_pct: 20, last_attempted: new Date() },
        { subtopic_id: 2, mastery_pct: 80, last_attempted: new Date() },
        { subtopic_id: 3, mastery_pct: 50, last_attempted: null },
      ];
      const picks = {};
      for (let i = 0; i < 1000; i++) {
        const id = pickSubtopic(mastery).subtopic_id;
        picks[id] = (picks[id] || 0) + 1;
      }
      // Subtopic 1 (weakest) should be picked most
      expect(picks[1]).toBeGreaterThan(picks[2]);
    });

    it('returns a subtopic even with empty mastery (all new)', () => {
      const mastery = [
        { subtopic_id: 1, mastery_pct: 0, last_attempted: null },
        { subtopic_id: 2, mastery_pct: 0, last_attempted: null },
      ];
      const result = pickSubtopic(mastery);
      expect(result.subtopic_id).toBeDefined();
    });
  });

  describe('adjustDifficulty', () => {
    it('increases difficulty after 3 correct in a row', () => {
      expect(adjustDifficulty(2, 3, 0)).toBe(3);
    });

    it('decreases difficulty after 3 wrong in a row', () => {
      expect(adjustDifficulty(3, 0, 3)).toBe(2);
    });

    it('stays at level 1 minimum', () => {
      expect(adjustDifficulty(1, 0, 5)).toBe(1);
    });

    it('caps at level 5 maximum', () => {
      expect(adjustDifficulty(5, 5, 0)).toBe(5);
    });

    it('does not change with mixed results', () => {
      expect(adjustDifficulty(3, 2, 1)).toBe(3);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/adaptive.test.js
```
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement adaptive.js**

Create `server/services/adaptive.js`:
```js
/**
 * Pick next subtopic based on mastery data.
 * 60% weakest (gap pushing), 25% recently learned (reinforcement), 15% new (exploration)
 */
export function pickSubtopic(masteryData) {
  if (masteryData.length === 0) throw new Error('No subtopics available');

  const roll = Math.random();
  const sorted = [...masteryData].sort((a, b) => a.mastery_pct - b.mastery_pct);
  const attempted = sorted.filter(m => m.last_attempted !== null);
  const unattempted = sorted.filter(m => m.last_attempted === null);

  if (roll < 0.60) {
    // Gap pushing — weakest subtopic
    return sorted[0];
  } else if (roll < 0.85 && attempted.length > 0) {
    // Reinforcement — recently attempted, pick randomly from attempted
    const recent = attempted.sort((a, b) =>
      new Date(b.last_attempted) - new Date(a.last_attempted)
    );
    return recent[Math.floor(Math.random() * Math.min(3, recent.length))];
  } else if (unattempted.length > 0) {
    // Exploration — new subtopic
    return unattempted[Math.floor(Math.random() * unattempted.length)];
  }
  // Fallback to weakest
  return sorted[0];
}

/**
 * Adjust difficulty level based on recent streak.
 * 3 correct in a row → up. 3 wrong in a row → down.
 * Range: 1-5.
 */
export function adjustDifficulty(currentLevel, recentCorrectStreak, recentWrongStreak) {
  let level = currentLevel;
  if (recentCorrectStreak >= 3) level = Math.min(5, level + 1);
  if (recentWrongStreak >= 3) level = Math.max(1, level - 1);
  return level;
}
```

- [ ] **Step 4: Run tests**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/adaptive.test.js
```
Expected: All PASS

- [ ] **Step 5: Create AI service (Gemini + fallback)**

Create `server/services/ai.js`:
```js
import { logger } from '../middleware/errors.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const DIFFICULTY_LABELS = ['foundational', 'basic', 'intermediate', 'advanced', 'challenge'];

export async function generateQuestion({ subtopicName, difficultyLevel, gradeLevel, encounterType, recentAnswers }) {
  const difficultyLabel = DIFFICULTY_LABELS[difficultyLevel - 1] || 'basic';
  const historyContext = recentAnswers.length > 0
    ? `Student's recent answers on this topic: ${recentAnswers.map(a => a.is_correct ? 'correct' : 'incorrect').join(', ')}`
    : 'This is the student\'s first question on this topic.';

  const prompt = `Generate a ${difficultyLabel}-level math question about "${subtopicName}" for grade ${gradeLevel}.

${historyContext}

Respond in this exact JSON format:
{
  "question": "the question text",
  "choices": ["choice A", "choice B", "choice C", "choice D"],
  "correctIndex": 0,
  "explanation": "why the correct answer is right"
}

Make the question engaging for a student playing an RPG game. The question should be ${encounterType === 'npc' ? 'presented as dialogue from a wise NPC character' : 'a challenge'}.
Keep the language clear and age-appropriate.`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
      }),
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in Gemini response');

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    logger.error({ err }, 'AI question generation failed');
    throw err;
  }
}
```

- [ ] **Step 6: Create question orchestration service (cache + generation)**

Create `server/services/questions.js`:
```js
import { pool } from '../db.js';
import { generateQuestion } from './ai.js';
import { pickSubtopic, adjustDifficulty } from './adaptive.js';
import { logger } from '../middleware/errors.js';

/**
 * Get the next question for a student, using cache when possible.
 */
export async function getNextQuestion(userId, classSubject, gradeLevel) {
  // 1. Get student mastery data
  const { rows: mastery } = await pool.query(
    `SELECT sm.subtopic_id, sm.mastery_pct, sm.difficulty_level, sm.last_attempted,
            s.name as subtopic_name
     FROM subtopics s
     JOIN topics t ON s.topic_id = t.id
     JOIN subjects sub ON t.subject_id = sub.id
     LEFT JOIN student_mastery sm ON sm.subtopic_id = s.id AND sm.user_id = $1
     WHERE sub.name = $2`,
    [userId, classSubject]
  );

  // Initialize mastery for subtopics student hasn't seen
  const masteryData = mastery.map(m => ({
    subtopic_id: m.subtopic_id,
    subtopic_name: m.subtopic_name,
    mastery_pct: m.mastery_pct ?? 0,
    difficulty_level: m.difficulty_level ?? 1,
    last_attempted: m.last_attempted,
  }));

  // 2. Pick subtopic using adaptive algorithm
  const target = pickSubtopic(masteryData);

  // 3. Get recent answers for difficulty adjustment
  const { rows: recentAnswers } = await pool.query(
    `SELECT is_correct FROM answer_log
     WHERE user_id = $1 AND subtopic_id = $2
     ORDER BY answered_at DESC LIMIT 5`,
    [userId, target.subtopic_id]
  );

  // Calculate streaks
  let correctStreak = 0, wrongStreak = 0;
  for (const a of recentAnswers) {
    if (a.is_correct) { correctStreak++; wrongStreak = 0; }
    else { wrongStreak++; correctStreak = 0; }
  }
  const difficulty = adjustDifficulty(target.difficulty_level, correctStreak, wrongStreak);

  // 4. Try cache first
  const { rows: cached } = await pool.query(
    `SELECT id, question_text, choices_json, explanation
     FROM question_cache
     WHERE subtopic_id = $1 AND difficulty_level = $2
     AND id NOT IN (SELECT question_id FROM answer_log WHERE user_id = $3 AND question_id IS NOT NULL)
     ORDER BY RANDOM() LIMIT 1`,
    [target.subtopic_id, difficulty, userId]
  );

  if (cached.length > 0) {
    logger.info({ subtopicId: target.subtopic_id, cache: 'hit' }, 'Question served from cache');
    return {
      questionId: cached[0].id,
      subtopicId: target.subtopic_id,
      subtopicName: target.subtopic_name,
      difficulty,
      question: cached[0].question_text,
      choices: cached[0].choices_json,
      explanation: cached[0].explanation,
    };
  }

  // 5. Generate fresh question via AI
  logger.info({ subtopicId: target.subtopic_id, cache: 'miss' }, 'Generating fresh question');
  const generated = await generateQuestion({
    subtopicName: target.subtopic_name,
    difficultyLevel: difficulty,
    gradeLevel,
    encounterType: 'npc',
    recentAnswers,
  });

  // 6. Cache the question (including correct_index for grading)
  const { rows: [inserted] } = await pool.query(
    `INSERT INTO question_cache (subtopic_id, difficulty_level, question_text, choices_json, correct_index, explanation, encounter_type)
     VALUES ($1, $2, $3, $4, $5, $6, 'npc') RETURNING id`,
    [target.subtopic_id, difficulty, generated.question, JSON.stringify(generated.choices), generated.correctIndex, generated.explanation]
  );

  return {
    questionId: inserted.id,
    subtopicId: target.subtopic_id,
    subtopicName: target.subtopic_name,
    difficulty,
    question: generated.question,
    choices: generated.choices,
    correctIndex: generated.correctIndex,
    explanation: generated.explanation,
  };
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: adaptive learning engine — subtopic selection, difficulty ladder, AI question generation with caching"
```

---

## Task 5: Economy Service

**Files:**
- Create: `server/services/economy.js`
- Create: `tests/economy.test.js`

- [ ] **Step 1: Write failing economy tests**

Create `tests/economy.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { calculateReward, canAfford } from '../server/services/economy.js';

describe('Economy', () => {
  describe('calculateReward', () => {
    it('awards 5 coins + 10 XP for easy correct', () => {
      const reward = calculateReward(1, true);
      expect(reward).toEqual({ coins: 5, xp: 10 });
    });

    it('awards 10 coins + 20 XP for medium correct', () => {
      const reward = calculateReward(3, true);
      expect(reward).toEqual({ coins: 10, xp: 20 });
    });

    it('awards 20 coins + 40 XP for hard correct', () => {
      const reward = calculateReward(5, true);
      expect(reward).toEqual({ coins: 20, xp: 40 });
    });

    it('awards 0 coins + 5 XP for incorrect (still get some XP for trying)', () => {
      const reward = calculateReward(3, false);
      expect(reward).toEqual({ coins: 0, xp: 5 });
    });
  });

  describe('canAfford', () => {
    it('returns true if player has enough coins', () => {
      expect(canAfford(100, 50)).toBe(true);
    });

    it('returns false if player cannot afford', () => {
      expect(canAfford(30, 50)).toBe(false);
    });

    it('returns true for exact amount', () => {
      expect(canAfford(50, 50)).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/economy.test.js
```
Expected: FAIL

- [ ] **Step 3: Implement economy.js**

Create `server/services/economy.js`:
```js
const COIN_REWARDS = {
  1: 5,   // foundational
  2: 7,   // basic
  3: 10,  // intermediate
  4: 15,  // advanced
  5: 20,  // challenge
};

const XP_REWARDS = {
  1: 10,
  2: 15,
  3: 20,
  4: 30,
  5: 40,
};

export function calculateReward(difficultyLevel, isCorrect) {
  if (!isCorrect) return { coins: 0, xp: 5 };
  return {
    coins: COIN_REWARDS[difficultyLevel] || 5,
    xp: XP_REWARDS[difficultyLevel] || 10,
  };
}

export function canAfford(playerCoins, itemCost) {
  return playerCoins >= itemCost;
}

export const LOGIN_STREAK_BONUSES = {
  1: 10,
  3: 20,
  7: 30,
  14: 50,
  30: 100,
};

export function getStreakBonus(streakDays) {
  const milestones = Object.keys(LOGIN_STREAK_BONUSES).map(Number).sort((a, b) => b - a);
  for (const m of milestones) {
    if (streakDays >= m) return LOGIN_STREAK_BONUSES[m];
  }
  return 0;
}
```

- [ ] **Step 4: Run tests**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/economy.test.js
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: economy service — coin/XP reward calculation, purchase validation, login streak bonuses"
```

---

## Task 6: Game API Routes (Map, Encounter, Answer, Profile)

**Files:**
- Create: `server/routes/game.js`
- Create: `tests/game.test.js`
- Modify: `server/app.js` — mount game routes

- [ ] **Step 1: Write failing game route tests**

Create `tests/game.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server/app.js';
import { resetTestDb, seedTestSchool, testPool } from './setup.js';
import bcrypt from 'bcrypt';

describe('Game API', () => {
  let schoolId, studentCookie;

  beforeEach(async () => {
    await resetTestDb();
    schoolId = await seedTestSchool();

    // Create teacher + class + student
    const tHash = await bcrypt.hash('pass', 10);
    const { rows: [teacher] } = await testPool.query(
      `INSERT INTO users (school_id, role, username, display_name, email, password_hash)
       VALUES ($1, 'teacher', 'teach', 'Teacher', 'teach@hsa.edu', $2) RETURNING id`,
      [schoolId, tHash]
    );
    await testPool.query(
      `INSERT INTO classes (school_id, teacher_id, name, join_code, subject, grade_level)
       VALUES ($1, $2, 'Math 6A', 'TEST01', 'Math', 6)`,
      [schoolId, teacher.id]
    );

    // Join as student
    const joinRes = await request(app)
      .post('/api/auth/student/join')
      .send({ joinCode: 'TEST01', username: 'teststu', displayName: 'Test Student', pin: '1111' });
    studentCookie = joinRes.headers['set-cookie'];
  });

  describe('GET /api/game/profile', () => {
    it('returns player profile', async () => {
      const res = await request(app)
        .get('/api/game/profile')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.coins).toBe(0);
      expect(res.body.xp).toBe(0);
      expect(res.body.level).toBe(1);
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app).get('/api/game/profile');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/game/encounter', () => {
    it('returns a question', async () => {
      // Seed a cached question so we don't need Gemini
      await testPool.query(
        `INSERT INTO question_cache (subtopic_id, difficulty_level, question_text, choices_json, correct_index, explanation)
         VALUES (1, 1, 'What is 2+2?', '["3","4","5","6"]', 1, 'Basic addition')`,
      );

      const res = await request(app)
        .post('/api/game/encounter')
        .set('Cookie', studentCookie)
        .send({ encounterType: 'npc' });

      expect(res.status).toBe(200);
      expect(res.body.question).toBeDefined();
      expect(res.body.choices).toHaveLength(4);
    });
  });

  describe('POST /api/game/answer', () => {
    it('awards coins for correct answer', async () => {
      // Seed question (correct answer is index 1 = "4")
      const { rows: [q] } = await testPool.query(
        `INSERT INTO question_cache (subtopic_id, difficulty_level, question_text, choices_json, correct_index, explanation)
         VALUES (1, 1, 'What is 2+2?', '["3","4","5","6"]', 1, 'Basic addition')
         RETURNING id`,
      );

      const res = await request(app)
        .post('/api/game/answer')
        .set('Cookie', studentCookie)
        .send({ questionId: q.id, choiceIndex: 1, responseMs: 3000 });

      expect(res.status).toBe(200);
      expect(res.body.correct).toBe(true);
      expect(res.body.coinsEarned).toBeGreaterThan(0);

      // Verify coins were added
      const profileRes = await request(app)
        .get('/api/game/profile')
        .set('Cookie', studentCookie);
      expect(profileRes.body.coins).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/game.test.js
```
Expected: FAIL

- [ ] **Step 3: Implement game routes**

Create `server/routes/game.js`:
```js
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getNextQuestion } from '../services/questions.js';
import { calculateReward } from '../services/economy.js';
import { adjustDifficulty } from '../services/adaptive.js';
import { logger } from '../middleware/errors.js';

const router = Router();

// Get player profile
router.get('/api/game/profile', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT pp.coins, pp.xp, pp.level, pp.login_streak,
              pp.last_login, u.display_name, u.username
       FROM player_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.user_id = $1`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Get map data
router.get('/api/game/map/:mapId', requireAuth, async (req, res, next) => {
  try {
    // Serve map JSON from public/assets/maps/
    // For Phase 1, just forward to static file
    res.redirect(`/assets/maps/${req.params.mapId}.json`);
  } catch (err) { next(err); }
});

// Simple in-memory rate limiter (200 questions/hour/student)
const rateLimits = new Map();
function checkRateLimit(userId) {
  const now = Date.now();
  const key = `q:${userId}`;
  const entry = rateLimits.get(key) || { count: 0, reset: now + 3600000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 3600000; }
  entry.count++;
  rateLimits.set(key, entry);
  return entry.count <= 200;
}

// Request a question for an NPC encounter
router.post('/api/game/encounter', requireAuth, async (req, res, next) => {
  try {
    if (!checkRateLimit(req.user.id)) {
      return res.status(429).json({ error: 'Rate limit: max 200 questions per hour' });
    }
    // Get student's class info for subject/grade
    const { rows: classInfo } = await pool.query(
      `SELECT c.subject, c.grade_level FROM classes c
       JOIN class_members cm ON cm.class_id = c.id
       WHERE cm.user_id = $1 LIMIT 1`,
      [req.user.id]
    );
    if (classInfo.length === 0) return res.status(400).json({ error: 'Student not in a class' });

    const { subject, grade_level } = classInfo[0];
    const question = await getNextQuestion(req.user.id, subject, grade_level);

    // Don't send correctIndex to client — server validates answers
    res.json({
      questionId: question.questionId,
      subtopicId: question.subtopicId,
      subtopicName: question.subtopicName,
      difficulty: question.difficulty,
      question: question.question,
      choices: question.choices,
    });
  } catch (err) { next(err); }
});

// Submit answer
router.post('/api/game/answer', requireAuth, async (req, res, next) => {
  try {
    const { questionId, choiceIndex, responseMs } = req.body;

    // Get question from cache
    const { rows: questions } = await pool.query(
      `SELECT subtopic_id, difficulty_level, choices_json, correct_index, explanation FROM question_cache WHERE id = $1`,
      [questionId]
    );
    if (questions.length === 0) return res.status(404).json({ error: 'Question not found' });

    const q = questions[0];
    const isCorrect = choiceIndex === q.correct_index;

    const reward = calculateReward(q.difficulty_level, isCorrect);

    // Log answer
    await pool.query(
      `INSERT INTO answer_log (user_id, question_id, subtopic_id, is_correct, response_ms, coins_earned, xp_earned)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user.id, questionId, q.subtopic_id, isCorrect, responseMs || 0, reward.coins, reward.xp]
    );

    // Update player profile
    await pool.query(
      `UPDATE player_profiles
       SET coins = coins + $1, xp = xp + $2,
           level = GREATEST(1, FLOOR(SQRT((xp + $2) / 100.0)) + 1)
       WHERE user_id = $3`,
      [reward.coins, reward.xp, req.user.id]
    );

    // Update mastery
    const { rows: recentAnswers } = await pool.query(
      `SELECT is_correct FROM answer_log
       WHERE user_id = $1 AND subtopic_id = $2
       ORDER BY answered_at DESC LIMIT 5`,
      [req.user.id, q.subtopic_id]
    );

    let correctStreak = 0, wrongStreak = 0;
    for (const a of recentAnswers) {
      if (a.is_correct) { correctStreak++; wrongStreak = 0; }
      else { wrongStreak++; correctStreak = 0; }
    }

    const newDifficulty = adjustDifficulty(q.difficulty_level, correctStreak, wrongStreak);
    const totalCorrect = recentAnswers.filter(a => a.is_correct).length;
    const totalAnswers = recentAnswers.length;
    const masteryPct = totalAnswers > 0 ? (totalCorrect / totalAnswers) * 100 : 0;

    await pool.query(
      `INSERT INTO student_mastery (user_id, subtopic_id, mastery_pct, difficulty_level, correct_count, incorrect_count, last_attempted)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, subtopic_id) DO UPDATE SET
         mastery_pct = $3,
         difficulty_level = $4,
         correct_count = student_mastery.correct_count + CASE WHEN $7 THEN 1 ELSE 0 END,
         incorrect_count = student_mastery.incorrect_count + CASE WHEN $7 THEN 0 ELSE 1 END,
         last_attempted = NOW()`,
      [req.user.id, q.subtopic_id, masteryPct, newDifficulty, isCorrect ? 1 : 0, isCorrect ? 0 : 1, isCorrect]
    );

    logger.info({ userId: req.user.id, questionId, isCorrect, coins: reward.coins }, 'Answer submitted');

    res.json({
      correct: isCorrect,
      explanation: q.explanation,
      coinsEarned: reward.coins,
      xpEarned: reward.xp,
    });
  } catch (err) { next(err); }
});

// Save player position
router.post('/api/game/position', requireAuth, async (req, res, next) => {
  try {
    const { mapId, x, y } = req.body;
    await pool.query(
      `UPDATE player_positions SET map_id = $1, x = $2, y = $3, updated_at = NOW() WHERE user_id = $4`,
      [mapId, x, y, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
```

- [ ] **Step 4: Mount game routes in app.js**

Add to `server/app.js`:
```js
import gameRouter from './routes/game.js';
app.use(gameRouter);
```

- [ ] **Step 5: Run tests**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/game.test.js
```
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: game API — profile, map, encounter (question generation), answer submission with rewards"
```

---

## Task 7: Shop & Inventory Routes

**Files:**
- Create: `server/routes/shop.js`
- Create: `server/routes/inventory.js`
- Create: `tests/shop.test.js`
- Modify: `server/app.js` — mount routes

- [ ] **Step 1: Write failing shop tests**

Create `tests/shop.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server/app.js';
import { resetTestDb, seedTestSchool, testPool } from './setup.js';
import bcrypt from 'bcrypt';

describe('Shop & Inventory', () => {
  let studentCookie;

  beforeEach(async () => {
    await resetTestDb();
    const schoolId = await seedTestSchool();
    const tHash = await bcrypt.hash('pass', 10);
    const { rows: [teacher] } = await testPool.query(
      `INSERT INTO users (school_id, role, username, display_name, email, password_hash)
       VALUES ($1, 'teacher', 'teach', 'Teacher', 'teach@hsa.edu', $2) RETURNING id`,
      [schoolId, tHash]
    );
    await testPool.query(
      `INSERT INTO classes (school_id, teacher_id, name, join_code) VALUES ($1, $2, 'Math 6A', 'SHOP01')`,
      [schoolId, teacher.id]
    );
    const joinRes = await request(app)
      .post('/api/auth/student/join')
      .send({ joinCode: 'SHOP01', username: 'shopper', displayName: 'Shopper', pin: '1234' });
    studentCookie = joinRes.headers['set-cookie'];
  });

  describe('GET /api/shop/catalog', () => {
    it('returns all shop items', async () => {
      const res = await request(app)
        .get('/api/shop/catalog')
        .set('Cookie', studentCookie);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(10);
    });
  });

  describe('POST /api/shop/buy', () => {
    it('purchases item when player has enough coins', async () => {
      // Give student coins
      await testPool.query(
        `UPDATE player_profiles SET coins = 500 WHERE user_id = (SELECT id FROM users WHERE username = 'shopper')`
      );

      const res = await request(app)
        .post('/api/shop/buy')
        .set('Cookie', studentCookie)
        .send({ itemId: 1 }); // Blue Wizard Hat, 50 coins

      expect(res.status).toBe(200);
      expect(res.body.coinsRemaining).toBe(450);
    });

    it('rejects purchase when too expensive', async () => {
      // Student has 0 coins
      const res = await request(app)
        .post('/api/shop/buy')
        .set('Cookie', studentCookie)
        .send({ itemId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('afford');
    });
  });

  describe('GET /api/inventory', () => {
    it('returns player inventory', async () => {
      const res = await request(app)
        .get('/api/inventory')
        .set('Cookie', studentCookie);
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/shop.test.js
```

- [ ] **Step 3: Implement shop routes**

Create `server/routes/shop.js`:
```js
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { canAfford } from '../services/economy.js';
import { logger } from '../middleware/errors.js';

const router = Router();

router.get('/api/shop/catalog', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, type, category, cost_coins, rarity, sprite_key FROM items ORDER BY cost_coins`
    );
    res.json({ items: rows });
  } catch (err) { next(err); }
});

router.get('/api/shop/featured', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.name, i.type, i.category, i.cost_coins, i.rarity, i.sprite_key
       FROM shop_featured sf JOIN items i ON i.id = sf.item_id
       WHERE CURRENT_DATE BETWEEN sf.start_date AND sf.end_date`
    );
    res.json({ items: rows });
  } catch (err) { next(err); }
});

router.post('/api/shop/buy', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { itemId } = req.body;
    await client.query('BEGIN');

    // Get item cost
    const { rows: items } = await client.query('SELECT cost_coins FROM items WHERE id = $1', [itemId]);
    if (items.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item not found' }); }

    // Check if already owned
    const { rows: owned } = await client.query(
      'SELECT id FROM player_inventory WHERE user_id = $1 AND item_id = $2', [req.user.id, itemId]
    );
    if (owned.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Already owned' }); }

    // Atomic deduct coins (SELECT FOR UPDATE prevents race conditions)
    const { rows: profiles } = await client.query(
      'SELECT coins FROM player_profiles WHERE user_id = $1 FOR UPDATE', [req.user.id]
    );
    if (!canAfford(profiles[0].coins, items[0].cost_coins)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot afford this item' });
    }

    await client.query('UPDATE player_profiles SET coins = coins - $1 WHERE user_id = $2', [items[0].cost_coins, req.user.id]);
    await client.query('INSERT INTO player_inventory (user_id, item_id) VALUES ($1, $2)', [req.user.id, itemId]);
    await client.query('COMMIT');

    logger.info({ userId: req.user.id, itemId, cost: items[0].cost_coins }, 'Item purchased');
    res.json({ coinsRemaining: profiles[0].coins - items[0].cost_coins });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

export default router;
```

- [ ] **Step 4: Implement inventory routes**

Create `server/routes/inventory.js`:
```js
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/api/inventory', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT pi.id, pi.equipped, pi.acquired_at,
              i.name, i.type, i.category, i.rarity, i.sprite_key
       FROM player_inventory pi JOIN items i ON i.id = pi.item_id
       WHERE pi.user_id = $1 ORDER BY pi.acquired_at DESC`,
      [req.user.id]
    );
    res.json({ items: rows });
  } catch (err) { next(err); }
});

router.post('/api/inventory/equip', requireAuth, async (req, res, next) => {
  try {
    const { inventoryId, equipped } = req.body;
    await pool.query(
      'UPDATE player_inventory SET equipped = $1 WHERE id = $2 AND user_id = $3',
      [equipped, inventoryId, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
```

- [ ] **Step 5: Mount routes in app.js**

Add to `server/app.js`:
```js
import shopRouter from './routes/shop.js';
import inventoryRouter from './routes/inventory.js';
app.use(shopRouter);
app.use(inventoryRouter);
```

- [ ] **Step 6: Run tests**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/shop.test.js
```
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: shop catalog + purchase + inventory with equip/unequip"
```

---

## Task 8: Leaderboard

**Files:**
- Create: `server/routes/leaderboard.js`
- Create: `tests/leaderboard.test.js`
- Modify: `server/app.js`

- [ ] **Step 1: Write failing leaderboard tests**

Create `tests/leaderboard.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server/app.js';
import { resetTestDb, seedTestSchool, testPool } from './setup.js';
import bcrypt from 'bcrypt';

describe('Leaderboard', () => {
  let studentCookie, classId;

  beforeEach(async () => {
    await resetTestDb();
    const schoolId = await seedTestSchool();
    const tHash = await bcrypt.hash('pass', 10);
    const { rows: [teacher] } = await testPool.query(
      `INSERT INTO users (school_id, role, username, display_name, email, password_hash)
       VALUES ($1, 'teacher', 'teach', 'Teacher', 'teach@hsa.edu', $2) RETURNING id`,
      [schoolId, tHash]
    );
    const { rows: [cls] } = await testPool.query(
      `INSERT INTO classes (school_id, teacher_id, name, join_code) VALUES ($1, $2, 'Math 6A', 'LB001') RETURNING id`,
      [schoolId, teacher.id]
    );
    classId = cls.id;

    // Create two students
    const joinRes = await request(app)
      .post('/api/auth/student/join')
      .send({ joinCode: 'LB001', username: 'alice', displayName: 'Alice', pin: '1111' });
    studentCookie = joinRes.headers['set-cookie'];

    await request(app)
      .post('/api/auth/student/join')
      .send({ joinCode: 'LB001', username: 'bob', displayName: 'Bob', pin: '2222' });

    // Give Alice more XP
    await testPool.query(
      `UPDATE player_profiles SET xp = 200, coins = 100 WHERE user_id = (SELECT id FROM users WHERE username = 'alice')`
    );
    await testPool.query(
      `UPDATE player_profiles SET xp = 50, coins = 30 WHERE user_id = (SELECT id FROM users WHERE username = 'bob')`
    );
  });

  it('returns class leaderboard sorted by XP', async () => {
    const res = await request(app)
      .get(`/api/leaderboard/${classId}`)
      .set('Cookie', studentCookie);

    expect(res.status).toBe(200);
    expect(res.body.leaderboard[0].display_name).toBe('Alice');
    expect(res.body.leaderboard[1].display_name).toBe('Bob');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/leaderboard.test.js
```

- [ ] **Step 3: Implement leaderboard route**

Create `server/routes/leaderboard.js`:
```js
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/api/leaderboard/:classId', requireAuth, async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { rows } = await pool.query(
      `SELECT u.id, u.display_name, u.username, pp.xp, pp.level, pp.coins,
              ROW_NUMBER() OVER (ORDER BY pp.xp DESC) as rank
       FROM class_members cm
       JOIN users u ON u.id = cm.user_id
       JOIN player_profiles pp ON pp.user_id = u.id
       WHERE cm.class_id = $1
       ORDER BY pp.xp DESC
       LIMIT 50`,
      [classId]
    );
    res.json({ leaderboard: rows });
  } catch (err) { next(err); }
});

export default router;
```

- [ ] **Step 4: Mount in app.js and run tests**

Add `import leaderboardRouter from './routes/leaderboard.js';` + `app.use(leaderboardRouter);`

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/leaderboard.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: classroom leaderboard sorted by XP with rank"
```

---

## Task 9: Teacher Dashboard API

**Files:**
- Create: `server/routes/teacher.js`
- Create: `tests/teacher.test.js`
- Modify: `server/app.js`

- [ ] **Step 1: Write failing teacher tests**

Create `tests/teacher.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server/app.js';
import { resetTestDb, seedTestSchool, testPool } from './setup.js';
import bcrypt from 'bcrypt';

describe('Teacher API', () => {
  let teacherCookie, schoolId, classId, studentId;

  beforeEach(async () => {
    await resetTestDb();
    schoolId = await seedTestSchool();

    // Login as teacher
    const tHash = await bcrypt.hash('pass', 10);
    await testPool.query(
      `INSERT INTO users (school_id, role, username, display_name, email, password_hash)
       VALUES ($1, 'teacher', 'teach', 'Teacher', 'teach@hsa.edu', $2)`,
      [schoolId, tHash]
    );
    const loginRes = await request(app)
      .post('/api/auth/teacher/login')
      .send({ email: 'teach@hsa.edu', password: 'pass' });
    teacherCookie = loginRes.headers['set-cookie'];

    // Create class via API
    const classRes = await request(app)
      .post('/api/teacher/class')
      .set('Cookie', teacherCookie)
      .send({ name: 'Math 6A', subject: 'Math', gradeLevel: 6 });
    classId = classRes.body.id;

    // Add a student
    const joinRes = await request(app)
      .post('/api/auth/student/join')
      .send({ joinCode: classRes.body.joinCode, username: 'stu1', displayName: 'Student 1', pin: '1111' });
    studentId = joinRes.body.user.id;
  });

  describe('POST /api/teacher/class', () => {
    it('creates a class with join code', async () => {
      const res = await request(app)
        .post('/api/teacher/class')
        .set('Cookie', teacherCookie)
        .send({ name: 'Science 7B', subject: 'Math', gradeLevel: 7 });

      expect(res.status).toBe(201);
      expect(res.body.joinCode).toBeDefined();
      expect(res.body.joinCode.length).toBe(6);
    });
  });

  describe('GET /api/teacher/class/:id/roster', () => {
    it('returns class roster with student stats', async () => {
      const res = await request(app)
        .get(`/api/teacher/class/${classId}/roster`)
        .set('Cookie', teacherCookie);

      expect(res.status).toBe(200);
      expect(res.body.students).toHaveLength(1);
      expect(res.body.students[0].display_name).toBe('Student 1');
    });
  });

  describe('POST /api/teacher/student/:id/reset-pin', () => {
    it('resets student PIN', async () => {
      const res = await request(app)
        .post(`/api/teacher/student/${studentId}/reset-pin`)
        .set('Cookie', teacherCookie)
        .send({ newPin: '9999' });

      expect(res.status).toBe(200);

      // Verify new PIN works
      const loginRes = await request(app)
        .post('/api/auth/student/login')
        .send({ username: 'stu1', pin: '9999', schoolId });
      expect(loginRes.status).toBe(200);
    });
  });

  describe('GET /api/teacher/classes', () => {
    it('returns teacher classes', async () => {
      const res = await request(app)
        .get('/api/teacher/classes')
        .set('Cookie', teacherCookie);

      expect(res.status).toBe(200);
      expect(res.body.classes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/teacher/class/:id/analytics', () => {
    it('returns subtopic mastery stats', async () => {
      // Seed mastery data for the student
      const { rows: [stu] } = await testPool.query(`SELECT id FROM users WHERE username = 'stu1'`);
      await testPool.query(
        `INSERT INTO student_mastery (user_id, subtopic_id, mastery_pct, difficulty_level, correct_count, incorrect_count, last_attempted)
         VALUES ($1, 1, 75.0, 2, 3, 1, NOW())`,
        [stu.id]
      );

      const res = await request(app)
        .get(`/api/teacher/class/${classId}/analytics`)
        .set('Cookie', teacherCookie);

      expect(res.status).toBe(200);
      expect(res.body.subtopicStats.length).toBeGreaterThan(0);
      expect(res.body.subtopicStats[0].avg_mastery).toBeDefined();
    });
  });

  describe('PUT /api/teacher/class/:id/settings', () => {
    it('updates class subject and grade', async () => {
      const res = await request(app)
        .put(`/api/teacher/class/${classId}/settings`)
        .set('Cookie', teacherCookie)
        .send({ subject: 'Science', gradeLevel: 7 });

      expect(res.status).toBe(200);
    });
  });

  it('rejects student access to teacher routes', async () => {
    const joinRes = await request(app)
      .post('/api/auth/student/join')
      .send({ joinCode: (await testPool.query(`SELECT join_code FROM classes WHERE id = $1`, [classId])).rows[0].join_code, username: 'hacker', displayName: 'Hacker', pin: '0000' });

    const res = await request(app)
      .get('/api/teacher/classes')
      .set('Cookie', joinRes.headers['set-cookie']);

    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/teacher.test.js
```

- [ ] **Step 3: Implement teacher routes**

Create `server/routes/teacher.js`:
```js
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const router = Router();

function generateJoinCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
}

// List teacher's classes
router.get('/api/teacher/classes', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.join_code, c.subject, c.grade_level, c.created_at,
              COUNT(cm.user_id) as student_count
       FROM classes c
       LEFT JOIN class_members cm ON cm.class_id = c.id
       WHERE c.teacher_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json({ classes: rows });
  } catch (err) { next(err); }
});

// Create class
router.post('/api/teacher/class', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const { name, subject, gradeLevel } = req.body;
    const joinCode = generateJoinCode();
    const { rows: [cls] } = await pool.query(
      `INSERT INTO classes (school_id, teacher_id, name, join_code, subject, grade_level)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, join_code`,
      [req.user.schoolId, req.user.id, name, joinCode, subject || 'Math', gradeLevel || 6]
    );
    res.status(201).json({ id: cls.id, joinCode: cls.join_code });
  } catch (err) { next(err); }
});

// Get class roster
router.get('/api/teacher/class/:id/roster', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.display_name, u.username, pp.coins, pp.xp, pp.level, pp.login_streak,
              (SELECT COUNT(*) FROM answer_log al WHERE al.user_id = u.id) as questions_answered,
              (SELECT ROUND(AVG(CASE WHEN al.is_correct THEN 1.0 ELSE 0.0 END) * 100, 1) FROM answer_log al WHERE al.user_id = u.id) as accuracy_pct
       FROM class_members cm
       JOIN users u ON u.id = cm.user_id
       JOIN player_profiles pp ON pp.user_id = u.id
       WHERE cm.class_id = $1
       ORDER BY u.display_name`,
      [req.params.id]
    );
    res.json({ students: rows });
  } catch (err) { next(err); }
});

// Get class analytics
router.get('/api/teacher/class/:id/analytics', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    // Per-subtopic mastery averages
    const { rows: subtopicStats } = await pool.query(
      `SELECT st.name as subtopic_name, t.name as topic_name,
              ROUND(AVG(sm.mastery_pct), 1) as avg_mastery,
              COUNT(sm.user_id) as students_attempted
       FROM class_members cm
       JOIN student_mastery sm ON sm.user_id = cm.user_id
       JOIN subtopics st ON st.id = sm.subtopic_id
       JOIN topics t ON t.id = st.topic_id
       WHERE cm.class_id = $1
       GROUP BY st.id, st.name, t.name
       ORDER BY avg_mastery ASC`,
      [req.params.id]
    );

    res.json({ subtopicStats });
  } catch (err) { next(err); }
});

// Update class settings (subject, grade level)
router.put('/api/teacher/class/:id/settings', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const { subject, gradeLevel } = req.body;
    const { rowCount } = await pool.query(
      `UPDATE classes SET subject = COALESCE($1, subject), grade_level = COALESCE($2, grade_level)
       WHERE id = $3 AND teacher_id = $4`,
      [subject, gradeLevel, req.params.id, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Class not found or not yours' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Reset student PIN (only for students in teacher's own classes)
router.post('/api/teacher/student/:id/reset-pin', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    // Verify teacher owns a class containing this student
    const { rows } = await pool.query(
      `SELECT 1 FROM class_members cm
       JOIN classes c ON c.id = cm.class_id
       WHERE cm.user_id = $1 AND c.teacher_id = $2`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(403).json({ error: 'Not your student' });

    const { newPin } = req.body;
    const pinHash = await bcrypt.hash(newPin, 10);
    await pool.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [pinHash, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// CSV export
router.get('/api/teacher/class/:id/export', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.display_name, u.username, pp.xp, pp.level, pp.coins,
              (SELECT COUNT(*) FROM answer_log al WHERE al.user_id = u.id) as questions_answered,
              (SELECT ROUND(AVG(CASE WHEN al.is_correct THEN 1.0 ELSE 0.0 END) * 100, 1) FROM answer_log al WHERE al.user_id = u.id) as accuracy_pct
       FROM class_members cm
       JOIN users u ON u.id = cm.user_id
       JOIN player_profiles pp ON pp.user_id = u.id
       WHERE cm.class_id = $1
       ORDER BY u.display_name`,
      [req.params.id]
    );

    const csv = ['Name,Username,XP,Level,Coins,Questions Answered,Accuracy %']
      .concat(rows.map(r => `${r.display_name},${r.username},${r.xp},${r.level},${r.coins},${r.questions_answered},${r.accuracy_pct || 0}`))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=class-${req.params.id}-export.csv`);
    res.send(csv);
  } catch (err) { next(err); }
});

export default router;
```

- [ ] **Step 4: Mount in app.js and run tests**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run tests/teacher.test.js
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: teacher dashboard API — class creation, roster, analytics, PIN reset, CSV export"
```

---

## Task 10: Client — Login Page

**Files:**
- Create: `public/login.html`
- Create: `public/css/login.css`
- Create: `public/js/auth.js`
- Create: `public/js/api.js`

- [ ] **Step 1: Create API client wrapper**

Create `public/js/api.js`:
```js
export async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
```

- [ ] **Step 2: Create login.html**

Create `public/login.html` — two forms:
- Student: join code + username + PIN (new), or username + PIN (returning)
- Teacher: email + password
- Tab-based switching between Student/Teacher

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Problocks Light — Login</title>
  <link rel="stylesheet" href="/css/login.css">
</head>
<body>
  <div class="login-container">
    <h1>Problocks Light</h1>
    <div class="tabs">
      <button class="tab active" data-tab="student">Student</button>
      <button class="tab" data-tab="teacher">Teacher</button>
    </div>

    <form id="student-join-form" class="form active">
      <h2>Join a Class</h2>
      <input type="text" name="joinCode" placeholder="Class Code" required maxlength="6">
      <input type="text" name="username" placeholder="Pick a Username" required maxlength="20">
      <input type="text" name="displayName" placeholder="Your Name" required maxlength="30">
      <input type="password" name="pin" placeholder="4-Digit PIN" required maxlength="4" pattern="[0-9]{4}">
      <button type="submit">Join</button>
      <p class="switch-link">Already have an account? <a href="#" id="show-login">Log in</a></p>
    </form>

    <form id="student-login-form" class="form" style="display:none">
      <h2>Student Login</h2>
      <input type="text" name="username" placeholder="Username" required>
      <input type="password" name="pin" placeholder="PIN" required maxlength="4">
      <input type="hidden" name="schoolId" value="1">
      <button type="submit">Login</button>
      <p class="switch-link">New student? <a href="#" id="show-join">Join a class</a></p>
    </form>

    <form id="teacher-form" class="form" style="display:none">
      <h2>Teacher Login</h2>
      <input type="email" name="email" placeholder="Email" required>
      <input type="password" name="password" placeholder="Password" required>
      <button type="submit">Login</button>
    </form>

    <p id="error" class="error"></p>
  </div>
  <script type="module" src="/js/auth.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create login.css**

Create `public/css/login.css` — dark pixel-game themed login:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #1a1a2e;
  color: #eee;
  font-family: 'Courier New', monospace;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
.login-container {
  background: #16213e;
  border: 2px solid #0f3460;
  border-radius: 8px;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
}
h1 { text-align: center; color: #e94560; margin-bottom: 1rem; }
h2 { margin-bottom: 1rem; font-size: 1.1rem; }
.tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
.tab {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #0f3460;
  background: transparent;
  color: #eee;
  cursor: pointer;
  font-family: inherit;
}
.tab.active { background: #0f3460; }
input {
  width: 100%;
  padding: 0.7rem;
  margin-bottom: 0.8rem;
  border: 1px solid #0f3460;
  background: #1a1a2e;
  color: #eee;
  font-family: inherit;
  border-radius: 4px;
}
button[type="submit"] {
  width: 100%;
  padding: 0.7rem;
  background: #e94560;
  color: white;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-weight: bold;
  border-radius: 4px;
}
button[type="submit"]:hover { background: #c73550; }
.error { color: #e94560; text-align: center; margin-top: 1rem; }
.switch-link { text-align: center; margin-top: 0.8rem; font-size: 0.85rem; }
.switch-link a { color: #e94560; }
```

- [ ] **Step 4: Create auth.js (form handlers)**

Create `public/js/auth.js`:
```js
import { api } from './api.js';

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.form').forEach(f => f.style.display = 'none');
    if (tab.dataset.tab === 'student') {
      document.getElementById('student-join-form').style.display = 'block';
    } else {
      document.getElementById('teacher-form').style.display = 'block';
    }
  });
});

// Toggle join/login for students
document.getElementById('show-login')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('student-join-form').style.display = 'none';
  document.getElementById('student-login-form').style.display = 'block';
});
document.getElementById('show-join')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('student-login-form').style.display = 'none';
  document.getElementById('student-join-form').style.display = 'block';
});

const errorEl = document.getElementById('error');

// Student join
document.getElementById('student-join-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const form = new FormData(e.target);
  try {
    await api('POST', '/api/auth/student/join', {
      joinCode: form.get('joinCode'),
      username: form.get('username'),
      displayName: form.get('displayName'),
      pin: form.get('pin'),
    });
    window.location.href = '/';
  } catch (err) { errorEl.textContent = err.message; }
});

// Student login
document.getElementById('student-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const form = new FormData(e.target);
  try {
    await api('POST', '/api/auth/student/login', {
      username: form.get('username'),
      pin: form.get('pin'),
      schoolId: Number(form.get('schoolId')),
    });
    window.location.href = '/';
  } catch (err) { errorEl.textContent = err.message; }
});

// Teacher login
document.getElementById('teacher-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const form = new FormData(e.target);
  try {
    await api('POST', '/api/auth/teacher/login', {
      email: form.get('email'),
      password: form.get('password'),
    });
    window.location.href = '/teacher.html';
  } catch (err) { errorEl.textContent = err.message; }
});
```

- [ ] **Step 5: Verify login page renders**

```bash
node server/index.js
# Visit http://localhost:3000/login.html in browser
# Verify: tabs switch, forms display correctly
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: login page — student join/login + teacher login with pixel-game theme"
```

---

## Task 11: Client — PixiJS Game Engine + Dungeon Map

**Files:**
- Create: `public/index.html`
- Create: `public/css/game.css`
- Create: `public/js/game/engine.js`
- Create: `public/js/game/map.js`
- Create: `public/js/game/player.js`
- Create: `public/js/game/npc.js`
- Create: `public/js/game/dialogue.js`
- Create: `public/js/game/hud.js`
- Create: `public/assets/maps/dungeon-math.json`

This is the largest task — the core game client. It creates the PixiJS rendering pipeline, tilemap system, player movement, NPC interaction, and question dialogue.

- [ ] **Step 1: Create game shell HTML**

Create `public/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Problocks Light</title>
  <link rel="stylesheet" href="/css/game.css">
  <script src="https://pixijs.download/release/pixi.min.js"></script>
</head>
<body>
  <div id="game-container"></div>
  <div id="hud">
    <span id="hud-coins">Coins: 0</span>
    <span id="hud-xp">XP: 0</span>
    <span id="hud-level">Lv. 1</span>
  </div>
  <div id="dialogue-box" style="display:none">
    <p id="dialogue-npc-name"></p>
    <p id="dialogue-question"></p>
    <div id="dialogue-choices"></div>
    <p id="dialogue-feedback" style="display:none"></p>
  </div>
  <script type="module" src="/js/game/engine.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create game.css**

Create `public/css/game.css`:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #000;
  overflow: hidden;
  font-family: 'Courier New', monospace;
}
#game-container { width: 100vw; height: 100vh; }
#hud {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: 8px 16px;
  background: rgba(0,0,0,0.7);
  color: #ffd700;
  display: flex;
  gap: 2rem;
  font-size: 14px;
  z-index: 10;
}
#dialogue-box {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 600px;
  background: #16213e;
  border: 2px solid #0f3460;
  border-radius: 8px;
  padding: 1.2rem;
  color: #eee;
  z-index: 20;
}
#dialogue-npc-name { color: #e94560; font-weight: bold; margin-bottom: 0.5rem; }
#dialogue-question { margin-bottom: 1rem; line-height: 1.4; }
#dialogue-choices { display: flex; flex-direction: column; gap: 0.5rem; }
.choice-btn {
  padding: 0.6rem 1rem;
  background: #1a1a2e;
  border: 1px solid #0f3460;
  color: #eee;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  border-radius: 4px;
}
.choice-btn:hover { background: #0f3460; }
.choice-btn.correct { background: #2d6a4f; border-color: #40916c; }
.choice-btn.incorrect { background: #6a2d2d; border-color: #916040; }
#dialogue-feedback { margin-top: 0.8rem; font-size: 0.9rem; color: #aaa; }
```

- [ ] **Step 3: Create dungeon map JSON**

Create `public/assets/maps/dungeon-math.json`:
```json
{
  "name": "Math Dungeon",
  "width": 20,
  "height": 15,
  "tileSize": 32,
  "layers": {
    "floor": [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,1,1,1,0,0,0,0,0,1,1,1,0,0,0,0,1],
      [1,0,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,1,1,1,0,0,0,0,0,1,1,1,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    "collision": [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,1,1,1,0,0,0,0,0,1,1,1,0,0,0,0,1],
      [1,0,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,1,1,1,0,0,0,0,0,1,1,1,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ]
  },
  "npcs": [
    { "id": "wizard", "name": "Wizard Algebrus", "x": 5, "y": 5, "sprite": "npc_wizard" },
    { "id": "knight", "name": "Sir Fraction", "x": 13, "y": 5, "sprite": "npc_knight" },
    { "id": "sage", "name": "Elder Decimal", "x": 9, "y": 10, "sprite": "npc_sage" }
  ],
  "playerStart": { "x": 3, "y": 2 },
  "tileColors": {
    "0": "#2d2d3d",
    "1": "#4a4a5a"
  }
}
```

- [ ] **Step 4: Create game engine (engine.js)**

Create `public/js/game/engine.js` — initializes PixiJS, loads map, creates player, handles game loop:
```js
import { api } from '../api.js';
import { TileMap } from './map.js';
import { Player } from './player.js';
import { NPCManager } from './npc.js';
import { DialogueBox } from './dialogue.js';
import { HUD } from './hud.js';

class Game {
  constructor() {
    this.app = null;
    this.map = null;
    this.player = null;
    this.npcs = null;
    this.dialogue = null;
    this.hud = null;
  }

  async init() {
    // Check auth
    try {
      this.profile = await api('GET', '/api/game/profile');
    } catch {
      window.location.href = '/login.html';
      return;
    }

    // Init PixiJS
    this.app = new PIXI.Application();
    await this.app.init({
      resizeTo: document.getElementById('game-container'),
      backgroundColor: 0x1a1a2e,
    });
    document.getElementById('game-container').appendChild(this.app.canvas);

    // Load map
    const mapData = await fetch('/assets/maps/dungeon-math.json').then(r => r.json());

    // Create game objects
    this.map = new TileMap(mapData);
    this.app.stage.addChild(this.map.container);

    this.npcs = new NPCManager(mapData.npcs, mapData.tileSize);
    this.map.container.addChild(this.npcs.container);

    this.player = new Player(mapData.playerStart, mapData.tileSize);
    this.map.container.addChild(this.player.sprite);

    this.dialogue = new DialogueBox();
    this.hud = new HUD(this.profile);

    // Game loop
    this.app.ticker.add(() => this.update());

    // Keyboard input
    this.keys = {};
    window.addEventListener('keydown', (e) => { this.keys[e.key] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
  }

  update() {
    if (this.dialogue.isOpen) return; // Freeze movement during dialogue

    let dx = 0, dy = 0;
    if (this.keys['ArrowUp'] || this.keys['w']) dy = -1;
    if (this.keys['ArrowDown'] || this.keys['s']) dy = 1;
    if (this.keys['ArrowLeft'] || this.keys['a']) dx = -1;
    if (this.keys['ArrowRight'] || this.keys['d']) dx = 1;

    if (dx !== 0 || dy !== 0) {
      this.player.move(dx, dy, this.map);
    }

    // Check NPC proximity
    if (this.keys['e'] || this.keys['Enter']) {
      const npc = this.npcs.getNearby(this.player.tileX, this.player.tileY);
      if (npc && !this.dialogue.isOpen) {
        this.keys['e'] = false;
        this.keys['Enter'] = false;
        this.startEncounter(npc);
      }
    }

    // Camera follow
    this.centerCamera();
  }

  centerCamera() {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    this.map.container.x = screenW / 2 - this.player.sprite.x;
    this.map.container.y = screenH / 2 - this.player.sprite.y;
  }

  async startEncounter(npc) {
    try {
      const question = await api('POST', '/api/game/encounter', { encounterType: 'npc' });
      this.dialogue.show(npc.name, question, async (choiceIndex) => {
        const startTime = Date.now();
        const result = await api('POST', '/api/game/answer', {
          questionId: question.questionId,
          choiceIndex,
          responseMs: Date.now() - startTime,
        });
        this.dialogue.showFeedback(result);
        if (result.coinsEarned > 0 || result.xpEarned > 0) {
          this.profile.coins += result.coinsEarned;
          this.profile.xp += result.xpEarned;
          this.hud.update(this.profile);
        }
      });
    } catch (err) {
      console.error('Encounter error:', err);
    }
  }
}

const game = new Game();
game.init();
```

- [ ] **Step 5: Create map.js (tilemap renderer)**

Create `public/js/game/map.js`:
```js
export class TileMap {
  constructor(mapData) {
    this.data = mapData;
    this.tileSize = mapData.tileSize;
    this.container = new PIXI.Container();
    this.render();
  }

  render() {
    const { floor, collision } = this.data.layers;
    const colors = this.data.tileColors;
    for (let y = 0; y < floor.length; y++) {
      for (let x = 0; x < floor[y].length; x++) {
        const tileType = floor[y][x];
        const color = parseInt(colors[tileType].replace('#', ''), 16);
        const rect = new PIXI.Graphics();
        rect.rect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        rect.fill({ color });
        if (collision[y][x] === 1) {
          rect.stroke({ color: 0x5a5a6a, width: 1 });
        }
        this.container.addChild(rect);
      }
    }
  }

  isWalkable(tileX, tileY) {
    const collision = this.data.layers.collision;
    if (tileY < 0 || tileY >= collision.length) return false;
    if (tileX < 0 || tileX >= collision[0].length) return false;
    return collision[tileY][tileX] === 0;
  }
}
```

- [ ] **Step 6: Create player.js**

Create `public/js/game/player.js`:
```js
export class Player {
  constructor(startPos, tileSize) {
    this.tileSize = tileSize;
    this.tileX = startPos.x;
    this.tileY = startPos.y;
    this.moveTimer = 0;
    this.moveCooldown = 150; // ms between moves

    this.sprite = new PIXI.Graphics();
    this.sprite.circle(tileSize / 2, tileSize / 2, tileSize / 3);
    this.sprite.fill({ color: 0xe94560 });
    this.updatePosition();
  }

  move(dx, dy, map) {
    const now = Date.now();
    if (now - this.moveTimer < this.moveCooldown) return;

    const newX = this.tileX + dx;
    const newY = this.tileY + dy;

    if (map.isWalkable(newX, newY)) {
      this.tileX = newX;
      this.tileY = newY;
      this.moveTimer = now;
      this.updatePosition();
    }
  }

  updatePosition() {
    this.sprite.x = this.tileX * this.tileSize;
    this.sprite.y = this.tileY * this.tileSize;
  }
}
```

- [ ] **Step 7: Create npc.js**

Create `public/js/game/npc.js`:
```js
export class NPCManager {
  constructor(npcData, tileSize) {
    this.npcs = npcData;
    this.tileSize = tileSize;
    this.container = new PIXI.Container();

    for (const npc of this.npcs) {
      const g = new PIXI.Graphics();
      g.circle(tileSize / 2, tileSize / 2, tileSize / 3);
      g.fill({ color: 0x4ecdc4 });
      g.x = npc.x * tileSize;
      g.y = npc.y * tileSize;

      // NPC name label
      const label = new PIXI.Text({ text: '?', style: { fontSize: 14, fill: '#ffd700' } });
      label.x = npc.x * tileSize + tileSize / 3;
      label.y = npc.y * tileSize - 10;

      this.container.addChild(g);
      this.container.addChild(label);
    }
  }

  getNearby(playerX, playerY, range = 1.5) {
    for (const npc of this.npcs) {
      const dist = Math.abs(npc.x - playerX) + Math.abs(npc.y - playerY);
      if (dist <= range) return npc;
    }
    return null;
  }
}
```

- [ ] **Step 8: Create dialogue.js (question UI)**

Create `public/js/game/dialogue.js`:
```js
export class DialogueBox {
  constructor() {
    this.box = document.getElementById('dialogue-box');
    this.npcNameEl = document.getElementById('dialogue-npc-name');
    this.questionEl = document.getElementById('dialogue-question');
    this.choicesEl = document.getElementById('dialogue-choices');
    this.feedbackEl = document.getElementById('dialogue-feedback');
    this.isOpen = false;
  }

  show(npcName, questionData, onAnswer) {
    this.isOpen = true;
    this.npcNameEl.textContent = npcName;
    this.questionEl.textContent = questionData.question;
    this.feedbackEl.style.display = 'none';
    this.choicesEl.innerHTML = '';

    const choices = questionData.choices;
    choices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = typeof choice === 'string' ? choice : choice.text;
      btn.addEventListener('click', () => {
        // Disable all buttons
        this.choicesEl.querySelectorAll('button').forEach(b => b.disabled = true);
        onAnswer(i);
      });
      this.choicesEl.appendChild(btn);
    });

    this.box.style.display = 'block';
  }

  showFeedback(result) {
    this.feedbackEl.style.display = 'block';
    if (result.correct) {
      this.feedbackEl.textContent = `Correct! +${result.coinsEarned} coins, +${result.xpEarned} XP`;
      this.feedbackEl.style.color = '#40916c';
    } else {
      this.feedbackEl.textContent = `Wrong. ${result.explanation}`;
      this.feedbackEl.style.color = '#e94560';
    }

    // Auto-close after 3 seconds
    setTimeout(() => this.close(), 3000);
  }

  close() {
    this.box.style.display = 'none';
    this.isOpen = false;
  }
}
```

- [ ] **Step 9: Create hud.js**

Create `public/js/game/hud.js`:
```js
export class HUD {
  constructor(profile) {
    this.coinsEl = document.getElementById('hud-coins');
    this.xpEl = document.getElementById('hud-xp');
    this.levelEl = document.getElementById('hud-level');
    this.update(profile);
  }

  update(profile) {
    this.coinsEl.textContent = `Coins: ${profile.coins}`;
    this.xpEl.textContent = `XP: ${profile.xp}`;
    this.levelEl.textContent = `Lv. ${profile.level}`;
  }
}
```

- [ ] **Step 10: Test in browser**

```bash
node server/index.js
# 1. Visit http://localhost:3000/login.html
# 2. Create teacher account (need to seed one manually or via psql)
# 3. Create class
# 4. Join as student
# 5. Verify: map renders, player moves with WASD/arrows, NPCs visible
# 6. Walk near NPC, press E — question appears
# 7. Answer — coins update in HUD
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: PixiJS game client — tilemap, player movement, NPC encounters, question dialogue, HUD"
```

---

## Task 12: Client — Shop UI

**Files:**
- Create: `public/js/game/shop-ui.js`
- Modify: `public/js/game/engine.js` — add shop toggle
- Modify: `public/index.html` — add shop overlay HTML

- [ ] **Step 1: Add shop overlay HTML to index.html**

Add before closing `</body>`:
```html
<div id="shop-overlay" style="display:none">
  <div id="shop-panel">
    <h2>Shop</h2>
    <div id="shop-coins">Your coins: 0</div>
    <div id="shop-items"></div>
    <button id="shop-close">Close (Esc)</button>
  </div>
</div>
```

- [ ] **Step 2: Add shop CSS to game.css**

Append to `public/css/game.css`:
```css
#shop-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.8); z-index: 30;
  display: flex; justify-content: center; align-items: center;
}
#shop-panel {
  background: #16213e; border: 2px solid #0f3460; border-radius: 8px;
  padding: 1.5rem; width: 90%; max-width: 500px; max-height: 80vh; overflow-y: auto; color: #eee;
}
#shop-coins { margin: 0.5rem 0 1rem; color: #ffd700; }
.shop-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.5rem; border-bottom: 1px solid #0f3460;
}
.shop-item-name { flex: 1; }
.shop-item-cost { color: #ffd700; margin-right: 1rem; }
.shop-buy-btn {
  padding: 0.3rem 0.8rem; background: #e94560; color: white;
  border: none; cursor: pointer; border-radius: 4px; font-family: inherit;
}
.shop-buy-btn:disabled { background: #555; cursor: not-allowed; }
#shop-close {
  margin-top: 1rem; width: 100%; padding: 0.5rem;
  background: transparent; border: 1px solid #0f3460; color: #eee;
  cursor: pointer; font-family: inherit;
}
```

- [ ] **Step 3: Create shop-ui.js**

Create `public/js/game/shop-ui.js`:
```js
import { api } from '../api.js';

export class ShopUI {
  constructor(game) {
    this.game = game;
    this.overlay = document.getElementById('shop-overlay');
    this.itemsEl = document.getElementById('shop-items');
    this.coinsEl = document.getElementById('shop-coins');
    this.isOpen = false;

    document.getElementById('shop-close').addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  async open() {
    this.isOpen = true;
    const catalog = await api('GET', '/api/shop/catalog');
    const inventory = await api('GET', '/api/inventory');
    const ownedIds = new Set(inventory.items.map(i => i.name));

    this.coinsEl.textContent = `Your coins: ${this.game.profile.coins}`;
    this.itemsEl.innerHTML = '';

    for (const item of catalog.items) {
      const div = document.createElement('div');
      div.className = 'shop-item';
      const owned = ownedIds.has(item.name);
      div.innerHTML = `
        <span class="shop-item-name">${item.name} <small>(${item.rarity})</small></span>
        <span class="shop-item-cost">${item.cost_coins} coins</span>
      `;
      const btn = document.createElement('button');
      btn.className = 'shop-buy-btn';
      btn.textContent = owned ? 'Owned' : 'Buy';
      btn.disabled = owned || this.game.profile.coins < item.cost_coins;
      if (!owned) {
        btn.addEventListener('click', async () => {
          try {
            const result = await api('POST', '/api/shop/buy', { itemId: item.id });
            this.game.profile.coins = result.coinsRemaining;
            this.game.hud.update(this.game.profile);
            btn.textContent = 'Owned';
            btn.disabled = true;
            this.coinsEl.textContent = `Your coins: ${result.coinsRemaining}`;
          } catch (err) { alert(err.message); }
        });
      }
      div.appendChild(btn);
      this.itemsEl.appendChild(div);
    }

    this.overlay.style.display = 'flex';
  }

  close() {
    this.overlay.style.display = 'none';
    this.isOpen = false;
  }
}
```

- [ ] **Step 4: Wire shop into engine.js**

Add to `Game.init()`:
```js
import { ShopUI } from './shop-ui.js';
// After HUD creation:
this.shop = new ShopUI(this);
```

Add to `Game.update()`:
```js
if (this.keys['b'] && !this.shop.isOpen && !this.dialogue.isOpen) {
  this.keys['b'] = false;
  this.shop.open();
}
```

- [ ] **Step 5: Test in browser**

```bash
# Press B in-game to open shop
# Verify items display, prices show, Buy button works
# Verify coins deduct and HUD updates
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: in-game shop UI — browse catalog, buy items, inventory tracking"
```

---

## Task 13: Client — Teacher Dashboard

**Files:**
- Create: `public/teacher.html`
- Create: `public/css/teacher.css`
- Create: `public/js/teacher/dashboard.js`
- Create: `public/js/teacher/charts.js`

- [ ] **Step 1: Create teacher.html**

Create `public/teacher.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Teacher Dashboard — Problocks Light</title>
  <link rel="stylesheet" href="/css/teacher.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
</head>
<body>
  <nav>
    <h1>Problocks Light — Teacher Dashboard</h1>
    <button id="logout-btn">Logout</button>
  </nav>

  <div class="dashboard">
    <section id="classes-section">
      <h2>Your Classes</h2>
      <button id="create-class-btn">+ Create Class</button>
      <div id="classes-list"></div>
    </section>

    <section id="class-detail" style="display:none">
      <button id="back-btn">&larr; Back to Classes</button>
      <h2 id="class-name"></h2>
      <p>Join Code: <strong id="class-code"></strong></p>

      <div class="tabs">
        <button class="tab active" data-tab="roster">Roster</button>
        <button class="tab" data-tab="leaderboard">Leaderboard</button>
        <button class="tab" data-tab="analytics">Analytics</button>
      </div>

      <div id="roster-tab" class="tab-content">
        <table id="roster-table">
          <thead>
            <tr><th>Name</th><th>Level</th><th>XP</th><th>Coins</th><th>Questions</th><th>Accuracy</th><th>Actions</th></tr>
          </thead>
          <tbody></tbody>
        </table>
        <button id="export-btn">Export CSV</button>
      </div>

      <div id="leaderboard-tab" class="tab-content" style="display:none">
        <canvas id="leaderboard-chart"></canvas>
      </div>

      <div id="analytics-tab" class="tab-content" style="display:none">
        <canvas id="mastery-chart"></canvas>
      </div>
    </section>
  </div>

  <div id="modal" style="display:none">
    <div class="modal-content">
      <h3 id="modal-title"></h3>
      <div id="modal-body"></div>
    </div>
  </div>

  <script type="module" src="/js/teacher/dashboard.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create teacher.css**

Create `public/css/teacher.css`:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #1a1a2e; color: #eee; font-family: 'Courier New', monospace; }
nav {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 2rem; background: #16213e; border-bottom: 2px solid #0f3460;
}
nav h1 { font-size: 1.2rem; color: #e94560; }
#logout-btn { background: transparent; border: 1px solid #e94560; color: #e94560; padding: 0.4rem 1rem; cursor: pointer; font-family: inherit; }
.dashboard { padding: 2rem; max-width: 900px; margin: 0 auto; }
h2 { margin-bottom: 1rem; }
#create-class-btn {
  padding: 0.5rem 1rem; background: #e94560; color: white;
  border: none; cursor: pointer; margin-bottom: 1rem; font-family: inherit;
}
.class-card {
  background: #16213e; border: 1px solid #0f3460; padding: 1rem;
  margin-bottom: 0.5rem; cursor: pointer; border-radius: 4px;
}
.class-card:hover { border-color: #e94560; }
.tabs { display: flex; gap: 0.5rem; margin: 1rem 0; }
.tab { padding: 0.5rem 1rem; background: transparent; border: 1px solid #0f3460; color: #eee; cursor: pointer; font-family: inherit; }
.tab.active { background: #0f3460; }
table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #0f3460; }
th { color: #e94560; }
#export-btn { padding: 0.4rem 1rem; background: #0f3460; color: #eee; border: none; cursor: pointer; font-family: inherit; }
canvas { max-height: 300px; }
#modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 50; }
.modal-content { background: #16213e; border: 2px solid #0f3460; padding: 2rem; border-radius: 8px; min-width: 300px; }
.modal-content input { width: 100%; padding: 0.5rem; margin: 0.5rem 0; background: #1a1a2e; border: 1px solid #0f3460; color: #eee; font-family: inherit; }
.modal-content button { padding: 0.5rem 1rem; margin-right: 0.5rem; border: none; cursor: pointer; font-family: inherit; }
.modal-content .primary { background: #e94560; color: white; }
.modal-content .secondary { background: transparent; border: 1px solid #0f3460; color: #eee; }
```

- [ ] **Step 3: Create dashboard.js**

Create `public/js/teacher/dashboard.js`:
```js
import { api } from '../api.js';
import { renderLeaderboardChart, renderMasteryChart } from './charts.js';

let currentClassId = null;

async function init() {
  try {
    await api('GET', '/api/teacher/classes');
  } catch {
    window.location.href = '/login.html';
    return;
  }
  loadClasses();
  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('POST', '/api/auth/logout');
    window.location.href = '/login.html';
  });

  document.getElementById('create-class-btn').addEventListener('click', showCreateClassModal);
  document.getElementById('back-btn').addEventListener('click', () => {
    document.getElementById('class-detail').style.display = 'none';
    document.getElementById('classes-section').style.display = 'block';
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      document.getElementById(`${tab.dataset.tab}-tab`).style.display = 'block';
    });
  });
}

async function loadClasses() {
  const data = await api('GET', '/api/teacher/classes');
  const list = document.getElementById('classes-list');
  list.innerHTML = '';
  for (const cls of data.classes) {
    const card = document.createElement('div');
    card.className = 'class-card';
    card.innerHTML = `<strong>${cls.name}</strong> — ${cls.student_count} students — Code: ${cls.join_code}`;
    card.addEventListener('click', () => openClass(cls));
    list.appendChild(card);
  }
}

async function openClass(cls) {
  currentClassId = cls.id;
  document.getElementById('classes-section').style.display = 'none';
  document.getElementById('class-detail').style.display = 'block';
  document.getElementById('class-name').textContent = cls.name;
  document.getElementById('class-code').textContent = cls.join_code;

  await loadRoster();
}

async function loadRoster() {
  const data = await api('GET', `/api/teacher/class/${currentClassId}/roster`);
  const tbody = document.querySelector('#roster-table tbody');
  tbody.innerHTML = '';

  for (const s of data.students) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.display_name}</td>
      <td>${s.level}</td>
      <td>${s.xp}</td>
      <td>${s.coins}</td>
      <td>${s.questions_answered}</td>
      <td>${s.accuracy_pct || 0}%</td>
      <td><button class="reset-pin-btn" data-id="${s.id}">Reset PIN</button></td>
    `;
    tbody.appendChild(tr);
  }

  // Reset PIN buttons
  tbody.querySelectorAll('.reset-pin-btn').forEach(btn => {
    btn.addEventListener('click', () => showResetPinModal(btn.dataset.id));
  });

  // Export button
  document.getElementById('export-btn').onclick = () => {
    window.open(`/api/teacher/class/${currentClassId}/export`);
  };

  // Load charts
  const leaderboard = await api('GET', `/api/leaderboard/${currentClassId}`);
  renderLeaderboardChart(leaderboard.leaderboard);

  try {
    const analytics = await api('GET', `/api/teacher/class/${currentClassId}/analytics`);
    renderMasteryChart(analytics.subtopicStats);
  } catch { /* no data yet */ }
}

function showCreateClassModal() {
  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = 'Create Class';
  document.getElementById('modal-body').innerHTML = `
    <input type="text" id="new-class-name" placeholder="Class Name (e.g. Math 6A)">
    <input type="number" id="new-grade-level" placeholder="Grade Level" min="1" max="12" value="6">
    <button class="primary" id="modal-submit">Create</button>
    <button class="secondary" id="modal-cancel">Cancel</button>
  `;
  modal.style.display = 'flex';

  document.getElementById('modal-cancel').onclick = () => modal.style.display = 'none';
  document.getElementById('modal-submit').onclick = async () => {
    const name = document.getElementById('new-class-name').value;
    const gradeLevel = document.getElementById('new-grade-level').value;
    await api('POST', '/api/teacher/class', { name, subject: 'Math', gradeLevel: Number(gradeLevel) });
    modal.style.display = 'none';
    loadClasses();
  };
}

function showResetPinModal(studentId) {
  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = 'Reset Student PIN';
  document.getElementById('modal-body').innerHTML = `
    <input type="password" id="new-pin" placeholder="New 4-digit PIN" maxlength="4" pattern="[0-9]{4}">
    <button class="primary" id="modal-submit">Reset</button>
    <button class="secondary" id="modal-cancel">Cancel</button>
  `;
  modal.style.display = 'flex';

  document.getElementById('modal-cancel').onclick = () => modal.style.display = 'none';
  document.getElementById('modal-submit').onclick = async () => {
    const newPin = document.getElementById('new-pin').value;
    await api('POST', `/api/teacher/student/${studentId}/reset-pin`, { newPin });
    modal.style.display = 'none';
  };
}

init();
```

- [ ] **Step 4: Create charts.js**

Create `public/js/teacher/charts.js`:
```js
let leaderboardChart = null;
let masteryChart = null;

export function renderLeaderboardChart(data) {
  const canvas = document.getElementById('leaderboard-chart');
  if (leaderboardChart) leaderboardChart.destroy();

  leaderboardChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.display_name),
      datasets: [{
        label: 'XP',
        data: data.map(d => d.xp),
        backgroundColor: '#e94560',
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#eee' } } },
      scales: {
        x: { ticks: { color: '#eee' } },
        y: { ticks: { color: '#eee' }, beginAtZero: true },
      },
    },
  });
}

export function renderMasteryChart(data) {
  const canvas = document.getElementById('mastery-chart');
  if (masteryChart) masteryChart.destroy();
  if (!data || data.length === 0) return;

  masteryChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.subtopic_name),
      datasets: [{
        label: 'Average Mastery %',
        data: data.map(d => d.avg_mastery),
        backgroundColor: data.map(d => d.avg_mastery < 50 ? '#e94560' : '#40916c'),
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { labels: { color: '#eee' } } },
      scales: {
        x: { ticks: { color: '#eee' }, max: 100, beginAtZero: true },
        y: { ticks: { color: '#eee', font: { size: 10 } } },
      },
    },
  });
}
```

- [ ] **Step 5: Test dashboard in browser**

```bash
node server/index.js
# Login as teacher → see dashboard
# Create class, get join code
# In another tab, join as student, answer questions
# Refresh dashboard → see roster, leaderboard chart, analytics
# Test CSV export, PIN reset
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: teacher dashboard — class management, roster, leaderboard chart, mastery analytics, CSV export, PIN reset"
```

---

## Task 14: Polish + Integration Testing

**Files:**
- Modify: `server/app.js` — add redirect for unauthenticated root
- Create: `tests/integration.test.js`

- [ ] **Step 1: Add root redirect logic**

Update `server/app.js` — add before static middleware:
```js
app.get('/', (req, res, next) => {
  const session = req.signedCookies?.session;
  if (!session) return res.redirect('/login.html');
  try {
    const user = JSON.parse(session);
    if (user.role === 'teacher') return res.redirect('/teacher.html');
    next(); // Students get index.html (game)
  } catch { res.redirect('/login.html'); }
});
```

- [ ] **Step 2: Write integration test (full flow)**

Create `tests/integration.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server/app.js';
import { resetTestDb, seedTestSchool, testPool } from './setup.js';
import bcrypt from 'bcrypt';

describe('Full Flow Integration', () => {
  let schoolId;

  beforeEach(async () => {
    await resetTestDb();
    schoolId = await seedTestSchool();
  });

  it('teacher creates class → student joins → answers question → earns coins → buys item', async () => {
    // 1. Create teacher
    const tHash = await bcrypt.hash('pass', 10);
    await testPool.query(
      `INSERT INTO users (school_id, role, username, display_name, email, password_hash)
       VALUES ($1, 'teacher', 'teach', 'Teacher', 'teach@test.com', $2)`,
      [schoolId, tHash]
    );
    const teacherLogin = await request(app)
      .post('/api/auth/teacher/login')
      .send({ email: 'teach@test.com', password: 'pass' });
    const teacherCookie = teacherLogin.headers['set-cookie'];

    // 2. Teacher creates class
    const classRes = await request(app)
      .post('/api/teacher/class')
      .set('Cookie', teacherCookie)
      .send({ name: 'Math 6A', subject: 'Math', gradeLevel: 6 });
    expect(classRes.status).toBe(201);
    const joinCode = classRes.body.joinCode;

    // 3. Student joins
    const joinRes = await request(app)
      .post('/api/auth/student/join')
      .send({ joinCode, username: 'student1', displayName: 'Student One', pin: '1234' });
    expect(joinRes.status).toBe(201);
    const studentCookie = joinRes.headers['set-cookie'];

    // 4. Seed a cached question (correct answer is index 1 = "8")
    await testPool.query(
      `INSERT INTO question_cache (subtopic_id, difficulty_level, question_text, choices_json, correct_index, explanation)
       VALUES (1, 1, 'What is 5+3?', '["7","8","9","6"]', 1, '5+3=8')`
    );

    // 5. Student requests encounter
    const encounterRes = await request(app)
      .post('/api/game/encounter')
      .set('Cookie', studentCookie)
      .send({ encounterType: 'npc' });
    expect(encounterRes.status).toBe(200);
    expect(encounterRes.body.question).toBeDefined();

    // 6. Student answers correctly
    const answerRes = await request(app)
      .post('/api/game/answer')
      .set('Cookie', studentCookie)
      .send({ questionId: encounterRes.body.questionId, choiceIndex: 1, responseMs: 2000 });
    expect(answerRes.status).toBe(200);
    expect(answerRes.body.correct).toBe(true);
    expect(answerRes.body.coinsEarned).toBeGreaterThan(0);

    // 7. Verify coins in profile
    const profileRes = await request(app)
      .get('/api/game/profile')
      .set('Cookie', studentCookie);
    expect(profileRes.body.coins).toBeGreaterThan(0);

    // 8. Student buys cheapest item (Starter Pack, 25 coins)
    // Give enough coins first
    await testPool.query(
      `UPDATE player_profiles SET coins = 100 WHERE user_id = ${joinRes.body.user.id}`
    );
    const buyRes = await request(app)
      .post('/api/shop/buy')
      .set('Cookie', studentCookie)
      .send({ itemId: 10 }); // Starter Pack
    expect(buyRes.status).toBe(200);

    // 9. Verify inventory
    const invRes = await request(app)
      .get('/api/inventory')
      .set('Cookie', studentCookie);
    expect(invRes.body.items.length).toBe(1);

    // 10. Teacher sees student in roster
    const rosterRes = await request(app)
      .get(`/api/teacher/class/${classRes.body.id}/roster`)
      .set('Cookie', teacherCookie);
    expect(rosterRes.body.students.length).toBe(1);
    expect(rosterRes.body.students[0].display_name).toBe('Student One');
  });
});
```

- [ ] **Step 3: Run all tests**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run
```
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: integration test (full flow) + root redirect for auth"
```

---

## Task 15: Final Wiring + README

**Files:**
- Modify: `server/app.js` — ensure all routes mounted
- Create: `public/assets/` placeholder structure

- [ ] **Step 1: Create asset placeholder directories**

```bash
mkdir -p public/assets/sprites public/assets/tiles public/assets/ui
```

- [ ] **Step 2: Verify complete app.js has all routes**

Final `server/app.js` should import and mount:
- `healthRouter`
- `authRouter`
- `gameRouter`
- `shopRouter`
- `inventoryRouter`
- `leaderboardRouter`
- `teacherRouter`

- [ ] **Step 3: Run full test suite one final time**

```bash
DATABASE_URL=postgresql://localhost:5432/problocks_test npx vitest run
```
Expected: All green

- [ ] **Step 4: Manual smoke test**

```bash
node server/index.js
```

Verify end-to-end:
1. `/login.html` renders, tabs work
2. Create teacher (via psql), login, create class
3. Join as student with class code
4. Game loads, player moves, NPC has `?` marker
5. Press E near NPC → question dialogue appears
6. Answer → coins + XP update in HUD
7. Press B → shop opens, buy item
8. Teacher dashboard shows student in roster
9. Leaderboard chart renders
10. CSV export downloads

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Problocks Light Phase 1 complete — game, auth, shop, leaderboard, teacher dashboard"
```

---

## Dependency Graph

```
Task 1 (scaffolding)
  └→ Task 2 (database)
       └→ Task 3 (auth)
            ├→ Task 4 (adaptive engine) ─→ Task 6 (game API)
            ├→ Task 5 (economy) ──────────→ Task 7 (shop)
            ├→ Task 8 (leaderboard)
            └→ Task 9 (teacher API)
       Task 10 (login page) ── depends on 3 (auth routes)
       Task 11 (game client) ── depends on 6
       Task 12 (shop UI) ── depends on 7, 11
       Task 13 (teacher dashboard) ── depends on 8, 9
       Task 14 (integration) ── depends on all above
       Task 15 (polish) ── depends on 14
```

**Parallelizable groups:**
- Tasks 4 + 5 can run in parallel
- Tasks 7 + 8 + 9 + 10 can run in parallel
- Tasks 11 + 13 can run in parallel (after their deps)
