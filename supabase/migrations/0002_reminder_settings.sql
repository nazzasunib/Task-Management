-- Reminder times, saved per account so the website and the Android app use the same ones.
-- Run once in Supabase → SQL Editor. Safe to run again.
alter table public.tm_profiles add column if not exists reminder_settings jsonb;
