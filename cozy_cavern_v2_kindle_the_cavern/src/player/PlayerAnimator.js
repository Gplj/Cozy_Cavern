import * as THREE from 'three';

function makeInPlace(source) {
  const clip = source.clone();

  // The supplied locomotion clips carry forward motion on Hip.position's local Y axis
  // (the armature root rotates that into world-space travel). Remove the accumulated
  // displacement while preserving the gait itself so gameplay owns position.
  for (const track of clip.tracks) {
    if (!(track instanceof THREE.VectorKeyframeTrack) || !/Hip\.position$/i.test(track.name)) continue;

    const values = track.values;
    const times = track.times;
    const count = times.length;
    if (count < 2) continue;

    const start = [values[0], values[1], values[2]];
    const end = [
      values[(count - 1) * 3],
      values[(count - 1) * 3 + 1],
      values[(count - 1) * 3 + 2]
    ];
    const delta = end.map((v, i) => v - start[i]);

    let axis = 0;
    if (Math.abs(delta[1]) > Math.abs(delta[axis])) axis = 1;
    if (Math.abs(delta[2]) > Math.abs(delta[axis])) axis = 2;
    if (Math.abs(delta[axis]) < 0.2) continue;

    const t0 = times[0];
    const span = Math.max(0.0001, times[count - 1] - t0);
    for (let i = 0; i < count; i++) {
      const alpha = (times[i] - t0) / span;
      values[i * 3 + axis] -= delta[axis] * alpha;
    }
  }
  return clip;
}

export class PlayerAnimator {
  constructor(model, clips, debugElement) {
    this.mixer = new THREE.AnimationMixer(model);
    this.debugElement = debugElement;
    this.sourceClips = [...clips];
    this.clips = [...clips].sort((a, b) => b.duration - a.duration);
    this.actions = new Map();
    // The source walk is unusually slow (~2.33 s per stride) while the run is
    // unusually aggressive (~1 s). These multipliers match foot travel to the
    // gameplay speeds in Player.js and calm the run pose at the same time.
    this.timeScales = { idle: 1.0, walk: 2.80, run: 0.91 };
    this.current = null;
    this.currentName = null;
    this.debugActive = false;

    // The supplied GLB uses generic NLA names. The four clips are:
    // ~12.25s idle-like, ~6.6s action, ~2.35s walk, ~1.0s run.
    const idleClip = this.clips[0];
    const walkClip = [...clips].sort((a,b) => Math.abs(a.duration - 2.35) - Math.abs(b.duration - 2.35))[0];
    const runClip = [...clips].sort((a,b) => Math.abs(a.duration - 1.0) - Math.abs(b.duration - 1.0))[0];

    if (idleClip) this.actions.set('idle', this.makeAction(idleClip, false));
    if (walkClip) this.actions.set('walk', this.makeAction(walkClip, true));
    if (runClip) this.actions.set('run', this.makeAction(runClip, true));

    this.allDebugActions = clips.map((clip) => this.makeAction(clip, true));
    this.play('idle', 0, true);
  }

  makeAction(clip, inPlace) {
    const action = this.mixer.clipAction(inPlace ? makeInPlace(clip) : clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    return action;
  }

  setLabel(text) {
    if (this.debugElement) this.debugElement.textContent = text;
  }

  play(name, fade = 0.18, force = false) {
    if (this.debugActive && !force) return;
    const next = this.actions.get(name);
    if (!next || next === this.current) return;

    next.enabled = true;
    next.setEffectiveTimeScale(this.timeScales[name] ?? 1);
    next.setEffectiveWeight(1);
    next.reset().play();
    if (this.current) this.current.crossFadeTo(next, fade, false);

    this.current = next;
    this.currentName = name;
    this.setLabel(`Animation: ${name}`);
  }

  setLocomotionSpeed(name, actualSpeed, nominalSpeed) {
    if (name !== 'walk' && name !== 'run') return;
    const action = this.actions.get(name);
    if (!action) return;

    // Match foot cadence to real displacement after collision resolution. At full
    // unobstructed speed this preserves the tuned gait; when sliding along props or
    // pressing into a wall, the feet slow with the body instead of treadmill-running.
    const ratio = THREE.MathUtils.clamp(actualSpeed / Math.max(0.001, nominalSpeed), 0.08, 1.08);
    const target = (this.timeScales[name] ?? 1) * ratio;
    const current = action.getEffectiveTimeScale();
    action.setEffectiveTimeScale(THREE.MathUtils.lerp(current, target, 0.35));
  }

  debugPlay(index) {
    const action = this.allDebugActions[index];
    const clip = this.sourceClips[index];
    if (!action || !clip) return;

    this.mixer.stopAllAction();
    action.reset().play();
    this.current = action;
    this.currentName = `debug-${index + 1}`;
    this.debugActive = true;
    this.setLabel(`Animation debug: ${index + 1} · ${clip.name} · ${clip.duration.toFixed(2)}s`);
  }

  exitDebug(resumeIdle = true) {
    if (!this.debugActive) return;
    this.debugActive = false;
    this.current = null;
    this.currentName = null;
    if (resumeIdle) this.play('idle', 0.12, true);
  }

  update(dt) {
    this.mixer.update(dt);
  }
}
