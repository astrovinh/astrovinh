-- Users
create table public.users (
  id uuid references auth.users primary key,
  name text,
  avatar_url text,
  push_token text,
  is_premium boolean default false,
  auth_provider text,
  created_at timestamptz default now()
);

-- Connections (inner circle)
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  connected_user_id uuid references public.users(id) on delete cascade,
  nickname text,
  frequency text default 'daily',
  created_at timestamptz default now()
);

-- Pulses
create table public.pulses (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.users(id) on delete cascade,
  photo_url text,
  voice_note_url text,
  mood_emoji text,
  text_note text,
  pulse_style text,
  created_at timestamptz default now()
);

-- Reactions
create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  pulse_id uuid references public.pulses(id) on delete cascade,
  reactor_id uuid references public.users(id) on delete cascade,
  emoji text not null,
  voice_note_url text,
  created_at timestamptz default now()
);

-- Connection rhythm (replaces "streaks")
create table public.connection_rhythm (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid references public.users(id) on delete cascade,
  user_b_id uuid references public.users(id) on delete cascade,
  days_connected integer default 0,
  longest_run integer default 0,
  last_mutual_pulse_at timestamptz
);

-- Daily pulse tracking
create table public.daily_pulses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  date date not null,
  pulse_count integer default 0,
  unique(user_id, date)
);

-- Notification preferences
create table public.user_notification_preferences (
  user_id uuid references public.users(id) on delete cascade primary key,
  preferred_send_time time,
  timezone text,
  most_engaged_type text,
  last_open_time timestamptz,
  frequency_pref text default 'balanced',
  consecutive_days_ignored integer default 0
);

-- Notification log
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  notification_type text not null,
  message_text text,
  sent_at timestamptz default now(),
  opened_at timestamptz,
  action_taken text
);

-- Notification queue
create table public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  notification_type text not null,
  message_text text not null,
  scheduled_for timestamptz not null,
  sent boolean default false,
  created_at timestamptz default now()
);

-- Enable Row Level Security on all tables
alter table public.users enable row level security;
alter table public.connections enable row level security;
alter table public.pulses enable row level security;
alter table public.reactions enable row level security;
alter table public.connection_rhythm enable row level security;
alter table public.daily_pulses enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.notification_log enable row level security;
alter table public.notification_queue enable row level security;

-- Basic RLS policies (users can read/write their own data)
create policy "Users can view own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);
create policy "Users can view own connections" on public.connections for select using (auth.uid() = user_id or auth.uid() = connected_user_id);
create policy "Users can manage own connections" on public.connections for all using (auth.uid() = user_id);
create policy "Users can view pulses from connections" on public.pulses for select using (true);
create policy "Users can send pulses" on public.pulses for insert with check (auth.uid() = sender_id);
create policy "Users can view reactions" on public.reactions for select using (true);
create policy "Users can add reactions" on public.reactions for insert with check (auth.uid() = reactor_id);
create policy "Users can view own rhythm" on public.connection_rhythm for select using (auth.uid() = user_a_id or auth.uid() = user_b_id);
create policy "Users can view own daily pulses" on public.daily_pulses for select using (auth.uid() = user_id);
create policy "Users can manage own notification prefs" on public.user_notification_preferences for all using (auth.uid() = user_id);
create policy "Users can view own notification log" on public.notification_log for select using (auth.uid() = user_id);
