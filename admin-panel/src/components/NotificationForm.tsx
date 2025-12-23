import { FormEvent, useMemo, useState } from 'react';
import { UserProfile } from '../types';

type Props = {
  users: UserProfile[];
  onSend: (title: string, body: string, userId?: string | null) => void;
  loading: boolean;
  error: Error | null;
};

export default function NotificationForm({ users, onSend, loading, error }: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetUser, setTargetUser] = useState<string>('all');

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => (a.email || '').localeCompare(b.email || '', 'tr', { sensitivity: 'base' })),
    [users]
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const userId = targetUser === 'all' ? null : targetUser;
    onSend(title, body, userId);
  };

  return (
    <div className="stack">
      <div>
        <p className="muted" style={{ margin: 0 }}>
          Push Notification
        </p>
        <h3 style={{ margin: '4px 0 0 0' }}>Kitle bildirimi</h3>
      </div>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="title">Başlık</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Yeni kampanya"
            required
          />
        </div>
        <div>
          <label htmlFor="body">Mesaj</label>
          <textarea
            id="body"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Push içeriği"
            required
          />
        </div>
        <div>
          <label htmlFor="target">Hedef</label>
          <select id="target" value={targetUser} onChange={(e) => setTargetUser(e.target.value)}>
            <option value="all">Tüm kullanıcılar</option>
            {sortedUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email} {u.full_name ? `• ${u.full_name}` : ''}
              </option>
            ))}
          </select>
        </div>
        {error ? <div className="pill danger">{error.message}</div> : null}
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Gönderiliyor…' : 'Gönder'}
        </button>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Not: Backend tarafındaki push servisi placeholder, gerçek gönderim için Expo/FCM entegrasyonu gerekir.
        </p>
      </form>
    </div>
  );
}

