// All sounds are synthesized locally. No microphone or external audio is used.
export class Sound {
  constructor() {
    this.context = null;
    this.volume = 0.65;
    this.active = false;
    this.lastBeat = 0;
  }
  start() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      this.ambient = this.context.createGain();
      this.ambient.gain.value = 0;
      this.ambient.connect(this.master);
      for (const frequency of [43, 65.3, 86.4]) {
        const osc = this.context.createOscillator(),
          gain = this.context.createGain();
        osc.frequency.value = frequency;
        gain.gain.value = 0.022;
        osc.connect(gain).connect(this.ambient);
        osc.start();
      }
      const buffer = this.context.createBuffer(
        1,
        this.context.sampleRate * 2,
        this.context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + Math.random() * 0.04 - 0.02) / 1.02;
        data[i] = last * 3;
      }
      this.noise = buffer;
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 180;
      const wind = this.context.createGain();
      wind.gain.value = 0.055;
      source.connect(filter).connect(wind).connect(this.ambient);
      source.start();
    }
    this.context.resume().catch(() => {});
    this.setActive(true);
  }
  setVolume(value) {
    this.volume = value;
    if (this.master) this.master.gain.value = value;
  }
  setActive(value) {
    this.active = value;
    if (this.context)
      this.ambient.gain.setTargetAtTime(value ? 1 : 0, this.context.currentTime, 0.1);
  }
  tone(frequency, duration = 0.15, volume = 0.1, type = 'sine', end = frequency) {
    if (!this.context || !this.active) return;
    const ctx = this.context,
      t = ctx.currentTime,
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }
  noiseHit(duration = 0.12, volume = 0.2, frequency = 400, pan = 0) {
    if (!this.context || !this.active) return;
    const ctx = this.context,
      t = ctx.currentTime,
      source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(gain);
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner).connect(this.master);
    } else gain.connect(this.master);
    source.start(t);
    source.stop(t + duration);
  }
  step(enemy = false, pan = 0, level = 1) {
    this.noiseHit(enemy ? 0.25 : 0.12, (enemy ? 0.38 : 0.14) * level, enemy ? 180 : 450, pan);
    this.tone(enemy ? 58 : 95, 0.09, 0.035 * level);
  }
  click() {
    this.noiseHit(0.06, 0.15, 1800);
  }
  pickup() {
    this.tone(440, 0.2, 0.07);
    setTimeout(() => this.tone(660, 0.25, 0.045), 100);
  }
  scare() {
    this.noiseHit(1.1, 0.8, 1400);
    this.tone(63, 1, 0.3, 'sawtooth', 28);
  }
  heartbeat(threat, time) {
    if (threat > 0.25 && time - this.lastBeat > 1.05 - threat * 0.52) {
      this.tone(48, 0.14, threat * 0.18);
      this.lastBeat = time;
    }
  }
}
