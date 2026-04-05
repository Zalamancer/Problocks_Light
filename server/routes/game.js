import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getNextQuestion } from '../services/questions.js';
import { calculateReward } from '../services/economy.js';
import { adjustDifficulty } from '../services/adaptive.js';
import { logger } from '../middleware/errors.js';

const router = Router();

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
    res.redirect(`/assets/maps/${req.params.mapId}.json`);
  } catch (err) { next(err); }
});

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
      if (a.is_correct) { correctStreak++; if (wrongStreak > 0) break; }
      else { wrongStreak++; if (correctStreak > 0) break; }
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
