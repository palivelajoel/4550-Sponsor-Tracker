# FRC Team 4550 — Something's Bruin

Public website and member hub for FRC Team 4550, built with React + Vite, hosted on Vercel with a Cloudflare D1 database.

**Live site:** [team4550.com](https://team4550.com)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Framer Motion |
| Hosting | Vercel (auto-deploys from `main`) |
| Database | Cloudflare D1 (via Worker gateway) |
| API | Vercel Serverless Functions (`/api/*`) |
| Auth | Custom JWT-based member hub login |

---

## Public Site

The landing page (`/`) includes:

- **Hero section** with animated background and team stats
- **About section** with team description
- **Sub-Teams section** with color-coded team cards
- **Outreach section** with community impact highlights
- **Media Gallery** (`/media`) — browsable photo/video grid filtered by category
- **Sponsors section** with tiered sponsor display
- **Contact form** with Discord webhook integration
- **Footer** with quick links and legal pages

Supporting pages:

| Route | Page |
|-------|------|
| `/media` | Public media gallery |
| `/forms/:id` | Public form submission (QR code accessible) |
| `/privacy` | Privacy Policy |
| `/terms` | Terms & Conditions |
| `/article` | Public article reader |

---

## Member Hub

Authenticated member portal (`/member-hub`) with role-based access (Admin → Captain → Member).

| Feature | Route | Description |
|---------|-------|-------------|
| **Dashboard** | `/member-hub` | Welcome screen with stat cards and feature grid |
| **Calendar** | `/member-hub/calendar` | Team events and deadlines |
| **Tasks** | `/member-hub/tasks` | Kanban board for task management |
| **Announcements** | `/member-hub/announcements` | Team-wide updates from captains |
| **Media Gallery** | `/member-hub/media` | Upload and browse team photos/videos |
| **Resources** | `/member-hub/resources` | CAD files, documents, team guides |
| **Inventory** | `/member-hub/inventory` | Parts tracking with AI item identification |
| **Forms & Surveys** | `/member-hub/forms` | Create/submit team forms, CSV export, Google Sheets sync |
| **Sponsor Tracker** | `/member-hub/sponsors` | Manage sponsor contacts and outreach status |
| **Articles** | `/member-hub/articles` | Write and publish blog/outreach articles |
| **Meeting Projector** | `/member-hub/projector` | Fullscreen rotating display for meetings |

### Permissions

- **Admin** — Full access to all features + Admin Panel
- **Captain** — Can manage tasks, calendar, announcements, forms, inventory, and all hub content
- **Member** — Can view content, submit forms, check out inventory, upload media
- **Build subteam** — Can manage inventory items and transactions

---

## Admin Panel

Protected admin dashboard (`/admin`) for site management.

| Section | What it does |
|---------|-------------|
| **Overview** | 14 metric cards + 6 detail panels (tasks, events, comps, subteams, maps, inventory) |
| **Accounts** | Create/edit/delete member accounts, assign roles and subteams |
| **Hub Tasks** | Create and assign tasks with due dates and priority levels |
| **Hub Calendar** | Manage team events and competition dates |
| **Sponsors** | Assign sponsors to team members for outreach tracking |
| **Leadership** | Manage captain/leadership profiles |
| **Suggestions** | View team feedback submissions |
| **Site Config** | Logo, banners, tile ordering, tile visibility, site details, legal pages |

---

## Site Configuration

Admins can customize the hub dashboard from the Site Config panel:

- **Tile ordering** — drag-and-drop to reorder hub tiles
- **Tile visibility** — toggle any tile on/off (hidden tiles are removed from the dashboard)
- **Landing banners** — upload rotating hero banners (1200×400 optimal)
- **Team logo** — uploaded to GitHub
- **Site details** — title, email, social links, TBA API key, donate URL, season year

---

## Forms & Google Sheets

Forms support two visibility modes:

- **Team Only** — accessible only through the member hub (requires login)
- **Public** — accessible via direct link `/forms/:id`, designed for QR code sharing

Submissions can auto-sync to a shared Google Sheet (requires Google Cloud service account setup). CSV export is available without any configuration.

---

## API Endpoints

All API routes are serverless functions in `/api/`:

| Endpoint | Purpose |
|----------|---------|
| `/api/hub-login` | Member hub authentication |
| `/api/admin-login` | Admin panel authentication |
| `/api/hub-proxy` | Authenticated writes to D1 (hub tables) |
| `/api/admin-proxy` | Authenticated writes to D1 (admin tables) |
| `/api/public-form-submit` | Public form submission (no auth required) |
| `/api/sheets-sync` | Append form submissions to Google Sheets |
| `/api/announce-to-discord` | Post announcements to Discord via webhook |
| `/api/discord-to-announcement` | Pull Discord messages into announcements |
| `/api/identify-item` | AI-powered inventory item identification |
| `/api/extract-brands` | AI brand extraction from text |
| `/api/lookup` | General AI lookup utility |
| `/api/parse-csv` | CSV parsing for inventory bulk import |
| `/api/find-event-links` | TBA event link finder |

---

## Project Structure

```
├── api/                    # Vercel serverless functions
│   ├── auth.js             # Login endpoints
│   ├── proxy.js            # D1 write proxy (via gateway)
│   ├── sheets.js           # Google Sheets sync
│   ├── public-form-submit.js
│   ├── ai.js               # AI-powered features
│   └── discord/            # Discord integrations
├── src/
│   ├── Landing.jsx         # Public landing page
│   ├── Hub.jsx             # Member hub dashboard
│   ├── Hub*.jsx            # Hub feature pages (Calendar, Tasks, etc.)
│   ├── Admin.jsx           # Admin panel
│   ├── PublicFormFill.jsx  # Public form submission page
│   ├── PublicMedia.jsx     # Public media gallery
│   ├── hubUtils.jsx        # Shared helpers, auth, API fetch
│   ├── HubBackground.jsx   # Reusable animated background
│   └── Starfield.jsx       # Particle starfield effect
├── dist/                   # Production build (committed for Vercel)
├── migration.sql           # Database schema
└── vercel.json             # Routing and rewrites
```

---

## Environment Variables

Required (set in Vercel dashboard):

```
D1_GATEWAY_URL             # Cloudflare Worker gateway URL (read/write)
D1_GATEWAY_TOKEN            # Gateway API token (shared with Worker secret)
JWT_SECRET                 # Token signing secret
```

Optional:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL   # For Google Sheets sync
GOOGLE_PRIVATE_KEY             # For Google Sheets sync
GOOGLE_SHEET_ID                # Target spreadsheet for form responses
DISCORD_WEBHOOK_URL            # For announcement posting
DISCORD_BOT_TOKEN              # For Discord integration
GROQ_API_KEY                   # For AI features
ANTHROPIC_API_KEY              # For AI features
```

---

## Development

```bash
npm install
npm run dev      # Start dev server
npm run build    # Production build
```

Pushes to `main` auto-deploy to Vercel.

---

*Built by [palivelajoel](https://github.com/palivelajoel) — FRC Team 4550 "Something's Bruin"*
