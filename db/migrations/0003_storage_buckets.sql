-- ============================================================
-- 轻运 AI · 0003 storage avatars bucket
-- 公共可读，用户只能写 user_id 命名的对象
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 用户只能写以自己 user_id 开头的路径（如 avatars/<uid>/profile.png）
create policy avatars_user_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_user_update on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');
