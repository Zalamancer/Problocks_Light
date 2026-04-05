import { api } from '../api.js';

const ITEM_EMOJIS = {
  hat: '🎩', outfit: '👘', accessory: '👢', pet: '🐾',
};
const RARITY_COLORS = {
  common: '#aaa', uncommon: '#4ecdc4', rare: '#4a9eff', epic: '#c77dff',
};

export class ShopUI {
  constructor(game) {
    this.game = game;
    this.overlay = document.getElementById('shop-overlay');
    this.itemsEl = document.getElementById('shop-items');
    this.coinsEl = document.getElementById('shop-coins');
    this.isOpen = false;

    document.getElementById('shop-close').addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  async open() {
    this.isOpen = true;
    const catalog = await api('GET', '/api/shop/catalog');
    const inventory = await api('GET', '/api/inventory');
    const ownedIds = new Set(inventory.items.map(i => i.name));

    this.coinsEl.textContent = `🪙 ${this.game.profile.coins}`;
    this.itemsEl.innerHTML = '';

    for (const item of catalog.items) {
      const div = document.createElement('div');
      div.className = 'shop-item';
      const owned = ownedIds.has(item.name);
      const emoji = ITEM_EMOJIS[item.category] || '✨';
      const rarityColor = RARITY_COLORS[item.rarity] || '#aaa';
      div.innerHTML = `
        <span class="shop-item-icon">${emoji}</span>
        <span class="shop-item-name">${item.name}<br><small style="color:${rarityColor}">${item.rarity}</small></span>
        <span class="shop-item-cost">🪙 ${item.cost_coins}</span>
      `;
      const btn = document.createElement('button');
      btn.className = 'shop-buy-btn';
      btn.textContent = owned ? 'OWNED' : 'BUY';
      btn.disabled = owned || this.game.profile.coins < item.cost_coins;
      if (!owned) {
        btn.addEventListener('click', async () => {
          try {
            const result = await api('POST', '/api/shop/buy', { itemId: item.id });
            this.game.profile.coins = result.coinsRemaining;
            this.game.hud.update(this.game.profile);
            btn.textContent = 'OWNED';
            btn.disabled = true;
            this.coinsEl.textContent = `🪙 ${result.coinsRemaining}`;
          } catch (err) {
            btn.textContent = ':(';
            setTimeout(() => { btn.textContent = 'BUY'; }, 1500);
          }
        });
      }
      div.appendChild(btn);
      this.itemsEl.appendChild(div);
    }

    this.overlay.style.display = 'flex';
  }

  close() {
    this.overlay.style.display = 'none';
    this.isOpen = false;
  }
}
