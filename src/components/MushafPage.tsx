import { useEffect, useMemo } from 'react';
import { fetchPage, chapterName, type PageData, type ChapterInfo, type ApiVerse } from '../lib/api';
import { player, wordAudioUrl, ayahAudioUrl } from '../lib/audio';
import { toArabicDigits } from '../lib/store';

interface Props {
  page: number;
  data: PageData | null;
  error: boolean;
  onRetry: (page: number) => void;
  chapters: ChapterInfo[];
  playingKey: string | null;
  setPlayingKey: (k: string | null) => void;
  playAyahSequence: (verses: { chapterId: number; verseNumber: number; key: string }[], fromIndex: number) => void;
  onFavorite: (page: number, verse: ApiVerse) => void;
  isFavorite: (verseKey: string) => boolean;
}

const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

export default function MushafPage({
  page,
  data,
  error,
  onRetry,
  chapters,
  playingKey,
  setPlayingKey,
  playAyahSequence,
  onFavorite,
  isFavorite,
}: Props) {
  // تسلسل آيات الصفحة لتشغيلها كاملة
  const ayahSeq = useMemo(
    () =>
      (data?.verses ?? []).map((v) => ({
        chapterId: v.chapter_id,
        verseNumber: v.verse_number,
        key: `ayah:${v.verse_key}`,
      })),
    [data]
  );

  useEffect(() => {
    if (!data) void fetchPage(page).catch(() => undefined);
  }, [page, data]);

  if (error && !data) {
    return (
      <div className="page-card">
        <div className="page-status error">
          <p>تعذّر تحميل الصفحة {toArabicDigits(page)}</p>
          <button className="btn btn-ghost" onClick={() => onRetry(page)}>
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-card">
        <div className="page-status">جارٍ تحميل الصفحة {toArabicDigits(page)}…</div>
      </div>
    );
  }

  // تجميع الآيات: فاصل عند بدء سورة جديدة
  type Block =
    | { type: 'surah'; chapterId: number; name: string; bismillahPre: boolean }
    | { type: 'verse'; verse: ApiVerse };
  const blocks: Block[] = [];
  let lastChapter = -1;
  for (const verse of data.verses) {
    if (verse.chapter_id !== lastChapter) {
      lastChapter = verse.chapter_id;
      const ch = chapters.find((c) => c.id === verse.chapter_id);
      blocks.push({
        type: 'surah',
        chapterId: verse.chapter_id,
        name: chapterName(chapters, verse.chapter_id),
        bismillahPre: ch?.bismillah_pre ?? true,
      });
    }
    blocks.push({ type: 'verse', verse });
  }

  // أول آية من سورة التوبة (9) لا تبدأ بالبسملة داخل النص
  const isFirstVerseOfSurah = (v: ApiVerse) => v.verse_number === 1;

  return (
    <div className="page-card">
      <div className="page-head">
        <span>صفحة {toArabicDigits(page)}</span>
        {!data.wordsVerified && <span className="page-note">النقر على الكلمات غير متاح في هذه الصفحة</span>}
      </div>
      <div className="mushaf-text" dir="rtl">
        {blocks.map((b, i) => {
          if (b.type === 'surah') {
            return (
              <div key={`s${b.chapterId}-${i}`} className="surah-block">
                <div className="surah-banner">سورة {b.name}</div>
                {b.bismillahPre && <div className="basmala">{BASMALA}</div>}
              </div>
            );
          }
          const verse = b.verse;
          const words = verse.words
            .filter((w) => w.char_type_name === 'word')
            .sort((a, b2) => a.position - b2.position);
          const ayahKey = `ayah:${verse.verse_key}`;
          const isPlaying = playingKey === ayahKey;
          const seqIndex = ayahSeq.findIndex((s) => s.key === ayahKey);
          const fav = isFavorite(verse.verse_key);

          // آية ١ من أي سورة (عدا الفاتحة والتوبة) تبدأ نصّها بالبسملة — نعرضها كنص عادي
          const startsWithBasmala =
            isFirstVerseOfSurah(verse) && verse.chapter_id !== 1 && verse.chapter_id !== 9;

          return (
            <span key={verse.verse_key} className={isPlaying ? 'ayah playing' : 'ayah'}>
              {startsWithBasmala && <span className="word plain">{BASMALA} </span>}
              {words.map((w) => {
                const wKey = `word:${w.location}`;
                if (!data.wordsVerified || !w.audio_url) {
                  return (
                    <span key={w.location} className="word plain">
                      {w.text_uthmani}{' '}
                    </span>
                  );
                }
                return (
                  <span
                    key={w.location}
                    className={playingKey === wKey ? 'word tappable playing-word' : 'word tappable'}
                    onClick={() => {
                      player.play(wordAudioUrl(w.audio_url!), wKey);
                      setPlayingKey(wKey);
                    }}
                  >
                    {w.text_uthmani}{' '}
                  </span>
                );
              })}
              <span
                className="ayah-end"
                title="تشغيل الآية بصوت علي جابر"
                onClick={() => {
                  playAyahSequence(ayahSeq, Math.max(seqIndex, 0));
                }}
              >
                ﴿{toArabicDigits(verse.verse_number)}﴾
              </span>
              <button
                className={fav ? 'fav-btn active' : 'fav-btn'}
                title={fav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                onClick={() => onFavorite(page, verse)}
              >
                {fav ? '★' : '☆'}
              </button>{' '}
            </span>
          );
        })}
      </div>
    </div>
  );
}
