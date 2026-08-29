-- ============================================================
-- 002: Add missing logo_url to sponsors
-- The live sponsors table is missing logo_url that the app expects
-- (migration.sql defines it, but the live DB predates that schema).
-- This breaks Sponsor Management logo uploads AND the homepage
-- sponsors grid (the Landing page query selects logo_url -> 400).
-- Run in Supabase SQL editor.
-- ============================================================

ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Make sure the public SELECT policy still covers the new column
DROP POLICY IF EXISTS "Public select sponsors" ON public.sponsors;
CREATE POLICY "Public select sponsors" ON public.sponsors FOR SELECT USING (true);