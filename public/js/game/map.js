// Stardew Valley-style tile map renderer using the sampled color palette
// Ground tiles: 0=grass, 1=grass_light, 2=dirt, 3=stone, 4=water, 5=sand, 6=bridge
// Object tiles: 0=none, 1=tree, 2=pink_tree, 3=bush, 4=rock, 5=fence,
//               6=wall, 7=door, 8=window, 9=roof, 10=flowers, 11=tall_grass, 12=sign

const P = {
  grass:     { hi: [245,219,154], mid: [112,199,37],  deep: [50,133,48] },
  dirt:      { hi: [247,179,39],  mid: [235,171,34],  shadow: [225,157,29] },
  stone:     { hi: [195,171,120], mid: [162,138,98],  shadow: [100,74,67] },
  water:     { deep: [35,96,135], mid: [59,150,193],  surface: [70,157,200], foam: [143,167,183] },
  sand:      { base: [245,219,154], dark: [235,171,34], hi: [255,255,203] },
  bush:      { dark: [4,43,55],   mid: [13,154,80],   bright: [17,215,86], hi: [150,255,130] },
  tree:      { dark: [12,48,42],  mid: [17,69,52],    bright: [54,198,66], hi: [122,255,102] },
  trunk:     { dark: [57,43,35],  mid: [108,66,2],    hi: [193,132,0] },
  pinkTree:  { dark: [114,50,140],mid: [246,134,229], hi: [255,191,250], white: [255,255,255] },
  pinkTrunk: { dark: [100,53,55], mid: [215,122,26],  hi: [255,180,68] },
  rock:      { dark: [71,61,64],  mid: [116,97,97],   hi: [184,162,132] },
  wall:      { base: [241,190,148], hi: [255,255,203] },
  baseWall:  { dark: [44,32,26],  mid: [132,115,84],  hi: [169,154,108] },
  pillar:    { dark: [88,42,45],  mid: [146,65,43],   hi: [197,99,46] },
  door:      { dark: [88,42,45],  mid: [176,75,52],   hi: [221,111,64] },
  roof:      { dark: [71,3,3],    mid: [120,41,41],   hi: [221,111,64] },
};

function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }

function seedHash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  return c;
}

class TileAtlas {
  constructor(ts) {
    this.ts = ts;
    this.groundCache = new Map();
    this.objectCache = new Map();
  }

  getGroundTexture(tileId, x, y) {
    const variant = Math.floor(seedHash(x, y, tileId) * 4);
    const key = `${tileId}_${variant}`;
    if (!this.groundCache.has(key)) {
      const canvas = makeCanvas(this.ts);
      const ctx = canvas.getContext('2d');
      this.drawGround(ctx, tileId, variant);
      this.groundCache.set(key, PIXI.Texture.from(canvas));
    }
    return this.groundCache.get(key);
  }

  getObjectTexture(objId, x, y) {
    const variant = Math.floor(seedHash(x, y, objId + 100) * 3);
    const key = `obj_${objId}_${variant}`;
    if (!this.objectCache.has(key)) {
      const canvas = makeCanvas(this.ts);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, this.ts, this.ts);
      this.drawObject(ctx, objId, variant);
      this.objectCache.set(key, PIXI.Texture.from(canvas));
    }
    return this.objectCache.get(key);
  }

  px(ctx, x, y, color) {
    ctx.fillStyle = rgb(color);
    ctx.fillRect(x, y, 1, 1);
  }

  drawGround(ctx, id, v) {
    const ts = this.ts;
    switch (id) {
      case 0: this.drawGrass(ctx, v, P.grass.mid, P.grass.deep, P.grass.hi); break;
      case 1: this.drawGrass(ctx, v, [140,215,60], P.grass.mid, P.grass.hi); break;
      case 2: this.drawDirt(ctx, v); break;
      case 3: this.drawStone(ctx, v); break;
      case 4: this.drawWater(ctx, v); break;
      case 5: this.drawSand(ctx, v); break;
      case 6: this.drawBridge(ctx, v); break;
      default: this.drawGrass(ctx, v, P.grass.mid, P.grass.deep, P.grass.hi);
    }
  }

  drawGrass(ctx, v, base, dark, hi) {
    const ts = this.ts;
    ctx.fillStyle = rgb(base);
    ctx.fillRect(0, 0, ts, ts);

    // Darker grass blade pixels
    const bladePositions = [
      [[2,3],[7,1],[13,5],[4,10],[10,8],[1,14],[8,13],[15,3]],
      [[1,2],[5,6],[11,1],[3,12],[9,9],[14,14],[6,4],[12,10]],
      [[3,1],[8,4],[14,7],[1,9],[7,12],[11,2],[5,15],[0,6]],
      [[4,5],[9,2],[0,11],[13,8],[6,14],[2,7],[10,0],[15,13]],
    ];
    const blades = bladePositions[v % 4];
    for (const [bx, by] of blades) {
      this.px(ctx, bx % ts, by % ts, dark);
      if (by + 1 < ts) this.px(ctx, bx % ts, (by+1) % ts, dark);
    }

    // Yellow highlight tips
    const tips = [
      [[2,2],[7,0],[13,4],[10,7]],
      [[1,1],[5,5],[11,0],[3,11]],
      [[3,0],[8,3],[0,10],[14,6]],
      [[4,4],[9,1],[6,13],[0,5]],
    ];
    for (const [tx, ty] of tips[v % 4]) {
      this.px(ctx, tx % ts, ty % ts, hi);
    }
  }

  drawDirt(ctx, v) {
    const ts = this.ts;
    ctx.fillStyle = rgb(P.dirt.mid);
    ctx.fillRect(0, 0, ts, ts);

    // Shadow patches
    const shadows = [[1,2,3,3],[8,1,4,2],[0,10,3,4],[10,8,5,3],[5,13,4,2]];
    ctx.fillStyle = rgb(P.dirt.shadow);
    for (const [sx,sy,sw,sh] of shadows) {
      if ((sx + v) % 3 !== 0)
        ctx.fillRect(sx % ts, sy % ts, Math.min(sw, ts-sx), Math.min(sh, ts-sy));
    }

    // Highlight spots
    ctx.fillStyle = rgb(P.dirt.hi);
    const hilights = [[4,4],[12,7],[7,12],[2,9],[14,2]];
    for (const [hx, hy] of hilights) {
      if ((hx + v) % 2 === 0)
        ctx.fillRect(hx % ts, hy % ts, 2, 1);
    }

    // Pebble details
    ctx.fillStyle = rgb(P.stone.mid);
    if (v === 0) { this.px(ctx, 5, 6, P.stone.shadow); this.px(ctx, 11, 11, P.stone.shadow); }
    if (v === 1) { this.px(ctx, 3, 13, P.stone.shadow); this.px(ctx, 13, 4, P.stone.shadow); }
  }

  drawStone(ctx, v) {
    const ts = this.ts;
    // Base
    ctx.fillStyle = rgb(P.stone.mid);
    ctx.fillRect(0, 0, ts, ts);

    // Cobblestone pattern — draw stone blocks with dark gaps
    ctx.fillStyle = rgb(P.stone.shadow);
    // Horizontal gaps
    ctx.fillRect(0, 7, ts, 1);
    // Vertical gaps offset per row
    if (v % 2 === 0) {
      ctx.fillRect(5, 0, 1, 7);
      ctx.fillRect(11, 0, 1, 7);
      ctx.fillRect(2, 8, 1, 8);
      ctx.fillRect(8, 8, 1, 8);
      ctx.fillRect(14, 8, 1, 8);
    } else {
      ctx.fillRect(3, 0, 1, 7);
      ctx.fillRect(9, 0, 1, 7);
      ctx.fillRect(0, 8, 1, 8);
      ctx.fillRect(6, 8, 1, 8);
      ctx.fillRect(12, 8, 1, 8);
    }

    // Highlight on stone tops
    ctx.fillStyle = rgb(P.stone.hi);
    ctx.fillRect(1, 1, 3, 1);
    ctx.fillRect(7, 1, 3, 1);
    ctx.fillRect(3, 9, 3, 1);
    ctx.fillRect(10, 9, 3, 1);
  }

  drawWater(ctx, v) {
    const ts = this.ts;
    ctx.fillStyle = rgb(P.water.mid);
    ctx.fillRect(0, 0, ts, ts);

    // Deep area
    ctx.fillStyle = rgb(P.water.deep);
    ctx.fillRect(0, 10, ts, 6);

    // Wave lines
    ctx.fillStyle = rgb(P.water.surface);
    const waveY = 4 + (v % 3);
    ctx.fillRect(2, waveY, 5, 1);
    ctx.fillRect(9, waveY + 2, 4, 1);

    // Foam sparkle
    ctx.fillStyle = rgb(P.water.foam);
    this.px(ctx, 3 + v, 3, P.water.foam);
    this.px(ctx, 11 - v, 7, P.water.foam);
  }

  drawSand(ctx, v) {
    const ts = this.ts;
    ctx.fillStyle = rgb(P.sand.base);
    ctx.fillRect(0, 0, ts, ts);

    ctx.fillStyle = rgb(P.sand.dark);
    const grains = [[3,5],[8,2],[12,9],[1,12],[14,6]];
    for (const [gx, gy] of grains) {
      if ((gx + v) % 3 !== 0) this.px(ctx, gx, gy, P.sand.dark);
    }
    ctx.fillStyle = rgb(P.sand.hi);
    this.px(ctx, 6, 3, P.sand.hi);
    this.px(ctx, 10, 11, P.sand.hi);
  }

  drawBridge(ctx, v) {
    const ts = this.ts;
    // Wood planks
    ctx.fillStyle = rgb(P.trunk.mid);
    ctx.fillRect(0, 0, ts, ts);

    // Plank gaps
    ctx.fillStyle = rgb(P.trunk.dark);
    ctx.fillRect(0, 3, ts, 1);
    ctx.fillRect(0, 7, ts, 1);
    ctx.fillRect(0, 11, ts, 1);
    ctx.fillRect(0, 15, ts, 1);

    // Wood grain highlight
    ctx.fillStyle = rgb(P.trunk.hi);
    ctx.fillRect(2, 1, 4, 1);
    ctx.fillRect(8, 5, 5, 1);
    ctx.fillRect(3, 9, 3, 1);
    ctx.fillRect(10, 13, 4, 1);

    // Railing posts on edges
    ctx.fillStyle = rgb(P.trunk.dark);
    ctx.fillRect(0, 0, 2, ts);
    ctx.fillRect(ts-2, 0, 2, ts);
    ctx.fillStyle = rgb(P.pillar.hi);
    ctx.fillRect(0, 0, 1, ts);
    ctx.fillRect(ts-1, 0, 1, ts);
  }

  // --- Object drawing ---
  drawObject(ctx, id, v) {
    switch (id) {
      case 1: this.drawTree(ctx, v); break;
      case 2: this.drawPinkTree(ctx, v); break;
      case 3: this.drawBush(ctx, v); break;
      case 4: this.drawRock(ctx, v); break;
      case 5: this.drawFence(ctx, v); break;
      case 6: this.drawWall(ctx, v); break;
      case 7: this.drawDoor(ctx, v); break;
      case 8: this.drawWindow(ctx, v); break;
      case 9: this.drawRoof(ctx, v); break;
      case 10: this.drawFlowers(ctx, v); break;
      case 11: this.drawTallGrass(ctx, v); break;
      case 12: this.drawSign(ctx, v); break;
    }
  }

  drawTree(ctx, v) {
    const ts = this.ts;
    // Canopy — rounded blob
    const c = P.tree;
    // Dark base of canopy
    ctx.fillStyle = rgb(c.dark);
    ctx.fillRect(3, 2, 10, 2);
    ctx.fillRect(2, 4, 12, 4);
    ctx.fillRect(3, 8, 10, 2);

    // Mid green overlay
    ctx.fillStyle = rgb(c.mid);
    ctx.fillRect(4, 2, 8, 2);
    ctx.fillRect(3, 4, 10, 3);
    ctx.fillRect(4, 7, 8, 2);

    // Bright center
    ctx.fillStyle = rgb(c.bright);
    ctx.fillRect(5, 3, 6, 2);
    ctx.fillRect(4, 5, 7, 2);

    // Highlight spot
    ctx.fillStyle = rgb(c.hi);
    this.px(ctx, 6, 3, c.hi);
    this.px(ctx, 7, 4, c.hi);
    this.px(ctx, 5, 5, c.hi);

    // Trunk
    ctx.fillStyle = rgb(P.trunk.mid);
    ctx.fillRect(7, 10, 3, 4);
    ctx.fillStyle = rgb(P.trunk.dark);
    ctx.fillRect(7, 10, 1, 4);
    ctx.fillStyle = rgb(P.trunk.hi);
    ctx.fillRect(9, 10, 1, 3);

    // Shadow at base
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(5, 14, 7, 2);
  }

  drawPinkTree(ctx, v) {
    const ts = this.ts;
    const c = P.pinkTree;
    // Canopy
    ctx.fillStyle = rgb(c.dark);
    ctx.fillRect(3, 1, 10, 2);
    ctx.fillRect(2, 3, 12, 4);
    ctx.fillRect(3, 7, 10, 3);

    ctx.fillStyle = rgb(c.mid);
    ctx.fillRect(4, 2, 8, 2);
    ctx.fillRect(3, 4, 10, 3);
    ctx.fillRect(4, 7, 8, 2);

    ctx.fillStyle = rgb(c.hi);
    ctx.fillRect(5, 3, 6, 2);
    ctx.fillRect(4, 5, 7, 2);

    // White sparkle
    this.px(ctx, 6, 3, c.white);
    this.px(ctx, 8, 5, c.white);
    this.px(ctx, 5, 6, c.white);

    // Trunk
    ctx.fillStyle = rgb(P.pinkTrunk.mid);
    ctx.fillRect(7, 10, 3, 4);
    ctx.fillStyle = rgb(P.pinkTrunk.dark);
    ctx.fillRect(7, 10, 1, 4);
    ctx.fillStyle = rgb(P.pinkTrunk.hi);
    ctx.fillRect(9, 10, 1, 3);

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(5, 14, 7, 2);
  }

  drawBush(ctx, v) {
    const c = P.bush;
    // Bush shape (lower half of tile)
    ctx.fillStyle = rgb(c.dark);
    ctx.fillRect(2, 6, 12, 2);
    ctx.fillRect(1, 8, 14, 4);
    ctx.fillRect(2, 12, 12, 2);

    ctx.fillStyle = rgb(c.mid);
    ctx.fillRect(3, 6, 10, 2);
    ctx.fillRect(2, 8, 12, 3);
    ctx.fillRect(3, 11, 10, 2);

    ctx.fillStyle = rgb(c.bright);
    ctx.fillRect(4, 7, 8, 2);
    ctx.fillRect(3, 9, 9, 2);

    ctx.fillStyle = rgb(c.hi);
    this.px(ctx, 5, 7, c.hi);
    this.px(ctx, 8, 8, c.hi);

    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(3, 14, 10, 2);
  }

  drawRock(ctx, v) {
    const c = P.rock;
    ctx.fillStyle = rgb(c.dark);
    ctx.fillRect(3, 7, 10, 2);
    ctx.fillRect(2, 9, 12, 4);
    ctx.fillRect(4, 13, 8, 2);

    ctx.fillStyle = rgb(c.mid);
    ctx.fillRect(4, 7, 8, 2);
    ctx.fillRect(3, 9, 10, 3);
    ctx.fillRect(5, 12, 6, 2);

    ctx.fillStyle = rgb(c.hi);
    ctx.fillRect(5, 7, 5, 1);
    ctx.fillRect(4, 9, 4, 1);

    // Crack detail
    ctx.fillStyle = rgb(c.dark);
    this.px(ctx, 7, 10, c.dark);
    this.px(ctx, 8, 11, c.dark);
  }

  drawFence(ctx, v) {
    const c = P.pillar;
    // Vertical post
    ctx.fillStyle = rgb(c.mid);
    ctx.fillRect(6, 2, 4, 12);
    // Top cap
    ctx.fillStyle = rgb(c.hi);
    ctx.fillRect(5, 1, 6, 2);
    // Shadow side
    ctx.fillStyle = rgb(c.dark);
    ctx.fillRect(6, 3, 1, 11);
    // Highlight side
    ctx.fillStyle = rgb(c.hi);
    ctx.fillRect(9, 3, 1, 10);
    // Horizontal rail
    ctx.fillStyle = rgb(c.mid);
    ctx.fillRect(0, 6, 16, 2);
    ctx.fillRect(0, 11, 16, 2);
    ctx.fillStyle = rgb(c.dark);
    ctx.fillRect(0, 6, 16, 1);
    ctx.fillRect(0, 11, 16, 1);
  }

  drawWall(ctx, v) {
    const c = P.wall;
    // Main wall
    ctx.fillStyle = rgb(c.base);
    ctx.fillRect(0, 0, 16, 16);
    // Top trim
    ctx.fillStyle = rgb(P.baseWall.hi);
    ctx.fillRect(0, 0, 16, 2);
    // Bottom base
    ctx.fillStyle = rgb(P.baseWall.mid);
    ctx.fillRect(0, 13, 16, 3);
    ctx.fillStyle = rgb(P.baseWall.dark);
    ctx.fillRect(0, 15, 16, 1);
    // Wall detail lines
    ctx.fillStyle = rgb(c.hi);
    ctx.fillRect(0, 7, 16, 1);
  }

  drawDoor(ctx, v) {
    const c = P.door;
    // Door frame
    ctx.fillStyle = rgb(c.dark);
    ctx.fillRect(2, 0, 12, 16);
    // Door panels
    ctx.fillStyle = rgb(c.mid);
    ctx.fillRect(3, 1, 10, 14);
    // Panel detail
    ctx.fillStyle = rgb(c.hi);
    ctx.fillRect(4, 2, 3, 5);
    ctx.fillRect(9, 2, 3, 5);
    ctx.fillRect(4, 9, 3, 5);
    ctx.fillRect(9, 9, 3, 5);
    // Knob
    ctx.fillStyle = rgb(P.dirt.hi);
    ctx.fillRect(10, 8, 2, 2);
    // Threshold
    ctx.fillStyle = rgb(P.baseWall.dark);
    ctx.fillRect(2, 15, 12, 1);
  }

  drawWindow(ctx, v) {
    // Wall background
    ctx.fillStyle = rgb(P.wall.base);
    ctx.fillRect(0, 0, 16, 16);
    // Top/bottom trim same as wall
    ctx.fillStyle = rgb(P.baseWall.hi);
    ctx.fillRect(0, 0, 16, 2);
    ctx.fillStyle = rgb(P.baseWall.mid);
    ctx.fillRect(0, 13, 16, 3);

    // Window frame
    ctx.fillStyle = rgb(P.pillar.dark);
    ctx.fillRect(3, 3, 10, 8);
    // Glass
    ctx.fillStyle = rgb([140, 200, 240]);
    ctx.fillRect(4, 4, 8, 6);
    // Cross frame
    ctx.fillStyle = rgb(P.pillar.mid);
    ctx.fillRect(7, 4, 2, 6);
    ctx.fillRect(4, 6, 8, 1);
    // Shine
    this.px(ctx, 5, 4, [200, 230, 255]);
  }

  drawRoof(ctx, v) {
    const c = P.roof;
    // Roof tiles
    ctx.fillStyle = rgb(c.mid);
    ctx.fillRect(0, 0, 16, 16);
    // Top edge highlight
    ctx.fillStyle = rgb(c.hi);
    ctx.fillRect(0, 0, 16, 3);
    // Shadow lines (tile rows)
    ctx.fillStyle = rgb(c.dark);
    ctx.fillRect(0, 6, 16, 1);
    ctx.fillRect(0, 10, 16, 1);
    ctx.fillRect(0, 14, 16, 1);
    // Tile pattern
    ctx.fillStyle = rgb(c.mid);
    if (v % 2 === 0) {
      ctx.fillRect(4, 3, 1, 3);
      ctx.fillRect(10, 3, 1, 3);
      ctx.fillRect(1, 7, 1, 3);
      ctx.fillRect(7, 7, 1, 3);
      ctx.fillRect(13, 7, 1, 3);
    }
  }

  drawFlowers(ctx, v) {
    // Flowers are transparent overlays — draw small flower sprites
    const colors = [
      [255, 100, 100], // red
      [255, 200, 50],  // yellow
      [200, 130, 255], // purple
      [255, 150, 200], // pink
    ];
    const positions = [
      [[3,4],[8,2],[12,6],[5,11],[10,13]],
      [[2,3],[7,7],[13,4],[4,12],[9,9]],
      [[5,2],[10,5],[3,9],[13,11],[8,14]],
    ];
    const pts = positions[v % 3];
    for (let i = 0; i < pts.length; i++) {
      const [fx, fy] = pts[i];
      const fc = colors[(i + v) % colors.length];
      // Petals
      this.px(ctx, fx, fy-1, fc);
      this.px(ctx, fx-1, fy, fc);
      this.px(ctx, fx+1, fy, fc);
      this.px(ctx, fx, fy+1, fc);
      // Center
      this.px(ctx, fx, fy, [255, 230, 80]);
    }
    // Stems
    ctx.fillStyle = rgb(P.grass.deep);
    for (const [fx, fy] of pts) {
      ctx.fillRect(fx, fy+2, 1, 2);
    }
  }

  drawTallGrass(ctx, v) {
    const c = P.grass;
    // Tall blades
    const bladeX = [2, 5, 8, 11, 14];
    for (let i = 0; i < bladeX.length; i++) {
      const bx = bladeX[i];
      const height = 8 + ((i + v) % 4) * 2;
      const startY = 16 - height;
      ctx.fillStyle = rgb((i + v) % 2 === 0 ? c.deep : c.mid);
      ctx.fillRect(bx, startY, 2, height);
      // Tip
      ctx.fillStyle = rgb(c.hi);
      this.px(ctx, bx, startY, c.hi);
      this.px(ctx, bx + 1, startY - 1, c.mid);
    }
  }

  drawSign(ctx, v) {
    // Post
    ctx.fillStyle = rgb(P.trunk.mid);
    ctx.fillRect(7, 6, 2, 10);
    ctx.fillStyle = rgb(P.trunk.dark);
    ctx.fillRect(7, 6, 1, 10);
    // Sign board
    ctx.fillStyle = rgb(P.pillar.hi);
    ctx.fillRect(2, 1, 12, 6);
    ctx.fillStyle = rgb(P.pillar.mid);
    ctx.fillRect(3, 2, 10, 4);
    // Text lines
    ctx.fillStyle = rgb(P.pillar.dark);
    ctx.fillRect(4, 3, 6, 1);
    ctx.fillRect(5, 5, 4, 1);
  }
}

// PixelLab object assets: objId → { file, scale, offsetX, offsetY }
const PIXELLAB_OBJECTS = {
  1:  { file: 'oak-tree.png',    scale: 0.5, ox: -4, oy: -16 },
  2:  { file: 'cherry-tree.png', scale: 0.5, ox: -4, oy: -16 },
  3:  { file: 'bush.png',        scale: 0.5, ox: 0,  oy: 0 },
  4:  { file: 'rock.png',        scale: 0.5, ox: 0,  oy: 0 },
  5:  { file: 'fence.png',       scale: 0.5, ox: 0,  oy: 0 },
  10: { file: 'flowers.png',     scale: 0.5, ox: 0,  oy: 0 },
  11: { file: 'tall-grass.png',  scale: 1.0, ox: 0,  oy: 0 },
  12: { file: 'sign.png',        scale: 0.5, ox: 0,  oy: -8 },
};


export class TileMap {
  constructor(mapData) {
    this.data = mapData;
    this.tileSize = mapData.tileSize;
    this.container = new PIXI.Container();
    this.atlas = new TileAtlas(this.tileSize);
    this.pixelLabTextures = {};
  }

  async loadAssets() {
    const loads = [];

    // Load PixelLab object assets
    for (const [id, cfg] of Object.entries(PIXELLAB_OBJECTS)) {
      loads.push(
        PIXI.Assets.load(`/assets/objects/${cfg.file}`)
          .then(tex => { this.pixelLabTextures[id] = tex; })
          .catch(() => {})
      );
    }
    loads.push(
      PIXI.Assets.load('/assets/tiles/tall-grass.png')
        .then(tex => { this.pixelLabTextures['11'] = tex; })
        .catch(() => {})
    );

    await Promise.all(loads);
    this.render();
  }


  render() {
    const { ground, objects } = this.data.layers;
    const ts = this.tileSize;

    // Ground layer (procedural — Stardew palette)
    for (let y = 0; y < ground.length; y++) {
      for (let x = 0; x < ground[y].length; x++) {
        const tex = this.atlas.getGroundTexture(ground[y][x], x, y);
        const sprite = new PIXI.Sprite(tex);
        sprite.x = x * ts;
        sprite.y = y * ts;
        this.container.addChild(sprite);
      }
    }

    // Object layer — PixelLab assets with procedural fallback
    for (let y = 0; y < objects.length; y++) {
      for (let x = 0; x < objects[y].length; x++) {
        const objId = objects[y][x];
        if (objId === 0) continue;

        const cfg = PIXELLAB_OBJECTS[objId];
        const plTex = this.pixelLabTextures[String(objId)];

        if (cfg && plTex) {
          const sprite = new PIXI.Sprite(plTex);
          sprite.scale.set(cfg.scale);
          sprite.x = x * ts + cfg.ox;
          sprite.y = y * ts + cfg.oy;
          this.container.addChild(sprite);
        } else {
          // Procedural fallback (building components: wall, door, window, roof)
          const tex = this.atlas.getObjectTexture(objId, x, y);
          const sprite = new PIXI.Sprite(tex);
          sprite.x = x * ts;
          sprite.y = y * ts;
          this.container.addChild(sprite);
        }
      }
    }
  }

  isWalkable(tileX, tileY) {
    const { collision } = this.data.layers;
    if (tileY < 0 || tileY >= collision.length) return false;
    if (tileX < 0 || tileX >= collision[0].length) return false;
    return collision[tileY][tileX] === 0;
  }
}
