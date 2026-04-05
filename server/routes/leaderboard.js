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
