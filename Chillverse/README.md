# 🎮 Chillverse — Landing Page & Auth

> Play. Win. Dominate. Your universe. Your rules.

Official landing page, auth flows, and legal pages for the **Chillverse** gaming platform.

---

## 📁 Project Structure

```
chillverse/
├── index.html              ← Main landing page
├── pages/
│   ├── login.html          ← Login page (email + platform connect)
│   ├── signup.html         ← 3-step signup (account → connect → profile)
│   ├── privacy.html        ← Privacy Policy (June 12, 2026)
│   └── terms.html          ← Terms & Conditions (June 12, 2026)
├── assets/
│   └── css/
│       └── shared.css      ← Shared design tokens & component styles
├── .github/
│   └── CODEOWNERS          ← Repo ownership rules
├── .gitignore
├── netlify.toml            ← Netlify SPA config & redirects
└── README.md
```

---

## 🚀 Deploy to Netlify

### Option A — Drag & Drop (quickest)
1. Go to [netlify.com](https://netlify.com) → **Add new site → Deploy manually**
2. Drag the entire `chillverse/` folder onto the deploy zone
3. Done — live in seconds

### Option B — Git Push to Deploy (recommended)
1. Push this repo to GitHub
2. In Netlify: **Add new site → Import from Git → GitHub**
3. Select this repo
4. Build settings:
   - **Build command:** *(leave blank — static site)*
   - **Publish directory:** `.` (root)
5. Click **Deploy site**

Every push to `main` auto-deploys.

---

## 🔗 Platform Integration

The Chillverse Learning branch is live at:  
**[cvwtplatform.vercel.app](https://cvwtplatform.vercel.app/)**

The signup flow includes a **platform connect step** where users can link their existing account from the learning branch, Discord, or Google. Update `pages/signup.html` and `pages/login.html` with real OAuth endpoints when your backend is ready.

---

## 🛠️ Connecting a Backend

The auth pages are currently frontend-only (no real auth). To go live:

| Feature | Recommended stack |
|---|---|
| Auth (email + OAuth) | Firebase Auth / Supabase Auth |
| Database | Firestore / Supabase Postgres |
| Serverless functions | Netlify Functions |
| Payments | Paystack / Stripe |

Replace the `// Simulate auth` comments in `login.html` and `signup.html` with real API calls.

---

## 📄 Legal

- Privacy Policy: `pages/privacy.html`
- Terms & Conditions: `pages/terms.html`
- Contact: legal@chillverse.com

---

## ©️ License

© 2026 Chillverse. All rights reserved.  
Unauthorised reproduction or distribution is prohibited.
