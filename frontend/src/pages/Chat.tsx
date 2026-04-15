// Основной экран мессенджера: сайдбар со списком комнат и онлайн-пользователей
// и область сообщений с полем ввода.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { ChatWebSocket } from "../ws";
import type { AuthUser, ChatMessage, Room, WsServerEvent } from "../types";

interface Props {
  token: string;
  user: AuthUser;
  onLogout: () => void;
}

// Форматирование времени сообщения в "ЧЧ:ММ"
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function Chat({ token, user, onLogout }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [online, setOnline] = useState<{ userId: number; username: string }[]>([]);
  const [typingByRoom, setTypingByRoom] = useState<Record<string, Set<string>>>({});
  const [draft, setDraft] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Реф на скроллируемую область сообщений — нужен, чтобы при новых сообщениях
  // скроллить к низу
  const messagesRef = useRef<HTMLDivElement | null>(null);

  // Одна инстанция WebSocket на весь экран чата.
  // useMemo — чтобы создать один раз на валидный token
  const ws = useMemo(() => new ChatWebSocket(token), [token]);

  // Загрузка списка комнат при монтировании
  useEffect(() => {
    let cancelled = false;
    api
      .rooms(token)
      .then((res) => {
        if (cancelled) return;
        setRooms(res.rooms);
        if (res.rooms.length > 0) {
          setActiveSlug((prev) => prev ?? res.rooms[0].slug);
        }
      })
      .catch((e) => setLoadError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Подключение к WebSocket на старте компонента
  useEffect(() => {
    ws.connect();
    const off = ws.on((ev: WsServerEvent) => {
      if (ev.type === "message") {
        // Добавляем новое сообщение в соответствующую комнату
        setMessagesByRoom((prev) => {
          const list = prev[ev.roomSlug] ? [...prev[ev.roomSlug], ev.message] : [ev.message];
          return { ...prev, [ev.roomSlug]: list };
        });
      } else if (ev.type === "presence") {
        setOnline(ev.online);
      } else if (ev.type === "typing") {
        // Не показываем индикатор собственного набора
        if (ev.userId === user.id) return;
        setTypingByRoom((prev) => {
          const next = { ...prev };
          const current = new Set(next[ev.roomSlug] ?? []);
          if (ev.isTyping) current.add(ev.username);
          else current.delete(ev.username);
          next[ev.roomSlug] = current;
          return next;
        });
      }
    });
    return () => {
      off();
      ws.close();
    };
    // ws и user.id стабильны на протяжении жизни компонента
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // При смене активной комнаты — подписаться и подгрузить историю
  useEffect(() => {
    if (!activeSlug) return;
    ws.join(activeSlug);
    // Если историю ещё не загружали — запросим
    if (!messagesByRoom[activeSlug]) {
      api
        .messages(token, activeSlug)
        .then((res) => {
          setMessagesByRoom((prev) => ({ ...prev, [activeSlug]: res.messages }));
        })
        .catch((e) => setLoadError((e as Error).message));
    }
    return () => {
      // Отписку не делаем — пусть сервер продолжает пушить события,
      // так переключаться между комнатами будет мгновенно.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlug, token]);

  // Автоскролл вниз при появлении новых сообщений в активной комнате
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeSlug, messagesByRoom]);

  // Таймер, который сбрасывает typing через паузу
  const typingTimer = useRef<number | null>(null);
  const isTypingSent = useRef<boolean>(false);

  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(value);
      if (!activeSlug) return;

      // Отправляем "печатает" не чаще чем раз на каждый период простоя
      if (!isTypingSent.current) {
        isTypingSent.current = true;
        ws.send({ type: "typing", roomSlug: activeSlug, isTyping: true });
      }
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => {
        if (activeSlug) {
          ws.send({ type: "typing", roomSlug: activeSlug, isTyping: false });
        }
        isTypingSent.current = false;
      }, 1500);
    },
    [activeSlug, ws]
  );

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const content = draft.trim();
      if (!content || !activeSlug) return;
      ws.send({ type: "message", roomSlug: activeSlug, content });
      setDraft("");
      // Сбрасываем индикатор "печатает"
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      if (isTypingSent.current) {
        ws.send({ type: "typing", roomSlug: activeSlug, isTyping: false });
        isTypingSent.current = false;
      }
    },
    [draft, activeSlug, ws]
  );

  const activeRoom = rooms.find((r) => r.slug === activeSlug) || null;
  const activeMessages = activeSlug ? messagesByRoom[activeSlug] ?? [] : [];
  const activeTyping = activeSlug
    ? Array.from(typingByRoom[activeSlug] ?? new Set<string>())
    : [];

  // Формируем текст индикатора "печатает..."
  let typingText = "";
  if (activeTyping.length === 1) typingText = `${activeTyping[0]} печатает…`;
  else if (activeTyping.length === 2)
    typingText = `${activeTyping[0]} и ${activeTyping[1]} печатают…`;
  else if (activeTyping.length > 2)
    typingText = `${activeTyping.length} участников печатают…`;

  return (
    <div className="chat-layout">
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="sidebar-header">
          <div className="me">
            Вы: <strong>{user.username}</strong>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Выйти">
            Выйти
          </button>
        </div>

        <div className="sidebar-section">Комнаты</div>
        <ul className="room-list">
          {rooms.map((r) => (
            <li
              key={r.id}
              className={r.slug === activeSlug ? "active" : ""}
              onClick={() => {
                setActiveSlug(r.slug);
                setSidebarOpen(false);
              }}
            >
              <span className="hash">#</span> {r.title}
            </li>
          ))}
        </ul>

        <div className="sidebar-section">Онлайн ({online.length})</div>
        <ul className="online-list">
          {online.map((u) => (
            <li key={u.userId}>
              <span className="online-dot" />
              {u.username}
              {u.userId === user.id ? " (вы)" : ""}
            </li>
          ))}
        </ul>
      </aside>

      <main className="main">
        <header className="main-header">
          <button
            className="back-btn"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Меню"
          >
            ☰
          </button>
          <div>
            <div className="title">{activeRoom ? `#${activeRoom.title}` : "Чат"}</div>
            <div className="subtitle">
              {activeMessages.length
                ? `${activeMessages.length} сообщений`
                : "Сообщений пока нет"}
            </div>
          </div>
        </header>

        <div className="messages" ref={messagesRef}>
          {loadError && <div className="error">{loadError}</div>}
          {activeMessages.map((m) => (
            <div key={m.id} className={`msg${m.userId === user.id ? " own" : ""}`}>
              <div className="msg-meta">
                {m.userId === user.id ? "Вы" : m.username} · {formatTime(m.createdAt)}
              </div>
              <div className="msg-bubble">{m.content}</div>
            </div>
          ))}
        </div>

        <div className="typing">{typingText}&nbsp;</div>

        <form className="composer" onSubmit={handleSend}>
          <input
            type="text"
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            placeholder={activeRoom ? `Сообщение в #${activeRoom.title}` : "Выберите комнату"}
            disabled={!activeRoom}
            maxLength={2000}
          />
          <button
            type="submit"
            className="btn send-btn"
            disabled={!activeRoom || !draft.trim()}
          >
            Отправить
          </button>
        </form>
      </main>
    </div>
  );
}
