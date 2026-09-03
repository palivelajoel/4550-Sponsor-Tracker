-- 0002 - D1 schema mirroring the real Supabase schema (post-cleanup).
-- Corrects the original 0001 guess (integer ids, wrong columns). Tables were empty,
-- so we drop and recreate 1:1 against Supabase.
-- REMOVED features: scouting (pits/matches/picklist) and competition map fields.
-- Ids are TEXT (UUIDs preserved). Booleans stored as INTEGER 0/1; JSON as TEXT.

DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS suggestions;
DROP TABLE IF EXISTS sponsors;
DROP TABLE IF EXISTS sponsor_notes;
DROP TABLE IF EXISTS captains;
DROP TABLE IF EXISTS site_config;
DROP TABLE IF EXISTS hub_tasks;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS hub_calendar;
DROP TABLE IF EXISTS hub_announcements;
DROP TABLE IF EXISTS hub_media;
DROP TABLE IF EXISTS hub_resources;
DROP TABLE IF EXISTS hub_forms;
DROP TABLE IF EXISTS hub_form_submissions;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS articles;
DROP TABLE IF EXISTS competitions;
DROP TABLE IF EXISTS scouting_matches;
DROP TABLE IF EXISTS scouting_pits;
DROP TABLE IF EXISTS scouting_picklist;

-- members
CREATE TABLE members (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'Member',
  created_at    TEXT,
  subteam       TEXT DEFAULT 'General',
  auth_id       TEXT,
  password_hash TEXT
);

-- suggestions
CREATE TABLE suggestions (
  id           TEXT PRIMARY KEY,
  message      TEXT NOT NULL,
  submitted_at TEXT
);

-- sponsors
CREATE TABLE sponsors (
  id                   TEXT PRIMARY KEY,
  company              TEXT NOT NULL,
  email                TEXT,
  phone                TEXT,
  notes                TEXT,
  status               TEXT NOT NULL,
  date_added           TEXT,
  updated_at           TEXT,
  tier                 TEXT,
  follow_up_date       TEXT,
  assigned_member_id   TEXT,
  assigned_member_name TEXT,
  logo_url             TEXT
);

-- sponsor_notes
CREATE TABLE sponsor_notes (
  id         TEXT PRIMARY KEY,
  sponsor_id TEXT,
  note       TEXT NOT NULL,
  created_at TEXT
);

-- captains
CREATE TABLE captains (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  position   TEXT NOT NULL,
  bio        TEXT,
  photo_url  TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT
);

-- site_config (primary key is `key`, matching Supabase)
CREATE TABLE site_config (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- hub_tasks
CREATE TABLE hub_tasks (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT DEFAULT 'To Do',
  priority      TEXT DEFAULT 'Medium',
  subteam       TEXT DEFAULT 'All',
  assigned_to   TEXT,
  assigned_name TEXT,
  due_date      TEXT,
  created_at    TEXT,
  start_date    TEXT,
  start_time    TEXT,
  due_time      TEXT
);

-- tasks (legacy/unused, kept for parity)
CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  assigned_to   TEXT,
  assigned_name TEXT,
  due_date      TEXT,
  status        TEXT DEFAULT 'To Do',
  priority      TEXT DEFAULT 'Medium',
  created_at    TEXT
);

-- hub_calendar
CREATE TABLE hub_calendar (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  type        TEXT DEFAULT 'event',
  date        TEXT NOT NULL,
  end_date    TEXT,
  time        TEXT,
  description TEXT,
  all_day     INTEGER DEFAULT 1,
  created_at  TEXT,
  end_time    TEXT
);

-- hub_announcements
CREATE TABLE hub_announcements (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  tag        TEXT DEFAULT 'General',
  author     TEXT,
  pinned     INTEGER DEFAULT 0,
  created_at TEXT
);

-- hub_media
CREATE TABLE hub_media (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  type        TEXT DEFAULT 'image',
  url         TEXT NOT NULL,
  category    TEXT DEFAULT 'Competition',
  description TEXT,
  year        INTEGER DEFAULT 2025,
  created_at  TEXT
);

-- hub_resources
CREATE TABLE hub_resources (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT DEFAULT 'Documentation',
  url         TEXT NOT NULL,
  file_name   TEXT,
  created_at  TEXT,
  folder      TEXT
);

-- hub_forms
CREATE TABLE hub_forms (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  questions   TEXT,
  created_by  TEXT,
  visibility  TEXT DEFAULT 'team',
  created_at  TEXT
);

-- hub_form_submissions
CREATE TABLE hub_form_submissions (
  id           TEXT PRIMARY KEY,
  form_id      TEXT,
  submitted_by TEXT,
  answers      TEXT,
  created_at   TEXT
);

-- inventory_items
CREATE TABLE inventory_items (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  description         TEXT,
  quantity            INTEGER DEFAULT 1,
  location            TEXT,
  bin_location        TEXT,
  category            TEXT,
  image_url           TEXT,
  tags                TEXT,
  manufacturer        TEXT,
  part_number         TEXT,
  low_stock_threshold INTEGER DEFAULT 5,
  added_by            TEXT,
  created_at          TEXT
);

-- inventory_transactions
CREATE TABLE inventory_transactions (
  id           TEXT PRIMARY KEY,
  item_id      TEXT,
  change       INTEGER,
  new_quantity INTEGER,
  reason       TEXT,
  user_id      TEXT,
  created_at   TEXT
);

-- articles
CREATE TABLE articles (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT,
  excerpt    TEXT,
  image_url  TEXT,
  author     TEXT,
  author_id  TEXT,
  published  INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- competitions
CREATE TABLE competitions (
  id          TEXT PRIMARY KEY,
  created_at  TEXT,
  event_key   TEXT,
  name        TEXT,
  start_date  TEXT,
  end_date    TEXT,
  location    TEXT,
  attending   INTEGER DEFAULT 0
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_hub_calendar_date ON hub_calendar(date);
CREATE INDEX IF NOT EXISTS idx_hub_announcements_created ON hub_announcements(created_at);
CREATE INDEX IF NOT EXISTS idx_hub_media_category ON hub_media(category);
CREATE INDEX IF NOT EXISTS idx_hub_resources_category ON hub_resources(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_competitions_event_key ON competitions(event_key);
