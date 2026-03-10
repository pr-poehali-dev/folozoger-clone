const URLS = {
  auth: "https://functions.poehali.dev/d79bc6ee-518d-41d2-a86a-401b23581b47",
  users: "https://functions.poehali.dev/eb847e9e-55f1-4dc5-bd1f-1e5f87155adc",
  conversations: "https://functions.poehali.dev/96835baa-d49b-4958-ac17-4e382a1936fd",
  messages: "https://functions.poehali.dev/897e2d1f-3025-4117-83da-85f0de38eb98",
  admin: "https://functions.poehali.dev/4743fc55-f24d-4820-a94b-cc2ed56170f4",
};

function getToken(): string | null {
  return localStorage.getItem("folozoger_token");
}

async function request(base: keyof typeof URLS, path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["X-Auth-Token"] = token;

  const res = await fetch(`${URLS[base]}${path}`, { ...options, headers });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw { status: res.status, data };
  return data;
}

export const api = {
  auth: {
    register: (username: string, display_name: string, password: string) =>
      request("auth", "/register", { method: "POST", body: JSON.stringify({ username, display_name, password }) }),
    login: (username: string, password: string) =>
      request("auth", "/login", { method: "POST", body: JSON.stringify({ username, password }) }),
    logout: () => request("auth", "/logout", { method: "POST" }),
    me: () => request("auth", "/me"),
    updateProfile: (data: { display_name?: string; bio?: string }) =>
      request("auth", "/profile", { method: "PUT", body: JSON.stringify(data) }),
  },
  users: {
    search: (q: string) => request("users", `/search?q=${encodeURIComponent(q)}`),
    all: () => request("users", "/all"),
    get: (id: number) => request("users", `/${id}`),
    block: (user_id: number) => request("users", "/block", { method: "POST", body: JSON.stringify({ user_id }) }),
    unblock: (user_id: number) => request("users", "/unblock", { method: "POST", body: JSON.stringify({ user_id }) }),
  },
  conversations: {
    list: () => request("conversations", "/list"),
    public: () => request("conversations", "/public"),
    create: (data: { type: string; name: string; description?: string; members?: number[] }) =>
      request("conversations", "/create", { method: "POST", body: JSON.stringify(data) }),
    join: (conversation_id: number) =>
      request("conversations", "/join", { method: "POST", body: JSON.stringify({ conversation_id }) }),
    leave: (conversation_id: number) =>
      request("conversations", "/leave", { method: "POST", body: JSON.stringify({ conversation_id }) }),
    members: (conversation_id: number) =>
      request("conversations", `/members?conversation_id=${conversation_id}`),
    kick: (conversation_id: number, user_id: number) =>
      request("conversations", "/kick", { method: "POST", body: JSON.stringify({ conversation_id, user_id }) }),
    direct: (user_id: number) =>
      request("conversations", "/direct", { method: "POST", body: JSON.stringify({ user_id }) }),
    update: (conversation_id: number, data: { name?: string; description?: string }) =>
      request("conversations", "/update", { method: "PUT", body: JSON.stringify({ conversation_id, ...data }) }),
  },
  messages: {
    list: (conversation_id: number, offset = 0) =>
      request("messages", `/list?conversation_id=${conversation_id}&offset=${offset}`),
    send: (conversation_id: number, content: string) =>
      request("messages", "/send", { method: "POST", body: JSON.stringify({ conversation_id, content }) }),
    remove: (message_id: number) =>
      request("messages", "/remove", { method: "POST", body: JSON.stringify({ message_id }) }),
  },
  admin: {
    stats: () => request("admin", "/stats"),
    users: () => request("admin", "/users"),
    conversations: () => request("admin", "/conversations"),
    ban: (user_id: number) => request("admin", "/ban", { method: "POST", body: JSON.stringify({ user_id }) }),
    unban: (user_id: number) => request("admin", "/unban", { method: "POST", body: JSON.stringify({ user_id }) }),
    deleteMessage: (message_id: number) =>
      request("admin", "/delete_message", { method: "POST", body: JSON.stringify({ message_id }) }),
    allMessages: (conversation_id: number) =>
      request("admin", `/all_messages?conversation_id=${conversation_id}`),
  },
};

export { getToken };
