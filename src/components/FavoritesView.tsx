import { useState } from 'react';
import { toArabicDigits, type Favorite } from '../lib/store';

interface Props {
  favorites: Favorite[];
  onUpdateNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
  onOpenPage: (page: number) => void;
}

export default function FavoritesView({ favorites, onUpdateNote, onRemove, onOpenPage }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (favorites.length === 0) {
    return (
      <div className="card empty-state">
        <p>لا توجد عناصر في المفضلة بعد.</p>
        <p className="hint">أثناء القراءة اضغط ☆ بجانب أي آية لحفظها هنا مع ملاحظة تدبّر.</p>
      </div>
    );
  }

  return (
    <div className="fav-list">
      {favorites.map((f) => (
        <div key={f.id} className="card fav-card">
          <div className="fav-head">
            <strong>
              سورة {f.surahName} — الآية {toArabicDigits(f.ayahNumber)}
            </strong>
            <span className="hint">صفحة {toArabicDigits(f.page)}</span>
          </div>
          <p className="fav-text">{f.ayahText}</p>
          {editing === f.id ? (
            <div className="fav-edit">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="اكتب ملاحظة تدبّر…"
                rows={3}
              />
              <div className="row">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    onUpdateNote(f.id, draft);
                    setEditing(null);
                  }}
                >
                  حفظ
                </button>
                <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <>
              {f.note ? <p className="fav-note">📝 {f.note}</p> : <p className="hint">بدون ملاحظة</p>}
              <div className="row">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setDraft(f.note);
                    setEditing(f.id);
                  }}
                >
                  {f.note ? 'تعديل الملاحظة' : 'إضافة ملاحظة تدبّر'}
                </button>
                <button className="btn btn-ghost" onClick={() => onOpenPage(f.page)}>
                  فتح الصفحة
                </button>
                <button className="btn btn-ghost danger" onClick={() => onRemove(f.id)}>
                  إزالة
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
