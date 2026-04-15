// Страница входа.
import { useState } from "react";
import { api } from "../api";
import type { AuthUser } from "../types";

interface Props {
  onSuccess: (token: string, user: AuthUser) => void;
  onSwitchToRegister: () => void;
}

export function Login({ onSuccess, onSwitchToRegister }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await api.login(username.trim(), password);
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
        <h1>Вход</h1>
        <p className="subtitle">Добро пожаловать в мини-чат</p>

        <div className="field">
          <label htmlFor="login-username">Логин</label>
          <input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Пароль</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <div className="error">{error}</div>}

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Входим…" : "Войти"}
        </button>

        <div className="switch-link">
          Нет аккаунта?{" "}
          <button type="button" onClick={onSwitchToRegister}>
            Зарегистрироваться
          </button>
        </div>
      </form>
    </div>
  );
}
