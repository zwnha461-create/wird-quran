import type { Settings, ThemeName } from '../lib/store';
import { toArabicDigits } from '../lib/store';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onResetAll: () => void;
}

export default function SettingsView({ settings, onChange, onResetAll }: Props) {
  return (
    <div className="card settings">
      <h3>الإعدادات</h3>

      <label className="setting-row">
        <span>عدد صفحات الورد</span>
        <span className="stepper">
          <button
            className="tool-btn"
            disabled={settings.pagesPerWird <= 1}
            onClick={() => onChange({ pagesPerWird: Math.max(1, settings.pagesPerWird - 1) })}
          >
            −
          </button>
          <strong>{toArabicDigits(settings.pagesPerWird)}</strong>
          <button
            className="tool-btn"
            disabled={settings.pagesPerWird >= 20}
            onClick={() => onChange({ pagesPerWird: Math.min(20, settings.pagesPerWird + 1) })}
          >
            +
          </button>
        </span>
      </label>

      <label className="setting-row">
        <span>السمة</span>
        <select
          value={settings.theme}
          onChange={(e) => onChange({ theme: e.target.value as ThemeName })}
        >
          <option value="light">فاتح</option>
          <option value="sepia">ورقي</option>
          <option value="dark">داكن</option>
        </select>
      </label>

      <label className="setting-row">
        <span>وضع القراءة</span>
        <select
          value={settings.readingMode ?? 'auto'}
          onChange={(e) =>
            onChange({ readingMode: e.target.value === 'auto' ? null : (e.target.value as 'phone' | 'ipad') })
          }
        >
          <option value="auto">تلقائي حسب الشاشة</option>
          <option value="phone">جوال (ضيّق)</option>
          <option value="ipad">آيباد (واسع)</option>
        </select>
      </label>

      <label className="setting-row">
        <span>حجم خط المصحف</span>
        <span className="stepper">
          <button className="tool-btn" onClick={() => onChange({ fontScale: Math.max(0.8, +(settings.fontScale - 0.1).toFixed(2)) })}>
            أ−
          </button>
          <strong>{toArabicDigits(Math.round(settings.fontScale * 100))}٪</strong>
          <button className="tool-btn" onClick={() => onChange({ fontScale: Math.min(1.6, +(settings.fontScale + 0.1).toFixed(2)) })}>
            أ+
          </button>
        </span>
      </label>

      <div className="setting-row danger-zone">
        <span>تصفير كل البيانات (الصفحات المقروءة والسجل والمفضلة)</span>
        <button className="btn btn-danger" onClick={onResetAll}>
          تصفير
        </button>
      </div>
    </div>
  );
}
