import { describe, it, expect } from 'vitest';
import { calculateReward, canAfford } from '../server/services/economy.js';

describe('Economy', () => {
  describe('calculateReward', () => {
    it('awards 5 coins + 10 XP for easy correct', () => {
      const reward = calculateReward(1, true);
      expect(reward).toEqual({ coins: 5, xp: 10 });
    });

    it('awards 10 coins + 20 XP for medium correct', () => {
      const reward = calculateReward(3, true);
      expect(reward).toEqual({ coins: 10, xp: 20 });
    });

    it('awards 20 coins + 40 XP for hard correct', () => {
      const reward = calculateReward(5, true);
      expect(reward).toEqual({ coins: 20, xp: 40 });
    });

    it('awards 0 coins + 5 XP for incorrect', () => {
      const reward = calculateReward(3, false);
      expect(reward).toEqual({ coins: 0, xp: 5 });
    });
  });

  describe('canAfford', () => {
    it('returns true if player has enough coins', () => {
      expect(canAfford(100, 50)).toBe(true);
    });

    it('returns false if player cannot afford', () => {
      expect(canAfford(30, 50)).toBe(false);
    });

    it('returns true for exact amount', () => {
      expect(canAfford(50, 50)).toBe(true);
    });
  });
});
