-- Per-event branding (logo, brand color, tagline) used by the viewer and display pages
ALTER TABLE events ADD COLUMN IF NOT EXISTS theme JSONB NOT NULL DEFAULT '{}'::jsonb;
