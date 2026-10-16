// ScalpGOD landing page: serves the static site and stores waitlist sign-ups in Workers KV.
//
// Bindings (see wrangler.jsonc):
//   ASSETS    the static files in ./public
//   WAITLIST  a KV namespace. Keys:  tg:<username>  ->  {"telegram","email","at","country"}
//                                    rl:<ip>        ->  sign-up attempts this hour (expires)
//
// Read the list:  npx wrangler kv key list --binding WAITLIST --prefix tg: --remote

const TG = /^[a-z][a-z0-9_]{4,31}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const MAX_PER_HOUR = 5;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

async function readBody(request) {
  const type = request.headers.get("Content-Type") || "";
  if (type.includes("application/json")) return request.json();
  const form = await request.formData();       // plain HTML form, when JavaScript is off
  return Object.fromEntries(form.entries());
}

async function joinWaitlist(request, env) {
  const wantsJson = (request.headers.get("Accept") || "").includes("application/json");
  const reply = (ok, error, status) =>
    wantsJson
      ? json(ok ? { ok: true } : { ok: false, error }, status)
      : Response.redirect(new URL(`/?joined=${ok ? 1 : 0}#waitlist`, request.url).toString(), 303);

  let body;
  try { body = await readBody(request); } catch { return reply(false, "That didn't go through. Try again.", 400); }

  // Bots fill every field, including the hidden one. Pretend it worked and store nothing.
  if (body.website) return reply(true);

  // Telegram usernames are case-insensitive, so store them lowercased without the @
  const telegram = String(body.telegram || "").trim().replace(/^@/, "").toLowerCase();
  const email = String(body.email || "").trim().toLowerCase();
  if (!TG.test(telegram)) return reply(false, "Enter your Telegram username, like @yourname. It's 5 to 32 letters, numbers or underscores.", 400);
  if (email && (email.length > 254 || !EMAIL.test(email))) return reply(false, "That email doesn't look right. Fix it, or leave it blank.", 400);

  // A light limit per IP address, so the list can't be flooded
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rlKey = `rl:${ip}`;
  const tries = parseInt((await env.WAITLIST.get(rlKey)) || "0", 10);
  if (tries >= MAX_PER_HOUR) return reply(false, "Too many tries from this connection. Try again in an hour.", 429);
  await env.WAITLIST.put(rlKey, String(tries + 1), { expirationTtl: 3600 });

  // One record per username. Signing up twice is fine and says nothing about who is already on the list.
  const key = `tg:${telegram}`;
  if (!(await env.WAITLIST.get(key))) {
    await env.WAITLIST.put(key, JSON.stringify({
      telegram: "@" + telegram, email: email || null, at: new Date().toISOString(), country: request.cf?.country || null,
    }));
  }
  return reply(true);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/waitlist") {
      if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
      return joinWaitlist(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
