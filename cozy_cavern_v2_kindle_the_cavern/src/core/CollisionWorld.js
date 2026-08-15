import * as THREE from 'three';

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.circles = [];
    this.bounds = { minX: -5.25, maxX: 5.25, minZ: -4.05, maxZ: 14.35 };
  }

  addBox(minX, maxX, minZ, maxZ, tag = '') {
    this.boxes.push({ minX, maxX, minZ, maxZ, tag });
  }

  addCircle(x, z, radius, tag = '') {
    this.circles.push({ x, z, radius, tag });
  }

  resolve(start, desired, radius) {
    const p = new THREE.Vector3(desired.x, start.y, desired.z);
    p.x = THREE.MathUtils.clamp(p.x, this.bounds.minX + radius, this.bounds.maxX - radius);
    p.z = THREE.MathUtils.clamp(p.z, this.bounds.minZ + radius, this.bounds.maxZ - radius);

    // A couple of passes is enough for the small player step sizes used here and lets
    // the character slide naturally along corners instead of snagging on them.
    for (let pass = 0; pass < 3; pass++) {
      for (const b of this.boxes) this.pushOutBox(p, radius, b);
      for (const c of this.circles) this.pushOutCircle(p, radius, c);
    }
    return p;
  }

  pushOutBox(p, radius, b) {
    const nx = THREE.MathUtils.clamp(p.x, b.minX, b.maxX);
    const nz = THREE.MathUtils.clamp(p.z, b.minZ, b.maxZ);
    let dx = p.x - nx;
    let dz = p.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) return;

    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      const push = radius - d;
      p.x += (dx / d) * push;
      p.z += (dz / d) * push;
      return;
    }

    // Center is inside the box; escape through the nearest side plus the player radius.
    const left = Math.abs(p.x - b.minX);
    const right = Math.abs(b.maxX - p.x);
    const back = Math.abs(p.z - b.minZ);
    const front = Math.abs(b.maxZ - p.z);
    const m = Math.min(left, right, back, front);
    if (m === left) p.x = b.minX - radius;
    else if (m === right) p.x = b.maxX + radius;
    else if (m === back) p.z = b.minZ - radius;
    else p.z = b.maxZ + radius;
  }

  pushOutCircle(p, radius, c) {
    let dx = p.x - c.x;
    let dz = p.z - c.z;
    const min = radius + c.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min) return;
    if (d2 < 1e-8) { dx = 1; dz = 0; }
    const d = Math.max(1e-5, Math.sqrt(dx * dx + dz * dz));
    p.x = c.x + (dx / d) * min;
    p.z = c.z + (dz / d) * min;
  }
}
