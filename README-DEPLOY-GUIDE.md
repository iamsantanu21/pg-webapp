# 🚀 P.G. Service Station — Website Setup Guide

This folder is your **complete website**, ready to put online for **FREE** on Netlify.

## 🧩 What you get

- 🏠 **Public homepage** → anyone can see your petrol pump website
- 🔑 **Staff / Admin Login** button → only you can log in
- 🛠️ **After login** → your 2 internal tools appear:
  - 💳 RTGS Letter Generator
  - 🆔 BPCL ID Card Maker
- 🔒 **Real protection** → the tools are hidden inside the server. There is **no secret link** that leaks them. Nobody can open them without the password. ✅

---

## 📦 Step 1 — Put it online (about 5 minutes)

1. Go to **https://app.netlify.com** and sign up (free) — you can use your Google account.
2. On the dashboard, click **"Add new site" → "Deploy manually"**.
3. **Drag the whole `pg-service-station` folder** into the upload box.
4. Wait ~30 seconds. Netlify gives you a live web address like
   `https://your-site-name.netlify.app` 🎉

---

## 🔑 Step 2 — Set your password (very important)

Your site is live, but you must set the admin password.

1. In Netlify, open your site → **Site configuration → Environment variables**.
2. Click **"Add a variable"** and add these **two**:

   | Key | Value |
   |-----|-------|
   | `ADMIN_PASSWORD` | *(choose your own password — e.g. `PgStation@2026`)* |
   | `SESSION_SECRET` | `3b6a54cbf641fdabca5cfaa2567687818ccb0e188726be70dc15034665aeb772` |

   > 💡 `ADMIN_PASSWORD` = the password you will type to log in. Pick a strong one.
   > 💡 `SESSION_SECRET` = a random safety key (already generated for you above). Keep it private.

3. After saving, go to **Deploys → Trigger deploy → "Deploy site"** once, so the password takes effect.

---

## ✅ Step 3 — Use it

- 🌍 **Homepage:** `https://your-site-name.netlify.app`
- 🔑 Click **"Staff / Admin Login"**, type your password → you reach the **Admin Panel**.
- 🛠️ Click either tool to open it. Normal visitors never see this. 🙈
- 🚪 Click **"Log out"** when done.

---

## 🔧 Common changes

**Change the password later?**
→ Netlify → Environment variables → edit `ADMIN_PASSWORD` → Trigger deploy.

**Edit the homepage text (address, phone, services)?**
→ Open `public/index.html`, change the text, and re-upload the folder (Step 1).

**Add another tool later?**
→ Just tell me and I'll wire it into the protected area for you.

---

## 🗂️ What's inside this folder

```
pg-service-station/
├── public/                  🌍 PUBLIC (anyone can see)
│   ├── index.html           → homepage
│   └── login.html           → login page
├── netlify/functions/       🔒 SERVER (protected)
│   ├── login.js             → checks your password
│   ├── logout.js            → logs you out
│   └── app.js               → holds the 2 tools, gives them only after login
├── netlify.toml             → site settings
└── package.json
```

> 🔐 **Why it's safe:** the tools are inside `app.js` on the server — not in the public
> folder. Even a technical person cannot reach them by guessing links or reading the
> page source. They are handed over only after the server checks your login cookie.
