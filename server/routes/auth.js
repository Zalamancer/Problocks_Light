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
       RETURNING login_streak`,
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
