import { useEffect, useMemo, useState } from 'react';
import ProgressRing from './components/ProgressRing';
import Reader from './components/Reader';
import CalendarView from './components/CalendarView';
import FavoritesView from './components/FavoritesView';
import SettingsView from './components/SettingsView';
import {
  TOTAL_PAGES,
  loadState,
  saveState,
  uid,
  pendingWird,
  drawPages,
  computeStreak,
  completedDaySet,
  pageRangeLabel,
  toArabicDigits,
  formatDateAr,
  type AppState,
  type ReadingMode,
  type ThemeName,
  type Wird,
} from './lib/store';
import { fetchChapters, chapterName, type ApiVerse } from './lib/api';

type Tab = 'home' | 'history' | 'favorites' | 'settings';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [tab, setTab] = useState<Tab>('home');
  const [reading, setReading] = useState<{ wird: Wird; review: boolean } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [wideScreen, setWideScreen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth >= 900
  );

  useEffect(() => saveState(state), [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
    document.documentElement.style.setProperty('--font-scale', String(state.settings.fontScale));
  }, [state.settings.theme, state.settings.fontScale]);

  useEffect(() => {
    const onResize = () => setWideScreen(window.innerWidth >= 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const readCount = state.readPages.length;
  const pending = pendingWird(state);
  const streak = useMemo(() => computeStreak(state), [state]);
  const completedDays = useMemo(() => completedDaySet(state), [state]);
  const remaining = TOTAL_PAGES - readCount;
  const perDay = state.settings.pagesPerWird;
  // الأيام المتوقعة لإنهاء الختمة بمعدل ورد واحد يوميًا
  const daysLeft = remaining > 0 ? Math.ceil(remaining / perDay) : 0;
  const etaDate = useMemo(() => {
    if (daysLeft === 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + daysLeft);
    return d.toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' });
  }, [daysLeft]);

  const readingMode: ReadingMode = state.settings.readingMode ?? (wideScreen ? 'ipad' : 'phone');

  const updateSettings = (patch: Partial<AppState['settings']>) =>
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  // ── عمليات الورد ──────────────────────────────────────────────────────────
  const drawNewWird = () => {
    setState((s) => {
      if (pendingWird(s)) return s;
      const pages = drawPages(s, s.settings.pagesPerWird);
      if (pages.length === 0) return s;
      const wird: Wird = { id: uid(), pages, drawnAt: new Date().toISOString(), completedAt: null };
      return { ...s, wirds: [wird, ...s.wirds] };
    });
  };

  const completeWird = (wirdId: string) => {
    setState((s) => {
      const w = s.wirds.find((x) => x.id === wirdId);
      if (!w || w.completedAt) return s;
      const read = new Set(s.readPages);
      for (const p of w.pages) read.add(p);
      const finished = read.size >= TOTAL_PAGES;
      const next: AppState = {
        ...s,
        readPages: [...read].sort((a, b) => a - b),
        wirds: s.wirds.map((x) => (x.id === wirdId ? { ...x, completedAt: new Date().toISOString() } : x)),
      };
      if (finished) {
        // اكتملت الختمة: احتفال + بدء دورة جديدة (تبقى السجلات والمفضلة)
        setTimeout(() => setCelebrate(true), 50);
        return { ...next, readPages: [], khatmaCount: s.khatmaCount + 1 };
      }
      return next;
    });
    setReading(null);
  };

  const undoLastCompletion = () => {
    setState((s) => {
      const completed = s.wirds.filter((w) => w.completedAt);
      if (completed.length === 0) return s;
      const last = completed.reduce((a, b) => ((a.completedAt ?? '') > (b.completedAt ?? '') ? a : b));
      const read = new Set(s.readPages);
      for (const p of last.pages) read.delete(p);
      return {
        ...s,
        readPages: [...read].sort((a, b) => a - b),
        wirds: s.wirds.map((w) => (w.id === last.id ? { ...w, completedAt: null } : w)),
      };
    });
  };

  const replacePending = () => {
    setState((s) => {
      const p = pendingWird(s);
      if (!p) return s;
      // نرسم بديلًا مع استبعاد صفحات الورد الحالي (ليأتي مختلفًا)
      const temp: AppState = { ...s, readPages: [...s.readPages, ...p.pages] };
      const pages = drawPages(temp, p.pages.length);
      const replacement = pages.length > 0 ? pages : drawPages(s, p.pages.length);
      if (replacement.length === 0) return s;
      return {
        ...s,
        wirds: s.wirds.map((w) => (w.id === p.id ? { ...w, pages: replacement, drawnAt: new Date().toISOString() } : w)),
      };
    });
  };

  const deleteWird = (wirdId: string) => {
    setState((s) => {
      const w = s.wirds.find((x) => x.id === wirdId);
      if (!w) return s;
      let readPages = s.readPages;
      if (w.completedAt) {
        const read = new Set(s.readPages);
        for (const p of w.pages) read.delete(p);
        readPages = [...read].sort((a, b) => a - b);
      }
      return { ...s, readPages, wirds: s.wirds.filter((x) => x.id !== wirdId) };
    });
    setReading(null);
  };

  // ── المفضلة ───────────────────────────────────────────────────────────────
  const toggleFavorite = async (page: number, verse: ApiVerse) => {
    const exists = state.favorites.find((f) => f.verseKey === verse.verse_key);
    if (exists) {
      setState((s) => ({ ...s, favorites: s.favorites.filter((f) => f.id !== exists.id) }));
      return;
    }
    let name = '';
    try {
      const chapters = await fetchChapters();
      name = chapterName(chapters, verse.chapter_id);
    } catch {
      name = '';
    }
    setState((s) => ({
      ...s,
      favorites: [
        {
          id: uid(),
          page,
          verseKey: verse.verse_key,
          surahName: name,
          ayahNumber: verse.verse_number,
          ayahText: verse.text_uthmani,
          note: '',
          createdAt: new Date().toISOString(),
        },
        ...s.favorites,
      ],
    }));
  };

  const completedWirds = state.wirds.filter((w) => w.completedAt);
  const hasCompleted = completedWirds.length > 0;

  // وضع القراءة
  if (reading) {
    return (
      <div className="app">
        <Reader
          wird={reading.wird}
          reviewMode={reading.review}
          readingMode={readingMode}
          theme={state.settings.theme}
          onToggleMode={() => updateSettings({ readingMode: readingMode === 'ipad' ? 'phone' : 'ipad' })}
          onTheme={(t: ThemeName) => updateSettings({ theme: t })}
          onFont={(delta) =>
            updateSettings({
              fontScale: Math.min(1.6, Math.max(0.8, +(state.settings.fontScale + delta).toFixed(2))),
            })
          }
          onBack={() => setReading(null)}
          onComplete={!reading.review ? () => completeWird(reading.wird.id) : null}
          onReplace={!reading.review ? replacePending : null}
          onDelete={() => deleteWird(reading.wird.id)}
          onFavorite={toggleFavorite}
          isFavorite={(key) => state.favorites.some((f) => f.verseKey === key)}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>ورد القرآن</h1>
        <p className="subtitle">وردك اليومي من مصحف المدينة — {toArabicDigits(TOTAL_PAGES)} صفحة</p>
      </header>

      {celebrate && (
        <div className="celebration" role="dialog">
          <div className="celebration-card">
            <div className="celebration-emoji">🎉</div>
            <h2>تقبّل الله — أتممت الختمة!</h2>
            <p>
              أكملت قراءة المصحف كاملًا ({toArabicDigits(TOTAL_PAGES)} صفحة).
              {state.khatmaCount > 0 && <> هذه ختمتك رقم {toArabicDigits(state.khatmaCount)} المسجّلة.</>}
            </p>
            <p className="hint">بدأت الآن دورة جديدة من الصفر — صفحاتك جاهزة لوَرد جديد.</p>
            <button className="btn btn-primary big" onClick={() => setCelebrate(false)}>
              الحمد لله
            </button>
          </div>
        </div>
      )}

      <nav className="tabs">
        <button className={tab === 'home' ? 'tab active' : 'tab'} onClick={() => setTab('home')}>
          اليوم
        </button>
        <button className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}>
          السجل
        </button>
        <button className={tab === 'favorites' ? 'tab active' : 'tab'} onClick={() => setTab('favorites')}>
          المفضلة
        </button>
        <button className={tab === 'settings' ? 'tab active' : 'tab'} onClick={() => setTab('settings')}>
          الإعدادات
        </button>
      </nav>

      {tab === 'home' && (
        <main className="content">
          <section className="card hero">
            <ProgressRing read={readCount} total={TOTAL_PAGES} />
            <div className="stats-row">
              <div className="stat">
                <strong>{toArabicDigits(streak)}</strong>
                <span>أيام متتالية 🔥</span>
              </div>
              <div className="stat">
                <strong>{toArabicDigits(remaining)}</strong>
                <span>صفحة متبقية</span>
              </div>
              <div className="stat">
                <strong>{toArabicDigits(state.khatmaCount)}</strong>
                <span>ختمات مكتملة</span>
              </div>
            </div>
            {remaining > 0 && etaDate && (
              <p className="hint">
                بمعدل ورد واحد يوميًا ({toArabicDigits(perDay)} صفحات) تنهي الختمة خلال {toArabicDigits(daysLeft)} يومًا
                تقريبًا — بحلول {etaDate} بإذن الله.
              </p>
            )}
          </section>

          <section className="card">
            {pending ? (
              <>
                <h3>لديك ورد بانتظار الإتمام</h3>
                <p>
                  {pageRangeLabel(pending.pages)} — سُحب بتاريخ {formatDateAr(pending.drawnAt)}
                </p>
                <div className="row">
                  <button className="btn btn-primary big" onClick={() => setReading({ wird: pending, review: false })}>
                    📖 متابعة القراءة
                  </button>
                  <button className="btn btn-ghost" onClick={replacePending}>
                    🔀 صفحات أخرى
                  </button>
                </div>
              </>
            ) : remaining > 0 ? (
              <>
                <h3>ورد اليوم</h3>
                <p className="hint">
                  اضغط الزر لسحب {toArabicDigits(perDay)} صفحات متتالية عشوائية من صفحاتك غير المقروءة — لا تتكرر أي
                  صفحة حتى تختم المصحف.
                </p>
                <button className="btn btn-primary big full" onClick={drawNewWird}>
                  ✨ ورد جديد
                </button>
              </>
            ) : (
              <>
                <h3>أتممت كل الصفحات 🎉</h3>
                <p className="hint">ابدأ ختمة جديدة من تبويب الإعدادات بتصفير البيانات، أو احذف وردًا مكتملًا من السجل لإعادة صفحاته.</p>
              </>
            )}
            {hasCompleted && (
              <button className="btn btn-ghost" onClick={undoLastCompletion}>
                ↩ تراجع عن آخر إتمام
              </button>
            )}
          </section>

          <CalendarView completedDays={completedDays} readCount={readCount} />

          <p className="hint footnote">
            تنبيه الصوت: نطق الكلمات المفردة من مقاطع Quran.com التعليمية (ليست بصوت علي الجابر) — أما تلاوة الآيات
            كاملة فبصوت الشيخ علي جابر.
          </p>
        </main>
      )}

      {tab === 'history' && (
        <main className="content">
          {state.wirds.length === 0 && (
            <div className="card empty-state">
              <p>لا توجد أوراد بعد — اسحب وردك الأول من تبويب «اليوم».</p>
            </div>
          )}
          {state.wirds.map((w) => (
            <div key={w.id} className="card history-item">
              <div>
                <strong>{pageRangeLabel(w.pages)}</strong>
                <div className="hint">
                  {w.completedAt
                    ? `أُتمّ بتاريخ ${formatDateAr(w.completedAt)}`
                    : `سُحب بتاريخ ${formatDateAr(w.drawnAt)} — بانتظار الإتمام`}
                </div>
              </div>
              <div className="row">
                <button
                  className="btn btn-ghost"
                  onClick={() => setReading({ wird: w, review: !!w.completedAt })}
                >
                  {w.completedAt ? 'مراجعة' : 'متابعة'}
                </button>
                <button className="btn btn-ghost danger" onClick={() => deleteWird(w.id)}>
                  حذف
                </button>
              </div>
            </div>
          ))}
        </main>
      )}

      {tab === 'favorites' && (
        <main className="content">
          <FavoritesView
            favorites={state.favorites}
            onUpdateNote={(id, note) =>
              setState((s) => ({ ...s, favorites: s.favorites.map((f) => (f.id === id ? { ...f, note } : f)) }))
            }
            onRemove={(id) => setState((s) => ({ ...s, favorites: s.favorites.filter((f) => f.id !== id) }))}
            onOpenPage={(page) => {
              const w: Wird = { id: `fav-${page}`, pages: [page], drawnAt: new Date().toISOString(), completedAt: null };
              setReading({ wird: w, review: true });
            }}
          />
        </main>
      )}

      {tab === 'settings' && (
        <main className="content">
          {!confirmReset ? (
            <SettingsView
              settings={state.settings}
              onChange={updateSettings}
              onResetAll={() => setConfirmReset(true)}
            />
          ) : (
            <div className="card">
              <h3>تصفير كل البيانات؟</h3>
              <p className="hint">سيتم حذف الصفحات المقروءة وكل الأوراد والمفضلة نهائيًا. لا يمكن التراجع.</p>
              <div className="row">
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    localStorage.removeItem('wird-quran-v1');
                    setState(loadState());
                    setConfirmReset(false);
                  }}
                >
                  نعم، صفّر كل شيء
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
