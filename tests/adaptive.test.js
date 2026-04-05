import { describe, it, expect } from 'vitest';
import { pickSubtopic, adjustDifficulty } from '../server/services/adaptive.js';

describe('Adaptive Algorithm', () => {
  describe('pickSubtopic', () => {
    it('picks weakest subtopic most often (60% weight)', () => {
      const mastery = [
        { subtopic_id: 1, mastery_pct: 20, last_attempted: new Date() },
        { subtopic_id: 2, mastery_pct: 80, last_attempted: new Date() },
        { subtopic_id: 3, mastery_pct: 50, last_attempted: null },
      ];
      const picks = {};
      for (let i = 0; i < 1000; i++) {
        const id = pickSubtopic(mastery).subtopic_id;
        picks[id] = (picks[id] || 0) + 1;
      }
      expect(picks[1]).toBeGreaterThan(picks[2]);
    });

    it('returns a subtopic even with empty mastery (all new)', () => {
      const mastery = [
        { subtopic_id: 1, mastery_pct: 0, last_attempted: null },
        { subtopic_id: 2, mastery_pct: 0, last_attempted: null },
      ];
      const result = pickSubtopic(mastery);
      expect(result.subtopic_id).toBeDefined();
    });
  });

  describe('adjustDifficulty', () => {
    it('increases difficulty after 3 correct in a row', () => {
      expect(adjustDifficulty(2, 3, 0)).toBe(3);
    });

    it('decreases difficulty after 3 wrong in a row', () => {
      expect(adjustDifficulty(3, 0, 3)).toBe(2);
    });

    it('stays at level 1 minimum', () => {
      expect(adjustDifficulty(1, 0, 5)).toBe(1);
    });

    it('caps at level 5 maximum', () => {
      expect(adjustDifficulty(5, 5, 0)).toBe(5);
    });

    it('does not change with mixed results', () => {
      expect(adjustDifficulty(3, 2, 1)).toBe(3);
    });
  });
});
