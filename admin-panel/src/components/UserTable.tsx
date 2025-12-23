import { useMemo, useState } from 'react';
import { UserProfile } from '../types';

type Props = {
  users: UserProfile[];
  onUpdateCredits: (userId: string, credits: number) => void;
  updating: boolean;
};

export default function UserTable({ users, onUpdateCredits, updating }: Props) {
  const [search, setSearch] = useState('');
  const [pendingCredits, setPendingCredits] = useState<Record<string, number>>({});

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return users.filter(
      (u) =>
        (u.email || '').toLowerCase().includes(term) ||
        (u.full_name || '').toLowerCase().includes(term) ||
        (u.id || '').toLowerCase().includes(term)
    );
  }, [users, search]);

  const handleChange = (userId: string, value: string) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    setPendingCredits((prev) => ({ ...prev, [userId]: numeric }));
  };

  const handleSubmit = (userId: string, currentCredits: number | undefined) => {
    const next = pendingCredits[userId];
    if (next === undefined || Number.isNaN(next)) return;
    if (next === currentCredits) return;
    onUpdateCredits(userId, next);
  };

  return (
    <div className="stack">
      <input
        placeholder="E-posta, isim veya ID ile ara"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>E-posta</th>
              <th>Kredi</th>
              <th>Durum</th>
              <th>Tier</th>
              <th style={{ width: 240 }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="stack">
                    <span>{user.email}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {user.full_name || 'İsim yok'}
                    </span>
                  </div>
                </td>
                <td>
                  <input
                    type="number"
                    value={pendingCredits[user.id] ?? user.credits ?? 0}
                    onChange={(e) => handleChange(user.id, e.target.value)}
                    style={{ width: 110 }}
                  />
                </td>
                <td>
                  <StatusPill status={user.subscription_status} />
                </td>
                <td>{user.subscription_tier || '—'}</td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn"
                      onClick={() => handleSubmit(user.id, user.credits)}
                      disabled={updating}
                    >
                      {updating ? 'Kaydediliyor…' : 'Kaydet'}
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        const add = 5;
                        const current = pendingCredits[user.id] ?? user.credits ?? 0;
                        setPendingCredits((prev) => ({ ...prev, [user.id]: current + add }));
                      }}
                    >
                      +5 kredi
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'active') {
    return <span className="pill success">Aktif</span>;
  }
  if (normalized === 'deleted') {
    return <span className="pill danger">Silindi</span>;
  }
  return <span className="pill neutral">{status || '—'}</span>;
}

