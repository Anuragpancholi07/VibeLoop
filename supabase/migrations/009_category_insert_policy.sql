-- Migration 009: Add category insert policy for authenticated users

CREATE POLICY "Authenticated users can insert categories" ON event_categories
  FOR INSERT TO authenticated WITH CHECK (true);
