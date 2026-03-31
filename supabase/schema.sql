create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  public_key text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  participant_a uuid not null references public.profiles (id) on delete cascade,
  participant_b uuid null references public.profiles (id) on delete cascade,
  active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz null,
  constraint room_participants_unique unique (participant_a, participant_b),
  constraint room_distinct_participants check (participant_b is null or participant_a <> participant_b)
);

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;

create policy "profiles are readable by authenticated users"
on public.profiles
for select
to authenticated
using (true);

create policy "users can upsert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "participants can read their rooms"
on public.rooms
for select
to authenticated
using (auth.uid() = participant_a or auth.uid() = participant_b or participant_b is null);

create policy "participants can create rooms"
on public.rooms
for insert
to authenticated
with check (auth.uid() = participant_a);

create policy "participants can update their rooms"
on public.rooms
for update
to authenticated
using (auth.uid() = participant_a or auth.uid() = participant_b or participant_b is null)
with check (auth.uid() = participant_a or auth.uid() = participant_b);

comment on table public.profiles is
'Stores minimal identity metadata only: username and public ECDH key. No private keys and no messages.';

comment on table public.rooms is
'Stores ephemeral room metadata only. Never store chat messages here or in any other table.';
