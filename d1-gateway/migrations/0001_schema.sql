-- D1 schema for Team 4550 site (migration 0001)
-- SQLite. Booleans are stored as INTEGER (0/1); JSON fields stored as TEXT.

CREATE TABLE IF NOT EXISTS members (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'Member',
  subteam       TEXT DEFAULT 'General',
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suggestions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  message      TEXT NOT NULL,
  submitted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sponsors (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  company             TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'Not Contacted',
  tier                TEXT DEFAULT 'None',
  follow_up_date      TEXT,
  date_added          TEXT,
  updated_at          TEXT,
  assigned_member_id  INTEGER,
  assigned_member_name TEXT,
  logo_url            TEXT,
  created_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sponsor_notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sponsor_id INTEGER NOT NULL,
  note       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS captains (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  position   TEXT NOT NULL,
  bio        TEXT,
  sort_order INTEGER DEFAULT 0,
  photo_url  TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_config (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL UNIQUE,
  value      TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hub_tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  description  TEXT,
  subteam      TEXT DEFAULT 'General',
  assigned_to  INTEGER,
  assigned_name TEXT,
  start_date   TEXT,
  start_time   TEXT,
  due_date     TEXT,
  due_time     TEXT,
  priority     TEXT DEFAULT 'Medium',
  status       TEXT DEFAULT 'To Do',
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hub_calendar (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  type        TEXT DEFAULT 'event',
  date        TEXT NOT NULL,
  end_date    TEXT,
  time        TEXT,
  end_time    TEXT,
  all_day     INTEGER DEFAULT 1,
  description TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hub_announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  tag        TEXT DEFAULT 'General',
  pinned     INTEGER DEFAULT 0,
  author     TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hub_media (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  category    TEXT,
  description TEXT,
  year        TEXT,
  url         TEXT,
  type        TEXT,
  folder      TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hub_resources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  url         TEXT,
  file_name   TEXT,
  folder      TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hub_forms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT,
  questions   TEXT,
  created_by  TEXT,
  visibility  TEXT DEFAULT 'draft',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hub_form_submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id      INTEGER NOT NULL,
  submitted_by TEXT,
  answers      TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  description         TEXT,
  quantity            INTEGER DEFAULT 1,
  location            TEXT,
  bin_location        TEXT,
  category            TEXT DEFAULT 'other',
  tags                TEXT,
  image_url           TEXT,
  low_stock_threshold INTEGER DEFAULT 5,
  manufacturer        TEXT,
  part_number         TEXT,
  added_by            INTEGER,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id      INTEGER NOT NULL,
  change       INTEGER,
  new_quantity INTEGER,
  reason       TEXT,
  user_id      INTEGER,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS articles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  excerpt    TEXT,
  content    TEXT,
  image_url  TEXT,
  published  INTEGER DEFAULT 0,
  author     TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS competitions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  event_key     TEXT,
  start_date    TEXT,
  end_date      TEXT,
  attending     INTEGER DEFAULT 0,
  location      TEXT,
  city          TEXT,
  state_prov    TEXT,
  address       TEXT,
  venue_map_url TEXT,
  pit_map_url   TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scouting_matches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  team_number   INTEGER NOT NULL,
  match_number  INTEGER NOT NULL,
  alliance      TEXT DEFAULT 'Red',
  scouter_name  TEXT,
  auto_fuel     INTEGER DEFAULT 0,
  auto_climb    INTEGER DEFAULT 0,
  teleop_fuel   INTEGER DEFAULT 0,
  endgame       TEXT DEFAULT 'None',
  defense       INTEGER DEFAULT 0,
  defended      INTEGER DEFAULT 0,
  died          INTEGER DEFAULT 0,
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scouting_pits (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  team_number           INTEGER NOT NULL,
  team_name             TEXT,
  drivetrain            TEXT DEFAULT 'Swerve',
  weight_lbs            REAL,
  auto_capabilities     TEXT,
  teleop_capabilities   TEXT,
  climb_type            TEXT DEFAULT 'None',
  notes                 TEXT,
  scouter_name          TEXT,
  can_score_auto_climb  INTEGER DEFAULT 0,
  can_score_fuel_near   INTEGER DEFAULT 0,
  can_score_fuel_far    INTEGER DEFAULT 0,
  created_at            TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scouting_picklist (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  team_number  INTEGER NOT NULL,
  rank         INTEGER,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- Helpful indexes for the most common query patterns.
CREATE INDEX IF NOT EXISTS idx_site_config_key ON site_config(key);
CREATE INDEX IF NOT EXISTS idx_forms_created ON hub_forms(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_form ON hub_form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON hub_tasks(status);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON hub_calendar(date);
CREATE INDEX IF NOT EXISTS idx_media_created ON hub_media(created_at);
CREATE INDEX IF NOT EXISTS idx_announce_pinned ON hub_announcements(pinned);
CREATE INDEX IF NOT EXISTS idx_inv_item_name ON inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_inv_tx_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_scout_match_num ON scouting_matches(team_number);
CREATE INDEX IF NOT EXISTS idx_scout_pit_num ON scouting_pits(team_number);
CREATE INDEX IF NOT EXISTS idx_picklist_rank ON scouting_picklist(rank);
