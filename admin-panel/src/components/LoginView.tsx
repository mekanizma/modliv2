import { FormEvent, useState } from 'react';

type Props = {
  onSubmit: (email: string, password: string) => void;
  loading: boolean;
  error: Error | null | unknown;
};

export default function LoginView({ onSubmit, loading, error }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(email, password);
  };

  return (
    <div className="card" style={{ maxWidth: 460, margin: '0 auto', marginTop: '64px' }}>
      <div className="stack">
        <div>
          <p className="muted" style={{ margin: 0 }}>
            Güvenli erişim
          </p>
          <h1 style={{ margin: '6px 0 0 0' }}>Modli Admin Panel</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Yönetici e-postanız ve şifreniz ile giriş yapın.
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email">E-posta</label>
            <input
              id="email"
              type="email"
              placeholder="admin@modli.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password">Şifre</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error ? (
            <div className="pill danger" role="alert">
              {(error as Error).message || 'Giriş başarısız'}
            </div>
          ) : null}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>
      </div>
    </div>
  );
}


