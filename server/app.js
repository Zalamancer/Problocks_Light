import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFile, readdir } from 'fs/promises';
import { errorHandler } from './middleware/errors.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import gameRouter from './routes/game.js';
import shopRouter from './routes/shop.js';
import inventoryRouter from './routes/inventory.js';
import leaderboardRouter from './routes/leaderboard.js';
import teacherRouter from './routes/teacher.js';
import pixellabRouter from './routes/pixellab.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser(process.env.SESSION_SECRET || 'dev-secret-change-me'));

// Map save/list — defined here to avoid auth/DB dependencies
const mapsDir = join(__dirname, '..', 'public', 'assets', 'maps');
app.post('/api/game/map', async (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) return res.status(400).json({ error: 'name and data required' });
    const safeName = name.replace(/[^a-z0-9_-]/gi, '_').substring(0, 64);
    await writeFile(join(mapsDir, `${safeName}.json`), JSON.stringify(data));
    res.json({ ok: true, mapId: safeName });
  } catch (err) {
    console.error('Map save error:', err);
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/game/maps', async (req, res) => {
  try {
    const files = await readdir(mapsDir);
    res.json(files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Root redirect based on auth
app.get('/', (req, res, next) => {
  const session = req.signedCookies?.session;
  if (!session) return res.redirect('/login.html');
  try {
    const user = JSON.parse(session);
    if (user.role === 'teacher') return res.redirect('/teacher.html');
    next(); // Students get index.html (game)
  } catch { res.redirect('/login.html'); }
});

app.use(express.static('public'));
app.use('/reference', express.static('reference'));
app.use(healthRouter);
app.use(authRouter);
app.use(gameRouter);
app.use(shopRouter);
app.use(inventoryRouter);
app.use(leaderboardRouter);
app.use(teacherRouter);
app.use(pixellabRouter);
app.use(errorHandler);

export default app;
