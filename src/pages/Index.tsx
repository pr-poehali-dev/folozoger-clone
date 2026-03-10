import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import Icon from "@/components/ui/icon";

// ─── Types ───────────────────────────────────────────────────────────────────
interface User { id: number; username: string; display_name: string; bio?: string; avatar_url?: string; is_banned?: boolean; created_at?: string; }
interface Conversation { id: number; type: string; name: string; description?: string; avatar_url?: string; owner_id?: number; is_locked?: boolean; my_role?: string; member_count?: number; owner_name?: string; }
interface Message { id: number; content: string; is_removed: boolean; created_at: string; sender?: User; }
interface AdminStats { users: number; messages: number; groups: number; channels: number; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Avatar({ name, size = 40, src }: { name: string; size?: number; src?: string }) {
  const initials = name ? name.slice(0, 2).toUpperCase() : "?";
  const colors = ["#9b59ff,#00d4ff", "#ff3da6,#9b59ff", "#00d4ff,#00ff88", "#ff6b35,#ff3da6", "#9b59ff,#ff3da6"];
  const idx = name.charCodeAt(0) % colors.length;
  const [g1, g2] = colors[idx].split(",");
  if (src && !src.startsWith("http")) src = undefined;
  return (
    <div style={{ width: size, height: size, minWidth: size, background: src ? undefined : `linear-gradient(135deg, ${g1}, ${g2})`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: "white", overflow: "hidden" }}>
      {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
    </div>
  );
}

function formatTime(dt: string) {
  const d = new Date(dt);
  return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(dt: string) {
  const d = new Date(dt);
  return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
}

function ConvIcon({ type, locked }: { type: string; locked?: boolean }) {
  if (type === "direct") return <Icon name="MessageCircle" size={16} />;
  if (type === "group") return <Icon name="Users" size={16} />;
  return locked ? <Icon name="Lock" size={16} /> : <Icon name="Radio" size={16} />;
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }: { onAuth: (user: User, token: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      let data: { token: string; user_id: number; username: string; display_name: string };
      if (mode === "login") {
        data = await api.auth.login(username.trim(), password) as typeof data;
      } else {
        data = await api.auth.register(username.trim(), displayName.trim() || username.trim(), password) as typeof data;
      }
      localStorage.setItem("folozoger_token", data.token);
      onAuth({ id: data.user_id, username: data.username, display_name: data.display_name }, data.token);
    } catch (e: unknown) {
      const err = e as { data?: { error?: string } };
      setError(err?.data?.error || "Ошибка соединения");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-animated flex items-center justify-center relative overflow-hidden p-4">
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 20% 50%, rgba(155,89,255,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(0,212,255,0.08) 0%, transparent 60%)" }} />
      <div className="w-full max-w-md relative z-10 animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div style={{ width: 52, height: 52, background: "linear-gradient(135deg, #9b59ff, #00d4ff)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 30px rgba(155,89,255,0.5)" }}>
              <span style={{ fontSize: 28 }}>⚡</span>
            </div>
            <h1 className="text-4xl font-heading font-black grad-text">Folozoger</h1>
          </div>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Мессенджер нового поколения</p>
        </div>

        <div className="glass rounded-2xl p-8">
          <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: "rgba(0,0,0,0.3)" }}>
            {(["login", "register"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={mode === m ? { background: "linear-gradient(135deg, #9b59ff, #00d4ff)", color: "white", boxShadow: "0 0 15px rgba(155,89,255,0.4)" } : { color: "rgba(255,255,255,0.5)" }}>
                {m === "login" ? "Войти" : "Регистрация"}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 6, display: "block" }}>Имя пользователя</label>
              <input className="input-dark" placeholder="@username" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
            </div>
            {mode === "register" && (
              <div>
                <label style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 6, display: "block" }}>Отображаемое имя</label>
                <input className="input-dark" placeholder="Как тебя называть" value={displayName} onChange={e => setDisplayName(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
              </div>
            )}
            <div>
              <label style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 6, display: "block" }}>Пароль</label>
              <input className="input-dark" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
            </div>
            {error && <div style={{ background: "rgba(255,61,99,0.15)", border: "1px solid rgba(255,61,99,0.3)", borderRadius: 10, padding: "10px 14px", color: "#ff6b8a", fontSize: 13 }}>{error}</div>}
            <button className="btn-neon w-full py-3 rounded-xl text-base" onClick={submit} disabled={loading}>
              {loading ? "Загрузка..." : mode === "login" ? "Войти в Folozoger" : "Создать аккаунт"}
            </button>
          </div>
        </div>

        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center", marginTop: 16 }}>
          Входя, ты принимаешь правила Folozoger
        </p>
      </div>
    </div>
  );
}

// ─── Chat View ────────────────────────────────────────────────────────────────
function ChatView({ conv, me, onClose, onKick }: { conv: Conversation; me: User; onClose?: () => void; onKick?: (uid: number) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAdmin = me.username === "CoNNectioN";
  const canWrite = conv.type !== "channel" || isAdmin;

  const loadMessages = useCallback(async () => {
    try {
      const data = await api.messages.list(conv.id) as Message[];
      setMessages(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [conv.id]);

  useEffect(() => {
    loadMessages();
    const iv = setInterval(loadMessages, 3000);
    return () => clearInterval(iv);
  }, [loadMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  useEffect(() => {
    if (conv.type !== "direct") {
      api.conversations.members(conv.id).then(d => setMembers(d as User[])).catch(() => {});
    }
  }, [conv.id, conv.type]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await api.messages.send(conv.id, text.trim());
      setText("");
      await loadMessages();
    } catch (e: unknown) {
      const err = e as { data?: { error?: string } };
      alert(err?.data?.error || "Ошибка отправки");
    } finally { setSending(false); }
  };

  const removeMsg = async (msgId: number) => {
    try { await api.messages.remove(msgId); loadMessages(); } catch { /* silent */ }
  };

  const typeColor = conv.type === "channel" ? "#00d4ff" : conv.type === "group" ? "#9b59ff" : "#00ff88";
  const typeLabel = conv.type === "channel" ? "Канал" : conv.type === "group" ? "Группа" : "Чат";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 glass border-b border-white/10">
        {onClose && (
          <button onClick={onClose} className="lg:hidden mr-1 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <Icon name="ArrowLeft" size={20} />
          </button>
        )}
        <Avatar name={conv.name || "?"} size={40} src={conv.avatar_url} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate">{conv.name}</span>
            {conv.is_locked && <span className="locked-badge">🔒 закреплён</span>}
          </div>
          <div className="flex items-center gap-2">
            <span style={{ color: typeColor, fontSize: 11, fontWeight: 600 }}>{typeLabel}</span>
            {conv.member_count && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>· {conv.member_count} участников</span>}
          </div>
        </div>
        {conv.type !== "direct" && (
          <button onClick={() => setShowMembers(!showMembers)} className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Участники">
            <Icon name="Users" size={18} style={{ color: showMembers ? "#9b59ff" : "rgba(255,255,255,0.5)" }} />
          </button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Messages */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading && (
              <div className="flex justify-center py-8">
                <div style={{ width: 32, height: 32, border: "3px solid rgba(155,89,255,0.3)", borderTop: "3px solid #9b59ff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              </div>
            )}
            {!loading && messages.length === 0 && (
              <div className="text-center py-12 animate-fade-in">
                <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                <p style={{ color: "rgba(255,255,255,0.4)" }}>Пока нет сообщений</p>
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 13 }}>Будь первым!</p>
              </div>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.sender?.id === me.id;
              const showDate = i === 0 || formatDate(msg.created_at) !== formatDate(messages[i-1].created_at);
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="text-center my-3">
                      <span style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>{formatDate(msg.created_at)}</span>
                    </div>
                  )}
                  <div className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                    {!isMe && conv.type !== "direct" && (
                      <div className="mr-2 mt-1">
                        <Avatar name={msg.sender?.display_name || "?"} size={28} src={msg.sender?.avatar_url} />
                      </div>
                    )}
                    <div className="max-w-[70%]">
                      {!isMe && conv.type !== "direct" && (
                        <div style={{ color: "#9b59ff", fontSize: 11, fontWeight: 600, marginBottom: 2, paddingLeft: 4 }}>
                          {msg.sender?.display_name || msg.sender?.username}
                        </div>
                      )}
                      <div className={`relative px-3 py-2 ${isMe ? "msg-mine" : conv.type === "channel" ? "msg-channel" : "msg-other"}`}>
                        <p style={{ color: msg.is_removed ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 1.5, fontStyle: msg.is_removed ? "italic" : "normal", wordBreak: "break-word" }}>
                          {msg.content}
                        </p>
                        <div className="flex items-center justify-end gap-1.5 mt-1">
                          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{formatTime(msg.created_at)}</span>
                          {isMe && !msg.is_removed && <Icon name="CheckCheck" size={12} style={{ color: "#00d4ff" }} />}
                        </div>
                        {(isMe || isAdmin) && !msg.is_removed && (
                          <button onClick={() => removeMsg(msg.id)}
                            className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                            style={{ background: "rgba(255,61,99,0.8)", backdropFilter: "blur(8px)" }}
                            title="Удалить">
                            <Icon name="Trash2" size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {canWrite ? (
            <div className="p-3 glass border-t border-white/10">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    className="input-dark resize-none"
                    style={{ minHeight: 44, maxHeight: 120, paddingTop: 11, paddingBottom: 11 }}
                    placeholder="Написать сообщение..."
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    rows={1}
                  />
                </div>
                <button className="btn-neon px-4 py-2.5 rounded-xl" onClick={send} disabled={sending || !text.trim()} style={{ minWidth: 48 }}>
                  {sending ? <Icon name="Loader2" size={18} className="animate-spin" /> : <Icon name="Send" size={18} />}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center glass border-t border-white/10">
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                <Icon name="Lock" size={14} className="inline mr-1" />
                Только администратор канала может писать
              </p>
            </div>
          )}
        </div>

        {/* Members panel */}
        {showMembers && conv.type !== "direct" && (
          <div className="w-56 border-l border-white/10 flex flex-col animate-slide-in" style={{ background: "rgba(0,0,0,0.3)" }}>
            <div className="p-3 border-b border-white/10">
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1 }}>Участники · {members.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 group">
                  <Avatar name={m.display_name || m.username} size={28} src={m.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 12, color: "white", fontWeight: 500, truncate: true }}>{m.display_name || m.username}</div>
                    {(m as User & { role?: string }).role && (
                      <div style={{ fontSize: 10, color: (m as User & { role?: string }).role === "owner" ? "#ff3da6" : "#9b59ff" }}>
                        {(m as User & { role?: string }).role === "owner" ? "Владелец" : (m as User & { role?: string }).role === "admin" ? "Админ" : ""}
                      </div>
                    )}
                  </div>
                  {(isAdmin || conv.my_role === "owner" || conv.my_role === "admin") && m.id !== me.id && onKick && (
                    <button onClick={() => onKick(m.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded" title="Выгнать">
                      <Icon name="UserX" size={12} style={{ color: "#ff6b8a" }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Conversation Modal ────────────────────────────────────────────────
function CreateConvModal({ me, onClose, onCreate }: { me: User; onClose: () => void; onCreate: (conv: Conversation) => void }) {
  const [type, setType] = useState<"group" | "channel">("group");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) { setError("Введи название"); return; }
    setLoading(true); setError("");
    try {
      const data = await api.conversations.create({ type, name: name.trim(), description: desc.trim() }) as { id: number };
      onCreate({ id: data.id, type, name: name.trim(), description: desc.trim(), owner_id: me.id, my_role: "owner", member_count: 1 });
    } catch (e: unknown) {
      const err = e as { data?: { error?: string } };
      setError(err?.data?.error || "Ошибка");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <div className="glass rounded-2xl p-6 w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-heading font-bold text-white">Создать</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><Icon name="X" size={18} /></button>
        </div>

        <div className="flex gap-2 mb-5 p-1 rounded-xl" style={{ background: "rgba(0,0,0,0.3)" }}>
          {(["group", "channel"] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
              style={type === t ? { background: "linear-gradient(135deg, #9b59ff, #00d4ff)", color: "white" } : { color: "rgba(255,255,255,0.5)" }}>
              {t === "group" ? <><Icon name="Users" size={14} /> Группа</> : <><Icon name="Radio" size={14} /> Канал</>}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 6, display: "block" }}>Название</label>
            <input className="input-dark" placeholder={type === "group" ? "Название группы" : "Название канала"} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 6, display: "block" }}>Описание (необязательно)</label>
            <input className="input-dark" placeholder="О чём этот чат?" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          {error && <div style={{ color: "#ff6b8a", fontSize: 13 }}>{error}</div>}
          <button className="btn-neon w-full py-3 rounded-xl" onClick={submit} disabled={loading}>
            {loading ? "Создание..." : `Создать ${type === "group" ? "группу" : "канал"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Search Users Panel ───────────────────────────────────────────────────────
function SearchPanel({ me, onStartChat, onClose }: { me: User; onStartChat: (conv: Conversation) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try { setResults(await api.users.search(q) as User[]); }
      catch { /* silent */ }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const startChat = async (user: User) => {
    try {
      const data = await api.conversations.direct(user.id) as { id: number };
      onStartChat({ id: data.id, type: "direct", name: user.display_name || user.username });
      onClose();
    } catch { /* silent */ }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><Icon name="ArrowLeft" size={18} /></button>
          <h3 className="font-semibold text-white">Поиск пользователей</h3>
        </div>
        <input className="input-dark" placeholder="Найти по имени или нику..." value={q} onChange={e => setQ(e.target.value)} autoFocus />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading && <div className="text-center py-6 text-white/40 text-sm">Поиск...</div>}
        {!loading && q && results.length === 0 && <div className="text-center py-6 text-white/40 text-sm">Никого не нашли</div>}
        {results.map(u => (
          <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all group" onClick={() => startChat(u)}>
            <Avatar name={u.display_name || u.username} size={44} src={u.avatar_url} />
            <div className="flex-1">
              <div className="font-semibold text-white text-sm">{u.display_name}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>@{u.username}</div>
              {u.bio && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>{u.bio}</div>}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Icon name="MessageCircle" size={16} style={{ color: "#9b59ff" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Profile & Settings Panel ─────────────────────────────────────────────────
function ProfilePanel({ me, onUpdate, onLogout }: { me: User; onUpdate: (u: Partial<User>) => void; onLogout: () => void }) {
  const [displayName, setDisplayName] = useState(me.display_name);
  const [bio, setBio] = useState(me.bio || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.auth.updateProfile({ display_name: displayName, bio });
      onUpdate({ display_name: displayName, bio });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const logout = async () => {
    try { await api.auth.logout(); } catch { /* silent */ }
    localStorage.removeItem("folozoger_token");
    onLogout();
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto">
      <h3 className="text-lg font-heading font-bold text-white mb-6">Профиль и настройки</h3>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <Avatar name={me.display_name || me.username} size={88} src={me.avatar_url} />
          <div className="online-dot absolute bottom-1 right-1" />
        </div>
        <h2 className="text-xl font-bold text-white mt-3">{me.display_name}</h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>@{me.username}</p>
        {me.username === "CoNNectioN" && (
          <div className="mt-2 px-3 py-1 rounded-full text-xs font-bold" style={{ background: "linear-gradient(135deg, #ff3da6, #9b59ff)", color: "white" }}>
            👑 Администратор
          </div>
        )}
      </div>

      {/* Edit form */}
      <div className="glass rounded-2xl p-5 space-y-4 mb-4">
        <h4 className="font-semibold text-white/70 text-sm uppercase tracking-wider">Редактировать профиль</h4>
        <div>
          <label style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 6, display: "block" }}>Отображаемое имя</label>
          <input className="input-dark" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 6, display: "block" }}>О себе</label>
          <textarea className="input-dark resize-none" rows={3} placeholder="Расскажи о себе..." value={bio} onChange={e => setBio(e.target.value)} />
        </div>
        <button className="btn-neon w-full py-2.5 rounded-xl" onClick={save} disabled={saving}>
          {saved ? "✓ Сохранено!" : saving ? "Сохраняем..." : "Сохранить изменения"}
        </button>
      </div>

      {/* Settings */}
      <div className="glass rounded-2xl p-5 mb-4">
        <h4 className="font-semibold text-white/70 text-sm uppercase tracking-wider mb-4">Настройки</h4>
        {[
          { icon: "Bell", label: "Уведомления", value: "Включены" },
          { icon: "Palette", label: "Тема", value: "Тёмная неон" },
          { icon: "Globe", label: "Язык", value: "Русский" },
          { icon: "Shield", label: "Конфиденциальность", value: "Настроить" },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
            <div className="flex items-center gap-3">
              <Icon name={item.icon as "Bell"} size={16} style={{ color: "#9b59ff" }} />
              <span style={{ color: "white", fontSize: 14 }}>{item.label}</span>
            </div>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{item.value}</span>
          </div>
        ))}
      </div>

      <button onClick={logout} className="w-full py-3 rounded-xl font-semibold transition-all" style={{ background: "rgba(255,61,99,0.15)", border: "1px solid rgba(255,61,99,0.3)", color: "#ff6b8a" }}>
        <Icon name="LogOut" size={16} className="inline mr-2" />
        Выйти из аккаунта
      </button>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel() {
  const [tab, setTab] = useState<"stats" | "users" | "convs">("stats");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<(User & { is_banned?: boolean })[]>([]);
  const [convs, setConvs] = useState<(Conversation & { message_count?: number; created_at?: string })[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    if (tab === "stats") api.admin.stats().then(d => setStats(d as AdminStats)).catch(() => {}).finally(() => setLoading(false));
    if (tab === "users") api.admin.users().then(d => setUsers(d as typeof users)).catch(() => {}).finally(() => setLoading(false));
    if (tab === "convs") api.admin.conversations().then(d => setConvs(d as typeof convs)).catch(() => {}).finally(() => setLoading(false));
  }, [tab]);

  const ban = async (uid: number) => {
    await api.admin.ban(uid);
    setUsers(u => u.map(x => x.id === uid ? { ...x, is_banned: true } : x));
  };
  const unban = async (uid: number) => {
    await api.admin.unban(uid);
    setUsers(u => u.map(x => x.id === uid ? { ...x, is_banned: false } : x));
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <div style={{ width: 40, height: 40, background: "linear-gradient(135deg, #ff3da6, #9b59ff)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="Shield" size={20} />
        </div>
        <div>
          <h3 className="text-lg font-heading font-bold text-white">Админ-панель</h3>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Только для CoNNectioN</p>
        </div>
      </div>

      <div className="flex gap-1.5 mb-5 p-1 rounded-xl" style={{ background: "rgba(0,0,0,0.4)" }}>
        {([["stats","Статистика"],["users","Пользователи"],["convs","Чаты"]] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
            style={tab === t ? { background: "linear-gradient(135deg, #ff3da6, #9b59ff)", color: "white" } : { color: "rgba(255,255,255,0.5)" }}>
            {l}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-8 text-white/40">Загрузка...</div>}

      {tab === "stats" && stats && !loading && (
        <div className="grid grid-cols-2 gap-3 animate-fade-in">
          {[
            { label: "Пользователи", value: stats.users, icon: "Users", color: "#9b59ff" },
            { label: "Сообщения", value: stats.messages, icon: "MessageSquare", color: "#00d4ff" },
            { label: "Группы", value: stats.groups, icon: "UsersRound", color: "#ff3da6" },
            { label: "Каналы", value: stats.channels, icon: "Radio", color: "#00ff88" },
          ].map(item => (
            <div key={item.label} className="glass rounded-2xl p-4 text-center">
              <Icon name={item.icon as "Users"} size={28} style={{ color: item.color, margin: "0 auto 8px" }} />
              <div className="text-3xl font-black text-white font-heading" style={{ color: item.color }}>{item.value}</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && !loading && (
        <div className="space-y-2 animate-fade-in">
          {users.map(u => (
            <div key={u.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <Avatar name={u.display_name || u.username} size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">{u.display_name} <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>@{u.username}</span></div>
                {u.is_banned && <span className="locked-badge">Заблокирован</span>}
              </div>
              {u.username !== "CoNNectioN" && (
                <button onClick={() => u.is_banned ? unban(u.id) : ban(u.id)}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                  style={u.is_banned ? { background: "rgba(0,255,136,0.15)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.3)" } : { background: "rgba(255,61,99,0.15)", color: "#ff6b8a", border: "1px solid rgba(255,61,99,0.3)" }}>
                  {u.is_banned ? "Разбан" : "Бан"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "convs" && !loading && (
        <div className="space-y-2 animate-fade-in">
          {convs.map(c => (
            <div key={c.id} className="glass rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: c.type === "channel" ? "#00d4ff" : "#9b59ff", fontSize: 12 }}>
                  {c.type === "channel" ? "📡 Канал" : c.type === "group" ? "👥 Группа" : "💬 Чат"}
                </span>
                {c.is_locked && <span className="locked-badge">🔒</span>}
              </div>
              <div className="text-sm font-semibold text-white">{c.name}</div>
              <div className="flex gap-3 mt-1">
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>👥 {c.member_count}</span>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>💬 {c.message_count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Discover Panel (публичные чаты) ─────────────────────────────────────────
function DiscoverPanel({ me, onJoin }: { me: User; onJoin: (conv: Conversation) => void }) {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.conversations.public().then(d => setConvs(d as Conversation[])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const join = async (conv: Conversation) => {
    try {
      await api.conversations.join(conv.id);
      onJoin(conv);
    } catch (e: unknown) {
      const err = e as { data?: { error?: string } };
      alert(err?.data?.error || "Ошибка");
    }
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto">
      <h3 className="text-lg font-heading font-bold text-white mb-5">Обзор</h3>
      {loading && <div className="text-center py-8 text-white/40">Загрузка...</div>}
      <div className="space-y-3">
        {convs.map(c => (
          <div key={c.id} className="glass rounded-2xl p-4 hover-scale cursor-pointer" onClick={() => join(c)}>
            <div className="flex items-start gap-3">
              <div style={{ width: 48, height: 48, background: c.type === "channel" ? "linear-gradient(135deg, #00d4ff, #9b59ff)" : "linear-gradient(135deg, #9b59ff, #ff3da6)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                {c.type === "channel" ? "📡" : "👥"}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">{c.name}</div>
                {c.description && <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>{c.description}</div>}
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 4 }}>👥 {c.member_count} участников</div>
              </div>
              <button className="btn-neon text-xs px-3 py-1.5 rounded-lg" onClick={e => { e.stopPropagation(); join(c); }}>
                Вступить
              </button>
            </div>
          </div>
        ))}
        {!loading && convs.length === 0 && (
          <div className="text-center py-12 text-white/40">
            <div style={{ fontSize: 48, marginBottom: 8 }}>🌐</div>
            <p>Пока нет публичных чатов</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
type Panel = "chats" | "discover" | "contacts" | "profile" | "admin" | "search";

export default function Index() {
  const [me, setMe] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [panel, setPanel] = useState<Panel>("chats");
  const [showCreate, setShowCreate] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  // Auth check
  useEffect(() => {
    const t = localStorage.getItem("folozoger_token");
    if (!t) { setLoading(false); return; }
    setToken(t);
    api.auth.me().then(u => { setMe(u as User); }).catch(() => { localStorage.removeItem("folozoger_token"); }).finally(() => setLoading(false));
  }, []);

  // Load conversations
  useEffect(() => {
    if (!me) return;
    const load = () => api.conversations.list().then(d => setConversations(d as Conversation[])).catch(() => {});
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [me]);

  const handleAuth = (user: User, tok: string) => { setMe(user); setToken(tok); };
  const handleLogout = () => { setMe(null); setToken(null); setConversations([]); setActiveConv(null); };

  const selectConv = (conv: Conversation) => {
    setActiveConv(conv);
    setPanel("chats");
    setMobileShowChat(true);
  };

  const handleKick = async (userId: number) => {
    if (!activeConv) return;
    try { await api.conversations.kick(activeConv.id, userId); } catch { /* silent */ }
  };

  const handleLeave = async (conv: Conversation) => {
    if (conv.is_locked) { alert("Из этого канала нельзя выйти"); return; }
    try {
      await api.conversations.leave(conv.id);
      setConversations(c => c.filter(x => x.id !== conv.id));
      if (activeConv?.id === conv.id) setActiveConv(null);
    } catch (e: unknown) {
      const err = e as { data?: { error?: string } };
      alert(err?.data?.error || "Ошибка");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-animated flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <div className="text-5xl mb-4 font-heading font-black grad-text">Folozoger</div>
        <div style={{ width: 40, height: 40, border: "3px solid rgba(155,89,255,0.3)", borderTop: "3px solid #9b59ff", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!me) return <AuthScreen onAuth={handleAuth} />;

  const isAdmin = me.username === "CoNNectioN";

  const navItems: { id: Panel; icon: string; label: string }[] = [
    { id: "chats", icon: "MessageSquare", label: "Чаты" },
    { id: "discover", icon: "Compass", label: "Обзор" },
    { id: "contacts", icon: "Users", label: "Контакты" },
    { id: "search", icon: "Search", label: "Поиск" },
    { id: "profile", icon: "User", label: "Профиль" },
    ...(isAdmin ? [{ id: "admin" as Panel, icon: "Shield", label: "Админ" }] : []),
  ];

  const typeIcon = (type: string, locked?: boolean) => {
    if (type === "direct") return "💬";
    if (type === "group") return "👥";
    return locked ? "🔒" : "📡";
  };

  return (
    <div className="h-screen bg-animated flex overflow-hidden" style={{ fontFamily: "'Golos Text', sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {showCreate && <CreateConvModal me={me} onClose={() => setShowCreate(false)} onCreate={conv => { setConversations(c => [conv, ...c]); setActiveConv(conv); setShowCreate(false); setMobileShowChat(true); }} />}

      {/* ── Sidebar (Left) ── */}
      <div className={`flex flex-col glass border-r border-white/10 ${mobileShowChat ? "hidden lg:flex" : "flex"}`} style={{ width: 72, minWidth: 72 }}>
        {/* Logo */}
        <div className="flex items-center justify-center py-5 border-b border-white/10">
          <div style={{ width: 42, height: 42, background: "linear-gradient(135deg, #9b59ff, #00d4ff)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 0 20px rgba(155,89,255,0.4)" }}>⚡</div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col items-center gap-1 py-4 flex-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setPanel(item.id); setMobileShowChat(false); }}
              title={item.label}
              className="w-12 h-12 flex flex-col items-center justify-center rounded-xl transition-all relative"
              style={panel === item.id ? { background: "linear-gradient(135deg, rgba(155,89,255,0.3), rgba(0,212,255,0.1))", boxShadow: "0 0 15px rgba(155,89,255,0.2)" } : { color: "rgba(255,255,255,0.4)" }}>
              <Icon name={item.icon as "MessageSquare"} size={20} style={{ color: panel === item.id ? (item.id === "admin" ? "#ff3da6" : "#9b59ff") : undefined }} />
              <span style={{ fontSize: 8, marginTop: 2, color: panel === item.id ? "#9b59ff" : "rgba(255,255,255,0.3)" }}>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User avatar */}
        <div className="flex justify-center py-4 border-t border-white/10">
          <button onClick={() => { setPanel("profile"); setMobileShowChat(false); }}>
            <Avatar name={me.display_name || me.username} size={38} src={me.avatar_url} />
          </button>
        </div>
      </div>

      {/* ── Conversations List ── */}
      <div className={`flex flex-col border-r border-white/10 ${mobileShowChat ? "hidden lg:flex" : panel === "chats" ? "flex" : "hidden lg:flex"}`}
        style={{ width: 280, minWidth: 280, background: "rgba(0,0,0,0.2)" }}>
        {panel === "chats" && (
          <>
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading font-bold text-white text-lg">Сообщения</h2>
                <button onClick={() => setShowCreate(true)} className="btn-neon p-2 rounded-xl" title="Новый чат">
                  <Icon name="Plus" size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {conversations.length === 0 && (
                <div className="text-center py-12 px-4">
                  <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Нет чатов</p>
                  <button onClick={() => setShowCreate(true)} className="btn-neon px-4 py-2 rounded-xl text-sm mt-4">Создать чат</button>
                </div>
              )}
              {conversations.map(conv => (
                <div key={conv.id}
                  className={`flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl cursor-pointer transition-all group ${activeConv?.id === conv.id ? "active sidebar-item" : "sidebar-item"}`}
                  onClick={() => selectConv(conv)}>
                  <div style={{ position: "relative" }}>
                    {conv.avatar_url ? (
                      <Avatar name={conv.name} size={44} src={conv.avatar_url} />
                    ) : (
                      <div style={{ width: 44, height: 44, background: conv.type === "channel" ? "linear-gradient(135deg, #00d4ff, #9b59ff)" : conv.type === "group" ? "linear-gradient(135deg, #9b59ff, #ff3da6)" : "linear-gradient(135deg, #ff3da6, #ff6b35)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                        {typeIcon(conv.type, conv.is_locked)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-sm truncate">{conv.name}</span>
                      {conv.is_locked && <Icon name="Lock" size={11} style={{ color: "#ff3da6", minWidth: 11 }} />}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                      {conv.type === "direct" ? "Личный чат" : conv.type === "group" ? `👥 ${conv.member_count || 0}` : `📡 ${conv.member_count || 0}`}
                    </div>
                  </div>
                  {!conv.is_locked && conv.name !== "Новости Folozoger" && (
                    <button onClick={e => { e.stopPropagation(); handleLeave(conv); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-opacity"
                      style={{ color: "rgba(255,255,255,0.4)" }} title="Выйти">
                      <Icon name="LogOut" size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {panel === "search" && <SearchPanel me={me} onStartChat={selectConv} onClose={() => setPanel("chats")} />}
        {panel === "contacts" && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-heading font-bold text-white text-lg">Контакты</h3>
            </div>
            <ContactsList me={me} onChat={selectConv} />
          </div>
        )}
        {panel === "discover" && <DiscoverPanel me={me} onJoin={conv => { setConversations(c => c.find(x => x.id === conv.id) ? c : [conv, ...c]); selectConv(conv); }} />}
        {panel === "profile" && <ProfilePanel me={me} onUpdate={u => setMe(m => m ? { ...m, ...u } : m)} onLogout={handleLogout} />}
        {panel === "admin" && isAdmin && <AdminPanel />}
      </div>

      {/* ── Chat Area ── */}
      <div className={`flex-1 flex flex-col min-w-0 ${!mobileShowChat && "hidden lg:flex"}`}>
        {activeConv && panel === "chats" ? (
          <ChatView conv={activeConv} me={me} onClose={() => { setMobileShowChat(false); }} onKick={handleKick} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">
            <div style={{ width: 100, height: 100, background: "linear-gradient(135deg, rgba(155,89,255,0.2), rgba(0,212,255,0.1))", borderRadius: 30, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, marginBottom: 24, border: "1px solid rgba(155,89,255,0.2)" }}>⚡</div>
            <h2 className="text-2xl font-heading font-black grad-text mb-2">Folozoger</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Выбери чат или начни новый</p>
            <div className="flex gap-3 mt-6">
              <button className="btn-neon px-5 py-2.5 rounded-xl text-sm" onClick={() => setShowCreate(true)}>
                <Icon name="Plus" size={16} className="inline mr-2" />Создать чат
              </button>
              <button className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }} onClick={() => { setPanel("search"); setMobileShowChat(false); }}>
                <Icon name="Search" size={16} className="inline mr-2" />Найти людей
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Contacts List ────────────────────────────────────────────────────────────
function ContactsList({ me, onChat }: { me: User; onChat: (conv: Conversation) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.users.all().then(d => setUsers((d as User[]).filter(u => u.id !== me.id))).catch(() => {}).finally(() => setLoading(false));
  }, [me.id]);

  const startChat = async (user: User) => {
    try {
      const data = await api.conversations.direct(user.id) as { id: number };
      onChat({ id: data.id, type: "direct", name: user.display_name || user.username });
    } catch { /* silent */ }
  };

  if (loading) return <div className="text-center py-8 text-white/40 text-sm">Загрузка...</div>;

  return (
    <div className="flex-1 overflow-y-auto p-2">
      {users.length === 0 && <div className="text-center py-8 text-white/40 text-sm">Нет пользователей</div>}
      {users.map(u => (
        <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all" onClick={() => startChat(u)}>
          <div className="relative">
            <Avatar name={u.display_name || u.username} size={42} src={u.avatar_url} />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-white text-sm">{u.display_name}</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>@{u.username}</div>
          </div>
          <Icon name="MessageCircle" size={16} style={{ color: "#9b59ff" }} />
        </div>
      ))}
    </div>
  );
}
