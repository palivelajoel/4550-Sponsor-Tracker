-- Full Supabase schema for FRC 4550 Website
-- Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

-- ============================================================
-- 1. MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'Member' CHECK (role IN ('Member', 'Captain', 'Admin')),
    subteam TEXT DEFAULT 'General' CHECK (subteam IN ('Build', 'Programming', 'Marketing & Outreach', 'General')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members select own" ON public.members;
CREATE POLICY "Members select own" ON public.members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin update members" ON public.members;
CREATE POLICY "Admin update members" ON public.members FOR UPDATE USING (true);

-- ============================================================
-- 2. SITE CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.site_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT
);

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select site_config" ON public.site_config;
CREATE POLICY "Public select site_config" ON public.site_config FOR SELECT USING (true);

-- ============================================================
-- 3. CAPTAINS (command team profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.captains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    position TEXT,
    photo_url TEXT,
    bio TEXT,
    sort_order INT DEFAULT 0
);

ALTER TABLE public.captains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select captains" ON public.captains;
CREATE POLICY "Public select captains" ON public.captains FOR SELECT USING (true);

-- ============================================================
-- 4. HUB TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Backlog' CHECK (status IN ('Backlog', 'To Do', 'In Progress', 'Review', 'Done')),
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    assigned_to UUID REFERENCES public.members(id) ON DELETE SET NULL,
    assigned_name TEXT,
    subteam TEXT,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hub_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select hub_tasks" ON public.hub_tasks;
CREATE POLICY "Public select hub_tasks" ON public.hub_tasks FOR SELECT USING (true);

-- ============================================================
-- 5. HUB CALENDAR
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type TEXT DEFAULT 'event' CHECK (type IN ('event', 'deadline', 'meeting', 'competition', 'other')),
    date DATE NOT NULL,
    end_date DATE,
    time TIME,
    description TEXT,
    all_day BOOLEAN DEFAULT true
);

ALTER TABLE public.hub_calendar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select hub_calendar" ON public.hub_calendar;
CREATE POLICY "Public select hub_calendar" ON public.hub_calendar FOR SELECT USING (true);

-- ============================================================
-- 6. HUB ANNOUNCEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    body TEXT,
    tag TEXT DEFAULT 'General' CHECK (tag IN ('General', 'Build', 'Programming', 'Marketing & Outreach', 'Competition', 'Reminder', 'Urgent')),
    pinned BOOLEAN DEFAULT false,
    author TEXT DEFAULT 'Discord',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hub_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select hub_announcements" ON public.hub_announcements;
CREATE POLICY "Public select hub_announcements" ON public.hub_announcements FOR SELECT USING (true);

-- ============================================================
-- 7. HUB RESOURCES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'Other' CHECK (category IN ('All', 'CAD & Design', 'Programming', 'Documentation', 'Marketing', 'Finance', 'Competition', 'Other')),
    url TEXT NOT NULL,
    file_name TEXT,
    folder TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hub_resources ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT '';

ALTER TABLE public.hub_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select hub_resources" ON public.hub_resources;
CREATE POLICY "Public select hub_resources" ON public.hub_resources FOR SELECT USING (true);

-- ============================================================
-- 8. HUB MEDIA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    category TEXT DEFAULT 'Other' CHECK (category IN ('All', 'Competition', 'Build Season', 'Outreach', 'Team', 'Other')),
    description TEXT,
    year INT,
    url TEXT NOT NULL,
    type TEXT DEFAULT 'image' CHECK (type IN ('image', 'video')),
    folder TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hub_media ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT '';

ALTER TABLE public.hub_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select hub_media" ON public.hub_media;
CREATE POLICY "Public select hub_media" ON public.hub_media FOR SELECT USING (true);

-- ============================================================
-- 9. SPONSORS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    status TEXT DEFAULT 'Not Contacted' CHECK (status IN ('Not Contacted', 'Contacted', 'In Progress', 'Sponsored', 'Declined')),
    tier TEXT DEFAULT 'None' CHECK (tier IN ('None', 'Bronze', 'Silver', 'Gold', 'Platinum')),
    follow_up_date DATE,
    assigned_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    logo_url TEXT,
    assigned_member_name TEXT,
    date_added TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select sponsors" ON public.sponsors;
CREATE POLICY "Public select sponsors" ON public.sponsors FOR SELECT USING (true);

-- ============================================================
-- 10. SPONSOR NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sponsor_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID REFERENCES public.sponsors(id) ON DELETE CASCADE,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sponsor_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select sponsor_notes" ON public.sponsor_notes;
CREATE POLICY "Public select sponsor_notes" ON public.sponsor_notes FOR SELECT USING (true);

-- ============================================================
-- 11. SUGGESTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select suggestions" ON public.suggestions;
CREATE POLICY "Public select suggestions" ON public.suggestions FOR SELECT USING (true);

-- ============================================================
-- 12. COMPETITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.competitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT,
    name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    location TEXT,
    attending BOOLEAN DEFAULT false,
    venue_map_url TEXT,
    pit_map_url TEXT,
    stream_url TEXT DEFAULT '',
    map_status TEXT DEFAULT 'Pit map not posted yet.',
    last_map_check TIMESTAMPTZ,
    schematic_data JSONB,
    city TEXT,
    state_prov TEXT,
    country TEXT
);

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select competitions" ON public.competitions;
CREATE POLICY "Public select competitions" ON public.competitions FOR SELECT USING (true);

-- ============================================================
-- 13. INVENTORY ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    location TEXT,
    bin_location TEXT,
    category TEXT,
    image_url TEXT,
    tags TEXT[],
    manufacturer TEXT,
    part_number TEXT,
    low_stock_threshold INTEGER DEFAULT 5,
    added_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add/replace category check constraint safely
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_category_check;
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_category_check
    CHECK (category IN ('structural', 'drivetrain', 'electronics', 'pneumatics', 'fastener', 'tool', 'consumable', 'cable', 'bearing', 'motor', 'sensor', 'other'));

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select inventory_items" ON public.inventory_items;
CREATE POLICY "Public select inventory_items" ON public.inventory_items FOR SELECT USING (true);

-- ============================================================
-- 14. INVENTORY TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    change INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reason TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "Public select inventory_transactions" ON public.inventory_transactions FOR SELECT USING (true);

-- ============================================================
-- 15. SCOUTING MATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scouting_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_number INT NOT NULL,
    match_number INT,
    alliance TEXT DEFAULT 'Red' CHECK (alliance IN ('Red', 'Blue')),
    scouter_name TEXT,
    auto_fuel INT DEFAULT 0,
    auto_climb BOOLEAN DEFAULT false,
    teleop_fuel INT DEFAULT 0,
    endgame TEXT DEFAULT 'None' CHECK (endgame IN ('None', 'Level 1 (10)', 'Level 2 (20)', 'Level 3 (30)')),
    defense BOOLEAN DEFAULT false,
    defended BOOLEAN DEFAULT false,
    died BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'human',
    event_key TEXT
);

ALTER TABLE public.scouting_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select scouting_matches" ON public.scouting_matches;
CREATE POLICY "Public select scouting_matches" ON public.scouting_matches FOR SELECT USING (true);

-- ============================================================
-- 16. SCOUTING PITS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scouting_pits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_number INT NOT NULL,
    team_name TEXT,
    drivetrain TEXT CHECK (drivetrain IN ('Swerve', 'Tank', 'West Coast', 'Mecanum', 'Other')),
    weight_lbs NUMERIC,
    auto_capabilities TEXT,
    teleop_capabilities TEXT,
    climb_type TEXT CHECK (climb_type IN ('None', 'Level 1', 'Level 2', 'Level 3')),
    notes TEXT,
    scouter_name TEXT,
    can_score_auto_climb BOOLEAN DEFAULT false,
    can_score_fuel_near BOOLEAN DEFAULT false,
    can_score_fuel_far BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.scouting_pits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select scouting_pits" ON public.scouting_pits;
CREATE POLICY "Public select scouting_pits" ON public.scouting_pits FOR SELECT USING (true);

-- ============================================================
-- 17. SCOUTING PICKLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scouting_picklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_number INT NOT NULL,
    rank INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.scouting_picklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select scouting_picklist" ON public.scouting_picklist;
CREATE POLICY "Public select scouting_picklist" ON public.scouting_picklist FOR SELECT USING (true);

-- ============================================================
-- SEED DATA: Default site_config entries
-- ============================================================
INSERT INTO public.site_config (key, value) VALUES
    ('logo_url', '/logo.jpg'),
    ('site_title', 'FRC 4550'),
    ('season_year', '2026')
ON CONFLICT (key) DO NOTHING;
