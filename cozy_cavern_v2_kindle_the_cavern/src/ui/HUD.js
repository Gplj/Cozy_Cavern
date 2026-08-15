export class HUD {
  constructor() {
    this.warmCard = document.querySelector('#warmthCard');
    this.warmFill = document.querySelector('#warmthFill');
    this.warmText = document.querySelector('#warmthText');
    this.warmStatus = document.querySelector('#warmthStatus');
    this.packCount = document.querySelector('#packCount');
    this.stoneCount = document.querySelector('#stoneCount');
    this.crystalCount = document.querySelector('#crystalCount');
    this.bankStone = document.querySelector('#bankStone');
    this.bankCrystal = document.querySelector('#bankCrystal');
    this.objectiveTitle = document.querySelector('#objectiveTitle');
    this.objectiveText = document.querySelector('#objectiveText');
    this.brazierStatus = document.querySelector('#brazierStatus');
    this.prompt = document.querySelector('#prompt');
    this.promptText = document.querySelector('#promptText');
    this.toastEl = document.querySelector('#toast');
    this.win = document.querySelector('#win');
    this.winStats = document.querySelector('#winStats');
    this.toastTimer = 0;

    document.querySelector('#continueBtn')?.addEventListener('click', () => this.win?.classList.add('hidden'));
  }

  update(state, warm) {
    const pct = Math.max(0, Math.min(1, state.warmth / state.maxWarmth));
    this.warmFill.style.width = `${pct * 100}%`;
    this.warmText.textContent = `${Math.ceil(state.warmth)}%`;
    this.warmStatus.textContent = state.heartAwake ? 'Cavern restored' : (warm ? 'Safe & glowing' : (pct < .25 ? 'Bitter cold' : 'Warmth fading'));
    this.warmCard.classList.toggle('cold', !warm && !state.heartAwake);
    this.warmCard.classList.toggle('danger', pct < .25 && !state.heartAwake);
    this.warmCard.classList.toggle('restored', state.heartAwake);

    this.packCount.textContent = `${state.totalCarried()} / ${state.capacity}`;
    this.stoneCount.textContent = state.carried.stone;
    this.crystalCount.textContent = state.carried.crystal;
    this.bankStone.textContent = state.bank.stone;
    this.bankCrystal.textContent = state.bank.crystal;

    if (this.brazierStatus) {
      this.brazierStatus.innerHTML = state.braziers.map((lit, i) => `<span class="${lit ? 'lit' : ''}" title="Brazier ${i+1}">${lit ? '◆' : '◇'}</span>`).join('');
      this.brazierStatus.classList.toggle('hidden', !state.complete || state.heartAwake);
    }

    if (state.heartAwake) {
      this.objectiveTitle.textContent = 'The Heart is warm';
      this.objectiveText.innerHTML = 'The cavern has been restored. Keep exploring, gather at your own pace, or simply stay by the light.';
    } else if (!state.complete) {
      this.objectiveTitle.textContent = 'Supply the hearth';
      this.objectiveText.innerHTML = `Bank <b>${Math.min(state.bank.stone, state.goal.stone)}/${state.goal.stone}</b> stone and <b>${Math.min(state.bank.crystal, state.goal.crystal)}/${state.goal.crystal}</b> crystal.`;
    } else if (state.brazierCount < 3) {
      this.objectiveTitle.textContent = `Kindle the cavern · ${state.brazierCount}/3`;
      const nextIndex = state.braziers.findIndex((lit) => !lit);
      const nextCost = nextIndex >= 0 ? state.brazierCosts[nextIndex] : 0;
      this.objectiveText.innerHTML = `Carry crystal into the deep and rekindle the ancient braziers. Next offering: <b>${nextCost} crystal</b>.`;
    } else {
      this.objectiveTitle.textContent = 'Awaken the Heart';
      this.objectiveText.innerHTML = `All three braziers burn. Carry <b>${state.heartCost} crystal</b> to the great formation in the deepest chamber.`;
    }
  }

  setPrompt(html = '') {
    if (!html) {
      this.prompt.classList.add('hidden');
      return;
    }
    this.promptText.innerHTML = html;
    this.prompt.classList.remove('hidden');
  }

  toast(message, seconds = 2.0) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), seconds * 1000);
  }

  showWin(state) {
    if (!this.win) return;
    if (this.winStats) {
      this.winStats.textContent = `You gathered ${state.mined} resources and fainted ${state.faints} time${state.faints === 1 ? '' : 's'}.`;
    }
    this.win.classList.remove('hidden');
  }
}
