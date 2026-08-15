export class GameState {
  constructor() {
    this.warmth = 100;
    this.maxWarmth = 100;
    this.capacity = 10;
    this.carried = { stone: 0, crystal: 0 };
    this.bank = { stone: 0, crystal: 0 };
    this.pickDamage = 1;
    this.mined = 0;
    this.faints = 0;

    // Phase 1: prove the hearth can be supplied in the rebuilt world.
    this.goal = { stone: 4, crystal: 6 };
    this.complete = false;

    // Phase 2: restore the old warm-route through the cavern.
    // Costs are deliberately kept within the current 10-slot satchel. The original
    // game used larger costs alongside an upgrade tree; this milestone restores the
    // complete brazier/Heart arc first and leaves upgrades as a later layer.
    this.brazierCosts = [6, 8, 10];
    this.braziers = [false, false, false];
    this.brazierCount = 0;
    this.heartCost = 10;
    this.heartAwake = false;
  }

  totalCarried() {
    return this.carried.stone + this.carried.crystal;
  }

  freeSpace() {
    return Math.max(0, this.capacity - this.totalCarried());
  }

  add(type, amount) {
    const got = Math.min(this.freeSpace(), amount);
    if (got <= 0) return 0;
    this.carried[type] += got;
    this.mined += got;
    return got;
  }

  deposit() {
    const total = this.totalCarried();
    if (!total) return 0;
    this.bank.stone += this.carried.stone;
    this.bank.crystal += this.carried.crystal;
    this.carried.stone = 0;
    this.carried.crystal = 0;
    this.checkComplete();
    return total;
  }

  withdrawCrystal() {
    const amount = Math.min(this.freeSpace(), this.bank.crystal);
    if (amount <= 0) return 0;
    this.bank.crystal -= amount;
    this.carried.crystal += amount;
    // Supply completion is intentionally sticky. Once the hearth has been supplied,
    // withdrawing those banked crystals for a brazier does not undo the milestone.
    this.checkComplete();
    return amount;
  }

  lightBrazier(index) {
    if (!this.complete || this.heartAwake) return { ok:false, reason:'locked', cost:0 };
    if (index < 0 || index >= this.braziers.length) return { ok:false, reason:'missing', cost:0 };
    if (this.braziers[index]) return { ok:false, reason:'lit', cost:this.brazierCosts[index] };

    const cost = this.brazierCosts[index];
    if (this.carried.crystal < cost) return { ok:false, reason:'crystal', cost };

    this.carried.crystal -= cost;
    this.braziers[index] = true;
    this.brazierCount = this.braziers.filter(Boolean).length;
    this.maxWarmth += 8;
    this.warmth = Math.min(this.maxWarmth, this.warmth + 34);
    return { ok:true, cost };
  }

  awakenHeart() {
    if (this.heartAwake) return { ok:false, reason:'awake', cost:this.heartCost };
    if (this.brazierCount < 3) return { ok:false, reason:'braziers', cost:this.heartCost };
    if (this.carried.crystal < this.heartCost) return { ok:false, reason:'crystal', cost:this.heartCost };

    this.carried.crystal -= this.heartCost;
    this.heartAwake = true;
    this.warmth = this.maxWarmth;
    return { ok:true, cost:this.heartCost };
  }

  loseHalfCarried() {
    this.carried.stone = Math.floor(this.carried.stone / 2);
    this.carried.crystal = Math.floor(this.carried.crystal / 2);
    this.faints += 1;
  }

  checkComplete() {
    if (this.bank.stone >= this.goal.stone && this.bank.crystal >= this.goal.crystal) this.complete = true;
    return this.complete;
  }
}
