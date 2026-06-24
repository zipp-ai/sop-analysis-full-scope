# Contributing to Latent Frontend

Thanks for helping improve Latent! This repo hosts our React-based frontend.

---

## 🔄 Branching Strategy

- All changes should be made in **feature branches** off `dev`
- PRs should target:
  - `dev` → for features
  - `main` → only from `dev`, after testing

### Branch Naming

```
feature/your-feature-name
fix/bug-description
chore/update-deps
```

---

## 🚀 Running Locally

```bash
npm install
npm start
```

Your app will run on `http://localhost:3000`

---

## 🔐 Environment Variables

You must create a `.env` file in the root:

```bash
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
```

*Never commit `.env` to GitHub.*

---

## ✅ Pull Request Requirements

- Descriptive title and summary
- Ensure code builds and works locally
- No direct commits to `dev` or `main`

---

## 🧪 CI/CD

- Every push to `dev` auto-deploys to **Dev site**
- Every push to `main` auto-deploys to **Production site**
