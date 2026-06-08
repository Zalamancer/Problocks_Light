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
    const raw = 70 * (n0 + n1 + n2);
    return Math.max(-1, Math.min(1, raw)); // Clamp to [-1, 1]
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
      if (val < 0.20) terrain = TERRAIN.WATER;
      else if (val < 0.45) terrain = TERRAIN.SAND;
      else if (val < 0.93) terrain = TERRAIN.GRASS;
      else terrain = TERRAIN.DIRT;

      // Grass light variation (~15%)
      if (terrain === TERRAIN.GRASS && rng.next() < 0.15) {
        terrain = TERRAIN.GRASS_LIGHT;
      }

      row.push(terrain);
    }
    ground.push(row);
  }

  // Post-process: enforce minimum 2-tile bands between non-adjacent terrain types
  // Valid adjacencies: water↔sand, sand↔grass, grass↔dirt
  // If water is within 2 tiles of grass, expand sand to fill the gap
  // If sand is within 2 tiles of dirt, expand grass to fill the gap
  enforceTerrainBands(ground, w, h);

  return ground;
}

// Enforce that terrain transitions always have at least 2 tiles of intermediate terrain.
// Run multiple passes until stable.
function enforceTerrainBands(ground, w, h) {
  const norm = t => (t === TERRAIN.GRASS_LIGHT ? TERRAIN.GRASS : t);

  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = norm(ground[y][x]);
        // Check all neighbors within 1 tile (cardinal + diagonal)
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const n = norm(ground[ny][nx]);
            if (t === n) continue;

            // Water next to grass/dirt → convert current tile to sand
            if (t === TERRAIN.WATER && (n === TERRAIN.GRASS || n === TERRAIN.DIRT)) {
              ground[ny][nx] = TERRAIN.SAND;
              changed = true;
            }
            // Grass/dirt next to water → convert current tile to sand
            if ((t === TERRAIN.GRASS || t === TERRAIN.DIRT) && n === TERRAIN.WATER) {
              ground[y][x] = TERRAIN.SAND;
              changed = true;
            }
            // Sand next to dirt → convert the sand to grass (dirt needs grass buffer)
            if (t === TERRAIN.SAND && n === TERRAIN.DIRT) {
              ground[y][x] = TERRAIN.GRASS;
              changed = true;
            }
            if (t === TERRAIN.DIRT && n === TERRAIN.SAND) {
              ground[ny][nx] = TERRAIN.GRASS;
              changed = true;
            }
          }
        }
      }
    }
    if (!changed) break;
  }
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

// --- Zone Detection ---

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

// --- Object Registry ---
// Footprint in tiles (fw x fh) for collision stamping
export const OBJ_FOOTPRINT = {
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
export const WALKABLE_OBJECTS = new Set([19, 20, 26]); // flowers, tall grass, mushroom

// Zone -> object placement rules
export const ZONE_OBJECTS = {
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

export function canPlace(objects, collision, x, y, fw, fh, w, h, spacing) {
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

export function stampObject(objects, collision, x, y, objId, fw, fh) {
  objects[y][x] = objId; // anchor only
  if (!WALKABLE_OBJECTS.has(objId)) {
    for (let dy = 0; dy < fh; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        collision[y + dy][x + dx] = 1;
      }
    }
  }
}

export function placeObjects(seed, ground, zones, w, h) {
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

export function placeBridges(seed, ground, objects, collision, w, h) {
  const rng = new SeededRNG(seed + 250);
  // Scan for 1-2 tile water gaps between dirt/cobblestone paths
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 2; x++) {
      const left = ground[y][x];
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

export function placeNPCs(seed, zones, objects, collision, w, h) {
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

export function findPlayerStart(ground, zones, collision, w, h) {
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
