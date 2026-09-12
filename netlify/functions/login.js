// POST /api/login  — verifies the admin password on the SERVER and issues
// a signed, HttpOnly session cookie. The password is never stored in any
// file the browser can read; it lives only in the ADMIN_PASSWORD env var.
const crypto = require("crypto");

function sign(payloadB64, secret) {
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function makeToken(secret, hours) {
  const payload = { exp: Date.now() + hours * 3600 * 1000 };
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return p + "." + sign(p, secret);
}

function parseBody(event) {
  let body = event.body || "";
  if (event.isBase64Encoded) body = Buffer.from(body, "base64").toString("utf8");
  const ct = event.headers["content-type"] || event.headers["Content-Type"] || "";
  if (ct.includes("application/json")) {
    try { return JSON.parse(body); } catch { return {}; }
  }
  const params = new URLSearchParams(body);
  const o = {};
  for (const [k, v] of params) o[k] = v;
  return o;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  const secret = process.env.SESSION_SECRET;
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!secret || !adminPw) {
    return { statusCode: 500, body: "Server not configured: set ADMIN_PASSWORD and SESSION_SECRET." };
  }

  const { password } = parseBody(event);
  const a = Buffer.from(String(password || ""));
  const b = Buffer.from(String(adminPw));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) {
    return { statusCode: 302, headers: { Location: "/login.html?error=1", "Cache-Control": "no-store" } };
  }

  const token = makeToken(secret, 8); // session valid for 8 hours
  const cookie = `pg_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${8 * 3600}`;
  return {
    statusCode: 302,
    headers: { Location: "/admin", "Set-Cookie": cookie, "Cache-Control": "no-store" },
  };
};
