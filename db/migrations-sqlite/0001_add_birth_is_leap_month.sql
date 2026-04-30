-- M3.x — profiles 增加 birth_is_leap_month 列（农历闰月支持）
-- 默认 false（0），既兼容已有公历档案，也兼容尚未指定闰月的农历档案。
ALTER TABLE `profiles` ADD COLUMN `birth_is_leap_month` integer DEFAULT false NOT NULL;
