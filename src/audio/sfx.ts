/**
 * Sintetizador de efectos de combate con Web Audio. Placeholders de calidad mientras no
 * haya audio real (docs/ASSETS_TODO.md): cada sonido se genera, nada se carga.
 *
 * Cada reproduccion lleva una pequeña variacion aleatoria de tono: diez deflects seguidos
 * no suenan a la misma muestra en bucle.
 */
export class SfxSynth {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  volume = 0.7;

  /** El navegador exige un gesto del usuario: llamar desde un pointerdown/keydown. */
  unlock(): void {
    if (!this.context) {
      const context = new AudioContext();
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 10;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.18;
      const master = context.createGain();
      master.gain.value = this.volume;
      master.connect(compressor);
      compressor.connect(context.destination);
      this.context = context;
      this.master = master;
      this.noiseBuffer = makeNoise(context);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  get ready(): boolean {
    return this.context !== null && this.context.state === 'running';
  }

  // ------------------------------------------------------------------ sonidos
  deflect(perfect: boolean, pan = 0): void {
    const io = this.begin(pan);
    if (!io) return;
    const { ctx, out, t } = io;
    const f0 = (perfect ? 1650 : 1450) * vary(0.05);
    const decay = perfect ? 1.35 : 1;
    this.noise(ctx, out, t, 0.03, 'highpass', 2600, perfect ? 0.9 : 0.75);
    metal(
      ctx,
      out,
      t,
      f0,
      [1, 2.32, 4.25, 6.63, 9.38],
      [1, 0.55, 0.4, 0.22, 0.14],
      [0.9, 0.55, 0.38, 0.26, 0.16].map((d) => d * decay),
      perfect ? 0.34 : 0.28,
    );
    if (perfect) {
      // Batido: dos parciales casi iguales dan el "anillo" vivo del deflect perfecto.
      metal(ctx, out, t, f0 * 1.004, [1, 2.32], [0.6, 0.3], [1.4, 0.8], 0.16);
      metal(ctx, out, t + 0.012, f0 * 2.01, [1], [0.5], [0.5], 0.08);
    }
    thump(ctx, out, t, 150, 62, 0.09, perfect ? 0.75 : 0.6);
  }

  block(pan = 0): void {
    const io = this.begin(pan);
    if (!io) return;
    const { ctx, out, t } = io;
    const f0 = 720 * vary(0.06);
    this.noise(ctx, out, t, 0.05, 'lowpass', 2200, 0.55);
    metal(ctx, out, t, f0, [1, 2.1, 3.7], [1, 0.4, 0.2], [0.22, 0.14, 0.09], 0.2);
    thump(ctx, out, t, 120, 55, 0.12, 0.75);
  }

  hit(pan = 0): void {
    const io = this.begin(pan);
    if (!io) return;
    const { ctx, out, t } = io;
    this.noise(ctx, out, t, 0.06, 'highpass', 3000, 0.35);
    this.noise(ctx, out, t + 0.005, 0.14, 'bandpass', 850 * vary(0.1), 0.8);
    thump(ctx, out, t, 95, 45, 0.16, 0.85);
  }

  guardBreak(pan = 0): void {
    const io = this.begin(pan);
    if (!io) return;
    const { ctx, out, t } = io;
    this.noise(ctx, out, t, 0.2, 'lowpass', 1400, 0.7);
    metal(ctx, out, t, 520 * vary(0.04), [1, 1.5, 2.8], [1, 0.7, 0.3], [0.6, 0.4, 0.25], 0.22);
    thump(ctx, out, t, 110, 38, 0.35, 0.95);
  }

  postureBreak(pan = 0): void {
    const io = this.begin(pan);
    if (!io) return;
    const { ctx, out, t } = io;
    thump(ctx, out, t, 130, 32, 0.6, 1);
    this.noise(ctx, out, t, 0.35, 'lowpass', 900, 0.6);
    // Anillo descendente: el acero "se rinde".
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.9);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 1.15);
  }

  deathblow(pan = 0): void {
    const io = this.begin(pan);
    if (!io) return;
    const { ctx, out, t } = io;
    this.noise(ctx, out, t, 0.3, 'bandpass', 620, 1);
    this.noise(ctx, out, t, 0.08, 'highpass', 3500, 0.5);
    thump(ctx, out, t, 80, 30, 0.7, 1);
    metal(ctx, out, t + 0.05, 2400, [1, 2.4], [0.4, 0.2], [1.6, 1], 0.08);
  }

  /** Silbido de la hoja. `delay` en segundos: se programa para caer en el golpe. */
  swing(heavy: boolean, delay: number, pan = 0): void {
    const io = this.begin(pan);
    if (!io) return;
    const { ctx, out } = io;
    const t = io.t + Math.max(delay, 0);
    const duration = heavy ? 0.32 : 0.22;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.2;
    filter.frequency.setValueAtTime(380, t);
    filter.frequency.exponentialRampToValueAtTime(heavy ? 1500 : 2100, t + duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(500, t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(heavy ? 0.55 : 0.4, t + duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(gain).connect(out);
    source.start(t, Math.random() * 0.5);
    source.stop(t + duration + 0.02);
  }

  /** Aviso de lectura: un "ting" breve y limpio antes de un golpe enemigo. */
  telegraph(pan = 0): void {
    const io = this.begin(pan);
    if (!io) return;
    const { ctx, out, t } = io;
    metal(ctx, out, t, 2650, [1, 1.5], [0.6, 0.35], [0.35, 0.22], 0.12);
  }

  // ------------------------------------------------------------------ utilidades
  private begin(pan: number): { ctx: AudioContext; out: AudioNode; t: number } | null {
    const ctx = this.context;
    const master = this.master;
    if (!ctx || !master || ctx.state !== 'running') return null;
    master.gain.value = this.volume;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(master);
    return { ctx, out: panner, t: ctx.currentTime + 0.002 };
  }

  private noise(
    ctx: AudioContext,
    out: AudioNode,
    t: number,
    duration: number,
    type: BiquadFilterType,
    frequency: number,
    level: number,
  ): void {
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(gain).connect(out);
    source.start(t, Math.random() * 0.5);
    source.stop(t + duration + 0.02);
  }
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Parciales inarmonicos con caida exponencial: el timbre del acero. */
function metal(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  f0: number,
  ratios: number[],
  amps: number[],
  decays: number[],
  level: number,
): void {
  ratios.forEach((ratio, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f0 * ratio;
    const amp = (amps[i] ?? 0.1) * level;
    const decay = decays[i] ?? 0.2;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(amp, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.02);
  });
}

/** Golpe grave con caida de tono: el "peso" del impacto. */
function thump(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  from: number,
  to: number,
  duration: number,
  level: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(level, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function vary(amount: number): number {
  return 1 + (Math.random() * 2 - 1) * amount;
}
