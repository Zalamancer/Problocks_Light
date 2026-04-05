// Player using PixelLab sprite assets — smooth pixel movement with tile collision

const SPRITE_BASE = '/assets/sprites/player';
const SPRITE_SCALE = 2 / 3; // 48px canvas → 32px game space (2 tiles tall)
const SPRITE_OFFSET_X = -8;  // center 32px sprite on 16px tile
const SPRITE_OFFSET_Y = -16; // feet at bottom of tile, body extends above

const DIR_MAP = { up: 'north', down: 'south', left: 'west', right: 'east' };
const WALK_DIRS = ['south', 'north', 'east', 'west'];
const ALL_DIRS = ['south', 'north', 'east', 'west', 'south-east', 'north-east', 'north-west', 'south-west'];
const WALK_FRAMES = 6;

export class Player {
  constructor(startPos, tileSize) {
    this.tileSize = tileSize;
    this.x = startPos.x * tileSize;
    this.y = startPos.y * tileSize;
    this.speed = 80;
    this.direction = 'down';
    this.animFrame = 0;
    this.animTimer = 0;
    this.moving = false;

    this.hitbox = { ox: 3, oy: 10, w: 10, h: 5 };

    this.sprite = new PIXI.Container();
    this.bodySprite = null;
    this.textures = {};
    this.loaded = false;
  }

  async loadAssets() {
    const loads = [];

    // Idle rotations
    for (const dir of ALL_DIRS) {
      loads.push(
        PIXI.Assets.load(`${SPRITE_BASE}/rotations/${dir}.png`)
          .then(tex => { this.textures[`idle_${dir}`] = tex; })
      );
    }

    // Walk animation frames
    for (const dir of WALK_DIRS) {
      for (let i = 0; i < WALK_FRAMES; i++) {
        const frame = String(i).padStart(3, '0');
        loads.push(
          PIXI.Assets.load(`${SPRITE_BASE}/animations/walk/${dir}/frame_${frame}.png`)
            .then(tex => { this.textures[`walk_${dir}_${i}`] = tex; })
        );
      }
    }

    await Promise.all(loads);
    this.loaded = true;
    this.refreshSprite();
    this.sprite.x = Math.round(this.x);
    this.sprite.y = Math.round(this.y);
  }

  getTexture() {
    const dir = DIR_MAP[this.direction] || 'south';
    if (this.moving) {
      const key = `walk_${dir}_${this.animFrame % WALK_FRAMES}`;
      if (this.textures[key]) return this.textures[key];
    }
    return this.textures[`idle_${dir}`] || PIXI.Texture.EMPTY;
  }

  refreshSprite() {
    if (!this.loaded) return;
    if (this.bodySprite) this.sprite.removeChild(this.bodySprite);
    this.bodySprite = new PIXI.Sprite(this.getTexture());
    this.bodySprite.scale.set(SPRITE_SCALE);
    this.bodySprite.x = SPRITE_OFFSET_X;
    this.bodySprite.y = SPRITE_OFFSET_Y;
    this.sprite.addChild(this.bodySprite);
  }

  update(dx, dy, dt, map) {
    this.moving = dx !== 0 || dy !== 0;

    if (!this.moving) {
      this.animTimer = 0;
      this.refreshSprite();
      return;
    }

    if (Math.abs(dx) >= Math.abs(dy)) {
      this.direction = dx < 0 ? 'left' : 'right';
    } else {
      this.direction = dy < 0 ? 'up' : 'down';
    }

    let len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) { dx /= len; dy /= len; }

    const moveX = dx * this.speed * dt;
    const moveY = dy * this.speed * dt;

    const newX = this.x + moveX;
    if (!this.collides(newX, this.y, map)) this.x = newX;

    const newY = this.y + moveY;
    if (!this.collides(this.x, newY, map)) this.y = newY;

    this.sprite.x = Math.round(this.x);
    this.sprite.y = Math.round(this.y);

    this.animTimer += dt;
    if (this.animTimer > 0.1) {
      this.animTimer = 0;
      this.animFrame++;
      this.refreshSprite();
    }
  }

  collides(px, py, map) {
    const hb = this.hitbox;
    const ts = this.tileSize;
    const left   = px + hb.ox;
    const right  = px + hb.ox + hb.w - 1;
    const top    = py + hb.oy;
    const bottom = py + hb.oy + hb.h - 1;

    const tiles = [
      [Math.floor(left / ts), Math.floor(top / ts)],
      [Math.floor(right / ts), Math.floor(top / ts)],
      [Math.floor(left / ts), Math.floor(bottom / ts)],
      [Math.floor(right / ts), Math.floor(bottom / ts)],
    ];

    for (const [tx, ty] of tiles) {
      if (!map.isWalkable(tx, ty)) return true;
    }
    return false;
  }

  get tileX() { return Math.floor((this.x + this.tileSize / 2) / this.tileSize); }
  get tileY() { return Math.floor((this.y + this.tileSize / 2) / this.tileSize); }
}
