import { useMemo, useState } from 'react';
import { dayKey, toArabicDigits } from '../lib/store';

interface Props {
  completedDays: Set<string>;
  readCount: number;
}

const WEEKDAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export default function CalendarView({ completedDays }: Props) {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    // بداية الأسبوع: السبت (getDay: 0=الأحد ... 6=السبت)
    const lead = (first.getDay() + 1) % 7;
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [cursor]);

  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString('ar', {
    month: 'long',
    year: 'numeric',
  });
  const todayKey = dayKey(today);

  const move = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  return (
    <div className="card">
      <div className="cal-head">
        <button className="tool-btn" onClick={() => move(-1)}>
          →
        </button>
        <strong>{monthName}</strong>
        <button className="tool-btn" onClick={() => move(1)}>
          ←
        </button>
      </div>
      <div className="cal-grid weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-wd">
            {w.slice(0, 5)}
          </span>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} className="cal-cell empty" />;
          const key = dayKey(new Date(cursor.y, cursor.m, d));
          const done = completedDays.has(key);
          const isToday = key === todayKey;
          return (
            <span key={i} className={`cal-cell${done ? ' done' : ''}${isToday ? ' today' : ''}`}>
              {toArabicDigits(d)}
              {done && <span className="cal-check">✓</span>}
            </span>
          );
        })}
      </div>
      <p className="hint">الأيام المميّزة بعلامة ✓ أتممت فيها وردًا.</p>
    </div>
  );
}
