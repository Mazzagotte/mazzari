export function createClickBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.045), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    const time = i / context.sampleRate;
    const contact = (Math.random() * 2 - 1) * Math.exp(-time * 190);
    const body = Math.sin(2 * Math.PI * 185 * time) * Math.exp(-time * 100) * 0.35;
    samples[i] = contact * 0.55 + body;
  }
  return buffer;
}

export function playMechanicalClick(context: AudioContext, buffer: AudioBuffer, volume: number): void {
  const source = context.createBufferSource(),
    filter = context.createBiquadFilter(),
    gain = context.createGain();
  source.buffer = buffer;
  source.playbackRate.value = 0.94 + Math.random() * 0.12;
  filter.type = "lowpass";
  filter.frequency.value = 1600;
  gain.gain.setValueAtTime(Math.min(0.07, volume * 0.08) * (0.85 + Math.random() * 0.15), context.currentTime);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
  source.start();
}
