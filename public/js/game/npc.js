// NPCs using PixelLab sprite assets

const NPC_SPRITE_BASE = '/assets/sprites/npcs';
const NPC_SCALE = 2 / 3;
const NPC_OFFSET_X = -8;
const NPC_OFFSET_Y = -16;

const NPC_CONFIG = {
  teacher:    { emoji: '📚', idleAnim: null,             walkAnim: true },
  shopkeeper: { emoji: '🛒', idleAnim: 'breathing-idle', walkAnim: false },
  librarian:  { emoji: '📖', idleAnim: 'breathing-idle', walkAnim: false },
};

const ALL_DIRS = ['south', 'north', 'east', 'west', 'south-east', 'north-east', 'north-west', 'south-west'];

export class NPCManager {
  constructor(npcData, tileSize) {
    this.npcs = npcData;
    this.tileSize = tileSize;
    this.container = new PIXI.Container();
    this.floatOffset = 0;
    this.npcGraphics = [];
    this.npcEmojis = {};
    this.loaded = false;
  }

  async loadAssets() {
    const loads = [];

    for (const npc of this.npcs) {
      const config = NPC_CONFIG[npc.id] || NPC_CONFIG.teacher;
      const basePath = `${NPC_SPRITE_BASE}/${npc.id}`;
      npc._textures = {};
      npc._config = config;

      // Load all rotation images
      for (const dir of ALL_DIRS) {
        loads.push(
          PIXI.Assets.load(`${basePath}/rotations/${dir}.png`)
            .then(tex => { npc._textures[`idle_${dir}`] = tex; })
            .catch(() => {}) // graceful fallback
        );
      }

      // Load idle animation if configured
      if (config.idleAnim) {
        const animName = config.idleAnim;
        // Try loading up to 8 frames
        for (let i = 0; i < 8; i++) {
          const frame = String(i).padStart(3, '0');
          loads.push(
            PIXI.Assets.load(`${basePath}/animations/${animName}/south/frame_${frame}.png`)
              .then(tex => { npc._textures[`anim_${i}`] = tex; })
              .catch(() => {}) // stop when frames run out
          );
        }
      }
    }

    await Promise.all(loads);
    this.buildSprites();
    this.loaded = true;
  }

  buildSprites() {
    for (const npc of this.npcs) {
      const config = npc._config || NPC_CONFIG.teacher;
      const npcContainer = new PIXI.Container();
      npcContainer.x = npc.x * this.tileSize;
      npcContainer.y = npc.y * this.tileSize;

      // NPC body sprite
      const tex = npc._textures['idle_south'] || PIXI.Texture.EMPTY;
      const body = new PIXI.Sprite(tex);
      body.scale.set(NPC_SCALE);
      body.x = NPC_OFFSET_X;
      body.y = NPC_OFFSET_Y;
      npcContainer.addChild(body);

      // Count idle animation frames
      let animFrameCount = 0;
      while (npc._textures[`anim_${animFrameCount}`]) animFrameCount++;

      // Floating "!" indicator
      const indicator = this.createIndicator();
      const indicatorWrap = new PIXI.Container();
      indicatorWrap.addChild(indicator);
      indicatorWrap.y = -14;
      npcContainer.addChild(indicatorWrap);

      this.npcGraphics.push({
        container: npcContainer,
        indicator: indicatorWrap,
        body,
        npc,
        animFrameCount,
        currentFrame: 0,
        animTimer: 0,
      });

      this.container.addChild(npcContainer);
      this.npcEmojis[npc.name] = config.emoji;
    }
  }

  createIndicator() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 12;
    const ctx = canvas.getContext('2d');

    // Glow
    ctx.fillStyle = 'rgba(245,219,154,0.3)';
    ctx.beginPath();
    ctx.ellipse(8, 6, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // "!" mark
    ctx.fillStyle = 'rgb(245,219,154)';
    ctx.fillRect(7, 1, 2, 5);
    ctx.fillRect(7, 8, 2, 2);

    return new PIXI.Sprite(PIXI.Texture.from(canvas));
  }

  getNearby(playerX, playerY, range = 1.5) {
    for (const npc of this.npcs) {
      const dist = Math.abs(npc.x - playerX) + Math.abs(npc.y - playerY);
      if (dist <= range) return npc;
    }
    return null;
  }

  getEmoji(npcName) {
    return this.npcEmojis[npcName] || '❓';
  }

  animate(time) {
    const dt = 1 / 60; // approximate
    this.floatOffset = Math.sin(time * 0.003) * 2;

    for (const g of this.npcGraphics) {
      // Float the indicator
      g.indicator.y = this.floatOffset - 14;

      // Idle animation
      if (g.animFrameCount > 0) {
        g.animTimer += dt;
        if (g.animTimer > 0.25) {
          g.animTimer = 0;
          g.currentFrame = (g.currentFrame + 1) % g.animFrameCount;
          const tex = g.npc._textures[`anim_${g.currentFrame}`];
          if (tex) g.body.texture = tex;
        }
      }
    }
  }
}
