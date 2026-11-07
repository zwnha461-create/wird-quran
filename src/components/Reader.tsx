import { useCallback, useEffect, useRef, useState } from 'react';
import MushafPage from './MushafPage';
import { fetchPage, fetchChapters, type PageData, type ChapterInfo, type ApiVerse } from '../lib/api';
import { player, ayahAudioUrl } from '../lib/audio';
import { toArabicDigits, type ReadingMode, type ThemeName, type Wird } from '../lib/store';

interface Props {
  wird: Wird;
  reviewMode: boolean;
  readingMode: ReadingMode;
  theme: ThemeName;
  onToggleMode: () => void;
  onTheme: (t: ThemeName) => void;
  onFont: (delta: number) => void;
  onBack: () => void;
  onComplete: (() => void) | null; // null في وضع المراجعة
  onReplace: (() => void) | null;
  onDelete: () => void;
  onFavorite: (page: number, verse: ApiVerse) => void;
  isFavorite: (verseKey: string) => boolean;
}

export default function Reader({
  wird,
  reviewMode,
  readingMode,
  theme,
  onToggleMode,
  onTheme,
  onFont,
  onBack,
  onComplete,
  onReplace,
  onDelete,
  onFavorite,
  isFavorite,
}: Props) {
  const pages = wird.pages;
  const [idx, setIdx] = useState(0);
  const [pageData, setPageData] = useState<Record<number, PageData>>({});
  const [errors, setErrors] = useState<Record<number, boolean>>({});
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const seqRef = useRef<{ list: { chapterId: number; verseNumber: number; key: string }[]; index: number } | null>(null);

  const page = pages[Math.min(idx, pages.length - 1)];

  const load = useCallback(async (p: number) => {
    try {
      const d = await fetchPage(p);
      setPageData((prev) => ({ ...prev, [p]: d }));
      setErrors((prev) => ({ ...prev, [p]: false }));
    } catch {
      setErrors((prev) => ({ ...prev, [p]: true }));
    }
  }, []);

  useEffect(() => {
    void load(page);
    // تحميل مسبق للصفحة التالية والسابقة
    if (pages[idx + 1]) void load(pages[idx + 1]);
    if (pages[idx - 1]) void load(pages[idx - 1]);
  }, [page, idx, pages, load]);

  useEffect(() => {
    fetchChapters()
      .then(setChapters)
      .catch(() => undefined);
  }, []);

  // إيقاف الصوت عند مغادرة القارئ
  useEffect(() => {
    return () => {
      player.stop();
    };
  }, []);

  const stopSequence = useCallback(() => {
    seqRef.current = null;
    player.stop();
    setPlayingKey(null);
  }, []);

  const playAyahAt = useCallback(
    (list: { chapterId: number; verseNumber: number; key: string }[], index: number) => {
      if (index >= list.length) {
        seqRef.current = null;
        setPlayingKey(null);
        return;
      }
      seqRef.current = { list, index };
      const item = list[index];
      player.play(ayahAudioUrl(item.chapterId, item.verseNumber), item.key, () => {
        const seq = seqRef.current;
        if (seq) playAyahAt(seq.list, seq.index + 1);
      });
      setPlayingKey(item.key);
    },
    []
  );

  /** تشغيل آيات الصفحة الحالية بالتتابع بدءًا من آية معينة */
  const playFromPage = useCallback(
    (fromIndex: number) => {
      const d = pageData[page];
      if (!d) return;
      const list = d.verses.map((v) => ({
        chapterId: v.chapter_id,
        verseNumber: v.verse_number,
        key: `ayah:${v.verse_key}`,
      }));
      playAyahAt(list, fromIndex);
    },
    [page, pageData, playAyahAt]
  );

  const playWholeWird = () => {
    if (playingKey) {
      stopSequence();
      return;
    }
    // نجمع آيات كل الصفحات المحمّلة؛ الصفحات غير المحمّلة تُجلب عند الحاجة
    void (async () => {
      const list: { chapterId: number; verseNumber: number; key: string }[] = [];
      for (const p of pages) {
        const d = pageData[p] ?? (await fetchPage(p).catch(() => null));
        if (d) {
          for (const v of d.verses) {
            list.push({ chapterId: v.chapter_id, verseNumber: v.verse_number, key: `ayah:${v.verse_key}` });
          }
        }
      }
      if (list.length > 0) playAyahAt(list, 0);
    })();
  };

  return (
    <div className={`reader ${readingMode === 'ipad' ? 'mode-wide' : 'mode-narrow'}`}>
      {/* شريط أدوات القراءة — في الأعلى دائمًا */}
      <div className="reader-toolbar">
        <button className="tool-btn" onClick={onBack}>
          → رجوع
        </button>
        <div className="tool-group">
          <button className="tool-btn" onClick={onToggleMode}>
            {readingMode === 'ipad' ? '📱 جوال' : '📖 آيباد'}
          </button>
          <button className="tool-btn" onClick={() => onFont(-0.1)}>
            أ−
          </button>
          <button className="tool-btn" onClick={() => onFont(0.1)}>
            أ+
          </button>
          <select
            className="tool-select"
            value={theme}
            onChange={(e) => onTheme(e.target.value as ThemeName)}
            aria-label="السمة"
          >
            <option value="light">فاتح</option>
            <option value="sepia">ورقي</option>
            <option value="dark">داكن</option>
          </select>
        </div>
      </div>

      <div className="reader-meta">
        {reviewMode ? <span>مراجعة ورد سابق</span> : <span>وردك الحالي</span>}
        <span>
          الصفحة {toArabicDigits(idx + 1)} من {toArabicDigits(pages.length)}
        </span>
        <button className="tool-btn" onClick={playWholeWird}>
          {playingKey ? '⏹ إيقاف التلاوة' : '▶ تلاوة الورد كاملًا (علي جابر)'}
        </button>
        {playingKey && (
          <button className="tool-btn danger" onClick={stopSequence}>
            إيقاف الصوت
          </button>
        )}
      </div>

      {/* مصغّرات الصفحات */}
      <div className="thumb-strip">
        {pages.map((p, i) => (
          <button key={p} className={i === idx ? 'thumb active' : 'thumb'} onClick={() => setIdx(i)}>
            {toArabicDigits(p)}
          </button>
        ))}
      </div>

      <MushafPage
        page={page}
        data={pageData[page] ?? null}
        error={!!errors[page]}
        onRetry={(p) => void load(p)}
        chapters={chapters}
        playingKey={playingKey}
        setPlayingKey={setPlayingKey}
        playAyahSequence={(_verses, fromIndex) => playFromPage(fromIndex)}
        onFavorite={onFavorite}
        isFavorite={isFavorite}
      />

      <div className="reader-nav">
        <button className="btn btn-ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          → الصفحة السابقة
        </button>
        <button
          className="btn btn-ghost"
          disabled={idx >= pages.length - 1}
          onClick={() => setIdx(idx + 1)}
        >
          الصفحة التالية ←
        </button>
      </div>

      <div className="reader-actions">
        {!reviewMode && onComplete && (
          <button className="btn btn-primary big" onClick={onComplete}>
            ✓ أتممت القراءة
          </button>
        )}
        <div className="reader-actions-row">
          {!reviewMode && onReplace && (
            <button className="btn btn-ghost" onClick={onReplace}>
              🔀 صفحات أخرى
            </button>
          )}
          {!confirmDelete ? (
            <button className="btn btn-ghost danger" onClick={() => setConfirmDelete(true)}>
              🗑 حذف الورد
            </button>
          ) : (
            <>
              <span className="confirm-text">متأكد من الحذف؟</span>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete();
                }}
              >
                نعم، احذف
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                إلغاء
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
