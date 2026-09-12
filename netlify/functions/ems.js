// /api/ems — SERVER-SIDE gated Employee Management System API.
// Stores employee records (JSON) and their document/photo files in
// Netlify Blobs. Every request requires the signed pg_session cookie
// (same auth used by the admin dashboard).
const crypto = require("crypto");

// ── Auth (same scheme as app.js / login.js) ──────────────────────
function verify(token, secret) {
  if (!token || token.indexOf(".") === -1) return false;
  const idx = token.indexOf(".");
  const p = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac("sha256", secret).update(p).digest("base64url");
  const A = Buffer.from(sig), B = Buffer.from(expected);
  if (A.length !== B.length || !crypto.timingSafeEqual(A, B)) return false;
  try {
    const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    return !!payload.exp && Date.now() < payload.exp;
  } catch { return false; }
}
function getCookie(event, name) {
  const h = event.headers.cookie || event.headers.Cookie || "";
  const part = h.split(/;\s*/).find((c) => c.indexOf(name + "=") === 0);
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

// ── Helpers ──────────────────────────────────────────────────────
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
};
function json(statusCode, obj) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(obj) };
}
function parseBody(event) {
  let body = event.body || "";
  if (event.isBase64Encoded) body = Buffer.from(body, "base64").toString("utf8");
  try { return JSON.parse(body); } catch { return {}; }
}
function safeId(s) { return String(s || "").replace(/[^A-Za-z0-9_\-]/g, ""); }

// Basic mime sniffing fallback by extension.
function guessMime(name, fallback) {
  const n = String(name || "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".doc")) return "application/msword";
  if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (n.endsWith(".txt")) return "text/plain; charset=utf-8";
  return fallback || "application/octet-stream";
}

exports.handler = async (event) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return json(500, { error: "Server not configured: set SESSION_SECRET." });
  if (!verify(getCookie(event, "pg_session"), secret)) {
    return json(401, { error: "Not authenticated." });
  }

  // Netlify Blobs is ESM-only; load it via dynamic import from CommonJS.
  let getStore;
  try {
    ({ getStore } = await import("@netlify/blobs"));
  } catch (e) {
    return json(500, { error: "Storage library unavailable: " + (e && e.message) });
  }
  let records, files;
  try {
    records = getStore({ name: "ems-records", consistency: "strong" });
    files = getStore({ name: "ems-files", consistency: "strong" });
  } catch (e) {
    return json(500, { error: "Storage not available. Enable Netlify Blobs for this site. (" + (e && e.message) + ")" });
  }

  const qs = event.queryStringParameters || {};
  const action = qs.action || (event.httpMethod === "POST" ? (parseBody(event).action || "save") : "list");

  try {
    // ── Serve / download a stored file ──────────────────────────
    if (action === "file") {
      const key = qs.key;
      if (!key) return json(400, { error: "Missing key." });
      const res = await files.getWithMetadata(key, { type: "arrayBuffer" });
      if (!res || !res.data) return json(404, { error: "File not found." });
      const meta = res.metadata || {};
      const mime = meta.mime || guessMime(meta.filename, "application/octet-stream");
      const buf = Buffer.from(res.data);
      const headers = {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      };
      if (qs.download) {
        const fn = (meta.filename || "file").replace(/[^A-Za-z0-9._\- ]/g, "_");
        headers["Content-Disposition"] = 'attachment; filename="' + fn + '"';
      }
      return { statusCode: 200, headers, body: buf.toString("base64"), isBase64Encoded: true };
    }

    // ── List all employees (summary only) ───────────────────────
    if (action === "list") {
      const { blobs } = await records.list();
      const out = [];
      for (const b of blobs) {
        const r = await records.get(b.key, { type: "json" });
        if (!r) continue;
        out.push({
          id: r.id, fullName: r.fullName, designation: r.designation,
          employeeCode: r.employeeCode, department: r.department,
          phone: r.phone, photoKey: r.photoKey || null,
          createdAt: r.createdAt, updatedAt: r.updatedAt,
        });
      }
      out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return json(200, { employees: out });
    }

    // ── Get one full employee record ────────────────────────────
    if (action === "get") {
      const id = safeId(qs.id);
      if (!id) return json(400, { error: "Missing id." });
      const r = await records.get(id, { type: "json" });
      if (!r) return json(404, { error: "Employee not found." });
      return json(200, { employee: r });
    }

    // ── Upload a file (photo / document / dependent photo) ──────
    if (action === "upload") {
      const b = parseBody(event);
      const empId = safeId(b.id);
      if (!empId) return json(400, { error: "Missing employee id." });
      if (!b.dataB64) return json(400, { error: "Missing file data." });
      const buf = Buffer.from(b.dataB64, "base64");
      if (buf.length > 8 * 1024 * 1024) return json(413, { error: "File too large (max 8 MB)." });
      const kind = (b.kind || "doc").replace(/[^a-z]/g, "");
      const key = "files/" + empId + "/" + kind + "-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex");
      const mime = b.mime || guessMime(b.filename, "application/octet-stream");
      await files.set(key, buf, { metadata: { mime, filename: b.filename || "file", empId } });
      return json(200, { key, mime, filename: b.filename || "file", size: buf.length });
    }

    // ── Save (create or update) an employee record ──────────────
    if (action === "save") {
      const b = parseBody(event);
      const rec = b.record || b;
      let id = safeId(rec.id);
      const now = Date.now();
      if (!id) { id = "emp_" + now + "_" + crypto.randomBytes(3).toString("hex"); rec.createdAt = now; }
      else {
        const existing = await records.get(id, { type: "json" });
        rec.createdAt = (existing && existing.createdAt) || rec.createdAt || now;
      }
      rec.id = id;
      rec.updatedAt = now;
      if (!rec.fullName || !String(rec.fullName).trim()) return json(400, { error: "Full name is required." });
      await records.setJSON(id, rec);
      return json(200, { employee: rec });
    }

    // ── Delete an employee and all their files ──────────────────
    if (action === "delete") {
      const id = safeId(qs.id || parseBody(event).id);
      if (!id) return json(400, { error: "Missing id." });
      const r = await records.get(id, { type: "json" });
      if (r) {
        const keys = [];
        if (r.photoKey) keys.push(r.photoKey);
        (r.documents || []).forEach((d) => d.key && keys.push(d.key));
        (r.dependents || []).forEach((d) => d.photoKey && keys.push(d.photoKey));
        for (const k of keys) { try { await files.delete(k); } catch (_) {} }
      }
      await records.delete(id);
      return json(200, { ok: true });
    }

    return json(400, { error: "Unknown action: " + action });
  } catch (e) {
    return json(500, { error: "Server error: " + (e && e.message ? e.message : String(e)) });
  }
};
