import { effectsVolume, soundContext, registerSustainedEffect } from './sound';

/** A deep bell opens into a rising, original fanfare. Every scheduled voice is cancellable. */
export function playKingVictory(): () => void {
  if (effectsVolume() <= 0 || document.hidden) return () => {};
  const context = soundContext();
  if (!context) return () => {};
  const output = context.createGain();
  output.gain.value = effectsVolume() * 0.7;
  output.connect(context.destination);
  const voices: OscillatorNode[] = [];
  let alive = 0;
  let unregister = () => {};
  const start = context.currentTime + 0.02;
  const note = (
    delay: number,
    pitch: number,
    duration: number,
    level: number,
    type: OscillatorType = 'sine',
  ) => {
    const gain = context.createGain(),
      voice = context.createOscillator();
    voice.type = type;
    voice.frequency.value = pitch;
    gain.gain.setValueAtTime(0.0001, start + delay);
    gain.gain.exponentialRampToValueAtTime(level, start + delay + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + duration);
    voice.connect(gain).connect(output);
    voice.start(start + delay);
    voice.stop(start + delay + duration + 0.02);
    voice.onended = () => {
      voice.disconnect();
      gain.disconnect();
      if (--alive === 0) {
        output.disconnect();
        unregister();
      }
    };
    voices.push(voice);
    alive++;
  };
  for (const [pitch, level] of [
    [73.42, 0.13],
    [146.83, 0.09],
    [293.66, 0.035],
    [439.7, 0.014],
  ])
    note(0, pitch!, 4.3, level!);
  for (const [i, pitch] of [293.66, 440, 523.25, 587.33, 698.46, 880].entries()) {
    note(1.3 + i * 0.32, pitch, 2.7, 0.035, 'triangle');
    note(1.3 + i * 0.32, pitch * 2, 2.2, 0.009);
  }
  for (const pitch of [293.66, 349.23, 440, 587.33]) note(3.5, pitch, 5, 0.025, 'triangle');
  let stopped = false;
  const cancel = () => {
    if (stopped) return;
    stopped = true;
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setTargetAtTime(0.0001, context.currentTime, 0.03);
    for (const voice of voices) {
      try {
        voice.stop(context.currentTime + 0.12);
      } catch {
        /* A completed voice needs no stop. */
      }
    }
  };
  unregister = registerSustainedEffect(cancel);
  return cancel;
}
