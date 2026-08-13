# WA Sender

Bulk WhatsApp messaging tool built for **Power City Oke Ira Campus**. Create campaigns, import contacts from spreadsheets, compose messages with WhatsApp formatting, and send to your community — all from a self-hosted web app.

## Features

- **WhatsApp connection** via Baileys (QR code scan + pairing code for mobile linking)
- **Campaign creation wizard** — name recipients, compose messages with bold/italic/strikethrough/monospace formatting, set send intervals, and schedule for later
- **Phone number import** from Excel, CSV, or TXT files with automatic normalization
- **File attachments** — images, videos, documents (up to 16 MB)
- **Message templates** — save and reuse frequently sent messages
- **Scheduled campaigns** — pick a date/time and the scheduler auto-starts them
- **Live progress tracking** via Server-Sent Events (SSE)
- **Retry failed messages** and graceful stop/pause
- **Campaign export** to `.xlsx` (per-campaign or all campaigns)
- **Automated email reports** with delivery stats sent on campaign completion
- **PWA** — installable on mobile/desktop with offline shell and service worker
- **Passwordless login** via email OTP (6-digit code)
- **Responsive design** — desktop sidebar + mobile bottom nav

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4 |
| Database | SQLite via better-sqlite3 (WAL mode) |
| WhatsApp | `@whiskeysockets/baileys` v7 |
| Auth | Email OTP + session cookie |
| Email | Nodemailer / Resend API |
| Spreadsheets | SheetJS (`xlsx`) |
| PWA | Service worker, Web App Manifest |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Environment

Copy the example env file and configure as needed:

```bash
cp .env.example .env.local
```

Key variables:

| Variable | Required | Description |
|---|---|---|
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | No | SMTP for OTP emails. If unset, the code is shown on-screen (dev mode). |
| `RESEND_API_KEY` | No | Alternative to SMTP for OTP delivery. |
| `REPORT_EMAILS` | No | Comma-separated emails to receive campaign completion reports. |

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build & Start

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── api/                  # API routes (auth, campaigns, connect, templates, upload, profile, export)
│   ├── dashboard/            # Dashboard pages (home, create, history, connect, settings, campaign detail)
│   ├── login/                # OTP login page
│   ├── layout.tsx            # Root layout (fonts, PWA, service worker)
│   └── manifest.ts           # Web App Manifest
├── components/
│   ├── dashboard/            # Dashboard UI (CampaignForm, CampaignDetail, ConnectPage, SettingsPage, Sidebar, etc.)
│   ├── PWA/                  # PWA components (ServiceWorker, PWAInstall)
│   └── ui/                   # Reusable UI (Button, Card, Badge, Modal, Toast, Icon, Field)
├── lib/
│   ├── auth.ts               # Session management, cookie-based auth
│   ├── db.ts                 # SQLite init, migrations, schema (7 tables)
│   ├── campaigns.ts          # Campaign & template CRUD
│   ├── scheduler.ts          # Polls for scheduled campaigns every 15s
│   ├── email.ts              # OTP delivery (SMTP/Resend)
│   ├── report.ts             # Campaign completion report emails
│   ├── numbers.ts            # Phone number normalization (E.164)
│   ├── format.ts             # Display formatting (timeAgo, formatBytes, etc.)
│   ├── ids.ts                # ID generation, types
│   └── sender/
│       ├── index.ts          # Campaign send engine (loop, retries, reconnect)
│       ├── baileys.ts        # Baileys WhatsApp driver
│       ├── webjs.ts          # whatsapp-web.js driver (alternative)
│       ├── events.ts         # Pub/sub for live progress
│       └── types.ts          # Driver interface
└── types/                    # Additional type declarations

public/
├── sw.js                     # Service worker (offline shell, cache strategies)
├── icons/                    # PWA icons (192, 512, maskable, Apple touch, MS tile)
└── splash/                   # Apple splash screen images
```

## Database

SQLite at `data/app.db` with 7 tables:

| Table | Purpose |
|---|---|
| `users` | User accounts (email, name, phone) |
| `otp_codes` | Login OTP codes (hashed, 10-min TTL) |
| `sessions` | Auth sessions (30-day expiry) |
| `campaigns` | Campaign metadata and stats |
| `recipients` | Per-campaign recipient list and delivery status |
| `attachments` | File attachments linked to campaigns |
| `templates` | Reusable message templates |
| `wa_sessions` | WhatsApp connection state persistence |

## WhatsApp Connection

1. Navigate to **Connect** in the dashboard
2. Scan the QR code with WhatsApp on your phone (Linked Devices > Link a Device)
3. Or use the **pairing code** for mobile-to-mobile linking
4. The connection persists across server restarts via `data/wa-session/`

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Docker

Build and run locally:

```bash
docker build -t wa-sender .
docker run -p 3000:3000 \
  -e DATABASE_PATH=/data/app.db \
  -e WA_SESSION_DIR=/data/wa-session \
  -v wa-sender-data:/data \
  wa-sender
```

### Cloud66 Deployment

1. Push to your Git remote
2. In Cloud66, create a new service from your repo
3. Set the **Dockerfile path** to `Dockerfile`
4. Add a **persistent disk** mounted at `/data`
5. Set environment variables in the Cloud66 dashboard:

| Variable | Value |
|---|---|
| `DATABASE_PATH` | `/data/app.db` |
| `DATA_DIR` | `/data` |
| `WA_SESSION_DIR` | `/data/wa-session` |
| `UPLOAD_DIR` | `/data/uploads` |
| `SMTP_HOST` | Your SMTP host |
| `SMTP_USER` | Your SMTP user |
| `SMTP_PASS` | Your SMTP password |
| `REPORT_EMAILS` | Comma-separated report recipients |

## License

Private — Power City Oke Ira Campus.
