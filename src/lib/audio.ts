// ─── تشغيل الصوت ─────────────────────────────────────────────────────────────
// - نقر كلمة: مقطع الكلمة الواحدة من صوتيات Quran.com كلمة-بكلمة
//   (https://audio.qurancdn.com/ + audio_url) — صوت تعليمي، ليس بصوت علي الجابر.
// - نقر رقم آية: تلاوة الآية كاملة بصوت الشيخ علي جابر من EveryAyah:
//   https://everyayah.com/data/Ali_Jaber_64kbps/{SSS}{AAA}.mp3

import { WORD_AUDIO_BASE } from './api';

export function wordAudioUrl(audioUrl: string): string {
  return WORD_AUDIO_BASE + audioUrl;
}

export function ayahAudioUrl(chapterId: number, verseNumber: number): string {
  const s = String(chapterId).padStart(3, '0');
  const a = String(verseNumber).padStart(3, '0');
  return `https://everyayah.com/data/Ali_Jaber_64kbps/${s}${a}.mp3`;
}

type EndListener = () => void;

class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private endListener: EndListener | null = null;
  currentKey: string | null = null; // "word:..." أو "ayah:34:50"

  play(url: string, key: string, onEnded?: EndListener): void {
    this.stop();
    const audio = new Audio(url);
    this.audio = audio;
    this.currentKey = key;
    this.endListener = onEnded ?? null;
    audio.onended = () => {
      if (this.audio === audio) {
        this.currentKey = null;
        const cb = this.endListener;
        this.endListener = null;
        cb?.();
      }
    };
    audio.onerror = () => {
      if (this.audio === audio) {
        this.currentKey = null;
        const cb = this.endListener;
        this.endListener = null;
        cb?.();
      }
    };
    void audio.play().catch(() => {
      // منع المتصفح التشغيل التلقائي أو فشل الشبكة — نتجاهل بهدوء
    });
  }

  stop(): void {
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.currentKey = null;
    this.endListener = null;
  }

  isPlaying(key: string): boolean {
    return this.currentKey === key;
  }
}

export const player = new AudioPlayer();
