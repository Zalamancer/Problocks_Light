import { describe, it, expect } from 'vitest';
import { testPool } from './setup.js';

describe('Database', () => {
  it('connects and has tables', async () => {
    const { rows } = await testPool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    const tables = rows.map(r => r.table_name);
    expect(tables).toContain('users');
    expect(tables).toContain('classes');
    expect(tables).toContain('player_profiles');
    expect(tables).toContain('question_cache');
    expect(tables).toContain('student_mastery');
  });

  it('has seeded math subtopics', async () => {
    const { rows } = await testPool.query('SELECT COUNT(*) as count FROM subtopics');
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(20);
  });

  it('has seeded shop items', async () => {
    const { rows } = await testPool.query('SELECT COUNT(*) as count FROM items');
    expect(Number(rows[0].count)).toBe(10);
  });
});
