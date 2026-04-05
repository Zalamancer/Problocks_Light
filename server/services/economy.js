const COIN_REWARDS = {
  1: 5,   // foundational
  2: 7,   // basic
  3: 10,  // intermediate
  4: 15,  // advanced
  5: 20,  // challenge
};

const XP_REWARDS = {
  1: 10,
  2: 15,
  3: 20,
  4: 30,
  5: 40,
};

export function calculateReward(difficultyLevel, isCorrect) {
  if (!isCorrect) return { coins: 0, xp: 5 };
  return {
    coins: COIN_REWARDS[difficultyLevel] || 5,
    xp: XP_REWARDS[difficultyLevel] || 10,
  };
}

export function canAfford(playerCoins, itemCost) {
  return playerCoins >= itemCost;
}

export const LOGIN_STREAK_BONUSES = {
  1: 10,
  3: 20,
  7: 30,
  14: 50,
  30: 100,
};

export function getStreakBonus(streakDays) {
  const milestones = Object.keys(LOGIN_STREAK_BONUSES).map(Number).sort((a, b) => b - a);
  for (const m of milestones) {
    if (streakDays >= m) return LOGIN_STREAK_BONUSES[m];
  }
  return 0;
}
