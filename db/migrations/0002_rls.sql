-- ============================================================
-- 轻运 AI · 0002 RLS 策略
-- 原则：用户只能读写自己的数据
--   - profiles / conversations 直接 user_id
--   - bazi_charts / fortunes 通过 profile_id → profiles.user_id 反查
--   - messages 通过 conversation_id → conversations.user_id 反查
--   - divination_records 通过 message_id → messages → conversations 反查
-- 种子表 prompts / divination_slips / hexagrams 对 authenticated 只读
-- ============================================================

-- ---------- profiles ----------
alter table public.profiles enable row level security;
create policy profiles_self_all on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- bazi_charts ----------
alter table public.bazi_charts enable row level security;
create policy bazi_charts_self_all on public.bazi_charts
  for all using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid())
  );

-- ---------- fortunes ----------
alter table public.fortunes enable row level security;
create policy fortunes_self_all on public.fortunes
  for all using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid())
  );

-- ---------- conversations ----------
alter table public.conversations enable row level security;
create policy conversations_self_all on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- messages ----------
alter table public.messages enable row level security;
create policy messages_self_select on public.messages
  for select using (
    exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );
create policy messages_self_insert on public.messages
  for insert with check (
    exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );

-- ---------- divination_records ----------
alter table public.divination_records enable row level security;
create policy divination_records_self_select on public.divination_records
  for select using (
    exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id and c.user_id = auth.uid()
    )
  );
create policy divination_records_self_insert on public.divination_records
  for insert with check (
    exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id and c.user_id = auth.uid()
    )
  );

-- ---------- 种子表：authenticated 只读 ----------
alter table public.prompts enable row level security;
create policy prompts_read on public.prompts
  for select to authenticated using (active = true);

alter table public.divination_slips enable row level security;
create policy slips_read on public.divination_slips
  for select to authenticated using (true);

alter table public.hexagrams enable row level security;
create policy hexagrams_read on public.hexagrams
  for select to authenticated using (true);
