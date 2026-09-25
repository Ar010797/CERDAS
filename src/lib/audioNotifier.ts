// Audio Notification & Alert Synthesizer for CERDAS
// Mendukung pemutaran nada dering jernih di browser desktop, mobile, maupun PWA
// Menggunakan Web Audio API oscillator multi-harmonics yang tidak bergantung pada file eksternal

let globalAudioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

/**
 * Membuka kunci (unlock) AudioContext saat user pertama kali menyentuh layar / mengklik
 * Diperlukan karena kebijakan browser modern melarang suara otomatis tanpa interaksi awal pengguna.
 */
export function unlockAudioContext(): void {
  if (isAudioUnlocked) return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!globalAudioCtx) {
      globalAudioCtx = new AudioCtx();
    }
    if (globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume().then(() => {
        isAudioUnlocked = true;
      }).catch(() => {});
    } else {
      isAudioUnlocked = true;
    }
  } catch (e) {
    console.warn('Unlock audio error:', e);
  }
}

// Pasang pendengar interaksi awal otomatis
if (typeof window !== 'undefined') {
  const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown'];
  const handleFirstInteraction = () => {
    unlockAudioContext();
    unlockEvents.forEach((evt) => window.removeEventListener(evt, handleFirstInteraction));
  };
  unlockEvents.forEach((evt) => window.addEventListener(evt, handleFirstInteraction, { passive: true }));
}

function getSafeAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
      globalAudioCtx = new AudioCtx();
    }
    if (globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume().catch(() => {});
    }
    return globalAudioCtx;
  } catch {
    return null;
  }
}

export type SoundType = 'announcement' | 'grade_released' | 'deadline_warning' | 'deadline_critical' | 'submission_success';

/**
 * Memutar nada dering notifikasi sesuai jenis event
 */
export function playNotificationSound(type: SoundType = 'announcement'): void {
  try {
    // Getar perangkat (vibrate) jika didukung (Android / PWA)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'deadline_critical') {
        navigator.vibrate([200, 100, 200, 100, 400]);
      } else if (type === 'grade_released') {
        navigator.vibrate([150, 80, 250]);
      } else {
        navigator.vibrate([200, 100, 200]);
      }
    }

    const ctx = getSafeAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'grade_released') {
      // Fanfare gembira: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.001, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.36);
      });
      return;
    }

    if (type === 'deadline_critical') {
      // 3 beep peringatan darurat bernada tinggi
      [880, 1174.66, 1318.51].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.001, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.23);
      });
      return;
    }

    if (type === 'deadline_warning') {
      // 2 nada pengingat (D5 -> G5)
      [587.33, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.14);
        gain.gain.setValueAtTime(0.001, now + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.14 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 0.41);
      });
      return;
    }

    if (type === 'submission_success') {
      // Nada lembut pengerjaan selesai: F5 -> A5 -> C6
      [698.46, 880.00, 1046.50].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.36);
      });
      return;
    }

    // Default: 'announcement' bell chime (D5 -> A5 dua nada jernih)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.28, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.65);
  } catch (err) {
    console.warn('Play notification sound notice:', err);
  }
}
