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
