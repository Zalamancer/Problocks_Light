import { pool } from '../db.js';
import { generateQuestion } from './ai.js';
import { pickSubtopic, adjustDifficulty } from './adaptive.js';
import { logger } from '../middleware/errors.js';

/**
 * Get the next question for a student, using cache when possible.
 */
export async function getNextQuestion(userId, classSubject, gradeLevel) {
  // 1. Get student mastery data
  const { rows: mastery } = await pool.query(
    `SELECT s.id as subtopic_id, s.name as subtopic_name,
            COALESCE(sm.mastery_pct, 0) as mastery_pct,
            COALESCE(sm.difficulty_level, 1) as difficulty_level,
            sm.last_attempted
     FROM subtopics s
     JOIN topics t ON s.topic_id = t.id
     JOIN subjects sub ON t.subject_id = sub.id
     LEFT JOIN student_mastery sm ON sm.subtopic_id = s.id AND sm.user_id = $1
     WHERE sub.name = $2`,
    [userId, classSubject]
  );

  if (mastery.length === 0) throw new Error('No subtopics found for subject');

  // 2. Pick subtopic using adaptive algorithm
  const target = pickSubtopic(mastery);

  // 3. Get recent answers for difficulty adjustment
  const { rows: recentAnswers } = await pool.query(
    `SELECT is_correct FROM answer_log
     WHERE user_id = $1 AND subtopic_id = $2
     ORDER BY answered_at DESC LIMIT 5`,
    [userId, target.subtopic_id]
  );

  // Calculate streaks
  let correctStreak = 0, wrongStreak = 0;
  for (const a of recentAnswers) {
    if (a.is_correct) { correctStreak++; if (wrongStreak > 0) break; }
    else { wrongStreak++; if (correctStreak > 0) break; }
  }
  const difficulty = adjustDifficulty(target.difficulty_level, correctStreak, wrongStreak);

  // 4. Try cache first — get a question this student hasn't answered
  const { rows: cached } = await pool.query(
    `SELECT id, question_text, choices_json, correct_index, explanation
     FROM question_cache
     WHERE subtopic_id = $1 AND difficulty_level = $2
     AND id NOT IN (SELECT question_id FROM answer_log WHERE user_id = $3 AND question_id IS NOT NULL)
     ORDER BY RANDOM() LIMIT 1`,
    [target.subtopic_id, difficulty, userId]
  );

  if (cached.length > 0) {
    logger.info({ subtopicId: target.subtopic_id, cache: 'hit' }, 'Question served from cache');
    return {
      questionId: cached[0].id,
      subtopicId: target.subtopic_id,
      subtopicName: target.subtopic_name,
      difficulty,
      question: cached[0].question_text,
      choices: cached[0].choices_json,
      correctIndex: cached[0].correct_index,
      explanation: cached[0].explanation,
    };
  }

  // 5. Generate fresh question via AI
  logger.info({ subtopicId: target.subtopic_id, cache: 'miss' }, 'Generating fresh question');
  const generated = await generateQuestion({
    subtopicName: target.subtopic_name,
    difficultyLevel: difficulty,
    gradeLevel,
    encounterType: 'npc',
    recentAnswers,
  });

  // 6. Cache the question (including correct_index for grading)
  const { rows: [inserted] } = await pool.query(
    `INSERT INTO question_cache (subtopic_id, difficulty_level, question_text, choices_json, correct_index, explanation, encounter_type)
     VALUES ($1, $2, $3, $4, $5, $6, 'npc') RETURNING id`,
    [target.subtopic_id, difficulty, generated.question, JSON.stringify(generated.choices), generated.correctIndex, generated.explanation]
  );

  return {
    questionId: inserted.id,
    subtopicId: target.subtopic_id,
    subtopicName: target.subtopic_name,
    difficulty,
    question: generated.question,
    choices: generated.choices,
    correctIndex: generated.correctIndex,
    explanation: generated.explanation,
  };
}
