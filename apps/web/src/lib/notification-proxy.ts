const routes: Record<string, string[]> = {
  "/healthz": ["GET"], "/auth/nonce": ["POST"], "/auth/siws": ["POST"],
  "/auth/logout": ["POST"], "/me": ["GET", "PATCH", "DELETE"], "/me/verify-email": ["POST"],
};
const jsonError = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/** Fixed backend routes only. Session cookies stay on the frontend origin. */
export async function notificationProxy(request: Request, path: string, base: string | undefined, production = true, send: typeof fetch = fetch): Promise<Response> {
  if (!routes[path]?.includes(request.method)) return jsonError("This settings route is unavailable.", 404);
  // Next may reconstruct the internal URL with localhost behind its server.
  // The HTTP Host identifies the browser-facing origin; production uses HTTPS.
  const internal = new URL(request.url);
  let browserOrigin: string;
  try { browserOrigin = new URL(`${production ? "https:" : internal.protocol}//${request.headers.get("host") ?? internal.host}`).origin; }
  catch { return jsonError("Request origin is not allowed.", 403); }
  if (request.method !== "GET" && request.headers.get("origin") !== browserOrigin) return jsonError("Request origin is not allowed.", 403);
  if (!base) return jsonError("Email settings are not connected yet.", 503);
  let upstream: URL;
  try {
    upstream = new URL(base);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(upstream.hostname);
    if (upstream.username || upstream.password || upstream.pathname !== "/" || upstream.search || upstream.hash || (upstream.protocol !== "https:" && !(upstream.protocol === "http:" && local && !production))) throw new Error();
  } catch { return jsonError("Email settings are not connected yet.", 503); }
  const headers = new Headers({ "Accept": "application/json" });
  headers.set("Origin", browserOrigin);
  const cookies = (request.headers.get("cookie") ?? "").split(";").map(v => v.trim()).filter(v => /^(?:__Host-afterkey-session|afterkey-session)=[A-Za-z0-9_-]{43}$/.test(v));
  if (cookies.length) headers.set("Cookie", cookies.join("; "));
  let body: string | undefined;
  if (request.method !== "GET" && request.body) {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return jsonError("A JSON request is required.", 415);
    const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.length;
      if (length > 8192) { await reader.cancel(); return jsonError("Settings request is too large.", 413); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    body = new TextDecoder().decode(bytes); headers.set("Content-Type", "application/json");
  }
  try {
    const response = await send(new URL(path, upstream), { method: request.method, headers, body, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (response.status >= 300 && response.status < 400) return jsonError("Email settings are temporarily unavailable.", 503);
    const replyHeaders = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
    for (const cookie of response.headers.getSetCookie()) if (/^(?:__Host-afterkey-session|afterkey-session)=/.test(cookie) && /;\s*HttpOnly/i.test(cookie)) replyHeaders.append("Set-Cookie", cookie);
    const result = await response.json();
    return Response.json(result, { status: response.status, headers: replyHeaders });
  } catch { return jsonError("Email settings are temporarily unavailable. Try again shortly.", 503); }
}
