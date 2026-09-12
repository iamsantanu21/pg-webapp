// GET/POST /api/logout — clears the session cookie and returns to the public site.
exports.handler = async () => ({
  statusCode: 302,
  headers: {
    Location: "/",
    "Set-Cookie": "pg_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    "Cache-Control": "no-store",
  },
});
