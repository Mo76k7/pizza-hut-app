/**
 * Plays a clean, pleasant notification chime using the Web Audio API.
 * Synthesizes a dual-tone bell sound without external file dependencies.
 */
let audioCtx = null;

export function playOrderChime() {
  if (localStorage.getItem('audio_enabled') === 'false') return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    } else if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Dual-tone chime (D5 - 587.33 Hz followed by A5 - 880 Hz)
    const playTone = (freq, startOffset, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);

      // Smooth attack and exponential decay
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.linearRampToValueAtTime(0.35, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration);
    };

    // First tone (chime)
    playTone(587.33, 0, 0.4);
    // Second higher tone (ding)
    playTone(880, 0.15, 0.6);
  } catch (e) {
    console.warn('[sound] Could not play notification chime:', e);
  }
}
