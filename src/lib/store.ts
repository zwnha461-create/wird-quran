// ─── ورد القرآن — إدارة الحالة والتخزين المحلي ────────────────────────────────
// كل البيانات تُحفظ في localStorage فقط (بدون خادم وبدون حسابات).

export const TOTAL_PAGES = 604;
export const STORAGE_KEY = 'wird-quran-v1';

export type ThemeName = 'light' | 'dark' | 'sepia';
export type ReadingMode = 'phone' | 'ipad';

export interface Wird {
  id: string;
  pages: number[]; // مرتبة تصاعديًا ومتتالية
  drawnAt: string; // ISO
  completedAt: string | null; // ISO عند الإتمام
}

export interface Favorite {
  id: string;
  page: number;
  verseKey: string; // "34:50"
  surahName: string; // اسم السورة بالعربية
  ayahNumber: number;
  ayahText: string;
  note: string; // ملاحظة تدبّر
  createdAt: string;
}

export interface Settings {
  pagesPerWird: number; // عدد صفحات الورد (افتراضي 4)
  theme: ThemeName;
  readingMode: ReadingMode | null; // null = تلقائي حسب عرض الشاشة
  fontScale: number; // 0.8 – 1.6
}

export interface AppState {
  readPages: number[]; // أرقام الصفحات المقروءة
  wirds: Wird[]; // كل الأوراد (المعلّق منها completedAt=null)
  favorites: Favorite[];
  khatmaCount: number; // عدد الختمات المكتملة
  settings: Settings;
}

export function defaultSettings(): Settings {
  return { pagesPerWird: 4, theme: 'light', readingMode: null, fontScale: 1 };
}

export function defaultState(): AppState {
  return { readPages: [], wirds: [], favorites: [], khatmaCount: 0, settings: defaultSettings() };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const base = defaultState();
    return {
      readPages: Array.isArray(parsed.readPages) ? parsed.readPages : [],
      wirds: Array.isArray(parsed.wirds) ? parsed.wirds : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      khatmaCount: typeof parsed.khatmaCount === 'number' ? parsed.khatmaCount : 0,
      settings: { ...base.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // مساحة التخزين ممتلئة أو محظورة — نتجاهل بهدوء
  }
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** مفتاح اليوم المحلي بصيغة YYYY-MM-DD */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** الورد المعلّق الحالي (إن وجد) */
export function pendingWird(state: AppState): Wird | null {
  return state.wirds.find((w) => w.completedAt === null) ?? null;
}

/** أيام إتمام الأوراد (مجموعة مفاتيح أيام) */
export function completedDaySet(state: AppState): Set<string> {
  const set = new Set<string>();
  for (const w of state.wirds) {
    if (w.completedAt) set.add(dayKey(new Date(w.completedAt)));
  }
  return set;
}

/** سلسلة الأيام المتتالية المنتهية اليوم أو أمس */
export function computeStreak(state: AppState): number {
  const days = completedDaySet(state);
  if (days.size === 0) return 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1); // لم يُتمّ ورد اليوم بعد — السلسلة تُحسب حتى أمس
    if (!days.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * سحب صفحات متتالية عشوائية من الصفحات غير المقروءة فقط.
 * تُستبعد صفحات الورد المعلّق الحالي (محجوزة، ليست مقروءة بعد لكنها ليست متاحة).
 * إذا تبقّى أقل من العدد المطلوب تُسحب البقية كلها.
 */
export function drawPages(state: AppState, count: number): number[] {
  const reserved = new Set<number>();
  const pending = pendingWird(state);
  if (pending) for (const p of pending.pages) reserved.add(p);
  const read = new Set(state.readPages);

  const unread: number[] = [];
  for (let p = 1; p <= TOTAL_PAGES; p++) {
    if (!read.has(p) && !reserved.has(p)) unread.push(p);
  }
  if (unread.length === 0) return [];

  const n = Math.min(count, unread.length);
  const unreadSet = new Set(unread);

  // كل بدايات الشرائح المتتالية الممكنة بطول n داخل الصفحات غير المقروءة
  const starts: number[] = [];
  for (const p of unread) {
    let ok = true;
    for (let i = 1; i < n; i++) {
      if (!unreadSet.has(p + i)) {
        ok = false;
        break;
      }
    }
    if (ok) starts.push(p);
  }

  if (starts.length > 0) {
    const start = starts[Math.floor(Math.random() * starts.length)];
    return Array.from({ length: n }, (_, i) => start + i);
  }
  // لا توجد شريحة متتالية بطول n (الصفحات المتبقية متفرقة) — نسحب أول n متاحات
  return unread.slice(0, n);
}

/** نطاق صفحات الورد كنص: «٤٣٤ – ٤٣٧» */
export function pageRangeLabel(pages: number[]): string {
  if (pages.length === 0) return '';
  const sorted = [...pages].sort((a, b) => a - b);
  if (sorted.length === 1) return `صفحة ${toArabicDigits(sorted[0])}`;
  return `الصفحات ${toArabicDigits(sorted[0])} – ${toArabicDigits(sorted[sorted.length - 1])}`;
}

export function toArabicDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

export function formatDateAr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
