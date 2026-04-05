# Problocks Light — Brainstorming Decisions

## 1. First Demo Scope
**Question:** What's the very first thing you want to be able to demo?
- A) A student answering AI-generated math questions that adapt to their level (adaptive learning core)
- B) A simple game that a teacher configured, running in the browser on a Chromebook (game runtime)
- C) The full loop — student plays a game, earns coins, sees a leaderboard (gamification proof-of-concept)
- D) Something else

**Picked: C** — Full loop proof-of-concept

---

## 2. Game Type
**Question:** What kind of game does the student play?
- A) Quiz game — answer AI-generated questions, earn coins per correct answer
- B) Adventure/RPG — move a character through a world, encounter learning challenges as obstacles
- C) Tower defense / strategy — answer questions to build defenses, earn resources
- D) Trivia battle arena — 2+ students answer simultaneously

**Picked: B** — Adventure/RPG

---

## 3. Visual Style
**Question:** How should the world look on 1366x768 Chromebook?
- A) Top-down 2D pixel art (classic Zelda / Prodigy style) — lightest, fastest to build
- B) Isometric 2.5D (Final Fantasy Tactics style) — more visual depth, moderate complexity
- C) Simple 3D low-poly (early Roblox style) — most immersive, heaviest on hardware

**Picked: A, B, C** — All three eventually, but **A (top-down 2D pixel art) first** for the demo

---

## 4. How AI Questions Appear In-Game
**Question:** How do AI-generated questions show up during gameplay?
- A) NPC encounters — walk up to a character, dialogue box with question, correct = coins + XP
- B) Obstacle/gate — path blocked, question as a puzzle to unlock next area
- C) Battle system — encounter monsters, defeat by answering correctly, wrong = take damage
- D) Mix of all three depending on context

**Picked: D** — Mix of all three

---

## 5. Who Creates the Game World
**Question:** How do teachers create game experiences?
- A) We build pre-made worlds/campaigns, teachers assign subject/grade level
- B) Teachers get a drag-and-drop map editor (RPG Maker lite)
- C) Teachers pick from templates and configure learning content — no coding

**Picked: All three eventually** — pre-made templates + teacher tools + AI-powered creation

---

## 6. Teacher Mini-Game Creation Experience
**Question:** How do teachers create mini-games using the platform's AI?
- A) Teacher describes game in natural language → AI generates the mini-game code → preview and publish
- B) Visual builder (drag-and-drop blocks, like Scratch) with AI assist
- C) Teacher picks a game template, tells AI what to customize → AI modifies the template

**Picked: A, B, C** — All three eventually, but **C (templates + AI customization) first** for the demo

**Tech note:** Plain HTML5 Canvas + JS in sandboxed iframes is the sweet spot for mini-games on Chromebooks. WASM is overkill for teacher-created mini-games. React too heavy.

---

## 7. Leaderboard Structure
**Question:** How should the leaderboard work?
- A) Classroom only — rankings within own class
- B) School-wide — compete across all classes
- C) Global — all students across all schools
- D) Tiered — classroom → school → global, students toggle between views

**Picked: D** — Tiered leaderboard

---

## 8. Trading System
**Question:** Should students be able to trade or gift coins/items?
- A) No trading — each student earns and spends independently (simplest, prevents exploitation)
- B) Free trading — trade items and coins freely
- C) Limited trading — gift items but not coins, with daily limits

**Picked: A** — No trading, independent economies

---

## 9. Gear System
**Question:** How does gear work — cosmetic, functional, or both?
- A) Cosmetic + stat boosts — appearance AND gameplay advantages
- B) Purely functional — unlocks abilities (skip question, 50/50, double coins)
- C) Cosmetic only — no gameplay advantage
- D) Split — coins buy cosmetics, skill points (earned by correct answers) unlock functional gear

**Picked: D** — Split system. Coins = cosmetics, skill points = functional gear

---

## 10. PvP Mode
**Question:** What should PvP look like in the first demo?
- A) Real-time 1v1 — same questions simultaneously, faster + correct wins
- B) Async challenge — set a score, send challenge to classmate
- C) Arena mode — 4-8 students live, elimination style (wrong answer = knocked out)
- D) Skip PvP in first demo

**Picked: C** — Arena mode, 4-8 students, elimination

---

## 11. AI Difficulty in PvP Arena
**Question:** How should AI difficulty adaptation work when students at different levels compete?
- A) Same questions for everyone — fairest but weaker students get crushed
- B) Personalized difficulty — questions at own level, normalized scoring
- C) Tiered matchmaking — grouped by skill level, compete against similar peers

**Picked: C** — Tiered matchmaking by skill level

---

## 12. Village Building
**Question:** Should village building be in the first demo?
- A) Yes — spend coins to build/decorate a personal village, visible to classmates
- B) Simplified — personal "home base" room to decorate
- C) Skip for first demo

**Picked: A** — Full village building in first demo

---

## 13. Teacher Dashboard
**Question:** What does the teacher need in the first demo?
- A) Minimal — roster, assign game/subject, restrict games, see leaderboard
- B) Analytics — A plus per-student performance, knowledge gaps, time spent, accuracy
- C) Full control — B plus manual difficulty adjustment, custom question sets, reward multipliers

**Picked: C** — Full control dashboard

---

## 14. Architecture Approach
**Options presented:**
- A) Monolith + HTML5 Canvas — single server, custom renderer, simplest
- B) Microservices + Phaser.js/PixiJS — separate services, existing game framework
- C) Serverless + WASM — Cloudflare Workers, Rust→WASM game engine

**Picked: A (Monolith)** with PixiJS instead of custom Canvas renderer

---

## 15. Rendering Engine
**Decision:** PixiJS for Phase 1 & 2, Babylon.js for Phase 3
- Phase 1: PixiJS — top-down 2D pixel art
- Phase 2: PixiJS — isometric 2.5D
- Phase 3: Babylon.js — low-poly 3D

---

## 16. Sponsorship Style
**Original idea:** Badge/logo in corner of questions
**Revised (user's preference):** Sponsor names woven INTO question text as real-world scenarios
- Example: "Texas Instruments is shipping 14,500 calculators to 12 districts equally..."

---

## Summary: First Demo Scope
- **Game:** Top-down 2D pixel art RPG (PixiJS)
- **Learning:** AI questions appear as NPCs, obstacles, and battles (mixed)
- **AI:** Gemini 3.0 Flash Preview, adaptive difficulty, 80% cached / 20% fresh
- **Economy:** Coins (cosmetics) + Skill Points (functional gear), no trading
- **Leaderboard:** Tiered — classroom → school → global
- **PvP:** Arena mode, 4-8 players, elimination, tiered matchmaking
- **Villages:** Full village building (20x20 grid), visible to classmates
- **Teacher tools:** Template-based with AI customization, full analytics + control dashboard
- **Sponsorships:** Brand names integrated into question text, not banner ads
- **Auth:** Class code + username + PIN (students), email/Google SSO (teachers)
- **Tech:** Node.js + Express, PixiJS, PostgreSQL, WebSocket, vanilla JS
- **Hosting:** Single VPS ~$18/month
- **Target:** Harmony Science Academy, Texas, $1/student/year
- **Full spec:** docs/superpowers/specs/2026-04-04-problocks-light-mvp-design.md
