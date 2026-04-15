// Страница регистрации нового пользователя.
import { useState } from "react";
import { api } from "../api";
import type { AuthUser } from "../types";

interface Props {
  onSuccess: (token: string, user: AuthUser) => void;
  onSwitchToLogin: () => void;
}

export function Register({ onSuccess, onSwitchToLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await api.register(username.trim(), password);
      onSuccess(token, user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Регистрация</h1>
        <p className="subtitle">Создайте аккаунт, чтобы войти в чат</p>

        <div className="field">
          <label htmlFor="reg-username">Логин</label>
          <input
            id="reg-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={32}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="reg-password">Пароль</label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        {error && <div className="error">{error}</div>}

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Создаём…" : "Создать аккаунт"}
        </button>

        <div className="switch-link">
          Уже есть аккаунт?{" "}
          <button type="button" onClick={onSwitchToLogin}>
            Войти
          </button>
        </div>
      </form>
    </div>
  );
}
