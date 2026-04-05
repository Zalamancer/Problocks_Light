// Generates the village map JSON for Problocks Light
// Run: node scripts/generate-village.js > public/assets/maps/village-main.json

const W = 40, H = 30;

const ground = [];
const objects = [];
const collision = [];
for (let y = 0; y < H; y++) {
  ground.push(new Array(W).fill(0));
  objects.push(new Array(W).fill(0));
  collision.push(new Array(W).fill(0));
}

// --- Helpers ---
function fillGround(x, y, w, h, tile) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      if (y+dy >= 0 && y+dy < H && x+dx >= 0 && x+dx < W)
        ground[y+dy][x+dx] = tile;
}

function placeObj(x, y, obj, blocked = true) {
  if (y >= 0 && y < H && x >= 0 && x < W) {
    objects[y][x] = obj;
    if (blocked) collision[y][x] = 1;
  }
}

function fillObj(x, y, w, h, obj, blocked = true) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      placeObj(x+dx, y+dy, obj, blocked);
}

function hash(x, y) {
  return ((x * 7 + y * 13 + x * y * 3) % 17);
}

// --- Grass variation ---
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const v = hash(x, y);
    if (v < 3) ground[y][x] = 1; // light grass
  }
}

// ========================================
// FOREST BORDER (2 tiles thick)
// ========================================
for (let x = 0; x < W; x++) {
  placeObj(x, 0, 1); placeObj(x, 1, 1);
  placeObj(x, H-1, 1); placeObj(x, H-2, 1);
}
for (let y = 0; y < H; y++) {
  placeObj(0, y, 1); placeObj(1, y, 1);
  placeObj(W-1, y, 1); placeObj(W-2, y, 1);
}

// Forest edge — scattered trees in row 2 and row H-3
for (let x = 2; x < W-2; x++) {
  if (hash(x, 2) < 5) placeObj(x, 2, 1);
  if (hash(x, H-3) < 5) placeObj(x, H-3, 1);
}

// Entrance gaps
for (const gx of [19, 20]) {
  objects[1][gx] = 0; collision[1][gx] = 0;
  objects[H-2][gx] = 0; collision[H-2][gx] = 0;
}
for (const gy of [14, 15]) {
  objects[gy][1] = 0; collision[gy][1] = 0;
  objects[gy][W-2] = 0; collision[gy][W-2] = 0;
}

// ========================================
// SCHOOL (top center, x=14..25, y=4..7)
// ========================================
// Roof
fillObj(14, 4, 12, 1, 9);
// Walls
fillObj(14, 5, 12, 2, 6);
// Windows on wall row
for (const wx of [15, 17, 22, 24]) {
  placeObj(wx, 5, 8);
}
// Door (walkable)
placeObj(19, 6, 7, false); placeObj(20, 6, 7, false);
collision[6][19] = 0; collision[6][20] = 0;
// Stone path in front
fillGround(13, 7, 14, 1, 3);
// Vertical path from school down
fillGround(19, 7, 2, 8, 2);

// ========================================
// LIBRARY (left, x=4..9, y=11..14)
// ========================================
fillObj(4, 11, 6, 1, 9);   // roof
fillObj(4, 12, 6, 2, 6);   // walls
placeObj(5, 12, 8);         // window
placeObj(8, 12, 8);         // window
placeObj(6, 13, 7, false);  // door
placeObj(7, 13, 7, false);  // door
collision[13][6] = 0; collision[13][7] = 0;

// ========================================
// SHOP (right, x=30..35, y=11..14)
// ========================================
fillObj(30, 11, 6, 1, 9);  // roof
fillObj(30, 12, 6, 2, 6);  // walls
placeObj(31, 12, 8);        // window
placeObj(34, 12, 8);        // window
placeObj(32, 13, 7, false); // door
placeObj(33, 13, 7, false); // door
collision[13][32] = 0; collision[13][33] = 0;

// ========================================
// MAIN PATHS
// ========================================
// Horizontal main path (y=15..16)
fillGround(2, 15, W-4, 2, 2);

// Vertical path already from school (x=19-20, y=7-14)
// Continue vertical south (x=19-20, y=17-24)
fillGround(19, 17, 2, 8, 2);

// Library approach path
fillGround(8, 14, 11, 1, 2);

// Shop approach path
fillGround(21, 14, 11, 1, 2);

// ========================================
// TOWN SQUARE (stone center)
// ========================================
fillGround(16, 14, 8, 4, 3);

// ========================================
// POND (bottom right, x=28..35, y=22..25)
// ========================================
// Sand border
fillGround(27, 21, 10, 1, 5);
fillGround(27, 26, 10, 1, 5);
for (let y = 22; y <= 25; y++) {
  ground[y][27] = 5;
  ground[y][36] = 5;
}
// Water fill
for (let dy = 0; dy < 4; dy++) {
  for (let dx = 0; dx < 8; dx++) {
    const wx = 28 + dx, wy = 22 + dy;
    if (wy < H && wx < W) {
      ground[wy][wx] = 4;
      collision[wy][wx] = 1;
    }
  }
}
// Bridge across pond (x=31-32, y=22-25)
for (let by = 22; by <= 25; by++) {
  ground[by][31] = 6; collision[by][31] = 0; // bridge
  ground[by][32] = 6; collision[by][32] = 0;
}

// ========================================
// PINK TREE GROVE (bottom left)
// ========================================
const pinkTrees = [[4,19], [6,18], [8,20], [5,21], [7,19], [9,22], [3,22]];
for (const [px, py] of pinkTrees) placeObj(px, py, 2);

// ========================================
// DECORATIONS
// ========================================

// Rock cluster (top right area)
const rocks = [[33,5], [34,4], [35,6], [34,6]];
for (const [rx, ry] of rocks) placeObj(rx, ry, 4);

// Bushes scattered
const bushes = [
  [12,3], [27,4], [10,9], [14,22], [25,8], [3,9], [36,8],
  [12,24], [24,22], [15,4], [26,20], [13,20]
];
for (const [bx, by] of bushes) {
  if (objects[by][bx] === 0) placeObj(bx, by, 3);
}

// Flowers (walkable)
const flowers = [
  [8,7], [9,8], [10,7], [30,7], [31,8], [32,7],
  [12,18], [13,19], [14,18], [15,19], [23,20], [24,21],
  [16,9], [17,9], [22,9], [23,9]
];
for (const [fx, fy] of flowers) {
  if (objects[fy][fx] === 0) placeObj(fx, fy, 10, false);
}

// Tall grass patches (walkable)
const tallGrass = [
  [6,8], [7,9], [8,8], [32,20], [33,19], [34,20],
  [20,22], [21,23], [22,22]
];
for (const [gx, gy] of tallGrass) {
  if (objects[gy][gx] === 0) placeObj(gx, gy, 11, false);
}

// Scattered green trees for variety
const extraTrees = [
  [10,4], [29,3], [3,15], [36,18], [24,24], [15,25],
  [28,7], [11,11]
];
for (const [tx, ty] of extraTrees) {
  if (objects[ty][tx] === 0) placeObj(tx, ty, 1);
}

// Signs
if (objects[7][18] === 0) placeObj(18, 7, 12);  // school sign
if (objects[15][10] === 0) placeObj(10, 15, 12); // near library
if (objects[15][29] === 0) placeObj(29, 15, 12); // near shop

// Fences near school garden
for (let fx = 13; fx <= 26; fx++) {
  if (objects[8][fx] === 0 && ground[8][fx] !== 2) placeObj(fx, 8, 5);
}
// Clear fence on path
collision[8][19] = 0; objects[8][19] = 0;
collision[8][20] = 0; objects[8][20] = 0;

// ========================================
// NPCs
// ========================================
const npcs = [
  { id: "teacher", name: "Prof. Stellar", x: 19, y: 9, sprite: "npc_teacher" },
  { id: "shopkeeper", name: "Merchant Rosa", x: 32, y: 15, sprite: "npc_shop" },
  { id: "librarian", name: "Sage Lumen", x: 7, y: 15, sprite: "npc_library" }
];

// Clear NPC tiles
for (const npc of npcs) {
  collision[npc.y][npc.x] = 1; // NPCs block movement
}

const map = {
  name: "Stellar Village",
  width: W,
  height: H,
  tileSize: 16,
  layers: { ground, objects, collision },
  npcs,
  playerStart: { x: 20, y: 17 }
};

process.stdout.write(JSON.stringify(map));
