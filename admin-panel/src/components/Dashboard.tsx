import NotificationForm from './NotificationForm';
import UserTable from './UserTable';
import { Stats, UserProfile } from '../types';

type Props = {
  adminEmail: string;
  onLogout: () => void;
  users: UserProfile[];
  usersLoading: boolean;
  usersError: Error | null;
  stats?: Stats;
  statsLoading: boolean;
  statsError: Error | null;
  onUpdateCredits: (userId: string, credits: number) => void;
  onSendNotification: (title: string, body: string, userId?: string | null) => void;
  creditUpdating: boolean;
  notificationSending: boolean;
  notificationError: Error | null;
};

export default function Dashboard({
  adminEmail,
  onLogout,
  users,
  usersLoading,
  usersError,
  stats,
  statsLoading,
  statsError,
  onUpdateCredits,
  onSendNotification,
  creditUpdating,
  notificationSending,
  notificationError
}: Props) {
  return (
    <div className="grid" style={{ gap: 'var(--space-3)' }}>
      <header className="header">
        <div className="hero">
          <p className="muted" style={{ margin: 0 }}>
            Hoş geldin
          </p>
          <h1 style={{ margin: '4px 0 0 0' }}>Modli Admin</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Kullanıcılara kredi tanımlayın, push gönderin, sistemi izleyin.
          </p>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end' }}>
          <div className="pill neutral"> {adminEmail} </div>
          <button className="btn secondary" onClick={onLogout}>
            Çıkış Yap
          </button>
        </div>
      </header>

      <section className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <p className="muted" style={{ margin: 0 }}>
                Genel İstatistikler
              </p>
              <h3 style={{ margin: '4px 0 0 0' }}>Kullanıcı ve kredi görünümü</h3>
            </div>
            {statsLoading ? <span className="muted">Yükleniyor…</span> : null}
          </div>
          {statsError ? (
            <div className="pill danger">İstatistik alınamadı: {statsError.message}</div>
          ) : (
            <div className="grid grid-2">
              <StatCard title="Toplam Kullanıcı" value={stats?.users.total ?? '-'} />
              <StatCard title="Aktif" value={stats?.users.active ?? '-'} />
              <StatCard title="Premium" value={stats?.users.premium ?? '-'} />
              <StatCard
                title="Toplam Kredi"
                value={stats ? stats.credits.total : '-'}
                subtitle={stats ? `Ortalama: ${stats.credits.average}` : undefined}
              />
            </div>
          )}
        </div>

        <div className="card">
          <NotificationForm
            users={users}
            loading={notificationSending}
            onSend={onSendNotification}
            error={notificationError}
          />
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="muted" style={{ margin: 0 }}>
              Kullanıcılar
            </p>
            <h3 style={{ margin: '4px 0 0 0' }}>Kredi yönetimi</h3>
          </div>
          {usersLoading ? <span className="muted">Yükleniyor…</span> : null}
        </div>
        {usersError ? (
          <div className="pill danger">Kullanıcılar alınamadı: {usersError.message}</div>
        ) : (
          <UserTable
            users={users}
            onUpdateCredits={onUpdateCredits}
            updating={creditUpdating}
          />
        )}
      </section>
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: number | string; subtitle?: string }) {
  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>
        {title}
      </p>
      <span className="stat-value">{value}</span>
      {subtitle ? <p className="muted" style={{ margin: 0 }}>{subtitle}</p> : null}
    </div>
  );
}

