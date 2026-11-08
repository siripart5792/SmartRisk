/**
 * Web Audio API Synthesizer, Speech Synthesizer & Mobile Vibration Alert Service
 * Runs 100% offline with zero external audio assets.
 * Automatically unlocks audio context upon first user gesture on mobile and desktop browsers.
 */

class AudioAlertService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private hasUnlocked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        if (!this.hasUnlocked) {
          this.initAndResume();
        }
      };
      ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown'].forEach((evt) => {
        window.addEventListener(evt, unlock, { once: false, passive: true });
      });
    }
  }

  private initAndResume(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.hasUnlocked = true;
    }

    return this.audioCtx;
  }

  private getAudioContext(): AudioContext | null {
    return this.initAndResume();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * High-priority Warning Alarm (Critical/High Severity Geofence Alert)
   * Plays a loud alternating 2-tone alarm siren + mobile vibration + voice warning
   */
  public playCriticalAlert(warningText?: string) {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();

    try {
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        // 4 rapid cycles of siren beeps (High tone 950Hz, Low tone 650Hz)
        const beeps = [
          { freq: 960, time: 0, dur: 0.12 },
          { freq: 720, time: 0.13, dur: 0.12 },
          { freq: 960, time: 0.28, dur: 0.12 },
          { freq: 720, time: 0.41, dur: 0.12 },
          { freq: 1100, time: 0.56, dur: 0.2 },
        ];

        beeps.forEach(({ freq, time, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + time);

          gain.gain.setValueAtTime(0.4, now + time);
          gain.gain.exponentialRampToValueAtTime(0.01, now + time + dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + time);
          osc.stop(now + time + dur + 0.02);
        });
      }

      // Mobile tactile vibration pattern: [vibrate, pause, vibrate, pause, vibrate]
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([300, 100, 300, 100, 450]);
      }

      // Optional Speech synthesis in Thai if supported and not muted
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && !this.isMuted) {
        try {
          window.speechSynthesis.cancel();
          const speechText = warningText ? `ระวัง ${warningText}` : 'เตือนภัย จุดเสี่ยงข้างหน้า';
          const utterance = new SpeechSynthesisUtterance(speechText);
          utterance.lang = 'th-TH';
          utterance.rate = 1.1;
          utterance.volume = 1.0;
          window.speechSynthesis.speak(utterance);
        } catch {
          // Ignore speech synthesis failures silently
        }
      }
    } catch (e) {
      console.warn('Audio alert error:', e);
    }
  }

  /**
   * Caution Beep (Medium/Low Severity or Approaching Danger Zone)
   */
  public playCautionAlert() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();

    try {
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const tones = [
          { freq: 659.25, time: 0, dur: 0.14 },
          { freq: 880.0, time: 0.14, dur: 0.18 },
        ];

        tones.forEach(({ freq, time, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + time);

          gain.gain.setValueAtTime(0.3, now + time);
          gain.gain.exponentialRampToValueAtTime(0.01, now + time + dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + time);
          osc.stop(now + time + dur + 0.02);
        });
      }

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([180, 90, 180]);
      }
    } catch (e) {
      console.warn('Caution audio error:', e);
    }
  }

  /**
   * Success Chime (Data Synced, Point Recorded)
   */
  public playSuccessChime() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        gain.gain.setValueAtTime(0.2, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.22);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([80]);
      }
    } catch (e) {
      console.warn('Success chime error:', e);
    }
  }
}

export const audioAlertService = new AudioAlertService();
