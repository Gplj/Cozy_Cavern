import * as THREE from 'three';
import { PlayerAnimator } from './PlayerAnimator.js';

export class Player {
  constructor(gltf, input, debugElement) {
    this.input = input;
    this.root = new THREE.Group();
    this.visual = gltf.scene;
    this.root.add(this.visual);

    this.visual.scale.setScalar(1.28);
    this.visual.rotation.y = Math.PI;

    this.visual.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
      }
    });

    this.animator = new PlayerAnimator(this.visual, gltf.animations, debugElement);
    this.animator.update(0);
    this.visual.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.visual);
    this.visual.position.y += -box.min.y - 0.018;

    this.moveDir = new THREE.Vector3();
    this.cameraForward = new THREE.Vector3();
    this.cameraRight = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.startPosition = new THREE.Vector3();
    this.radius = 0.43;

    // The current speeds already felt right in playtest. Keep them, and instead make
    // animation playback follow the distance the character actually travelled.
    this.speed = 1.75;
    this.runSpeed = 2.65;
    this.modelFacingOffset = Math.PI;

    // Movement remains camera-relative, but Cozy Cavern's camera yaw is fixed.
    // This makes WASD screen-consistent and predictable while preserving the option
    // to reuse Player with another camera strategy in a future project.
    this.movementYaw = 0;
    this.wasMoving = false;

    // Walking stays immediate. Sprinting gets a tiny steering blend so a full
    // right-to-left reversal cannot happen in a single rendered frame.
    this.runMoveYaw = 0;
    this.wasRunning = false;
    this.runReverseTime = 0.15;

    // Final locomotion polish: sprint translation eases into and out of speed instead
    // of jumping instantly between velocity states. These are 90%-settle times, not
    // long acceleration curves: the controls stay responsive while losing the small
    // "teleporty" snap visible in playtest footage.
    this.velocity = new THREE.Vector3();
    this.targetVelocity = new THREE.Vector3();
    this.travelDir = new THREE.Vector3();
    this.sprintAccelTime = 0.16;
    this.sprintDecelTime = 0.10;
  }

  update(dt, cameraYaw, collisionWorld) {
    if (this.input.consume('Digit1')) this.animator.debugPlay(0);
    if (this.input.consume('Digit2')) this.animator.debugPlay(1);
    if (this.input.consume('Digit3')) this.animator.debugPlay(2);
    if (this.input.consume('Digit4')) this.animator.debugPlay(3);
    if (this.input.consume('Digit0')) this.animator.exitDebug();

    let strafe = 0;
    let forwardInput = 0;
    if (this.input.down('KeyA','ArrowLeft')) strafe -= 1;
    if (this.input.down('KeyD','ArrowRight')) strafe += 1;
    if (this.input.down('KeyW','ArrowUp')) forwardInput += 1;
    if (this.input.down('KeyS','ArrowDown')) forwardInput -= 1;

    const moving = strafe !== 0 || forwardInput !== 0;
    const running = moving && this.input.down('ShiftLeft','ShiftRight');
    const wasRunning = this.wasRunning;

    if (moving) {
      // The production camera has a fixed yaw, so this basis is effectively
      // screen-relative: W always heads toward the top of the view, A/D left/right.
      this.movementYaw = cameraYaw;
      this.wasMoving = true;

      this.cameraForward.set(-Math.sin(this.movementYaw), 0, -Math.cos(this.movementYaw)).normalize();
      this.cameraRight.set(Math.cos(this.movementYaw), 0, -Math.sin(this.movementYaw)).normalize();
      this.moveDir.copy(this.cameraRight).multiplyScalar(strafe).addScaledVector(this.cameraForward, forwardInput).normalize();

      if (running) {
        const requestedYaw = Math.atan2(this.moveDir.x, this.moveDir.z);
        if (!wasRunning) {
          this.runMoveYaw = requestedYaw;
        } else {
          const yawDelta = Math.atan2(
            Math.sin(requestedYaw - this.runMoveYaw),
            Math.cos(requestedYaw - this.runMoveYaw)
          );
          const maxTurn = (Math.PI / this.runReverseTime) * dt;
          this.runMoveYaw += THREE.MathUtils.clamp(yawDelta, -maxTurn, maxTurn);
        }
        this.moveDir.set(Math.sin(this.runMoveYaw), 0, Math.cos(this.runMoveYaw));
      }

      const requestedSpeed = running ? this.runSpeed : this.speed;
      this.targetVelocity.copy(this.moveDir).multiplyScalar(requestedSpeed);

      if (running) {
        // Reach 90% of the requested sprint velocity in ~0.16 s. Smoothing the
        // velocity vector (not only facing) also softens sharp changes of direction.
        const alpha = 1 - Math.exp(-Math.log(10) * dt / this.sprintAccelTime);
        this.velocity.lerp(this.targetVelocity, alpha);
      } else if (wasRunning || this.velocity.length() > this.speed + 0.04) {
        // Dropping out of sprint settles back to walk speed quickly, without a snap.
        const alpha = 1 - Math.exp(-Math.log(10) * dt / this.sprintDecelTime);
        this.velocity.lerp(this.targetVelocity, alpha);
      } else {
        // Preserve the playtested immediate walking response.
        this.velocity.copy(this.targetVelocity);
      }
    } else {
      this.wasMoving = false;
      this.targetVelocity.set(0, 0, 0);

      if (wasRunning || this.velocity.length() > this.speed + 0.04) {
        // A tiny sprint stop ease removes the last positional snap. It is deliberately
        // short enough to avoid making Cozy Cavern feel slippery or momentum-heavy.
        const alpha = 1 - Math.exp(-Math.log(10) * dt / this.sprintDecelTime);
        this.velocity.lerp(this.targetVelocity, alpha);
        if (this.velocity.lengthSq() < 0.0009) this.velocity.set(0, 0, 0);
      } else {
        this.velocity.set(0, 0, 0);
      }
    }

    this.wasRunning = running;

    const translating = this.velocity.lengthSq() > 0.0004;
    if (translating) {
      this.startPosition.copy(this.root.position);
      this.desiredPosition.copy(this.root.position).addScaledVector(this.velocity, dt);
      if (collisionWorld) this.root.position.copy(collisionWorld.resolve(this.root.position, this.desiredPosition, this.radius));
      else this.root.position.copy(this.desiredPosition);
      this.root.position.y = 0.01;

      const dx = this.root.position.x - this.startPosition.x;
      const dz = this.root.position.z - this.startPosition.z;
      const actualDistance = Math.hypot(dx, dz);
      const actualSpeed = dt > 0 ? actualDistance / dt : 0;

      // Face the direction the controller is actually carrying us. During collision
      // sliding, prefer real displacement when there is enough of it to measure.
      if (actualDistance > 0.0005) this.travelDir.set(dx, 0, dz).normalize();
      else this.travelDir.copy(this.velocity).setY(0).normalize();

      if (this.travelDir.lengthSq() > 0.0001) {
        const targetYaw = Math.atan2(this.travelDir.x, this.travelDir.z) + this.modelFacingOffset;
        const delta = Math.atan2(Math.sin(targetYaw - this.root.rotation.y), Math.cos(targetYaw - this.root.rotation.y));
        this.root.rotation.y += delta * Math.min(1, dt * 12);
      }

      this.animator.exitDebug(false);

      // Keep the run pose during the tiny coast after releasing sprint; switching to
      // idle only when displacement is genuinely near zero avoids a visible pop.
      const coastingFromRun = !moving && (wasRunning || this.velocity.length() > this.speed + 0.04);
      const locomotion = (running || coastingFromRun) ? 'run' : 'walk';
      const nominalSpeed = locomotion === 'run' ? this.runSpeed : this.speed;
      if (actualSpeed < 0.06) {
        this.animator.play('idle');
      } else {
        this.animator.play(locomotion);
        this.animator.setLocomotionSpeed(locomotion, actualSpeed, nominalSpeed);
      }
    } else if (!this.animator.debugActive) {
      this.animator.play('idle');
    }

    this.animator.update(dt);
  }

  teleport(position) {
    this.root.position.copy(position);
    this.root.position.y = 0.01;
    this.wasMoving = false;
    this.wasRunning = false;
    this.velocity.set(0, 0, 0);
    this.targetVelocity.set(0, 0, 0);
  }
}
