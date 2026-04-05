import { api } from '../api.js';
import { TileMap } from './map.js';
import { Player } from './player.js';
import { NPCManager } from './npc.js';
import { DialogueBox } from './dialogue.js';
import { HUD } from './hud.js';
import { ShopUI } from './shop-ui.js';
import { generateWorld } from './world-gen.js';

class Game {
  constructor() {
    this.app = null;
    this.map = null;
    this.player = null;
    this.npcs = null;
    this.dialogue = null;
    this.hud = null;
    this.shop = null;
    this.profile = null;
    this.gameTime = 0;
  }

  async init() {
    try {
      this.profile = await api('GET', '/api/game/profile');
    } catch {
      window.location.href = '/login.html';
      return;
    }

    this.app = new PIXI.Application();
    await this.app.init({
      resizeTo: document.getElementById('game-container'),
      backgroundColor: 0x87CEEB,
      antialias: false,
    });
    document.getElementById('game-container').appendChild(this.app.canvas);
    this.app.canvas.style.imageRendering = 'pixelated';

    this.zoom = 3; // Stardew-style pixel zoom
    // TODO: read seed from classroom config once schema supports it
    const seed = 42;
    const mapData = generateWorld(seed, 120, 90);

    // World container — everything inside gets zoomed
    this.world = new PIXI.Container();
    this.world.scale.set(this.zoom);
    this.app.stage.addChild(this.world);

    this.map = new TileMap(mapData);
    this.map.app = this.app;
    await this.map.loadAssets();
    this.world.addChild(this.map.container);

    this.npcs = new NPCManager(mapData.npcs, mapData.tileSize);
    await this.npcs.loadAssets();
    this.map.container.addChild(this.npcs.container);

    this.player = new Player(mapData.playerStart, mapData.tileSize);
    await this.player.loadAssets();
    this.map.container.addChild(this.player.sprite);

    this.dialogue = new DialogueBox();
    this.hud = new HUD(this.profile);
    this.shop = new ShopUI(this);

    this.app.ticker.add((ticker) => this.update(ticker));

    this.keys = {};
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
  }

  update(ticker) {
    const dt = ticker.deltaMS / 1000; // seconds
    this.gameTime += ticker.deltaMS;

    this.npcs.animate(this.gameTime);

    if (this.dialogue.isOpen || this.shop.isOpen) return;

    let dx = 0, dy = 0;
    if (this.keys['arrowup'] || this.keys['w']) dy = -1;
    if (this.keys['arrowdown'] || this.keys['s']) dy = 1;
    if (this.keys['arrowleft'] || this.keys['a']) dx = -1;
    if (this.keys['arrowright'] || this.keys['d']) dx = 1;

    this.player.update(dx, dy, dt, this.map);

    if (this.keys['e'] || this.keys['enter']) {
      const npc = this.npcs.getNearby(this.player.tileX, this.player.tileY);
      if (npc && !this.dialogue.isOpen) {
        this.keys['e'] = false;
        this.keys['enter'] = false;
        this.startEncounter(npc);
      }
    }

    if (this.keys['b']) {
      this.keys['b'] = false;
      this.shop.open();
    }

    this.centerCamera();
  }

  centerCamera() {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const ts = this.player.tileSize;
    const z = this.zoom;

    let camX = screenW / 2 / z - this.player.sprite.x - ts / 2;
    let camY = screenH / 2 / z - this.player.sprite.y - ts / 2;

    const mapW = this.map.data.width * ts;
    const mapH = this.map.data.height * ts;
    camX = Math.min(0, Math.max(screenW / z - mapW, camX));
    camY = Math.min(0, Math.max(screenH / z - mapH, camY));

    this.map.container.x = Math.round(camX);
    this.map.container.y = Math.round(camY);
  }

  async startEncounter(npc) {
    try {
      const question = await api('POST', '/api/game/encounter', { encounterType: 'npc' });
      const emoji = this.npcs.getEmoji(npc.name);
      this.dialogue.show(npc.name, question, async (choiceIndex) => {
        const startTime = Date.now();
        const result = await api('POST', '/api/game/answer', {
          questionId: question.questionId,
          choiceIndex,
          responseMs: Date.now() - startTime,
        });
        this.dialogue.showFeedback(result);
        if (result.coinsEarned > 0 || result.xpEarned > 0) {
          this.profile.coins += result.coinsEarned;
          this.profile.xp += result.xpEarned;
          this.hud.update(this.profile);
        }
      }, emoji);
    } catch (err) {
      console.error('Encounter error:', err);
    }
  }
}

const game = new Game();
game.init();
