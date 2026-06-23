export const playTone = (frequency: number, type: OscillatorType, duration: number, vol: number = 0.1) => {
  try {
    // Only initialize if window exists (avoids SSR issues if any, though it's Vite SPA)
    if (typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const audioCtx = new AudioContextClass();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      
      gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

export const playClickSound = () => {
  // A short subtle pop sound for button clicks
  playTone(600, 'sine', 0.05, 0.05);
};

export const playSuccessSound = () => {
  // A pleasant chime (two notes) for completing an order
  playTone(523.25, 'sine', 0.1, 0.1); // C5
  setTimeout(() => playTone(659.25, 'sine', 0.3, 0.1), 100); // E5
};

export const playNewOrderSound = () => {
  // A noticeable double chime / bell for new incoming orders
  playTone(880, 'sine', 0.2, 0.2); // A5
  setTimeout(() => playTone(1108.73, 'sine', 0.4, 0.2), 200); // C#6
};

export const playCheckInSound = () => {
  // Ascending notes for check-in
  playTone(523.25, 'sine', 0.1, 0.1); // C5
  setTimeout(() => playTone(659.25, 'sine', 0.1, 0.1), 100); // E5
  setTimeout(() => playTone(783.99, 'sine', 0.2, 0.1), 200); // G5
};

export const playCheckOutSound = () => {
  // Descending notes for check-out
  playTone(783.99, 'sine', 0.1, 0.1); // G5
  setTimeout(() => playTone(659.25, 'sine', 0.1, 0.1), 100); // E5
  setTimeout(() => playTone(523.25, 'sine', 0.2, 0.1), 200); // C5
};
