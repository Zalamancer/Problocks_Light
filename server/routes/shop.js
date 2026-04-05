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
