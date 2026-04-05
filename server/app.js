import express from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errors.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import gameRouter from './routes/game.js';
import shopRouter from './routes/shop.js';
import inventoryRouter from './routes/inventory.js';
import leaderboardRouter from './routes/leaderboard.js';
import teacherRouter from './routes/teacher.js';

const app = express();

app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET || 'dev-secret-change-me'));

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
app.use(healthRouter);
app.use(authRouter);
app.use(gameRouter);
app.use(shopRouter);
app.use(inventoryRouter);
app.use(leaderboardRouter);
app.use(teacherRouter);
app.use(errorHandler);

export default app;
