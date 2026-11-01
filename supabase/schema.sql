-- NovaWallet — Supabase schema, RLS and admin guards
-- Run this once in Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

/* ------------------------------------------------------------------ */
/* profiles                                                            */
/* ------------------------------------------------------------------ */
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_suspended boolean not null default false,
  withdrawal_lock boolean not null default false,
  wallet_address text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- security-definer helper: is the caller an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- create a profile row for every new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- block privilege escalation from normal users
create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service role / SQL editor has no auth.uid(); allow it
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_suspended is distinct from old.is_suspended then
      raise exception 'Only administrators can change role or suspension status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_trg on public.profiles;
create trigger protect_profile_trg
before update on public.profiles
for each row execute function public.protect_profile();

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read"
on public.profiles for select
using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles update" on public.profiles;
create policy "profiles update"
on public.profiles for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

/* ------------------------------------------------------------------ */
/* tickets                                                             */
/* ------------------------------------------------------------------ */
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  admin_reply text,
  created_at timestamptz not null default now()
);

alter table public.tickets enable row level security;

drop policy if exists "tickets read" on public.tickets;
create policy "tickets read"
on public.tickets for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "tickets insert" on public.tickets;
create policy "tickets insert"
on public.tickets for insert
with check (auth.uid() = user_id);

drop policy if exists "tickets admin update" on public.tickets;
create policy "tickets admin update"
on public.tickets for update
using (public.is_admin())
with check (public.is_admin());

create index if not exists tickets_user_idx on public.tickets(user_id);

/* ------------------------------------------------------------------ */
/* audit_log                                                           */
/* ------------------------------------------------------------------ */
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

drop policy if exists "audit insert own" on public.audit_log;
create policy "audit insert own"
on public.audit_log for insert
with check (auth.uid() = user_id);

drop policy if exists "audit read" on public.audit_log;
create policy "audit read"
on public.audit_log for select
using (auth.uid() = user_id or public.is_admin());

create index if not exists audit_created_idx on public.audit_log(created_at desc);

/* ------------------------------------------------------------------ */
/* bootstrap the first admin                                           */
/* Replace the email below with your own, then run just this statement. */
/* ------------------------------------------------------------------ */
-- update public.profiles set role = 'admin' where email = 'you@example.com';
