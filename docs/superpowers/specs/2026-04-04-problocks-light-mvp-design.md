# Problocks Light — MVP Design Spec

**Date:** 2026-04-04
**Status:** Draft
**Target:** First demo for Harmony Science Academy, Texas

---

## 1. Overview

Problocks Light is an educational gaming platform — Roblox-style engagement meets adaptive learning. Students explore a top-down 2D pixel art RPG world where learning encounters (NPCs, obstacles, battles) are powered by AI-generated questions that adapt to each student's knowledge gaps. Students earn coins and skill points, compete in arena mode, build villages, and climb tiered leaderboards.

Teachers get full control: assign games, restrict access, view analytics, adjust difficulty, create custom content, and run live arena sessions.

**First target:** Harmony Science Academy schools in Texas at $1/student/year.

---

## 2. System Architecture

### Approach: Monolith with Clear Internal Boundaries

Single Node.js server with PostgreSQL. Code organized into modules (game, economy, AI, arena, social, teacher) that can be extracted into services later if needed.

```
┌─────────────────────────────────────────────────┐
│                  Client (Browser)                │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ PixiJS    │  │ Game UI  │  │ Teacher      │  │
│  │ Renderer  │  │ (HUD,    │  │ Dashboard    │  │
│  │ (RPG,     │  │  menus,  │  │ (vanilla JS) │  │
│  │  arena)   │  │  village) │  │              │  │
│  └─────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│        └──────────┬───┘               │          │
│              WebSocket + REST         │          │
└──────────────────┬────────────────────┘          │
                   │                               │
┌──────────────────┴───────────────────────────────┘
│                  Server (Node.js + Express)
│  ┌──────────┐ ┌──────────┐ ┌───────────────┐
│  │ Game     │ │ Economy  │ │ AI Engine     │
│  │ Module   │ │ Module   │ │ (Gemini API)  │
│  │ - maps   │ │ - coins  │ │ - adaptive Q  │
│  │ - state  │ │ - gear   │ │ - gap detect  │
│  │ - combat │ │ - shop   │ │ - difficulty  │
│  ├──────────┤ ├──────────┤ ├───────────────┤
│  │ Arena    │ │ Social   │ │ Teacher       │
│  │ Module   │ │ Module   │ │ Module        │
│  │ - match  │ │ - leader │ │ - dashboard   │
│  │ - lobby  │ │ - village│ │ - analytics   │
│  │ - sync   │ │ - profile│ │ - controls    │
│  └──────────┘ └──────────┘ └───────────────┘
│                      │
│              ┌───────┴───────┐
│              │  PostgreSQL   │
│              └───────────────┘
```

### Communication
- **WebSocket:** Arena mode (real-time), RPG state sync
- **REST:** Teacher dashboard, shop, leaderboards, auth
- **Server-authoritative:** All game state validated server-side to prevent cheating

---

## 3. Game Engine & RPG Design

### Renderer: PixiJS
- Lightweight (~100KB), GPU-accelerated 2D
- Handles sprite batching, tilemaps, animations
- Future phases: PixiJS for isometric 2.5D, Babylon.js for 3D

### Map System
- Tile-based maps (32x32 pixel tiles)
- Map data stored as JSON: tile type, collision, interaction zones
- Templates: forest (science), dungeon (math), space station (CS), underwater (biology), city (economics)
- Teacher picks template → AI customizes NPCs, obstacles, question triggers

### Character System
- Player sprite: 4-direction movement + idle animations
- Cosmetic layers: base body → outfit → hat → accessory → pet follower
- Functional gear visually distinct from cosmetic gear

### Learning Encounters

| Type | Trigger | UX | Reward |
|------|---------|-----|--------|
| NPC | Walk up + interact | Dialogue box, question, multiple choice or typed answer | Coins + XP |
| Gate/Obstacle | Walk into blocked path | Puzzle overlay, solve to unlock | XP + new area access |
| Battle | Enter enemy zone | Battle screen — HP bar, question = attack, wrong = take damage | Coins + XP + skill points |

### Question Flow
1. Encounter triggers → client requests question from server
2. Server calls Gemini API with student's history (last 10 answers, known gaps, current difficulty tier)
3. Gemini returns question + 4 choices + explanation for wrong answers
4. Student answers → server records result → adjusts difficulty model
5. Response cached so identical requests don't re-hit Gemini

### Performance Budget (Celeron N4020, 4GB RAM)
- Target: 30fps minimum, 60fps preferred
- Max 200 sprites on screen
- Tile maps pre-rendered to texture atlas
- Simple AABB collision detection (no physics engine)
- Progressive asset loading (visible area first)

---

## 4. Arena Mode (PvP)

### Flow
```
Teacher starts arena → Lobby opens → Students join →
Matchmaking groups by skill tier → 4-8 per room →
Countdown → Questions begin → Elimination rounds → Winner
```

### Matchmaking Tiers
- Tier 1: Beginner (0-100 skill points)
- Tier 2: Intermediate (101-300)
- Tier 3: Advanced (301-600)
- Tier 4: Expert (600+)
- If insufficient players at same tier, expand range ±1 tier

### Round Mechanics
- One question per round, 15-30 second timer (difficulty-based)
- Wrong answer or timeout = eliminated
- Eliminated students spectate
- Last standing wins (or highest accuracy + speed if multiple survive)
- 8-12 rounds per session (~10-15 minutes, fits end-of-class window)

### Rewards
- Winner: 50 coins + 20 skill points
- Top 3: 30 coins + 10 skill points
- Participation: 10 coins + 3 skill points
- Everyone gets XP — no penalty for losing

### Real-time Sync
- WebSocket room per arena match
- Server-authoritative: questions, timer, elimination all server-side
- Client renders state updates only
- Latency tolerance: up to 500ms (turn-based Q&A)

### Teacher Controls
- Start/stop arena, set subject, difficulty range, round count
- Spectate live, see all student answers
- Pause and discuss a question mid-arena

---

## 5. Economy & Village System

### Dual Currency

| Currency | Earned By | Spent On |
|----------|-----------|----------|
| Coins | Correct answers, arena participation, daily login streak | Cosmetics: skins, outfits, pets, village decorations |
| Skill Points | Correct answers only (weighted by difficulty) | Functional gear: hint tokens, time extensions, 50/50 eliminators, XP boosters |

### Earning Rates
- Easy correct: 5 coins, 1 skill point
- Medium correct: 10 coins, 3 skill points
- Hard correct: 20 coins, 7 skill points
- Daily login streak: 10/20/30/50/100 coins at days 1/3/7/14/30

### Shop
- Rotating daily featured items
- Permanent catalog by category
- Cosmetics: 50-5000 coins
- Functional gear: 20-200 skill points
- No real-money purchases — everything earned through learning

### Village System
- Each student gets a 20x20 tile grid plot
- Place buildings, decorations, paths, trees, NPCs
- Buildings unlocked by milestones (100 questions = castle, complete subject = themed building)
- Classmates visit each other's villages (read-only)
- Village prestige score on profile (based on item rarity)
- Separate PixiJS scene (performance-isolated from RPG world)

### Anti-Exploit
- Server validates all coin/SP awards
- Rate limit: max 200 questions/hour/student
- Streak bonus caps at 30 days then resets

---

## 6. AI Adaptive Learning Engine

### Student Knowledge Model
- Per-subject skill graph in PostgreSQL
- Subjects → topics → subtopics (e.g., Math → Fractions → Adding Unlike Denominators)
- Per subtopic: mastery level (0-100%), last attempted, correct/incorrect count, avg response time

### Adaptive Algorithm
```
Student answers question
        ↓
Server updates subtopic mastery
        ↓
Next question request
        ↓
Server picks target subtopic:
  - 60% chance: weakest subtopic (gap pushing)
  - 25% chance: recently learned (reinforcement)
  - 15% chance: new subtopic (exploration)
        ↓
Server sends to Gemini:
  "Generate a [difficulty] question about [subtopic]
   for grade [X]. Student history: [last 5 answers].
   Format: question + 4 choices + explanation.
   Context: [encounter type]"
        ↓
Gemini returns question → server caches
        ↓
Student answers → loop continues
```

### Difficulty Ladder
- 3 wrong in a row on same subtopic → drop one level
- 3 correct in a row → raise one level
- 5 levels: foundational → basic → intermediate → advanced → challenge

### Cost Control
- Cache frequently generated questions (same subtopic + difficulty = reuse)
- Pre-generate batches during off-peak hours (overnight)
- Target: ~80% served from cache, ~20% fresh from Gemini
- Estimated: ~500 fresh questions/student/year = ~$0.02/student/year for AI
- Fallback: if Gemini is down, serve from cached pool

### Teacher Overrides
- Pin specific subtopics for the week
- Upload custom question sets (bypass AI)
- Set difficulty floor/ceiling per student
- Adjust 60/25/15 subtopic selection ratio per class

---

## 7. Teacher Dashboard

### View 1: Class Management
- Roster with student profiles (name, avatar, level, tier)
- Assign game templates to class (pick template, subject, grade)
- Restrict games: whitelist which activities students access
- AI customization: natural language instructions to modify templates
- Schedule: set game time windows

### View 2: Analytics
- Class overview: average mastery per subtopic, gap heatmap
- Per-student drill-down: mastery graph over time, accuracy, time spent, coins earned
- Auto-flagging: stuck (3+ wrong in a row), disengaged (no activity 3 days), suspicious speed
- Export: CSV download for parent meetings / admin reports

### View 3: Controls
- Manual difficulty override (per student or class)
- Create custom question sets
- Set reward multipliers ("double coins this Friday")
- Arena controls: start/stop, spectate, pause, parameters
- Content filter: review/approve AI-generated questions before they go live (optional, off by default)

### Tech
- Server-rendered HTML + vanilla JS
- Charts: Chart.js (~60KB)
- Same auth system, role-based (teacher vs student)

---

## 8. Corporate Sponsorship Integration

### How It Works
Sponsor names are woven into AI-generated questions as real-world scenarios. No banners, no badges — the brand is a natural part of the problem context.

### Examples
- Math: *"Texas Instruments is shipping 14,500 calculators to 12 school districts equally. How many calculators does each district receive?"*
- Economics: *"Walmart's quarterly revenue increased from $152B to $164B. What is the percentage increase?"*
- Science: *"NASA's Perseverance rover traveled 3.7 km in 8 days on Mars. What was its average speed in meters per hour?"*
- English: *"Grammarly analyzed 10,000 essays and found that 37% contained comma splices. Rewrite the following sentence to fix the comma splice."*

### Gemini Prompt Addition
```
When generating this question, naturally incorporate
[Sponsor Name] into the scenario. Use them as the
real-world context (hiring, selling, building,
researching, etc.). Keep it factual and positive —
not an ad, just a realistic business scenario.
```

### Rules
- One sponsor per question max
- Sponsor rotation — no single brand dominates
- Teacher can toggle off if school policy requires
- Sponsors never appear in incorrect answer choices (no negative association)
- All sponsor questions reviewable by teachers

### Subject-Sponsor Mapping

| Subject | Example Sponsors |
|---------|-----------------|
| Math | Texas Instruments, IBM, Casio |
| Economics | Goldman Sachs, Walmart, JPMorgan |
| Science | NASA, SpaceX, 3M |
| English | Grammarly, Penguin Books |
| History | National Geographic, Smithsonian |
| Computer Science | Google, Microsoft, GitHub |

### Privacy
- Zero student data shared with sponsors
- No cookies, pixels, or tracking scripts from sponsors
- Sponsors get monthly aggregate reports: total impressions, subjects, grade levels
- Never individual student info
- COPPA / FERPA compliant by design

### Admin Panel
- Add/remove sponsors, assign to subjects
- Set active date ranges
- Track aggregate impressions per sponsor (the metric sold to companies)

---

## 9. Authentication & Multi-tenancy

### User Roles
- **Platform Admin:** manage schools, sponsors, platform settings
- **School Admin:** manage teachers within their school
- **Teacher:** manage classes, students, games, analytics
- **Student:** play games, earn rewards, build village

### Auth Flow
- Teachers: email + password or Google SSO
- Students: class code + username + PIN (no email, no phone, no PII beyond display name)
- Teacher creates class → gets join code → students enter code + pick username + set PIN

### Multi-tenancy
- Every record scoped to school_id
- Students see only classmates (class/school leaderboard tiers)
- Global leaderboard: anonymized usernames only
- Teachers see only their own classes
- School admins see all classes in their school

### Data Isolation
- Single database, row-level scoping via school_id + class_id
- Game restrictions enforced server-side
- Session tokens: HTTP-only cookies, 24hr expiry (students), 7-day (teachers)

### Compliance (COPPA / FERPA)
- No student PII beyond display name
- No third-party tracking
- School admin can export/delete all student data
- Parent consent at school level (COPPA school exception)

---

## 10. Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Game engine | PixiJS | Lightweight 2D, GPU-accelerated, sprites/tilemaps |
| Client UI | Vanilla JS + HTML/CSS | No framework overhead, fast on Chromebooks |
| Server | Node.js + Express | Fast to build, WebSocket support, large ecosystem |
| Real-time | ws library | Lightweight native WebSocket for arena + game sync |
| Database | PostgreSQL | Reliable relational data, free tier available |
| AI (primary) | Gemini 3.0 Flash Preview | Cheapest quality option ($0.50/1M in, $3/1M out) |
| AI (fallback) | Claude Haiku or equivalent | Backup if primary is down or pricing changes |
| Charts | Chart.js | ~60KB, teacher dashboard needs |
| Auth | Custom (bcrypt + HTTP-only cookies) | Simple, no third-party, COPPA-friendly |

### Rendering Roadmap
1. **Phase 1 (MVP):** PixiJS — top-down 2D pixel art
2. **Phase 2:** PixiJS — isometric 2.5D
3. **Phase 3:** Babylon.js — low-poly 3D

### Teacher Game Creation Roadmap
1. **Phase 1 (MVP):** Templates + AI customization
2. **Phase 2:** Natural language → AI generates mini-game
3. **Phase 3:** Visual drag-and-drop builder with AI assist

---

## 11. Hosting & Cost Estimate

### Infrastructure (for ~500 students)

| Item | Monthly Cost |
|------|-------------|
| VPS (Hetzner or Railway) | ~$15 |
| Database (Supabase free tier) | ~$0 |
| CDN / static assets (Cloudflare R2) | ~$1 |
| Gemini API (~20% fresh questions) | ~$1 |
| Domain | ~$1 |
| **Total** | **~$18/month ($216/year)** |

### Revenue
- $1/student/year × 500 students = $500/year
- Margin before sponsorship: ~$284/year
- Sponsorship revenue is the primary income stream

### Scaling
- Single VPS handles hundreds of concurrent users
- Scale later with Fly.io for global edge deployment
- Add Redis when leaderboard queries slow down

---

## 12. Phased Delivery

The full feature set is too large for a single release. Split into phases:

### Phase 1 — Playable Demo (pitch to Harmony Science Academy)
- Single pre-made dungeon map (math theme)
- NPC encounters only (simplest encounter type)
- AI-adaptive questions via Gemini
- Coins earned per correct answer
- Basic shop with ~10 cosmetic items
- Classroom leaderboard only
- Teacher dashboard: roster, assign subject/grade, view leaderboard, basic accuracy stats
- Student auth: class code + username + PIN
- No arena, no village, no skill points gear, no sponsorship

### Phase 2 — Full Solo Experience
- Multiple map templates (all subjects)
- All three encounter types (NPC, gate, battle)
- Dual currency (coins + skill points)
- Functional gear shop
- Village building
- Tiered leaderboard (classroom → school → global)
- Teacher analytics + controls (full dashboard)
- Sponsorship integration in questions

### Phase 3 — Multiplayer & Scale
- Arena mode (4-8 players, elimination, matchmaking)
- AI template customization for teachers
- School admin role
- Multi-school deployment
- Corporate sponsorship admin panel

---

## 13. Database Schema

### Core Tables

```sql
-- Multi-tenancy
schools (id, name, created_at)
classes (id, school_id, teacher_id, name, join_code, created_at)

-- Users
users (id, school_id, role, username, display_name, password_hash, pin_hash, created_at)
  -- role: 'admin' | 'school_admin' | 'teacher' | 'student'
class_members (class_id, user_id, joined_at)

-- Game State
player_profiles (user_id, coins, skill_points, xp, level, login_streak, last_login)
player_inventory (id, user_id, item_id, equipped, acquired_at)
player_positions (user_id, map_id, x, y, updated_at)

-- Items & Shop
items (id, name, type, category, cost_coins, cost_skill_points, rarity, sprite_key)
  -- type: 'cosmetic' | 'functional'
  -- category: 'outfit' | 'hat' | 'accessory' | 'pet' | 'village_decoration' | 'gear'
shop_featured (id, item_id, start_date, end_date)

-- Learning
subjects (id, name)
topics (id, subject_id, name)
subtopics (id, topic_id, name)
student_mastery (user_id, subtopic_id, mastery_pct, difficulty_level, correct_count, incorrect_count, avg_response_ms, last_attempted)

-- Question Cache
question_cache (id, subtopic_id, difficulty_level, sponsor_id, question_text, choices_json, explanation, encounter_type, created_at)
answer_log (id, user_id, question_id, subtopic_id, is_correct, response_ms, answered_at)

-- Leaderboard (materialized, refreshed periodically)
leaderboard (user_id, class_id, school_id, total_xp, total_skill_points, rank_class, rank_school, rank_global, updated_at)

-- Village
village_tiles (user_id, x, y, item_id, placed_at)

-- Arena (Phase 3)
arena_matches (id, class_id, subject_id, status, created_by, created_at)
arena_participants (match_id, user_id, tier, eliminated_round, final_rank, coins_earned, sp_earned)

-- Sponsorship (Phase 2)
sponsors (id, name, logo_url, active)
sponsor_subjects (sponsor_id, subject_id)
sponsor_impressions (id, sponsor_id, subject_id, date, impression_count)

-- Teacher Controls
class_settings (class_id, difficulty_floor, difficulty_ceiling, subtopic_ratio_json, reward_multiplier, game_schedule_json, sponsor_enabled)
game_restrictions (class_id, allowed_template_ids_json)
```

### Key Indexes
- `student_mastery (user_id, subtopic_id)` — adaptive algorithm lookups
- `question_cache (subtopic_id, difficulty_level)` — cache hit queries
- `answer_log (user_id, answered_at)` — student history
- `leaderboard (class_id, total_xp)` — class rankings
- `class_members (class_id)` — roster lookups

---

## 14. API Contract

### REST Endpoints

**Auth**
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/teacher/login | Email + password or Google SSO |
| POST | /api/auth/student/join | Class code + username + PIN |
| POST | /api/auth/student/login | Username + PIN |
| POST | /api/auth/logout | Clear session |

**Student Game**
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/game/map/:mapId | Get map JSON (tiles, NPCs, zones) |
| POST | /api/game/encounter | Request a question for encounter |
| POST | /api/game/answer | Submit answer, returns result + rewards |
| GET | /api/game/profile | Get player profile (coins, SP, XP, level) |
| POST | /api/game/position | Save player position |

**Economy**
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/shop/catalog | Get available items |
| GET | /api/shop/featured | Get daily featured items |
| POST | /api/shop/buy | Purchase item |
| GET | /api/inventory | Get player inventory |
| POST | /api/inventory/equip | Equip/unequip item |

**Social**
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/leaderboard/:scope | Get leaderboard (class/school/global) |
| GET | /api/village/:userId | Get village layout |
| POST | /api/village/place | Place item in village |
| DELETE | /api/village/remove | Remove item from village |

**Teacher**
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/teacher/classes | List teacher's classes |
| POST | /api/teacher/class | Create class, returns join code |
| GET | /api/teacher/class/:id/roster | Get class roster + stats |
| GET | /api/teacher/class/:id/analytics | Per-student mastery data |
| PUT | /api/teacher/class/:id/settings | Update class settings |
| POST | /api/teacher/class/:id/questions | Upload custom question set |
| POST | /api/teacher/student/:id/reset-pin | Reset student PIN |
| GET | /api/teacher/class/:id/export | CSV export |

### WebSocket Messages (Arena — Phase 3)

**Client → Server**
| Event | Payload | Description |
|-------|---------|-------------|
| arena:join | { matchId } | Join arena lobby |
| arena:answer | { matchId, questionId, choiceIndex } | Submit answer |

**Server → Client**
| Event | Payload | Description |
|-------|---------|-------------|
| arena:lobby | { players[], countdown } | Lobby state update |
| arena:question | { questionId, text, choices[], timer } | New round question |
| arena:result | { eliminated[], remaining[], correctAnswer } | Round result |
| arena:end | { rankings[], rewards[] } | Match complete |

---

## 15. AI Cost Calculation

### Token Estimates Per Question

**Input prompt (~400 tokens):**
- System instructions: ~100 tokens
- Student history (last 5 answers): ~150 tokens
- Subtopic + difficulty + encounter type + sponsor: ~50 tokens
- Format instructions: ~100 tokens

**Output (~200 tokens):**
- Question text: ~50 tokens
- 4 choices: ~80 tokens
- Explanation: ~70 tokens

### Cost Per Fresh Question
- Input: 400 tokens × $0.50 / 1M = $0.0002
- Output: 200 tokens × $3.00 / 1M = $0.0006
- **Total per question: $0.0008**

### Annual Cost Per Student
- Assume 2,500 total questions/student/year (~10/day × 250 school days)
- 80% cache hit rate → 500 fresh questions/student/year
- 500 × $0.0008 = **$0.40/student/year**

**Note:** Previous estimate of $0.02 was too low. Revised to $0.40/student/year. Still well within budget at $1/student/year.

### Cache Strategy
- **Cache key:** `{subtopic_id}:{difficulty_level}:{encounter_type}`
- **TTL:** 30 days (questions don't go stale quickly)
- **Eviction:** LRU, max 100K cached questions
- **Pre-generation:** Nightly job generates 50 questions per active subtopic+difficulty combo
- **Storage:** `question_cache` table in PostgreSQL (no Redis needed at this scale)

### Revised Hosting Cost (500 students)

| Item | Monthly Cost |
|------|-------------|
| VPS | ~$15 |
| Database | ~$0 (free tier) |
| CDN | ~$1 |
| Gemini API | ~$17 ($0.40 × 500 / 12) |
| Domain | ~$1 |
| **Total** | **~$34/month ($408/year)** |

Revenue: $500/year → Margin: ~$92/year before sponsorship.

---

## 16. Connectivity & Resilience

### RPG Mode (offline-tolerant)
- On disconnect: game pauses, shows "Reconnecting..." overlay
- Player position and local state cached in localStorage
- On reconnect: client syncs position + any pending answer submissions
- If offline >30 seconds: queue up to 5 unanswered encounters locally, submit when reconnected
- Questions pre-fetched: client requests next 3 questions in advance, cached locally

### Arena Mode (requires connection)
- Arena requires active WebSocket — no offline fallback
- On disconnect: 10-second grace period to reconnect before auto-elimination
- Teacher sees which students are disconnected

### General
- WebSocket auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- REST requests retry once on network failure, then show user-friendly error
- All state changes are idempotent (safe to retry)

---

## 17. Asset Pipeline

### Art Style
- 16-color palette per tileset (keeps file size tiny)
- Sprites: 32x32 character, 16x16 tiles
- Source: open-source pixel art packs for MVP (e.g., kenney.nl, itch.io free packs)
- Custom art commissioned post-funding

### Asset Format
- Spritesheets: PNG texture atlases with JSON metadata (TexturePacker format, PixiJS native)
- Maps: Tiled editor (.tmx) → exported to JSON
- Audio: MP3 for music, WAV for short SFX (optional for MVP)

### Bundle Budget
- Initial page load: <500KB total (HTML + JS + CSS + core sprites)
- Per-map assets: <200KB (loaded on enter)
- Village assets: <300KB (loaded when visiting village)
- Total game assets: <2MB
- Loaded progressively — no single blocking download

### Build
- Asset files in `/public/assets/` directory
- No build step for assets — static files served directly
- Spritesheet packing done offline (TexturePacker CLI or free alternative)

---

## 18. Observability

### Logging
- Structured JSON logging (pino for Node.js — fast, low overhead)
- Log levels: error, warn, info
- Key events logged: auth attempts, question generation, answer submissions, purchase transactions, WebSocket connections
- No student PII in logs — only user_id

### Error Tracking
- Unhandled exceptions caught and logged with stack trace
- Client-side: `window.onerror` sends errors to `/api/errors` endpoint
- Server-side: Express error middleware logs and returns 500

### Health Check
- `GET /health` — returns 200 if server + database are up
- External uptime monitor (UptimeRobot free tier — checks every 5 min)
- Email alert on downtime

### Metrics (kept simple)
- Daily active users (DAU) — counted from answer_log
- Questions answered per day — counted from answer_log
- Average response time — from answer_log
- Cache hit rate — logged per question request
- All queryable from PostgreSQL — no separate metrics service needed

---

## 19. First Demo Scope Summary (Phase 1 Only)

For the Harmony Science Academy pitch:

- **Single dungeon map** (math theme, top-down 2D pixel art, PixiJS)
- **NPC encounters** only (simplest encounter type)
- **AI-adaptive questions** (Gemini, with caching)
- **Coins** earned per correct answer
- **Basic shop** (~10 cosmetic items)
- **Classroom leaderboard** only
- **Teacher dashboard:** roster, assign subject/grade, view leaderboard, basic accuracy stats, reset student PINs
- **Student auth:** class code + username + PIN
- **Hosted on single VPS, ~$34/month**
- No arena, no village, no skill points gear, no sponsorship — those come in Phase 2+
