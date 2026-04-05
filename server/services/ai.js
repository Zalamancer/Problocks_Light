import { logger } from '../middleware/errors.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const DIFFICULTY_LABELS = ['foundational', 'basic', 'intermediate', 'advanced', 'challenge'];

export async function generateQuestion({ subtopicName, difficultyLevel, gradeLevel, encounterType, recentAnswers }) {
  const difficultyLabel = DIFFICULTY_LABELS[difficultyLevel - 1] || 'basic';
  const historyContext = recentAnswers.length > 0
    ? `Student's recent answers on this topic: ${recentAnswers.map(a => a.is_correct ? 'correct' : 'incorrect').join(', ')}`
    : 'This is the student\'s first question on this topic.';

  const prompt = `Generate a ${difficultyLabel}-level math question about "${subtopicName}" for grade ${gradeLevel}.

${historyContext}

Respond in this exact JSON format:
{
  "question": "the question text",
  "choices": ["choice A", "choice B", "choice C", "choice D"],
  "correctIndex": 0,
  "explanation": "why the correct answer is right"
}

Make the question engaging for a student playing an RPG game. The question should be ${encounterType === 'npc' ? 'presented as dialogue from a wise NPC character' : 'a challenge'}.
Keep the language clear and age-appropriate.`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
      }),
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in Gemini response');

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    logger.error({ err }, 'AI question generation failed');
    throw err;
  }
}
