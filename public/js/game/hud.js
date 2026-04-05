export class HUD {
  constructor(profile) {
    this.coinsEl = document.getElementById('hud-coins');
    this.xpEl = document.getElementById('hud-xp');
    this.levelEl = document.getElementById('hud-level');
    this.update(profile);
  }

  update(profile) {
    this.coinsEl.textContent = profile.coins;
    this.xpEl.textContent = `${profile.xp} XP`;
    this.levelEl.textContent = `Lv. ${profile.level}`;
  }
}
