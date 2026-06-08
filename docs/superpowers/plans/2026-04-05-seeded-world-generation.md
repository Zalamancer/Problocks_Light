# Seeded World Generation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static village map with a client-side seeded procedural world generator using Simplex noise, whole-building sprites, and ground-layer baking for Chromebook performance.

**Architecture:** A `WorldGenerator` class in `public/js/game/world-gen.js` takes a seed and produces a map data object. Simplex noise generates organic terrain, zones are detected from terrain features, objects/buildings are scattered per zone density rules. The renderer in `map.js` is cleaned up (remove all procedural canvas code) and optimized (bake ground to RenderTexture).

**Tech Stack:** PixiJS (browser renderer), Simplex noise (inline implementation), Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-04-05-seeded-world-generation-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `public/js/game/world-gen.js` | Create | WorldGenerator class + inline SimplexNoise |
| `public/js/game/map.js` | Modify | Remove procedural code, update object registry, add ground baking |
| `public/js/game/engine.js` | Modify | Use WorldGenerator instead of static JSON fetch |
| `tests/world-gen.test.js` | Create | Determinism, terrain adjacency, zone detection, collision tests |
| `public/tile-viewer.html` | Modify | Update object IDs for new building sprites |
| `public/assets/objects/cherry-tree.png` | Rename | → `pine-tree.png` |
| `public/assets/objects/wall.png` | Delete | Replaced by whole building sprites |
| `public/assets/objects/door.png` | Delete | Replaced by whole building sprites |
| `public/assets/objects/window.png` | Delete | Replaced by whole building sprites |
| `public/assets/objects/roof.png` | Delete | Replaced by whole building sprites |
| `scripts/generate-village.js` | Delete | Replaced by client-side generation |
| `public/assets/maps/village-main.json` | Delete | Maps generated at runtime |
| `public/assets/maps/dungeon-math.json` | Delete | Unused |

---

### Task 1: Generate PixelLab Building Assets

**Files:**
- Create: `public/assets/objects/shop-a.png`, `shop-b.png`, `shop-c.png`
- Create: `public/assets/objects/farmhouse-a.png`, `farmhouse-b.png`
- Create: `public/assets/objects/barn-a.png`, `barn-b.png`
- Create: `public/assets/objects/cave-a.png`, `cave-b.png`
- Create: `public/assets/objects/dock-a.png`, `dock-b.png`
- Create: `public/assets/objects/bridge-h.png`, `bridge-v.png`
- Create: `public/assets/objects/mushroom.png`

This task generates all new PixelLab assets needed before code changes. Use the `mcp__pixellab__create_map_object` tool. Respect the concurrent job limit (max 5 at a time).

- [ ] **Step 1: Generate shop variants (3)**

Queue 3 shop generation jobs via PixelLab MCP:
- Shop A: `"Stardew Valley pixel art storefront with red striped awning, wooden sign, warm brown wooden door, stone foundation, cream colored walls"` — 128x128, low top-down, high detail, detailed shading, selective outline
- Shop B: `"Stardew Valley pixel art bakery shop with blue awning, display window with bread, warm wooden frame, stone base"` — 128x128, same settings
- Shop C: `"Stardew Valley pixel art general store with green awning, wooden barrel outside, hanging lantern, stone and wood facade"` — 128x128, same settings

Wait for completion, download each to `public/assets/objects/shop-a.png`, `shop-b.png`, `shop-c.png` using `curl -L --fail`.

- [ ] **Step 2: Generate farmhouse + barn variants (4)**

- Farmhouse A: `"Stardew Valley cozy cottage with smoking chimney, warm terracotta roof, cream walls, wooden door, flower box window, small porch"` — 128x128
- Farmhouse B: `"Stardew Valley stone cottage with thatched brown roof, round window, wooden fence, garden patch beside it"` — 128x128
- Barn A: `"Stardew Valley large red barn with double sliding doors, hay loft window, wooden planks, peaked roof"` — 160x128
- Barn B: `"Stardew Valley brown wooden barn with white trim, large door, weathervane on top, hay bales visible"` — 160x128

Download to `public/assets/objects/farmhouse-a.png`, `farmhouse-b.png`, `barn-a.png`, `barn-b.png`.

- [ ] **Step 3: Generate cave + dock + bridge + mushroom (6)**

- Cave A: `"Stardew Valley dark cave entrance in rocky hillside, grey-brown stones, dark opening, moss on rocks, scattered pebbles"` — 128x96
- Cave B: `"Stardew Valley mine entrance with wooden support beams, dark opening, lantern hanging, rocky terrain"` — 128x96
- Dock A: `"Stardew Valley wooden pier extending over water, warm brown planks, rope post, simple railing"` — 128x64
- Dock B: `"Stardew Valley small fishing dock with wooden planks, barrel on end, rope coil, weathered wood"` — 128x64
- Bridge H: `"Stardew Valley horizontal wooden plank bridge top-down view, warm brown wood, side railings"` — 64x32, high top-down view
- Bridge V: `"Stardew Valley vertical wooden plank bridge top-down view, warm brown wood, side railings"` — 32x64, high top-down view

Also generate: Mushroom: `"Stardew Valley red spotted mushroom with white dots, small forest mushroom"` — 32x32, low top-down

Download all to `public/assets/objects/`.

- [ ] **Step 4: Rename and delete old assets**

```bash
cd public/assets/objects
mv cherry-tree.png pine-tree.png
rm wall.png door.png window.png roof.png
```

- [ ] **Step 5: Verify all assets exist**

```bash
ls -la public/assets/objects/*.png | wc -l
# Expected: 26 files (oak-tree, pine-tree, bush, rock, fence, shop-a/b/c, farmhouse-a/b, barn-a/b, cave-a/b, dock-a/b, bridge-h, bridge-v, flowers, sign, lamp, bench, barrel, well, mushroom)
```

- [ ] **Step 6: Commit**

```bash
git add public/assets/objects/ public/assets/tiles/
git commit -m "feat: add PixelLab building sprites, rename cherry→pine, remove tile-based building parts"
```

---

### Task 2: Simplex Noise + Terrain Generation

**Files:**
- Create: `public/js/game/world-gen.js`
- Create: `tests/world-gen.test.js`

- [ ] **Step 1: Write terrain generation tests**

Create `tests/world-gen.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/world-gen.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SimplexNoise and generateTerrain**

Create `public/js/game/world-gen.js`:

```javascript
// Seeded Simplex 2D noise — inline, no dependencies
// Based on Stefan Gustavson's implementation, adapted for seeded determinism

export class SimplexNoise {
  constructor(seed) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    // Seed-based permutation using simple LCG
    let s = seed | 0;
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = ((s >>> 0) % (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (x + y) * F2;
    const i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = x - X0, y0 = y - Y0;
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const grad = (hash, gx, gy) => {
      const h = hash & 7;
      const u = h < 4 ? gx : gy;
      const v = h < 4 ? gy : gx;
      return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
    };
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * grad(this.perm[ii + this.perm[jj]], x0, y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * grad(this.perm[ii + i1 + this.perm[jj + j1]], x1, y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * grad(this.perm[ii + 1 + this.perm[jj + 1]], x2, y2); }
    return 70 * (n0 + n1 + n2); // Scale to roughly [-1, 1]
  }
}

// Seeded pseudo-random number generator (deterministic)
class SeededRNG {
  constructor(seed) {
    this.state = seed | 0;
  }
  next() {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff;
    return (this.state >>> 0) / 0xffffffff;
  }
  nextInt(max) {
    return Math.floor(this.next() * max);
  }
}

// --- Terrain Generation ---

// Terrain IDs: 0=grass, 1=grass_light, 2=dirt, 3=cobblestone, 4=water, 5=sand
const TERRAIN = { GRASS: 0, GRASS_LIGHT: 1, DIRT: 2, COBBLE: 3, WATER: 4, SAND: 5 };

export function generateTerrain(seed, w, h) {
  const noise = new SimplexNoise(seed);
  const rng = new SeededRNG(seed + 1);
  const ground = [];

  const cx = w / 2, cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      // Base noise (low frequency)
      const base = noise.noise2D(x * 0.03, y * 0.03);
      // Detail noise (high frequency, low amplitude)
      const detail = noise.noise2D(x * 0.1, y * 0.1) * 0.2;
      // Radial bias: boost center toward dirt
      const dx = (x - cx) / cx, dy = (y - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radialBias = (1 - dist) * 0.3;

      // Combined value normalized to [0, 1]
      let val = (base + detail + radialBias + 1) / 2;
      val = Math.max(0, Math.min(1, val));

      let terrain;
      if (val < 0.25) terrain = TERRAIN.WATER;
      else if (val < 0.35) terrain = TERRAIN.SAND;
      else if (val < 0.75) terrain = TERRAIN.GRASS;
      else terrain = TERRAIN.DIRT;

      // Grass light variation (~15%)
      if (terrain === TERRAIN.GRASS && rng.next() < 0.15) {
        terrain = TERRAIN.GRASS_LIGHT;
      }

      row.push(terrain);
    }
    ground.push(row);
  }

  return ground;
}

// --- Town Plaza Stamping ---

export function stampTownPlaza(seed, ground, w, h) {
  // Find the largest dirt cluster near center and stamp a cobblestone plaza
  // with a guaranteed 1-tile grass buffer around it
  const rng = new SeededRNG(seed + 100);
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Plaza size: 6-10 tiles
  const pw = 6 + rng.nextInt(5);
  const ph = 6 + rng.nextInt(5);
  const px = cx - Math.floor(pw / 2);
  const py = cy - Math.floor(ph / 2);

  // Stamp grass buffer (plaza + 1 tile border)
  for (let dy = -1; dy <= ph; dy++) {
    for (let dx = -1; dx <= pw; dx++) {
      const tx = px + dx, ty = py + dy;
      if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
        if (dx === -1 || dx === pw || dy === -1 || dy === ph) {
          // Buffer ring: force grass if currently dirt
          if (ground[ty][tx] === TERRAIN.DIRT) {
            ground[ty][tx] = TERRAIN.GRASS;
          }
        } else {
          // Plaza interior: cobblestone
          ground[ty][tx] = TERRAIN.COBBLE;
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/world-gen.test.js`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add public/js/game/world-gen.js tests/world-gen.test.js
git commit -m "feat: add SimplexNoise and terrain generation with adjacency guarantees"
```

---

### Task 3: Zone Detection

**Files:**
- Modify: `public/js/game/world-gen.js`
- Modify: `tests/world-gen.test.js`

- [ ] **Step 1: Write zone detection tests**

Add to `tests/world-gen.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/world-gen.test.js`
Expected: FAIL — `detectZones` and `ZONES` not found

- [ ] **Step 3: Implement zone detection**

Add to `public/js/game/world-gen.js`:

```javascript
export const ZONES = {
  NONE: 0,
  TOWN: 1,
  CAVE: 2,
  BEACH: 3,
  FARM: 4,
  FOREST: 5,
};

export function detectZones(seed, ground, w, h) {
  const zones = [];
  for (let y = 0; y < h; y++) zones.push(new Array(w).fill(ZONES.NONE));

  const norm = t => (t === 1 ? 0 : t);
  const EDGE_BAND = 10;

  // Pass 1: Town — cobblestone tiles + adjacent dirt
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ground[y][x] === TERRAIN.COBBLE) zones[y][x] = ZONES.TOWN;
      if (ground[y][x] === TERRAIN.DIRT) zones[y][x] = ZONES.TOWN;
    }
  }

  // Pass 2: Cave — highest-scoring quadrant corner
  const halfW = Math.floor(w / 2), halfH = Math.floor(h / 2);
  const quadrants = [
    { sx: 0, sy: 0 },          // NW
    { sx: halfW, sy: 0 },      // NE
    { sx: 0, sy: halfH },      // SW
    { sx: halfW, sy: halfH },  // SE
  ];
  let bestQ = 0, bestScore = -1;
  for (let q = 0; q < 4; q++) {
    let score = 0;
    const { sx, sy } = quadrants[q];
    for (let y = sy; y < sy + halfH && y < h; y++) {
      for (let x = sx; x < sx + halfW && x < w; x++) {
        if (ground[y][x] === TERRAIN.DIRT) score++;
      }
    }
    if (score > bestScore) { bestScore = score; bestQ = q; }
  }
  // Mark a 15x15 area in that quadrant's corner as cave
  const caveQ = quadrants[bestQ];
  const caveX = bestQ % 2 === 0 ? caveQ.sx : caveQ.sx + halfW - 15;
  const caveY = bestQ < 2 ? caveQ.sy : caveQ.sy + halfH - 15;
  for (let y = Math.max(0, caveY); y < Math.min(h, caveY + 15); y++) {
    for (let x = Math.max(0, caveX); x < Math.min(w, caveX + 15); x++) {
      if (zones[y][x] === ZONES.NONE) zones[y][x] = ZONES.CAVE;
    }
  }

  // Pass 3: Beach — sand tiles adjacent to water
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (norm(ground[y][x]) === TERRAIN.SAND) {
        const neighbors = [];
        if (y > 0) neighbors.push(ground[y-1][x]);
        if (y < h-1) neighbors.push(ground[y+1][x]);
        if (x > 0) neighbors.push(ground[y][x-1]);
        if (x < w-1) neighbors.push(ground[y][x+1]);
        if (neighbors.some(n => n === TERRAIN.WATER)) {
          if (zones[y][x] === ZONES.NONE) zones[y][x] = ZONES.BEACH;
        }
      }
    }
  }

  // Pass 4: Forest — grass within EDGE_BAND of map edge
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (norm(ground[y][x]) === TERRAIN.GRASS &&
          (x < EDGE_BAND || x >= w - EDGE_BAND || y < EDGE_BAND || y >= h - EDGE_BAND)) {
        if (zones[y][x] === ZONES.NONE) zones[y][x] = ZONES.FOREST;
      }
    }
  }

  // Pass 5: Farm — grass adjacent to town zone, not forest
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (norm(ground[y][x]) === TERRAIN.GRASS && zones[y][x] === ZONES.NONE) {
        const neighbors = [];
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
              neighbors.push(zones[ny][nx]);
            }
          }
        }
        if (neighbors.includes(ZONES.TOWN)) {
          zones[y][x] = ZONES.FARM;
        }
      }
    }
  }

  return zones;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/world-gen.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add public/js/game/world-gen.js tests/world-gen.test.js
git commit -m "feat: add zone detection (town, cave, beach, forest, farm)"
```

---

### Task 4: Object Placement + Collision + NPC + Full Generator

**Files:**
- Modify: `public/js/game/world-gen.js`
- Modify: `tests/world-gen.test.js`

- [ ] **Step 1: Write object placement and full generator tests**

Add to `tests/world-gen.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/world-gen.test.js`
Expected: FAIL — `generateWorld` not found

- [ ] **Step 3: Implement object placement, collision, NPC, and generateWorld**

Add to `public/js/game/world-gen.js`:

```javascript
// --- Object Registry ---
// Footprint in tiles (fw x fh) for collision stamping
const OBJ_FOOTPRINT = {
  1: [2,2], 2: [2,2],                       // trees
  3: [1,1], 4: [1,1], 5: [1,1],             // bush, rock, fence
  6: [4,4], 7: [4,4], 8: [4,4],             // shops
  9: [4,4], 10: [4,4],                       // farmhouses
  11: [5,4], 12: [5,4],                      // barns
  13: [4,3], 14: [4,3],                      // caves
  15: [4,2], 16: [4,2],                      // docks
  17: [2,1], 18: [1,2],                      // bridges
  19: [1,1], 20: [1,1], 21: [1,1],           // flowers, tall grass, sign
  22: [1,1], 23: [2,1], 24: [1,1], 25: [1,1], 26: [1,1], // lamp, bench, barrel, well, mushroom
};

// Objects that DON'T block movement
const WALKABLE_OBJECTS = new Set([19, 20, 26]); // flowers, tall grass, mushroom

// Zone → object placement rules
const ZONE_OBJECTS = {
  [ZONES.FOREST]: [
    { ids: [1, 2], density: 8, spacing: 1 },
    { ids: [3], density: 3, spacing: 0 },
    { ids: [20], density: 5, spacing: 0 },
    { ids: [26], density: 2, spacing: 0 },
    { ids: [4], density: 2, spacing: 0 },
  ],
  [ZONES.TOWN]: [
    { ids: [6, 7, 8], total: 3, spacing: 6 },
    { ids: [22], density: 3, spacing: 0 },
    { ids: [23], density: 2, spacing: 0 },
    { ids: [21], total: 2, spacing: 0 },
    { ids: [24], density: 2, spacing: 0 },
  ],
  [ZONES.FARM]: [
    { ids: [9, 10], total: 2, spacing: 6 },
    { ids: [11, 12], total: 2, spacing: 6 },
    { ids: [5], density: 8, spacing: 0 },
    { ids: [25], total: 1, spacing: 0 },
  ],
  [ZONES.BEACH]: [
    { ids: [15, 16], total: 1, spacing: 0 },
    { ids: [4], density: 3, spacing: 0 },
  ],
  [ZONES.CAVE]: [
    { ids: [13, 14], total: 1, spacing: 0 },
    { ids: [4], density: 6, spacing: 0 },
  ],
};

function canPlace(objects, collision, x, y, fw, fh, w, h, spacing) {
  // Check bounds
  if (x < 0 || y < 0 || x + fw > w || y + fh > h) return false;
  // Check footprint is clear
  for (let dy = -spacing; dy < fh + spacing; dy++) {
    for (let dx = -spacing; dx < fw + spacing; dx++) {
      const tx = x + dx, ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      if (objects[ty][tx] !== 0 || collision[ty][tx] !== 0) return false;
    }
  }
  return true;
}

function stampObject(objects, collision, x, y, objId, fw, fh) {
  objects[y][x] = objId; // anchor only
  if (!WALKABLE_OBJECTS.has(objId)) {
    for (let dy = 0; dy < fh; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        collision[y + dy][x + dx] = 1;
      }
    }
  }
}

function placeObjects(seed, ground, zones, w, h) {
  const rng = new SeededRNG(seed + 200);
  const objects = [];
  const collision = [];
  for (let y = 0; y < h; y++) {
    objects.push(new Array(w).fill(0));
    collision.push(new Array(w).fill(0));
  }

  // Block water and map border
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ground[y][x] === TERRAIN.WATER) collision[y][x] = 1;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) collision[y][x] = 1;
    }
  }

  // Collect tiles per zone
  const zoneTiles = {};
  for (const z of Object.values(ZONES)) zoneTiles[z] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      zoneTiles[zones[y][x]].push([x, y]);
    }
  }

  // Place objects per zone
  for (const [zone, rules] of Object.entries(ZONE_OBJECTS)) {
    const tiles = zoneTiles[zone];
    if (!tiles || tiles.length === 0) continue;

    for (const rule of rules) {
      const count = rule.total ?? Math.floor(tiles.length * rule.density / 100);
      let placed = 0;
      // Shuffle tiles deterministically
      const shuffled = [...tiles];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = rng.nextInt(i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      for (const [tx, ty] of shuffled) {
        if (placed >= count) break;
        const objId = rule.ids[rng.nextInt(rule.ids.length)];
        const [fw, fh] = OBJ_FOOTPRINT[objId] || [1, 1];
        if (canPlace(objects, collision, tx, ty, fw, fh, w, h, rule.spacing || 0)) {
          stampObject(objects, collision, tx, ty, objId, fw, fh);
          placed++;
        }
      }
    }
  }

  return { objects, collision };
}

function placeBridges(seed, ground, objects, collision, w, h) {
  const rng = new SeededRNG(seed + 250);
  // Scan for 1-2 tile water gaps between dirt/cobblestone paths
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 2; x++) {
      const left = ground[y][x], right = ground[y][x+1];
      // Horizontal bridge: dirt/cobble — water — dirt/cobble
      if ((left === TERRAIN.DIRT || left === TERRAIN.COBBLE) &&
          ground[y][x+1] === TERRAIN.WATER &&
          (x+2 < w && (ground[y][x+2] === TERRAIN.DIRT || ground[y][x+2] === TERRAIN.COBBLE))) {
        if (canPlace(objects, collision, x+1, y, 2, 1, w, h, 0)) {
          stampObject(objects, collision, x+1, y, 17, 2, 1); // Bridge H
        }
      }
    }
  }
  for (let y = 1; y < h - 2; y++) {
    for (let x = 1; x < w - 1; x++) {
      // Vertical bridge: dirt/cobble above — water — dirt/cobble below
      if ((ground[y][x] === TERRAIN.DIRT || ground[y][x] === TERRAIN.COBBLE) &&
          ground[y+1][x] === TERRAIN.WATER &&
          (y+2 < h && (ground[y+2][x] === TERRAIN.DIRT || ground[y+2][x] === TERRAIN.COBBLE))) {
        if (canPlace(objects, collision, x, y+1, 1, 2, w, h, 0)) {
          stampObject(objects, collision, x, y+1, 18, 1, 2); // Bridge V
        }
      }
    }
  }
}

function placeNPCs(seed, zones, objects, collision, w, h) {
  const rng = new SeededRNG(seed + 300);
  const npcs = [
    { id: 'teacher', name: 'Prof. Stellar', sprite: 'npc_teacher' },
    { id: 'shopkeeper', name: 'Merchant Rosa', sprite: 'npc_shop' },
    { id: 'librarian', name: 'Sage Lumen', sprite: 'npc_library' },
  ];

  // Find walkable tiles in town zone (check both objects AND collision)
  const townTiles = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (zones[y][x] === ZONES.TOWN && objects[y][x] === 0 && collision[y][x] === 0) {
        townTiles.push([x, y]);
      }
    }
  }

  // Shuffle and assign positions
  for (let i = townTiles.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [townTiles[i], townTiles[j]] = [townTiles[j], townTiles[i]];
  }

  for (let i = 0; i < npcs.length; i++) {
    if (i < townTiles.length) {
      npcs[i].x = townTiles[i][0];
      npcs[i].y = townTiles[i][1];
    } else {
      // Fallback: center of map
      npcs[i].x = Math.floor(w / 2) + i;
      npcs[i].y = Math.floor(h / 2);
    }
  }

  return npcs;
}

function findPlayerStart(ground, zones, collision, w, h) {
  // Prefer town zone, walkable, grass or dirt
  for (let r = 0; r < Math.max(w, h); r++) {
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && x < w && y >= 0 && y < h &&
            collision[y][x] === 0 &&
            ground[y][x] !== TERRAIN.WATER) {
          return { x, y };
        }
      }
    }
  }
  return { x: Math.floor(w / 2), y: Math.floor(h / 2) };
}

// --- Main Generator ---

export function generateWorld(seed, width, height) {
  const ground = generateTerrain(seed, width, height);
  stampTownPlaza(seed, ground, width, height);
  const zones = detectZones(seed, ground, width, height);
  const { objects, collision } = placeObjects(seed, ground, zones, width, height);
  placeBridges(seed, ground, objects, collision, width, height);
  const npcs = placeNPCs(seed, zones, objects, collision, width, height);
  const playerStart = findPlayerStart(ground, zones, collision, width, height);

  return {
    name: 'generated',
    width,
    height,
    tileSize: 16,
    layers: { ground, objects, collision },
    npcs,
    playerStart,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/world-gen.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add public/js/game/world-gen.js tests/world-gen.test.js
git commit -m "feat: add object placement, collision, NPC placement, and full generateWorld pipeline"
```

---

### Task 5: Clean Up map.js — Remove Procedural Code + Update Object Registry

**Files:**
- Modify: `public/js/game/map.js`

- [ ] **Step 1: Remove BridgeAtlas, P palette, rgb(), makeCanvas()**

In `public/js/game/map.js`, delete lines 1-12 (palette + rgb) and lines 184-218 (makeCanvas + BridgeAtlas class). Remove the bridge ground tile comment from line 1.

Replace the file header with:
```javascript
// Tile map renderer using PixelLab Wang tilesets + object sprites
// Ground tiles: 0=grass, 1=grass_light, 2=dirt, 3=cobblestone, 4=water, 5=sand
// Objects: see PIXELLAB_OBJECTS registry below
```

- [ ] **Step 2: Update PIXELLAB_OBJECTS to new ID scheme**

Replace the existing `PIXELLAB_OBJECTS` constant with:

```javascript
const PIXELLAB_OBJECTS = {
  1:  { file: 'oak-tree.png',    dir: 'objects', scale: 0.25, ox: -16, oy: -80 },
  2:  { file: 'pine-tree.png',   dir: 'objects', scale: 0.25, ox: -12, oy: -80 },
  3:  { file: 'bush.png',        dir: 'objects', scale: 0.5,  ox: 0,   oy: 0 },
  4:  { file: 'rock.png',        dir: 'objects', scale: 0.5,  ox: 0,   oy: 0 },
  5:  { file: 'fence.png',       dir: 'objects', scale: 0.5,  ox: 0,   oy: 0 },
  6:  { file: 'shop-a.png',      dir: 'objects', scale: 0.5,  ox: -24, oy: -48 },
  7:  { file: 'shop-b.png',      dir: 'objects', scale: 0.5,  ox: -24, oy: -48 },
  8:  { file: 'shop-c.png',      dir: 'objects', scale: 0.5,  ox: -24, oy: -48 },
  9:  { file: 'farmhouse-a.png', dir: 'objects', scale: 0.5,  ox: -24, oy: -48 },
  10: { file: 'farmhouse-b.png', dir: 'objects', scale: 0.5,  ox: -24, oy: -48 },
  11: { file: 'barn-a.png',      dir: 'objects', scale: 0.5,  ox: -32, oy: -48 },
  12: { file: 'barn-b.png',      dir: 'objects', scale: 0.5,  ox: -32, oy: -48 },
  13: { file: 'cave-a.png',      dir: 'objects', scale: 0.5,  ox: -24, oy: -32 },
  14: { file: 'cave-b.png',      dir: 'objects', scale: 0.5,  ox: -24, oy: -32 },
  15: { file: 'dock-a.png',      dir: 'objects', scale: 0.5,  ox: -24, oy: -16 },
  16: { file: 'dock-b.png',      dir: 'objects', scale: 0.5,  ox: -24, oy: -16 },
  17: { file: 'bridge-h.png',    dir: 'objects', scale: 0.5,  ox: -8,  oy: 0 },
  18: { file: 'bridge-v.png',    dir: 'objects', scale: 0.5,  ox: 0,   oy: -16 },
  19: { file: 'flowers.png',     dir: 'objects', scale: 0.5,  ox: 0,   oy: 0 },
  20: { file: 'tall-grass.png',  dir: 'tiles',   scale: 0.5,  ox: 0,   oy: 0 },
  21: { file: 'sign.png',        dir: 'objects', scale: 0.5,  ox: -4,  oy: -16 },
  22: { file: 'lamp.png',        dir: 'objects', scale: 0.5,  ox: -4,  oy: -16 },
  23: { file: 'bench.png',       dir: 'objects', scale: 0.5,  ox: -4,  oy: 0 },
  24: { file: 'barrel.png',      dir: 'objects', scale: 0.5,  ox: 0,   oy: 0 },
  25: { file: 'well.png',        dir: 'objects', scale: 0.5,  ox: -4,  oy: -16 },
  26: { file: 'mushroom.png',    dir: 'objects', scale: 0.5,  ox: 0,   oy: 0 },
};
```

- [ ] **Step 3: Remove bridge ID 6 from TERRAIN_PRIO**

Change:
```javascript
const TERRAIN_PRIO = { 4: 0, 5: 1, 0: 2, 2: 3, 3: 4, 6: 5 };
```
To:
```javascript
const TERRAIN_PRIO = { 4: 0, 5: 1, 0: 2, 2: 3, 3: 4 };
```

- [ ] **Step 4: Remove bridge case from render() and remove BridgeAtlas usage**

In the `TileMap` constructor, remove `this.bridge = new BridgeAtlas(this.tileSize);`.

In `render()`, replace the ground rendering loop:
```javascript
    // Ground layer — Wang tilesets only (no procedural fallback)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tex = getWangTexture(
          this.wang,
          verts[y][x],
          verts[y][x+1],
          verts[y+1][x],
          verts[y+1][x+1]
        );
        if (!tex) continue;

        const sprite = new PIXI.Sprite(tex);
        sprite.x = x * ts;
        sprite.y = y * ts;
        this.container.addChild(sprite);
      }
    }
```

- [ ] **Step 5: Commit**

```bash
git add public/js/game/map.js
git commit -m "refactor: remove all procedural canvas code, update object registry to new ID scheme"
```

---

### Task 6: Ground Layer Baking + Object Culling

**Files:**
- Modify: `public/js/game/map.js`

- [ ] **Step 1: Add app reference to TileMap**

The TileMap needs access to the PIXI renderer for baking. Update the constructor and `loadAssets`:

```javascript
export class TileMap {
  constructor(mapData) {
    this.data = mapData;
    this.tileSize = mapData.tileSize;
    this.container = new PIXI.Container();
    this.wang = new WangTileManager(this.tileSize);
    this.objectTextures = {};
    this.app = null; // set before loadAssets
  }
```

- [ ] **Step 2: Implement ground baking in render()**

Replace the ground rendering section in `render()`:

```javascript
  render() {
    const { ground, objects } = this.data.layers;
    const ts = this.tileSize;
    const h = ground.length, w = ground[0].length;
    const verts = buildVertexGrid(ground);

    // Ground layer — render to temporary container, then bake to texture
    const groundContainer = new PIXI.Container();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tex = getWangTexture(
          this.wang, verts[y][x], verts[y][x+1], verts[y+1][x], verts[y+1][x+1]
        );
        if (!tex) continue;
        const sprite = new PIXI.Sprite(tex);
        sprite.x = x * ts;
        sprite.y = y * ts;
        groundContainer.addChild(sprite);
      }
    }

    // Bake ground to single texture if renderer available
    if (this.app) {
      const renderTex = PIXI.RenderTexture.create({ width: w * ts, height: h * ts });
      this.app.renderer.render({ container: groundContainer, target: renderTex });
      const bakedGround = new PIXI.Sprite(renderTex);
      this.container.addChild(bakedGround);
      groundContainer.destroy({ children: true });
    } else {
      // Fallback: add sprites directly (for environments without renderer)
      this.container.addChild(groundContainer);
    }

    // Object layer — individual sprites with culling
    const objContainer = new PIXI.Container();
    objContainer.cullable = true;
    for (let y = 0; y < objects.length; y++) {
      for (let x = 0; x < objects[y].length; x++) {
        const objId = objects[y][x];
        if (objId === 0) continue;
        const cfg = PIXELLAB_OBJECTS[objId];
        const tex = this.objectTextures[String(objId)];
        if (!cfg || !tex) continue;
        const sprite = new PIXI.Sprite(tex);
        sprite.scale.set(cfg.scale);
        sprite.x = x * ts + cfg.ox;
        sprite.y = y * ts + cfg.oy;
        objContainer.addChild(sprite);
      }
    }
    this.container.addChild(objContainer);
  }
```

- [ ] **Step 3: Commit**

```bash
git add public/js/game/map.js
git commit -m "perf: bake ground layer to RenderTexture, enable object culling"
```

---

### Task 7: Wire Engine + test-game.html to WorldGenerator

**Files:**
- Modify: `public/js/game/engine.js`
- Modify: `public/test-game.html`

**Note:** The `classroomSeed` field does not yet exist in the database schema or profile API. For now, use a hardcoded default seed (42). Adding per-classroom seeds to the schema/dashboard is follow-up work.

- [ ] **Step 1: Replace static map fetch with WorldGenerator in engine.js**

In `engine.js`, add import at top:
```javascript
import { generateWorld } from './world-gen.js';
```

Replace line 40:
```javascript
const mapData = await fetch('/assets/maps/village-main.json').then(r => r.json());
```

With:
```javascript
// TODO: read seed from classroom config once schema supports it
const seed = 42;
const mapData = generateWorld(seed, 120, 90);
```

- [ ] **Step 2: Pass app reference to TileMap**

After creating the TileMap, pass the app reference. Change:
```javascript
this.map = new TileMap(mapData);
await this.map.loadAssets();
```

To:
```javascript
this.map = new TileMap(mapData);
this.map.app = this.app;
await this.map.loadAssets();
```

- [ ] **Step 3: Update test-game.html to use WorldGenerator**

In `public/test-game.html`, find the script that fetches the static map JSON and replace it with an inline import of `generateWorld`. The exact location depends on the file's structure — look for `fetch('/assets/maps/village-main.json')` and replace with:

```javascript
import { generateWorld } from '/js/game/world-gen.js';
const mapData = generateWorld(42, 120, 90);
```

Ensure the `<script>` tag has `type="module"` so the import works.

- [ ] **Step 4: Commit**

```bash
git add public/js/game/engine.js public/test-game.html
git commit -m "feat: wire engine + test-game to WorldGenerator"
```

---

### Task 8: Delete Old Files

**Files:**
- Delete: `scripts/generate-village.js`
- Delete: `public/assets/maps/village-main.json`
- Delete: `public/assets/maps/dungeon-math.json`

- [ ] **Step 1: Delete old map files and generation script**

```bash
rm scripts/generate-village.js
rm public/assets/maps/village-main.json
rm public/assets/maps/dungeon-math.json
rmdir public/assets/maps  # remove empty directory
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove static map files and old generation script"
```

---

### Task 9: Update Tile Viewer

**Files:**
- Modify: `public/tile-viewer.html`

- [ ] **Step 1: Update object list in tile-viewer.html**

Replace the `objects` array in the script section with all 26 object files:

```javascript
const objects = [
  'oak-tree.png', 'pine-tree.png', 'bush.png', 'rock.png', 'fence.png',
  'shop-a.png', 'shop-b.png', 'shop-c.png',
  'farmhouse-a.png', 'farmhouse-b.png',
  'barn-a.png', 'barn-b.png',
  'cave-a.png', 'cave-b.png',
  'dock-a.png', 'dock-b.png',
  'bridge-h.png', 'bridge-v.png',
  'flowers.png', 'sign.png', 'lamp.png', 'bench.png',
  'barrel.png', 'well.png', 'mushroom.png',
];
```

Update the tiles array to remove bridge-plank (now an object):
```javascript
const tiles = [
  'crate.png', 'mushroom.png', 'pumpkin.png',
  'stepping-stone.png', 'tall-grass.png',
];
```

- [ ] **Step 2: Commit**

```bash
git add public/tile-viewer.html
git commit -m "chore: update tile viewer with new building sprites and object IDs"
```

---

### Task 10: Run Full Test Suite + Visual Verification

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All world-gen tests pass. Pre-existing auth test failures are unrelated.

- [ ] **Step 2: Start server and visual test**

```bash
node server/index.js &
```

Open `http://localhost:3000/test-game.html` in browser. Verify:
- Terrain looks organic with smooth Wang transitions
- Buildings appear as single sprites in appropriate zones
- Trees are large and detailed
- No black holes or missing tiles
- Player can walk around, collision works
- NPCs are present in town area

- [ ] **Step 3: Check tile viewer**

Open `http://localhost:3000/tile-viewer.html`. Verify all new building sprites display correctly.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: visual verification fixes"
```
