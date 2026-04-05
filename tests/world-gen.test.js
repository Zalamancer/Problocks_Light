import { describe, it, expect } from 'vitest';

// WorldGenerator is browser code using no DOM APIs in generation logic,
// so we can import and test the pure functions directly.
// We'll test via a thin import of the generation module.

describe('SimplexNoise', () => {
  it('produces deterministic output for same seed', async () => {
    const { SimplexNoise } = await import('../public/js/game/world-gen.js');
    const n1 = new SimplexNoise(42);
    const n2 = new SimplexNoise(42);
    for (let i = 0; i < 100; i++) {
      expect(n1.noise2D(i * 0.1, i * 0.2)).toBe(n2.noise2D(i * 0.1, i * 0.2));
    }
  });

  it('produces different output for different seeds', async () => {
    const { SimplexNoise } = await import('../public/js/game/world-gen.js');
    const n1 = new SimplexNoise(42);
    const n2 = new SimplexNoise(99);
    let diffs = 0;
    for (let i = 0; i < 100; i++) {
      if (n1.noise2D(i * 0.1, i * 0.2) !== n2.noise2D(i * 0.1, i * 0.2)) diffs++;
    }
    expect(diffs).toBeGreaterThan(90);
  });

  it('returns values in [-1, 1]', async () => {
    const { SimplexNoise } = await import('../public/js/game/world-gen.js');
    const n = new SimplexNoise(1);
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        const v = n.noise2D(x * 0.05, y * 0.05);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('generateTerrain', () => {
  it('produces a 2D array of correct dimensions', async () => {
    const { generateTerrain } = await import('../public/js/game/world-gen.js');
    const ground = generateTerrain(42, 40, 30);
    expect(ground.length).toBe(30);
    expect(ground[0].length).toBe(40);
  });

  it('only contains valid terrain IDs (0-5)', async () => {
    const { generateTerrain } = await import('../public/js/game/world-gen.js');
    const ground = generateTerrain(42, 60, 45);
    const validIds = new Set([0, 1, 2, 3, 4, 5]);
    for (const row of ground) {
      for (const tile of row) {
        expect(validIds.has(tile)).toBe(true);
      }
    }
  });

  it('guarantees no dirt adjacent to cobblestone', async () => {
    const { generateTerrain, stampTownPlaza } = await import('../public/js/game/world-gen.js');
    const ground = generateTerrain(42, 120, 90);
    stampTownPlaza(42, ground, 120, 90);
    for (let y = 0; y < 90; y++) {
      for (let x = 0; x < 120; x++) {
        if (ground[y][x] === 2) { // dirt
          // Check 4 cardinal neighbors
          if (y > 0) expect(ground[y-1][x]).not.toBe(3);
          if (y < 89) expect(ground[y+1][x]).not.toBe(3);
          if (x > 0) expect(ground[y][x-1]).not.toBe(3);
          if (x < 119) expect(ground[y][x+1]).not.toBe(3);
        }
      }
    }
  });

  it('guarantees no sand adjacent to dirt', async () => {
    const { generateTerrain } = await import('../public/js/game/world-gen.js');
    const ground = generateTerrain(42, 120, 90);
    for (let y = 0; y < 90; y++) {
      for (let x = 0; x < 120; x++) {
        if (ground[y][x] === 5) { // sand
          if (y > 0) expect(ground[y-1][x] !== 2 || ground[y-1][x] === 0).toBeTruthy();
          if (y < 89) expect(ground[y+1][x] !== 2 || ground[y+1][x] === 0).toBeTruthy();
          if (x > 0) expect(ground[y][x-1] !== 2 || ground[y][x-1] === 0).toBeTruthy();
          if (x < 119) expect(ground[y][x+1] !== 2 || ground[y][x+1] === 0).toBeTruthy();
        }
      }
    }
  });

  it('is deterministic', async () => {
    const { generateTerrain } = await import('../public/js/game/world-gen.js');
    const g1 = generateTerrain(12345, 60, 45);
    const g2 = generateTerrain(12345, 60, 45);
    expect(g1).toEqual(g2);
  });
});

describe('detectZones', () => {
  it('returns a 2D array matching ground dimensions', async () => {
    const { generateTerrain, stampTownPlaza, detectZones } = await import('../public/js/game/world-gen.js');
    const ground = generateTerrain(42, 120, 90);
    stampTownPlaza(42, ground, 120, 90);
    const zones = detectZones(42, ground, 120, 90);
    expect(zones.length).toBe(90);
    expect(zones[0].length).toBe(120);
  });

  it('assigns town zone to cobblestone tiles', async () => {
    const { generateTerrain, stampTownPlaza, detectZones, ZONES } = await import('../public/js/game/world-gen.js');
    const ground = generateTerrain(42, 120, 90);
    stampTownPlaza(42, ground, 120, 90);
    const zones = detectZones(42, ground, 120, 90);
    for (let y = 0; y < 90; y++) {
      for (let x = 0; x < 120; x++) {
        if (ground[y][x] === 3) { // cobblestone
          expect(zones[y][x]).toBe(ZONES.TOWN);
        }
      }
    }
  });

  it('assigns beach zone to sand adjacent to water', async () => {
    const { generateTerrain, detectZones, ZONES } = await import('../public/js/game/world-gen.js');
    const ground = generateTerrain(42, 120, 90);
    const zones = detectZones(42, ground, 120, 90);
    // At least some beach tiles should exist if there's water
    const hasWater = ground.flat().includes(4);
    if (hasWater) {
      const hasBeach = zones.flat().includes(ZONES.BEACH);
      expect(hasBeach).toBe(true);
    }
  });

  it('assigns forest zone near map edges', async () => {
    const { generateTerrain, detectZones, ZONES } = await import('../public/js/game/world-gen.js');
    const ground = generateTerrain(42, 120, 90);
    const zones = detectZones(42, ground, 120, 90);
    // Corner tiles (if grass) should be forest
    if (ground[2][2] === 0 || ground[2][2] === 1) {
      expect(zones[2][2]).toBe(ZONES.FOREST);
    }
  });

  it('is deterministic', async () => {
    const { generateTerrain, stampTownPlaza, detectZones } = await import('../public/js/game/world-gen.js');
    const g1 = generateTerrain(99, 60, 45);
    stampTownPlaza(99, g1, 60, 45);
    const z1 = detectZones(99, g1, 60, 45);
    const g2 = generateTerrain(99, 60, 45);
    stampTownPlaza(99, g2, 60, 45);
    const z2 = detectZones(99, g2, 60, 45);
    expect(z1).toEqual(z2);
  });
});

describe('generateWorld (full pipeline)', () => {
  it('returns valid mapData with all required fields', async () => {
    const { generateWorld } = await import('../public/js/game/world-gen.js');
    const map = generateWorld(42, 60, 45);
    expect(map.name).toBe('generated');
    expect(map.width).toBe(60);
    expect(map.height).toBe(45);
    expect(map.tileSize).toBe(16);
    expect(map.layers.ground.length).toBe(45);
    expect(map.layers.ground[0].length).toBe(60);
    expect(map.layers.objects.length).toBe(45);
    expect(map.layers.collision.length).toBe(45);
    expect(map.npcs.length).toBe(3);
    expect(map.playerStart).toHaveProperty('x');
    expect(map.playerStart).toHaveProperty('y');
  });

  it('player starts on a walkable tile', async () => {
    const { generateWorld } = await import('../public/js/game/world-gen.js');
    const map = generateWorld(42, 120, 90);
    const { x, y } = map.playerStart;
    expect(map.layers.collision[y][x]).toBe(0);
    expect(map.layers.ground[y][x]).not.toBe(4); // not water
  });

  it('water tiles are blocked in collision', async () => {
    const { generateWorld } = await import('../public/js/game/world-gen.js');
    const map = generateWorld(42, 120, 90);
    for (let y = 0; y < 90; y++) {
      for (let x = 0; x < 120; x++) {
        if (map.layers.ground[y][x] === 4) {
          expect(map.layers.collision[y][x]).toBe(1);
        }
      }
    }
  });

  it('map border is blocked', async () => {
    const { generateWorld } = await import('../public/js/game/world-gen.js');
    const map = generateWorld(42, 60, 45);
    for (let x = 0; x < 60; x++) {
      expect(map.layers.collision[0][x]).toBe(1);
      expect(map.layers.collision[44][x]).toBe(1);
    }
    for (let y = 0; y < 45; y++) {
      expect(map.layers.collision[y][0]).toBe(1);
      expect(map.layers.collision[y][59]).toBe(1);
    }
  });

  it('is fully deterministic', async () => {
    const { generateWorld } = await import('../public/js/game/world-gen.js');
    const m1 = generateWorld(777, 60, 45);
    const m2 = generateWorld(777, 60, 45);
    expect(m1).toEqual(m2);
  });

  it('different seeds produce different maps', async () => {
    const { generateWorld } = await import('../public/js/game/world-gen.js');
    const m1 = generateWorld(1, 60, 45);
    const m2 = generateWorld(2, 60, 45);
    expect(m1.layers.ground).not.toEqual(m2.layers.ground);
  });
});
