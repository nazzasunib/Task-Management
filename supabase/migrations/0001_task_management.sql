-- =====================================================================
-- Task Management — schema, Row Level Security, storage
-- Supabase Dashboard → SQL Editor → paste everything → Run.
-- Safe to run more than once.
-- =====================================================================

-- ---------- profiles ----------
create table if not exists public.tm_profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 80),
  email       text not null default '',
  about       text not null default '' check (char_length(about) <= 500),
  avatar_url  text check (avatar_url is null or char_length(avatar_url) <= 400000),
  seeded      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- tasks ----------
create table if not exists public.tm_tasks (
  user_id         uuid not null references auth.users (id) on delete cascade,
  id              text not null check (char_length(id) <= 64),
  title           text not null default '' check (char_length(title) <= 300),
  description     text not null default '' check (char_length(description) <= 5000),
  category        text not null default 'Work' check (char_length(category) <= 40),
  priority        text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  estimated_time  text not null default '' check (char_length(estimated_time) <= 40),
  due_time        text not null default '' check (due_time = '' or due_time ~ '^\d{2}:\d{2}$'),
  original_date   date not null,
  current_day   date not null,
  is_range        boolean not null default false,
  end_date        date,
  status          text not null default 'pending' check (status in ('pending', 'completed')),
  is_rolled_over  boolean not null default false,
  rollover_count  integer not null default 0 check (rollover_count >= 0),
  created_at      timestamptz not null default now(),
  completed_at    timestamptz,
  attachment      jsonb check (attachment is null or pg_column_size(attachment) <= 4000),
  updated_at      timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists tm_tasks_user_date_idx on public.tm_tasks (user_id, current_day);

-- ---------- notes (category -> checklists/text notes -> items) ----------
create table if not exists public.tm_note_categories (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null check (char_length(id) <= 64),
  name        text not null default '' check (char_length(name) <= 120),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  tasks       jsonb not null default '[]'::jsonb check (jsonb_typeof(tasks) = 'array' and pg_column_size(tasks) <= 500000),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------- updated_at ----------
create or replace function public.tm_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists tm_touch_profiles on public.tm_profiles;
create trigger tm_touch_profiles before update on public.tm_profiles for each row execute function public.tm_touch();
drop trigger if exists tm_touch_tasks on public.tm_tasks;
create trigger tm_touch_tasks before update on public.tm_tasks for each row execute function public.tm_touch();
drop trigger if exists tm_touch_notes on public.tm_note_categories;
create trigger tm_touch_notes before update on public.tm_note_categories for each row execute function public.tm_touch();

-- ---------- profile for every new account ----------
create or replace function public.tm_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tm_profiles (id, full_name, email)
  values (new.id,
          left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)), 80),
          coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists tm_on_auth_user_created on auth.users;
create trigger tm_on_auth_user_created after insert on auth.users
  for each row execute function public.tm_handle_new_user();

create or replace function public.tm_handle_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.tm_profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists tm_on_auth_email_changed on auth.users;
create trigger tm_on_auth_email_changed after update of email on auth.users
  for each row execute function public.tm_handle_email_change();

-- Accounts created before this script ran still get a profile.
insert into public.tm_profiles (id, full_name, email)
select u.id,
       left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(u.email, ''), '@', 1)), 80),
       coalesce(u.email, '')
from auth.users u
on conflict (id) do nothing;

-- ---------- Row Level Security: everyone sees and edits ONLY their own rows ----------
alter table public.tm_profiles        enable row level security;
alter table public.tm_tasks           enable row level security;
alter table public.tm_note_categories enable row level security;

drop policy if exists tm_profiles_select on public.tm_profiles;
drop policy if exists tm_profiles_update on public.tm_profiles;
drop policy if exists tm_profiles_insert on public.tm_profiles;
create policy tm_profiles_select on public.tm_profiles for select to authenticated using (id = (select auth.uid()));
create policy tm_profiles_insert on public.tm_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy tm_profiles_update on public.tm_profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists tm_tasks_all on public.tm_tasks;
create policy tm_tasks_all on public.tm_tasks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists tm_notes_all on public.tm_note_categories;
create policy tm_notes_all on public.tm_note_categories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- email is kept in sync by the trigger; users edit name/about/avatar/seeded only
revoke update on public.tm_profiles from authenticated;
grant update (full_name, about, avatar_url, seeded) on public.tm_profiles to authenticated;
revoke all on public.tm_profiles, public.tm_tasks, public.tm_note_categories from anon;

-- ---------- Storage: private bucket for task attachments ----------
-- Files live at  <user id>/<task id>/<file name>; only the owner can touch them.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('tm-attachments', 'tm-attachments', false, 3145728)
    on conflict (id) do update set public = false, file_size_limit = 3145728;

    execute 'drop policy if exists tm_attach_select on storage.objects';
    execute 'drop policy if exists tm_attach_insert on storage.objects';
    execute 'drop policy if exists tm_attach_update on storage.objects';
    execute 'drop policy if exists tm_attach_delete on storage.objects';
    execute $p$create policy tm_attach_select on storage.objects for select to authenticated
      using (bucket_id = 'tm-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
    execute $p$create policy tm_attach_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'tm-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
    execute $p$create policy tm_attach_update on storage.objects for update to authenticated
      using (bucket_id = 'tm-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
    execute $p$create policy tm_attach_delete on storage.objects for delete to authenticated
      using (bucket_id = 'tm-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  end if;
end $$;
