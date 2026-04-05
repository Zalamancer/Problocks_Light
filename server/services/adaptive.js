/**
 * Pick next subtopic based on mastery data.
 * 60% weakest (gap pushing), 25% recently learned (reinforcement), 15% new (exploration)
 */
export function pickSubtopic(masteryData) {
  if (masteryData.length === 0) throw new Error('No subtopics available');

  const roll = Math.random();
  const sorted = [...masteryData].sort((a, b) => a.mastery_pct - b.mastery_pct);
  const attempted = sorted.filter(m => m.last_attempted !== null);
  const unattempted = sorted.filter(m => m.last_attempted === null);

  if (roll < 0.60) {
    // Gap pushing — weakest subtopic
    return sorted[0];
  } else if (roll < 0.85 && attempted.length > 0) {
    // Reinforcement — recently attempted
    const recent = attempted.sort((a, b) =>
      new Date(b.last_attempted) - new Date(a.last_attempted)
    );
    return recent[Math.floor(Math.random() * Math.min(3, recent.length))];
  } else if (unattempted.length > 0) {
    // Exploration — new subtopic
    return unattempted[Math.floor(Math.random() * unattempted.length)];
  }
  // Fallback to weakest
  return sorted[0];
}

/**
 * Adjust difficulty level based on recent streak.
 * 3 correct in a row → up. 3 wrong in a row → down.
 * Range: 1-5.
 */
export function adjustDifficulty(currentLevel, recentCorrectStreak, recentWrongStreak) {
  let level = currentLevel;
  if (recentCorrectStreak >= 3) level = Math.min(5, level + 1);
  if (recentWrongStreak >= 3) level = Math.max(1, level - 1);
  return level;
}
