// Audio engine: procedural WebAudio SFX synthesis + CC0 music playback
// (with a full procedural synth-music fallback if the CC0 files fail).
import { clamp } from './utils.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.noise = null;
    this.cc0 = {};          // name -> AudioBuffer
    this.musicMode = 'none';
    this.musicSrc = null;
    this.musicGain = null;
    this.synthTimer = null;
    this.synthNext = 0;
    this.synthStep = 0;
    this.boss = false;
    this._noiseBuf = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.85;
    this.sfxGain.connect(this.master);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.master);

    // simple feedback delay for space
    this.delay = ctx.createDelay();
    this.delay.delayTime.value = 0.18;
    const fb = ctx.createGain(); fb.gain.value = 0.3;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    this.delay.connect(fb); fb.connect(this.delay);
    this.delay.connect(wet); wet.connect(this.master);

    this._noiseBuf = this.makeNoise(2);
    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  makeNoise(sec) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  now() { return this.ctx.currentTime; }

  filter(freq, type = 'lowpass', q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  // ---- generic tone with envelope ----
  tone({ freq = 440, type = 'sine', dur = 0.2, gain = 0.3, sweep = 0, delay = 0, detune = 0, wet = 0.15 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.detune.value = detune;
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(this.delay); this.delay.connect(w); w.connect(this.sfxGain); }
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // ---- filtered noise burst ----
  noiseBurst({ dur = 0.2, gain = 0.3, freq = 1000, type = 'lowpass', sweepTo = 0, delay = 0, q = 1, wet = 0.1 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = this.filter(freq, type, q);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(this.delay); this.delay.connect(w); w.connect(this.sfxGain); }
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ---- SFX ----
  shoot(kind) {
    switch (kind) {
      case 'blaster':
        this.tone({ freq: 900, type: 'square', dur: 0.1, gain: 0.18, sweep: -580, wet: 0.1 });
        this.noiseBurst({ dur: 0.05, gain: 0.1, freq: 2600, type: 'bandpass', q: 2 });
        break;
      case 'scatter':
        this.noiseBurst({ dur: 0.16, gain: 0.3, freq: 1400, sweepTo: 400 });
        this.tone({ freq: 240, type: 'saw', dur: 0.12, gain: 0.14, sweep: -120 });
        break;
      case 'rockets':
        this.tone({ freq: 170, type: 'sine', dur: 0.3, gain: 0.25, sweep: -110, wet: 0.2 });
        this.noiseBurst({ dur: 0.25, gain: 0.18, freq: 900, sweepTo: 200 });
        break;
      case 'minigun':
        this.tone({ freq: 1200, type: 'square', dur: 0.045, gain: 0.1, sweep: -700 });
        this.noiseBurst({ dur: 0.03, gain: 0.08, freq: 3200, type: 'highpass' });
        break;
    }
  }

  explosion(big = false) {
    this.noiseBurst({ dur: big ? 0.9 : 0.45, gain: big ? 0.55 : 0.35, freq: big ? 1100 : 900, sweepTo: 55, wet: 0.25 });
    this.tone({ freq: big ? 130 : 160, type: 'sine', dur: big ? 0.8 : 0.5, gain: big ? 0.4 : 0.25, sweep: big ? -100 : -120, wet: 0.2 });
    if (big) {
      this.noiseBurst({ dur: 1.2, gain: 0.3, freq: 400, sweepTo: 40, delay: 0.08, wet: 0.3 });
      this.tone({ freq: 70, type: 'sine', dur: 1.0, gain: 0.3, sweep: -40, delay: 0.05 });
    }
  }

  hit(crit = false) {
    this.tone({ freq: crit ? 1300 : 700, type: 'triangle', dur: 0.07, gain: 0.22, wet: 0.05 });
    this.noiseBurst({ dur: 0.04, gain: 0.12, freq: 4200, type: 'highpass' });
  }

  hurt() {
    this.tone({ freq: 260, type: 'saw', dur: 0.28, gain: 0.28, sweep: -170, wet: 0.15 });
    this.noiseBurst({ dur: 0.18, gain: 0.2, freq: 700, sweepTo: 150 });
  }

  pickup() {
    this.tone({ freq: 660, type: 'sine', dur: 0.1, gain: 0.28 });
    this.tone({ freq: 990, type: 'sine', dur: 0.14, gain: 0.28, delay: 0.09 });
  }

  dash() {
    this.noiseBurst({ dur: 0.25, gain: 0.22, freq: 800, sweepTo: 4200, type: 'bandpass', q: 1.5, wet: 0.2 });
    this.tone({ freq: 300, type: 'sine', dur: 0.14, gain: 0.12, sweep: 420 });
  }

  reload() {
    this.noiseBurst({ dur: 0.03, gain: 0.18, freq: 5000, type: 'highpass' });
    this.noiseBurst({ dur: 0.05, gain: 0.22, freq: 2600, type: 'bandpass', q: 2, delay: 0.16 });
  }

  empty() {
    this.tone({ freq: 200, type: 'square', dur: 0.05, gain: 0.12 });
  }

  waveStart() {
    [523, 659, 784, 1047].forEach((f, i) => {
      this.tone({ freq: f, type: 'square', dur: 0.28, gain: 0.16, delay: i * 0.09, wet: 0.15 });
    });
  }

  bossRoar() {
    this.tone({ freq: 95, type: 'saw', dur: 1.3, gain: 0.35, sweep: -50, wet: 0.2 });
    this.tone({ freq: 142, type: 'saw', dur: 1.3, gain: 0.25, sweep: -70, detune: 8, wet: 0.2 });
    this.noiseBurst({ dur: 1.1, gain: 0.3, freq: 350, sweepTo: 60, wet: 0.3 });
  }

  enemyShoot() {
    this.noiseBurst({ dur: 0.08, gain: 0.1, freq: 2200, type: 'highpass' });
    this.tone({ freq: 500, type: 'square', dur: 0.06, gain: 0.08, sweep: -250 });
  }

  countdownTick(final = false) {
    this.tone({ freq: final ? 880 : 440, type: 'sine', dur: 0.16, gain: 0.2 });
  }

  gameOver() {
    this.tone({ freq: 440, type: 'saw', dur: 1.6, gain: 0.28, sweep: -330, wet: 0.25 });
    this.tone({ freq: 220, type: 'saw', dur: 1.8, gain: 0.2, sweep: -160, delay: 0.1, wet: 0.25 });
  }

  buy() {
    [523, 659, 784].forEach((f, i) => this.tone({ freq: f, type: 'sine', dur: 0.14, gain: 0.22, delay: i * 0.08 }));
  }

  ui(kind) {
    const sfx = this.cc0[kind];
    if (sfx && this.ctx) {
      const src = this.ctx.createBufferSource();
      src.buffer = sfx;
      const g = this.ctx.createGain();
      g.gain.value = 0.5;
      src.connect(g); g.connect(this.sfxGain);
      src.start();
      return;
    }
    // synth fallback
    if (kind === 'error') this.tone({ freq: 180, type: 'square', dur: 0.14, gain: 0.18, sweep: -60 });
    else if (kind === 'confirm') { this.tone({ freq: 700, type: 'sine', dur: 0.09, gain: 0.2 }); this.tone({ freq: 1050, type: 'sine', dur: 0.12, gain: 0.2, delay: 0.07 }); }
    else if (kind === 'back') this.tone({ freq: 400, type: 'sine', dur: 0.08, gain: 0.15, sweep: -150 });
    else this.tone({ freq: 900, type: 'square', dur: 0.04, gain: 0.12, sweep: -400 });
  }

  // ---- CC0 music ----
  async loadCC0(name, url) {
    if (!this.ctx) return;
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(arr);
      this.cc0[name] = buf;
      return buf;
    } catch (e) {
      console.warn('CC0 audio failed:', name, e);
      return null;
    }
  }

  async loadAll() {
    this.init();
    this.resume();
    await Promise.all([
      this.loadCC0('menu', 'audio/menu.mp3'),
      this.loadCC0('game', 'audio/gameplay.mp3'),
      this.loadCC0('boss', 'audio/boss.mp3'),
      this.loadCC0('click', 'audio/sfx/click_001.ogg'),
      this.loadCC0('confirm', 'audio/sfx/confirmation_001.ogg'),
      this.loadCC0('error', 'audio/sfx/error_001.ogg'),
      this.loadCC0('back', 'audio/sfx/close_001.ogg'),
    ]);
    return this.cc0;
  }

  setMusic(mode) {
    this.boss = mode === 'boss';
    if (this.musicMode === mode && this.musicSrc) return;
    this.musicMode = mode;
    if (!this.ctx) return;
    // fade out current
    if (this.musicSrc) {
      const old = this.musicSrc;
      this.musicSrc = null;
      try {
        this.musicGain.gain.cancelScheduledValues(this.now());
        this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, this.now());
        this.musicGain.gain.linearRampToValueAtTime(0, this.now() + 0.3);
        old.stop(this.now() + 0.35);
      } catch (e) { /* ignore */ }
    }
    if (this.synthTimer) { clearInterval(this.synthTimer); this.synthTimer = null; }
    if (mode === 'none') return;

    const buf = this.cc0[mode];
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(g); g.connect(this.musicGain);
      this.musicGain.gain.setValueAtTime(0, this.now());
      this.musicGain.gain.linearRampToValueAtTime(0.5, this.now() + 0.6);
      src.start();
      this.musicSrc = src;
    } else {
      this.startSynthMusic(mode);
    }
  }

  // ---- procedural synth-music fallback ----
  startSynthMusic(mode) {
    if (!this.ctx) return;
    const bpm = this.boss ? 138 : 124;
    this.synthStep = 0;
    this.synthNext = this.ctx.currentTime + 0.1;
    this.synthTimer = setInterval(() => this._scheduleSynth(bpm), 25);
  }

  _scheduleSynth(bpm) {
    const ctx = this.ctx;
    if (!ctx) return;
    const stepDur = 60 / bpm / 4;
    while (this.synthNext < ctx.currentTime + 0.2) {
      this._synthStep(this.synthStep, this.synthNext, stepDur);
      this.synthStep = (this.synthStep + 1) % 32;
      this.synthNext += stepDur;
    }
  }

  _synthStep(step, t, dur) {
    const ctx = this.ctx;
    const bass = [0, 0, 7, 0, 3, 0, 7, 10, 0, 0, 7, 0, 5, 0, 7, 8];
    const arp = [12, 15, 19, 15, 12, 15, 17, 15, 10, 13, 17, 13, 10, 13, 15, 13];
    const freq = (n) => 55 * Math.pow(2, n / 12);
    // kick
    if (step % 8 === 0) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(this.musicGain);
      o.start(t); o.stop(t + 0.2);
    }
    // hats
    if (step % 2 === 1) {
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuf;
      const f = this.filter(7000, 'highpass');
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(f); f.connect(g); g.connect(this.musicGain);
      src.start(t); src.stop(t + 0.06);
    }
    // bass
    if (step % 8 === 0 || step % 8 === 3 || step % 8 === 5 || step % 8 === 6) {
      const n = bass[step % 16];
      const o = ctx.createOscillator(); o.type = 'saw';
      o.frequency.value = freq(n);
      const f = this.filter(420, 'lowpass');
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur * 2);
      o.connect(f); f.connect(g); g.connect(this.musicGain);
      o.start(t); o.stop(t + dur * 2.2);
    }
    // arp
    if (step % 2 === 0) {
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.value = freq(arp[step % 16] + 12);
      const f = this.filter(2600, 'lowpass');
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.5);
      o.connect(f); f.connect(g); g.connect(this.musicGain);
      o.start(t); o.stop(t + dur * 1.7);
    }
  }
}
