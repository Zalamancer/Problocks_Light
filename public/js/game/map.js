// Tile map renderer using PixelLab Wang tilesets + object sprites
// Ground tiles: 0=grass, 1=grass_light, 2=dirt, 3=cobblestone, 4=water, 5=sand
// Objects: see PIXELLAB_OBJECTS registry below

// --- Wang Tileset System ---

// Fixed Wang tile layout (4x4 grid, 16 tiles)
// Order: (Q1=NE, Q2=NW, Q3=SW, Q4=SE) — u=upper, l=lower
//  0(u,u,l,u)  1(l,u,u,l)  2(u,l,l,l)  3(u,u,l,l)
//  4(u,l,u,l)  5(l,u,l,l)  6(l,l,l,l)  7(l,l,l,u)
//  8(l,u,u,u)  9(l,l,u,u) 10(l,l,u,l) 11(u,l,l,u)
// 12(u,u,u,u) 13(u,u,u,l) 14(l,u,l,u) 15(u,l,u,u)
//
// Key: 6=pure lower, 12=pure upper
// Edges: 3=S, 9=N, 4=W, 14=E
// Inner corners: 2=NE, 5=NW, 7=SE, 10=SW
// Outer corners: 0=SW, 8=NE, 13=SE, 15=NW
// Diagonals: 1, 11

// Corner pattern for each grid index: (NE, NW, SW, SE) → 1=upper, 0=lower
const WANG_CORNERS = [
  [1,1,0,1], [0,1,1,0], [1,0,0,0], [1,1,0,0],
  [1,0,1,0], [0,1,0,0], [0,0,0,0], [0,0,0,1],
  [0,1,1,1], [0,0,1,1], [0,0,1,0], [1,0,0,1],
  [1,1,1,1], [1,1,1,0], [0,1,0,1], [1,0,1,1],
];

// Build reverse lookup: cornerKey → grid index
// cornerKey = NE*8 + NW*4 + SW*2 + SE
const WANG_LOOKUP = {};
WANG_CORNERS.forEach(([ne, nw, sw, se], idx) => {
  WANG_LOOKUP[ne * 8 + nw * 4 + sw * 2 + se] = idx;
});

// Tileset configs: each defines a transition between two terrain types
const TERRAIN_TILESETS = [
  { name: 'water-sand',         lower: 4, upper: 5 },
  { name: 'sand-grass',         lower: 5, upper: 0 },
  { name: 'grass-dirt',         lower: 0, upper: 2 },
  { name: 'grass-cobblestone',  lower: 0, upper: 3 },
];

// Normalize terrain: grass_light (1) → grass (0)
function normTerrain(t) { return t === 1 ? 0 : t; }

// For pure terrain tiles (all 4 corners same), which tileset provides the base tile
// Index 6 = pure lower, index 12 = pure upper
const PURE_TILE_SOURCE = {
  4: { tileset: 'water-sand',        idx: 6 },   // pure water = all-lower
  5: { tileset: 'water-sand',        idx: 12 },  // pure sand = all-upper
  0: { tileset: 'sand-grass',        idx: 12 },  // pure grass = all-upper
  2: { tileset: 'grass-dirt',        idx: 12 },  // pure dirt = all-upper
  3: { tileset: 'grass-cobblestone', idx: 12 },  // pure stone = all-upper
};

// Terrain priority for vertex resolution (higher = wins at shared vertex)
const TERRAIN_PRIO = { 4: 0, 5: 1, 0: 2, 2: 3, 3: 4 };

class WangTileManager {
  constructor(tileSize) {
    this.tileSize = tileSize;
    this.tilesets = {};     // name → { tiles: {idx: PIXI.Texture}, lower, upper }
  }

  async load(name, lower, upper) {
    const s = this.tileSize;

    // Load spritesheet as plain Image, then extract 16 tiles via canvas
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = `/assets/tilesets/${name}.png`;
    });

    const tiles = {};
    for (let i = 0; i < 16; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const canvas = document.createElement('canvas');
      canvas.width = s;
      canvas.height = s;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, col * s, row * s, s, s, 0, 0, s, s);
      tiles[i] = PIXI.Texture.from(canvas);
    }

    this.tilesets[name] = { tiles, lower, upper };
  }

  async loadAll() {
    await Promise.all(
      TERRAIN_TILESETS.map(ts => this.load(ts.name, ts.lower, ts.upper))
    );
  }

  // Get texture for a tile by tileset name and grid index (0-15)
  getTex(tilesetName, idx) {
    const ts = this.tilesets[tilesetName];
    if (!ts) return null;
    return ts.tiles[idx] || null;
  }

  // Find which tileset handles a pair of terrain types
  findTileset(a, b) {
    const na = normTerrain(a), nb = normTerrain(b);
    if (na === nb) return null;
    for (const cfg of TERRAIN_TILESETS) {
      if ((na === cfg.lower && nb === cfg.upper) || (na === cfg.upper && nb === cfg.lower)) {
        return cfg.name;
      }
    }
    return null;
  }
}

// --- Vertex terrain helpers ---

function getVertexTerrain(ground, vx, vy, w, h) {
  const cells = [];
  if (vy > 0 && vx > 0)   cells.push(normTerrain(ground[vy - 1][vx - 1]));
  if (vy > 0 && vx < w)   cells.push(normTerrain(ground[vy - 1][vx]));
  if (vy < h && vx > 0)   cells.push(normTerrain(ground[vy][vx - 1]));
  if (vy < h && vx < w)   cells.push(normTerrain(ground[vy][vx]));
  if (cells.length === 0) return 0;
  // Highest-priority terrain wins at vertex
  return cells.reduce((a, b) => (TERRAIN_PRIO[b] ?? 0) > (TERRAIN_PRIO[a] ?? 0) ? b : a);
}

function buildVertexGrid(ground) {
  const h = ground.length, w = ground[0].length;
  const verts = [];
  for (let vy = 0; vy <= h; vy++) {
    verts[vy] = [];
    for (let vx = 0; vx <= w; vx++) {
      verts[vy][vx] = getVertexTerrain(ground, vx, vy, w, h);
    }
  }
  return verts;
}

function getWangTexture(wang, nw, ne, sw, se) {
  const corners = [nw, ne, sw, se];
  const unique = [...new Set(corners)];

  if (unique.length === 1) {
    // Pure terrain — all corners same
    const src = PURE_TILE_SOURCE[unique[0]];
    return src ? wang.getTex(src.tileset, src.idx) : null;
  }

  if (unique.length === 2) {
    // Two-terrain transition
    const [a, b] = unique;
    const tsName = wang.findTileset(a, b);
    if (!tsName) return null;
    const ts = wang.tilesets[tsName];
    const lo = ts.lower;
    // Compute corner key: (NE, NW, SW, SE) → 1=upper, 0=lower
    const cornerKey =
      (ne !== lo ? 8 : 0) |
      (nw !== lo ? 4 : 0) |
      (sw !== lo ? 2 : 0) |
      (se !== lo ? 1 : 0);
    const idx = WANG_LOOKUP[cornerKey];
    if (idx === undefined) return null;
    return wang.getTex(tsName, idx);
  }

  // 3+ terrains at corners — fall back to pure tile of most common corner terrain
  const counts = {};
  corners.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const src = PURE_TILE_SOURCE[Number(dominant)];
  return src ? wang.getTex(src.tileset, src.idx) : null;
}

// PixelLab object assets: objId -> { file, dir, scale, ox, oy }
// Scale targets: trees ~3x4 tiles, buildings ~6x6, small objects ~1.5x1.5 tiles
const PIXELLAB_OBJECTS = {
  1:  { file: 'oak-tree.png',    dir: 'objects', scale: 0.5,  ox: -16, oy: -48 },  // 96x128 → 48x64 = 3x4 tiles
  2:  { file: 'pine-tree.png',   dir: 'objects', scale: 0.5,  ox: -12, oy: -48 },  // 80x128 → 40x64 = 2.5x4 tiles
  3:  { file: 'bush.png',        dir: 'objects', scale: 0.75, ox: -4,  oy: -4 },   // 32x32 → 24x24 = 1.5x1.5 tiles
  4:  { file: 'rock.png',        dir: 'objects', scale: 0.75, ox: -4,  oy: -4 },   // 32x32 → 24x24
  5:  { file: 'fence.png',       dir: 'objects', scale: 0.75, ox: -4,  oy: -4 },   // 32x32 → 24x24
  6:  { file: 'shop-a.png',      dir: 'objects', scale: 0.75, ox: -32, oy: -64 },  // 128x128 → 96x96 = 6x6 tiles
  7:  { file: 'shop-b.png',      dir: 'objects', scale: 0.75, ox: -32, oy: -64 },
  8:  { file: 'shop-c.png',      dir: 'objects', scale: 0.75, ox: -32, oy: -64 },
  9:  { file: 'farmhouse-a.png', dir: 'objects', scale: 0.75, ox: -32, oy: -64 },
  10: { file: 'farmhouse-b.png', dir: 'objects', scale: 0.75, ox: -32, oy: -64 },
  11: { file: 'barn-a.png',      dir: 'objects', scale: 0.75, ox: -44, oy: -64 },  // 160x128 → 120x96 = 7.5x6 tiles
  12: { file: 'barn-b.png',      dir: 'objects', scale: 0.75, ox: -44, oy: -64 },
  13: { file: 'cave-a.png',      dir: 'objects', scale: 0.75, ox: -32, oy: -48 },  // 128x96 → 96x72 = 6x4.5 tiles
  14: { file: 'cave-b.png',      dir: 'objects', scale: 0.75, ox: -32, oy: -48 },
  15: { file: 'dock-a.png',      dir: 'objects', scale: 0.75, ox: -32, oy: -16 },  // 128x64 → 96x48 = 6x3 tiles
  16: { file: 'dock-b.png',      dir: 'objects', scale: 0.75, ox: -32, oy: -16 },
  17: { file: 'bridge-h.png',    dir: 'objects', scale: 1.0,  ox: -8,  oy: -4 },   // 64x32 → 64x32 = 4x2 tiles
  18: { file: 'bridge-v.png',    dir: 'objects', scale: 1.0,  ox: -4,  oy: -16 },  // 32x64 → 32x64 = 2x4 tiles
  19: { file: 'flowers.png',     dir: 'objects', scale: 0.75, ox: -4,  oy: -4 },   // 32x32 → 24x24
  20: { file: 'tall-grass.png',  dir: 'tiles',   scale: 0.75, ox: -4,  oy: -4 },   // 32x32 → 24x24
  21: { file: 'sign.png',        dir: 'objects', scale: 0.75, ox: -4,  oy: -20 },  // 32x48 → 24x36 = 1.5x2.25 tiles
  22: { file: 'lamp.png',        dir: 'objects', scale: 0.75, ox: -4,  oy: -20 },  // 32x48 → 24x36
  23: { file: 'bench.png',       dir: 'objects', scale: 0.75, ox: -8,  oy: -4 },   // 48x32 → 36x24 = 2.25x1.5 tiles
  24: { file: 'barrel.png',      dir: 'objects', scale: 0.75, ox: -4,  oy: -4 },   // 32x32 → 24x24
  25: { file: 'well.png',        dir: 'objects', scale: 0.75, ox: -4,  oy: -20 },  // 32x48 → 24x36
  26: { file: 'mushroom.png',    dir: 'objects', scale: 0.75, ox: -4,  oy: -4 },   // 32x32 → 24x24
};


export class TileMap {
  constructor(mapData) {
    this.data = mapData;
    this.tileSize = mapData.tileSize;
    this.container = new PIXI.Container();
    this.wang = new WangTileManager(this.tileSize);
    this.objectTextures = {};
    this.app = null; // set before loadAssets for ground baking
  }

  async loadAssets() {
    const loads = [];

    // Load Wang tilesets
    loads.push(this.wang.loadAll());

    // Load PixelLab object assets
    for (const [id, cfg] of Object.entries(PIXELLAB_OBJECTS)) {
      loads.push(
        PIXI.Assets.load(`/assets/${cfg.dir}/${cfg.file}`)
          .then(tex => { this.objectTextures[id] = tex; })
          .catch(() => {})
      );
    }

    await Promise.all(loads);
    this.render();
  }

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

  isWalkable(tileX, tileY) {
    const { collision } = this.data.layers;
    if (tileY < 0 || tileY >= collision.length) return false;
    if (tileX < 0 || tileX >= collision[0].length) return false;
    return collision[tileY][tileX] === 0;
  }
}
