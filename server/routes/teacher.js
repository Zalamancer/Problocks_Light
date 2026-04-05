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
    const { rows: subtopicStats } = await pool.query(
      `SELECT st.name as subtopic_name, t.name as topic_name,
              ROUND(AVG(sm.mastery_pct)::numeric, 1) as avg_mastery,
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

// Update class settings
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
