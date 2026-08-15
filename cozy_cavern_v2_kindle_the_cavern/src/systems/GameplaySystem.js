export class GameplaySystem {
  constructor({ input, player, world, state, hud }) {
    this.input = input;
    this.player = player;
    this.world = world;
    this.state = state;
    this.hud = hud;
    this.mineCooldown = 0;
    this.wasComplete = false;
    this.audio = null;
  }

  ensureAudio() {
    if (!this.audio) this.audio = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audio.state === 'suspended') this.audio.resume();
  }

  tone(freq = 440, duration = .08, type = 'sine', volume = .045, slide = 1) {
    try {
      this.ensureAudio();
      const o = this.audio.createOscillator();
      const g = this.audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, this.audio.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(45, freq * slide), this.audio.currentTime + duration);
      g.gain.setValueAtTime(volume, this.audio.currentTime);
      g.gain.exponentialRampToValueAtTime(.0001, this.audio.currentTime + duration);
      o.connect(g).connect(this.audio.destination);
      o.start();
      o.stop(this.audio.currentTime + duration);
    } catch (_) {}
  }

  chord(root = 392) {
    this.tone(root, .38, 'sine', .05, 1.03);
    setTimeout(() => this.tone(root * 4/3, .43, 'sine', .043, 1.03), 120);
    setTimeout(() => this.tone(root * 5/3, .5, 'sine', .038, 1.03), 250);
  }

  update(dt) {
    this.mineCooldown = Math.max(0, this.mineCooldown - dt);
    const pos = this.player.root.position;
    const warm = this.world.isWarm(pos);

    if (this.state.heartAwake) {
      this.state.warmth = Math.min(this.state.maxWarmth, this.state.warmth + 24 * dt);
    } else if (warm) {
      this.state.warmth = Math.min(this.state.maxWarmth, this.state.warmth + 15 * dt);
    } else {
      this.state.warmth = Math.max(0, this.state.warmth - this.world.warmthDrainRate(pos) * dt);
    }

    if (this.state.warmth <= 0) this.faint();

    const hearthNear = this.world.isNearHearth(pos);
    const brazier = this.world.nearestBrazier(pos, 1.95);
    const heartNear = this.world.isNearHeart(pos, 2.7);
    const node = this.world.nearestMineNode(pos, 1.72);

    if (hearthNear) {
      this.handleHearth();
    } else if (brazier) {
      this.handleBrazier(brazier);
    } else if (heartNear) {
      this.handleHeart();
    } else if (node) {
      this.handleMineNode(node);
    } else {
      this.handleExplorePrompt(warm, pos);
    }

    const complete = this.state.checkComplete();
    if (complete && !this.wasComplete) {
      this.hud.toast('The hearth is supplied. The old braziers are waiting deeper below.', 3.4);
      this.world.celebrateHearth();
      this.chord(392);
    }
    this.wasComplete = complete;
    this.hud.update(this.state, warm, this.world);
  }

  handleHearth() {
    if (this.state.totalCarried() > 0) {
      this.hud.setPrompt(`Press <kbd>E</kbd> to deposit your pack at the hearth${this.state.bank.crystal > 0 ? ' · <kbd>R</kbd> withdraw crystal' : ''}`);
    } else if (this.state.bank.crystal > 0) {
      this.hud.setPrompt(this.state.complete
        ? `Hearth storage · <kbd>R</kbd> withdraw crystal for the braziers`
        : `Hearth storage · <kbd>R</kbd> withdraw crystal`);
    } else if (this.state.complete) {
      this.hud.setPrompt('The hearth is steady. Follow the cold passage and rekindle the ancient braziers.');
    } else {
      this.hud.setPrompt('The hearth is warm. Venture through the open passage to gather supplies.');
    }

    if (this.input.consume('KeyE') || this.input.consume('Space')) {
      const deposited = this.state.deposit();
      if (deposited) {
        this.hud.toast(`Deposited ${deposited} resource${deposited === 1 ? '' : 's'} at the hearth.`);
        this.tone(330, .12, 'triangle', .05, 1.35);
        setTimeout(() => this.tone(510, .16, 'sine', .04, 1.08), 70);
        this.world.pulseHearth();
      }
    }

    if (this.input.consume('KeyR')) {
      const amount = this.state.withdrawCrystal();
      this.hud.toast(amount ? `Withdrew ${amount} crystal for the expedition.` : 'No crystal can be withdrawn right now.');
      if (amount) this.tone(650, .1, 'triangle', .04, 1.2);
    }
  }

  handleBrazier(brazier) {
    if (!this.state.complete) {
      this.hud.setPrompt(`${brazier.name} is dormant. Supply the hearth before attempting the deeper rite.`);
      return;
    }

    if (brazier.lit) {
      this.hud.setPrompt(`${brazier.name} burns steadily · this chamber is now a warm refuge.`);
      return;
    }

    const cost = this.state.brazierCosts[brazier.index];
    this.hud.setPrompt(`Press <kbd>E</kbd> to offer <b>${cost}</b> carried crystal to ${brazier.name} · ${this.state.carried.crystal}/${cost}`);
    if (!(this.input.consume('KeyE') || this.input.consume('Space'))) return;

    const result = this.state.lightBrazier(brazier.index);
    if (result.ok) {
      this.world.lightBrazier(brazier.index);
      this.hud.toast(`${brazier.name} rekindled. A new pocket of warmth returns.`, 3.0);
      this.chord(440 + brazier.index * 55);
    } else if (result.reason === 'crystal') {
      this.hud.toast(`${brazier.name} needs ${result.cost} carried crystal (${this.state.carried.crystal}/${result.cost}).`, 2.8);
      this.tone(115, .18, 'sawtooth', .045, .7);
    }
  }

  handleHeart() {
    if (this.state.heartAwake) {
      this.hud.setPrompt('The Heart is warm. The cavern remembers home.');
      return;
    }

    if (this.state.brazierCount < 3) {
      this.hud.setPrompt(`The Heart sleeps behind cold crystal · rekindle all three braziers first (${this.state.brazierCount}/3).`);
      return;
    }

    const need = this.state.heartCost;
    this.hud.setPrompt(`Press <kbd>E</kbd> to offer <b>${need}</b> carried crystal and awaken the Heart · ${this.state.carried.crystal}/${need}`);
    if (!(this.input.consume('KeyE') || this.input.consume('Space'))) return;

    const result = this.state.awakenHeart();
    if (result.ok) {
      this.world.awakenHeart();
      this.hud.toast('The Heart wakes. Warmth floods back through the cavern.', 4.0);
      this.chord(523.25);
      setTimeout(() => this.chord(659.25), 480);
      setTimeout(() => this.hud.showWin(this.state), 850);
    } else if (result.reason === 'crystal') {
      this.hud.toast(`The Heart needs ${need} carried crystal (${this.state.carried.crystal}/${need}).`, 2.8);
      this.tone(105, .2, 'sawtooth', .045, .68);
    }
  }

  handleMineNode(node) {
    const label = node.type === 'crystal' ? 'crystal seam' : 'stone outcrop';
    const full = this.state.freeSpace() <= 0;
    this.hud.setPrompt(full ? `Pack full · return to the hearth` : `Hold <kbd>E</kbd> or <kbd>Space</kbd> to mine ${label} · ${Math.max(0, Math.ceil(node.hp))}/${node.maxHp}`);

    if (!full && this.mineCooldown <= 0 && this.input.down('KeyE', 'Space')) {
      this.mineCooldown = .32;
      const result = this.world.hitNode(node, this.state.pickDamage);
      this.tone(node.type === 'crystal' ? 720 : 170, .07, node.type === 'crystal' ? 'triangle' : 'square', .032, .75);
      if (result.depleted) {
        const got = this.state.add(node.type, result.amount);
        if (got > 0) {
          this.hud.toast(`Gathered ${got} ${node.type}.`);
          this.tone(node.type === 'crystal' ? 980 : 420, .13, 'sine', .05, 1.22);
        }
      }
    }
  }

  handleExplorePrompt(warm, pos) {
    if (this.state.heartAwake) {
      this.hud.setPrompt('The restored cavern is warm enough to wander without fear.');
    } else if (!this.state.complete) {
      this.hud.setPrompt(warm ? 'The passage ahead leads into colder crystal tunnels.' : 'Explore, mine glowing seams, and return before your warmth runs out.');
    } else if (this.state.brazierCount < 3) {
      const next = this.world.nextUnlitBrazier();
      if (warm && next) this.hud.setPrompt(`${next.name} lies farther below. Carry crystal from the hearth and push beyond the warm light.`);
      else if (next && pos.z > next.z + 2) this.hud.setPrompt('You have gone beyond the next refuge. Turn back if the cold begins winning.');
      else this.hud.setPrompt('Follow the old passage. Lit braziers become safe warm refuges for deeper expeditions.');
    } else {
      this.hud.setPrompt('All three braziers burn. The great Heart formation waits in the deepest chamber.');
    }
  }

  faint() {
    if (this.state.heartAwake) return;
    this.state.loseHalfCarried();
    this.state.warmth = Math.max(62, this.state.maxWarmth * .58);
    this.player.teleport(this.world.spawnPoint);
    this.hud.toast('The cold sends you back to the hearth. Half your carried haul was lost.', 3.2);
    this.tone(145, .55, 'sine', .06, .55);
  }
}
