import pg from 'pg';

const testPool = new pg.Pool({
  connectionString: 'postgresql://localhost:5432/problocks_test',
});

export async function resetTestDb() {
  await testPool.query(`
    TRUNCATE answer_log, leaderboard, player_inventory, shop_featured,
    player_positions, player_profiles, student_mastery, class_members,
    question_cache, classes, users RESTART IDENTITY CASCADE
  `);
}

export async function seedTestSchool() {
  const { rows } = await testPool.query(
    `SELECT id FROM schools WHERE name = 'Harmony Science Academy'`
  );
  return rows[0].id;
}

export { testPool };
