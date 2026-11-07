// ─── جلب نص الصفحات من واجهة Quran.com (v4) ──────────────────────────────────
// تم التحقق من شكل الاستجابة فعليًا:
// GET https://api.quran.com/api/v4/verses/by_page/{page}?words=true&per_page=50
//   &word_fields=text_uthmani,location,audio_url
//   &fields=text_uthmani,chapter_id,verse_key
// يعيد verses[] وكل آية فيها words[] — كل كلمة فيها text_uthmani و audio_url
// (نسبي مثل "wbw/001_001_001.mp3") و char_type_name ("word" أو "end" لعلامة نهاية الآية).

export interface ApiWord {
  position: number;
  text_uthmani: string;
  audio_url: string | null;
  char_type_name: string; // 'word' | 'end' | ...
  location: string;
}

export interface ApiVerse {
  id: number;
  verse_number: number;
  verse_key: string; // "34:50"
  chapter_id: number;
  page_number: number;
  text_uthmani: string;
  words: ApiWord[];
}

export interface ChapterInfo {
  id: number;
  name_arabic: string;
  bismillah_pre: boolean;
}

export interface PageData {
  page: number;
  verses: ApiVerse[];
  /** هل قائمة الكلمات تطابق نص الصفحة تمامًا (ترتيبًا وعددًا)؟ عندها فقط تكون الكلمات قابلة للنقر */
  wordsVerified: boolean;
}

const API_BASE = 'https://api.quran.com/api/v4';
export const WORD_AUDIO_BASE = 'https://audio.qurancdn.com/';

const pageCache = new Map<number, PageData>();
let chaptersCache: ChapterInfo[] | null = null;

/** تطبيع النص للمقارنة: إزالة كل ما ليس حرفًا (مسافات وتشكيل إضافي) */
function normalizeForCompare(s: string): string {
  return s.replace(/[\sٰـۖ-ۭ]/g, '');
}

/**
 * فحص تطابق الكلمات مع نص الآية: نجمع نصوص الكلمات الحقيقية فقط
 * (char_type_name === 'word') ونقارنها بنص الآية الكامل بعد التطبيع.
 */
function verseWordsMatch(verse: ApiVerse): boolean {
  const words = verse.words.filter((w) => w.char_type_name === 'word');
  if (words.length === 0) return false;
  // ترتيب الكلمات حسب موضعها
  const ordered = [...words].sort((a, b) => a.position - b.position);
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].position !== i + 1) return false; // فجوة في الترتيب
  }
  const joined = ordered.map((w) => w.text_uthmani).join('');
  return normalizeForCompare(joined) === normalizeForCompare(verse.text_uthmani);
}

export async function fetchPage(page: number): Promise<PageData> {
  const cached = pageCache.get(page);
  if (cached) return cached;

  const url =
    `${API_BASE}/verses/by_page/${page}?words=true&per_page=50` +
    `&word_fields=text_uthmani,location,audio_url` +
    `&fields=text_uthmani,chapter_id,verse_key`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { verses: ApiVerse[] };
  const verses = (json.verses || []).slice().sort((a, b) => a.id - b.id);
  if (verses.length === 0) throw new Error('صفحة فارغة');

  const wordsVerified = verses.every(verseWordsMatch);
  const data: PageData = { page, verses, wordsVerified };
  pageCache.set(page, data);
  return data;
}

export async function fetchChapters(): Promise<ChapterInfo[]> {
  if (chaptersCache) return chaptersCache;
  const res = await fetch(`${API_BASE}/chapters?language=ar`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { chapters: ChapterInfo[] };
  chaptersCache = json.chapters || [];
  return chaptersCache;
}

export function chapterName(chapters: ChapterInfo[], id: number): string {
  return chapters.find((c) => c.id === id)?.name_arabic ?? '';
}
