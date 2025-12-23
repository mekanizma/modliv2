import { useState } from 'react';
import { UserProfile } from '../types';

type Props = {
  users: UserProfile[];
  onUpdateCredits: (userId: string, credits: number) => void;
  updating: boolean;
  total: number;
  page: number;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
};

export default function UserTable({
  users,
  total,
  page,
  onUpdateCredits,
  updating,
  onSearchChange,
  onPageChange
}: Props) {
  const [search, setSearch] = useState('');
  const [pendingCredits, setPendingCredits] = useState<Record<string, number>>({});

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

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="stack">
      <input
        placeholder="E-posta, isim veya ID ile ara"
        value={search}
        onChange={(e) => {
          const next = e.target.value;
          setSearch(next);
          onSearchChange(next);
        }}
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
            {users.map((user) => (
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted">
          Toplam {total} kullanıcı • Sayfa {page}/{totalPages}
        </span>
        <div className="table-actions">
          <button className="btn secondary" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
            Önceki
          </button>
          <button
            className="btn secondary"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            Sonraki
          </button>
        </div>
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

