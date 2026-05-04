-- Add editable home/away team name columns to accounts.
-- These are displayed on the football scoreboard and saved per-account.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS home_team_name text,
  ADD COLUMN IF NOT EXISTS away_team_name text;
