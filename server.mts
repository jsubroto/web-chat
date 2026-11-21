const members = new Set<{ username: string }>();

const clean = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const publishUsers = () =>
  server.publish("chat", JSON.stringify({ type: "users", users: [...members].map(({ username }) => username) }));

const server = Bun.serve({
  port: process.env.PORT ?? 3000,
  fetch(req) {
    if (server.upgrade(req, { data: { username: "" } })) return;
    if (new URL(req.url).pathname === "/") return new Response(Bun.file(`${import.meta.dir}/index.html`));
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    maxPayloadLength: 16 * 1024,
    message(ws, raw) {
      let event;
      try {
        event = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (event?.type === "join" && !ws.data.username) {
        const username = clean(event.username, 32);
        if (!username) return;
        ws.data.username = username;
        members.add(ws.data);
        ws.subscribe("chat");
        publishUsers();
      } else if (event?.type === "message" && ws.data.username) {
        const text = clean(event.text, 2000);
        if (!text) return;
        server.publish("chat", JSON.stringify({ type: "message", user: ws.data.username, text }));
      }
    },
    close(ws) {
      if (members.delete(ws.data)) publishUsers();
    },
  },
});

console.log(`Server running at ${server.url}`);
