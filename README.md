# 💰 Finance Dashboard

🔗 **[Ver demo en vivo](https://finance-dashboard-phi-hazel.vercel.app/)**

A personal finance tracker built with **Angular 21**, **Signals**, and **Tailwind CSS**. Track your income and expenses, visualize spending by category, and monitor your monthly balance — all stored locally in your browser.

![Angular](https://img.shields.io/badge/Angular-21-dd0031?style=flat-square&logo=angular)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwindcss)
![Chart.js](https://img.shields.io/badge/Chart.js-4-ff6384?style=flat-square&logo=chartdotjs)

---

## ✨ Features

- 📊 Monthly summary — total income, expenses, and balance
- 🍩 Spending breakdown by category (donut chart)
- 📈 Monthly cash flow chart (bar chart)
- 📋 Transaction list with filters
- ➕ Add, edit, and delete transactions
- 🌙 Dark mode support
- 💾 Data persisted in localStorage — no backend required

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Angular 21 | Framework — standalone components, new control flow |
| Angular Signals | Reactive state management |
| Tailwind CSS v3 | Utility-first styling |
| Chart.js | Data visualization |
| localStorage | Client-side data persistence |
| TypeScript 5 | Strict typing throughout |
| Vitest | Unit tests |
| Playwright | End-to-end tests in desktop and mobile Chrome |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Angular CLI 21+

```bash
pnpm install -g @angular/cli
```

### Installation

```bash
# Clone the repository
git clone https://github.com/Alx93Dev/finance-dashboard.git

# Navigate to the project
cd finance-dashboard

# Install dependencies
pnpm install

# Start the development server
pnpm start
```

Open your browser at `http://localhost:4200`

### Tests

```bash
# Unit tests
pnpm test -- --watch=false

# End-to-end tests (run against the production build)
pnpm exec playwright install chromium   # first time only
pnpm build
pnpm e2e
```

### Cloud sync (optional)

Data lives in the browser. To sync it between devices with [Supabase](https://supabase.com):

1. Create a project (the free plan is enough).
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql). It creates one row per user, protected by row level security.
3. In **Authentication → URL Configuration**, set the **Site URL** to the production URL and add the preview and local URLs (for example `https://*.vercel.app/**` and `http://localhost:4200/**`) to **Redirect URLs**.
4. In **Authentication → Email Templates → Magic Link**, add `{{ .Token }}` to the message so it also carries a code. The code lets you sign in on a device other than the one where you open the email.
5. In **Project Settings → API**, copy the project URL and the `anon` public key into [`src/app/core/sync/sync.config.ts`](src/app/core/sync/sync.config.ts).

A **Sincronización** section then appears under **Tus datos**. Changes upload a couple of seconds after you make them, and the cloud copy is read when the app opens or regains focus. If both sides changed, the app asks which one to keep.

---

## 📁 Project Structure

```
src/
└── app/
    ├── core/
    │   ├── models/
    │   │   ├── transaction.model.ts
    │   │   └── category.model.ts
    │   └── services/
    │       ├── transaction.service.ts   ← signals-based state
    │       └── storage.service.ts
    ├── features/
    │   ├── dashboard/
    │   └── transactions/
    │       └── transaction-form/
    └── shared/
        └── components/
            ├── summary-card/
            └── nav/
```

---

## 🧠 Key Angular Concepts Used

- **Signals & computed()** — reactive state without RxJS overhead
- **Standalone components** — no NgModules
- **input()** — new signal-based input API
- **inject()** — functional dependency injection
- **@if / @for** — new Angular 17+ control flow syntax
- **Reactive Forms** — for transaction creation and editing

---

## 📸 Screenshot

![Finance Dashboard](./docs/screenshot.png)

---

## 📄 License

MIT
