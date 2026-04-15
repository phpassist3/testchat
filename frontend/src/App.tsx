// Корневой компонент приложения.
// Управляет состоянием авторизации и переключает экраны логина/чата.
import { useEffect, useState } from "react";
import { api } from "./api";
import type { AuthUser } from "./types";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Chat } from "./pages/Chat";

// Ключ, под которым в localStorage хранится JWT-токен
const TOKEN_KEY = "testchat.token";

export function App() {
  // Токен и данные пользователя (null = не авторизован)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  // Флаг "пытаемся восстановить сессию по сохранённому токену"
  const [checking, setChecking] = useState<boolean>(!!token);
  // Какую из auth-страниц показать (login/register)
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // При наличии токена пытаемся получить /me, чтобы убедиться, что он живой
  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    api
      .me(token)
      .then((res) => {
        if (!cancelled) setUser(res.user);
      })
      .catch(() => {
        if (!cancelled) {
          // Токен протух или невалиден — очищаем
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAuth = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  if (checking) {
    return <div className="auth-page">Загрузка…</div>;
  }

  if (!token || !user) {
    if (authMode === "login") {
      return (
        <Login
          onSuccess={handleAuth}
          onSwitchToRegister={() => setAuthMode("register")}
        />
      );
    }
    return (
      <Register
        onSuccess={handleAuth}
        onSwitchToLogin={() => setAuthMode("login")}
      />
    );
  }

  return <Chat token={token} user={user} onLogout={handleLogout} />;
}
