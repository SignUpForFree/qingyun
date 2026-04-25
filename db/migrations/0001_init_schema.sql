-- ============================================================
-- 轻运 AI · 0001 init schema
-- 来源：docs/superpowers/specs/2026-04-24-qingyun-ai-design.md 第 4 节
-- 9 张表：profiles / bazi_charts / fortunes / conversations / messages
--         / divination_records / prompts / divination_slips / hexagrams
-- ============================================================

-- 通用 updated_at 触发器
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text,
  gender text check (gender in ('male','female')),
  birth_time timestamptz,
  calendar_type text check (calendar_type in ('solar','lunar')) default 'solar',
  birth_province text,
  birth_city text,
  birth_district text,
  birth_longitude numeric(9,6),
  birth_latitude numeric(9,6),
  current_location jsonb,
  avatar_url text,
  is_default bool default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_user_default_idx on public.profiles(user_id, is_default);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- bazi_charts ----------
create table public.bazi_charts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  pillars jsonb not null,
  five_elements jsonb not null,
  day_master text not null,
  ten_gods jsonb not null,
  favorable_gods jsonb,
  luck_pillars jsonb,
  solar_true_time timestamptz not null,
  raw jsonb,
  created_at timestamptz not null default now()
);

-- ---------- fortunes ----------
create table public.fortunes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  fortune_date date not null,
  score_overall int,
  scores jsonb,
  one_liner text,
  readings jsonb,
  attributes jsonb,
  model text,
  tokens_used int,
  created_at timestamptz not null default now(),
  unique (profile_id, fortune_date)
);

-- ---------- conversations ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  title text,
  last_message_at timestamptz default now(),
  created_at timestamptz not null default now()
);
create index conversations_user_recent_idx on public.conversations(user_id, last_message_at desc);

-- ---------- messages ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  intent text check (intent in ('chat','divination','dream','bazi','meihua')),
  metadata jsonb,
  tokens_used int default 0,
  created_at timestamptz not null default now()
);
create index messages_conv_time_idx on public.messages(conversation_id, created_at);
create index messages_user_hourly_idx on public.messages(created_at)
  where role = 'user';

-- ---------- divination_records ----------
create table public.divination_records (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.messages(id) on delete cascade,
  type text not null check (type in ('qianwen','dream','bazi','meihua')),
  input jsonb not null,
  result jsonb not null,
  ai_reading text,
  created_at timestamptz not null default now()
);

-- ---------- prompts ----------
create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version int not null default 1,
  system_prompt text not null,
  user_prompt_tpl text not null,
  active bool not null default true,
  created_at timestamptz not null default now(),
  unique (key, version)
);
create index prompts_key_active_idx on public.prompts(key) where active = true;

-- ---------- divination_slips（P2 seed） ----------
create table public.divination_slips (
  number int primary key check (number between 1 and 100),
  level text not null check (level in ('上上','上吉','吉','平','渐顺','慎行')),
  title text not null,
  poem text not null,
  readings jsonb not null,
  image_url text
);

-- ---------- hexagrams（P2 seed） ----------
create table public.hexagrams (
  number int primary key check (number between 1 and 64),
  name text not null,
  upper_trigram text not null check (upper_trigram in ('乾','兑','离','震','巽','坎','艮','坤')),
  lower_trigram text not null check (lower_trigram in ('乾','兑','离','震','巽','坎','艮','坤')),
  upper_wuxing text not null check (upper_wuxing in ('金','木','水','火','土')),
  lower_wuxing text not null check (lower_wuxing in ('金','木','水','火','土')),
  judgment text not null,
  image text not null,
  lines jsonb not null
);
