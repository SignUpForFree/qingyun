"use client";

import * as React from "react";
import Picker from "react-mobile-picker";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getProvinces, getCities, getDistricts } from "@/lib/regions/pca-data";

export interface RegionPickerValue {
  province: string;
  city: string;
  district?: string;
  longitude: number;
  latitude: number;
}

export interface RegionPickerProps {
  value: RegionPickerValue | null;
  onChange: (value: RegionPickerValue | null) => void;
  className?: string;
  disabled?: boolean;
}

interface DraftValue {
  province: string;
  city: string;
  district: string;
  [key: string]: string;
}

/**
 * 出生地选择器 — 省/市/区 三级联动抽屉 + 经纬度手动输入
 *
 * - 触发行：显示选中结果（如"北京市 · 市辖区 · 东城区"），点击打开 Sheet
 * - Sheet 内：3 列滚轮（省/市/区），联动
 * - Sheet 底部：取消/确定
 * - 经纬度手动输入
 */

export function RegionPicker({
  value,
  onChange,
  className,
  disabled,
}: RegionPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftValue>(() => valueToDraft(value));

  const openSheet = () => {
    if (disabled) return;
    setDraft(valueToDraft(value));
    setOpen(true);
  };

  const handleConfirm = () => {
    onChange({
      province: draft.province,
      city: draft.city,
      district: draft.district,
      longitude: value?.longitude ?? 0,
      latitude: value?.latitude ?? 0,
    });
    setOpen(false);
  };

  // 省变 → 市重置为第一个，区重置
  // 市变 → 区重置为第一个
  const handleDraftChange = (next: DraftValue, key: string) => {
    if (key === "province" && next.province !== draft.province) {
      const cities = getCities(next.province);
      const firstCity = cities[0] ?? "";
      const districts = getDistricts(next.province, firstCity);
      setDraft({
        ...next,
        city: firstCity,
        district: districts[0] ?? "",
      });
    } else if (key === "city" && next.city !== draft.city) {
      const districts = getDistricts(draft.province, next.city);
      setDraft({
        ...next,
        district: districts[0] ?? "",
      });
    } else {
      setDraft(next);
    }
  };

  // 当前 draft 对应的选项
  const provinces = React.useMemo(() => getProvinces(), []);
  const cities = React.useMemo(() => getCities(draft.province), [draft.province]);
  const districts = React.useMemo(
    () => getDistricts(draft.province, draft.city),
    [draft.province, draft.city],
  );

  // 确保 draft 值在选项内
  const safeDraft: DraftValue = React.useMemo(() => {
    const p = provinces.includes(draft.province) ? draft.province : (provinces[0] ?? "");
    const cs = getCities(p);
    const c = cs.includes(draft.city) ? draft.city : (cs[0] ?? "");
    const ds = getDistricts(p, c);
    const d = ds.includes(draft.district) ? draft.district : (ds[0] ?? "");
    return { province: p, city: c, district: d };
  }, [draft, provinces]);

  const longitude = value?.longitude ?? 0;
  const latitude = value?.latitude ?? 0;

  const handleLngChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!value) return;
    const v = parseFloat(e.target.value);
    onChange({ ...value, longitude: Number.isNaN(v) ? 0 : v });
  };

  const handleLatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!value) return;
    const v = parseFloat(e.target.value);
    onChange({ ...value, latitude: Number.isNaN(v) ? 0 : v });
  };

  // trigger 行展示文案
  const triggerLabel = value
    ? [value.province, value.city, value.district].filter(Boolean).join(" · ")
    : "选择出生地（省 / 市 / 区）";

  return (
    <div className={cn("space-y-3", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={openSheet}
        data-testid="onboarding-region-trigger"
        className={cn(
          "flex w-full items-center gap-2 rounded-[8px] border border-input bg-white px-3 py-2.5 text-sm transition-colors",
          "hover:bg-[var(--color-accent-lavender)]/10 disabled:opacity-50",
          value ? "text-[var(--color-ink-plum)]" : "text-[var(--color-ink-fade)]",
        )}
      >
        <MapPin className="h-4 w-4 opacity-60" />
        <span className="flex-1 text-left">{triggerLabel}</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="rounded-t-[16px] border-t border-[var(--color-accent-lavender)]/30 bg-[var(--color-bg-paper)] p-0"
        >
          <SheetHeader className="border-b border-[var(--color-accent-lavender)]/20 pb-3">
            <SheetTitle className="text-center font-[family-name:var(--font-serif)] text-[15px] tracking-ritual text-[var(--color-ink-plum)]">
              选择出生地
            </SheetTitle>
            <SheetDescription className="sr-only">
              请滚动选择省、市、区
            </SheetDescription>
            {/* 选中结果展示 */}
            <div className="mx-4 mt-1 rounded-[8px] bg-[var(--color-accent-lavender)]/15 px-3 py-2 text-center">
              <p className="font-[family-name:var(--font-serif)] text-sm tracking-ritual text-[var(--color-ink-plum)]">
                {safeDraft.province}{safeDraft.city ? ` ${safeDraft.city}` : ""}{safeDraft.district ? ` ${safeDraft.district}` : ""}
              </p>
            </div>
          </SheetHeader>

          <div className="relative px-2 py-3" data-testid="onboarding-region-wheel">
            {/* 中央选中行高亮 */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-2 right-2 top-1/2 z-10 h-8 -translate-y-1/2 rounded-[8px] bg-[var(--color-accent-lavender)]/20 ring-1 ring-[var(--color-accent-lavender)]/40"
            />
            <Picker
              value={safeDraft}
              onChange={(next, key) => handleDraftChange(next as DraftValue, key as string)}
              height={200}
              itemHeight={32}
              wheelMode="natural"
            >
              <Picker.Column name="province">
                {provinces.map((name) => (
                  <Picker.Item key={name} value={name}>
                    {name}
                  </Picker.Item>
                ))}
              </Picker.Column>
              <Picker.Column name="city">
                {cities.map((name) => (
                  <Picker.Item key={name} value={name}>
                    {name}
                  </Picker.Item>
                ))}
              </Picker.Column>
              <Picker.Column name="district">
                {districts.map((name) => (
                  <Picker.Item key={name} value={name}>
                    {name}
                  </Picker.Item>
                ))}
              </Picker.Column>
            </Picker>
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-[var(--color-accent-lavender)]/20 p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              className="bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] text-white hover:opacity-90"
            >
              确定
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* 经纬度手动输入 */}
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          step="0.0001"
          placeholder="经度 (如 116.4074)"
          value={longitude || ""}
          onChange={handleLngChange}
          disabled={disabled}
        />
        <Input
          type="number"
          step="0.0001"
          placeholder="纬度 (如 39.9042)"
          value={latitude || ""}
          onChange={handleLatChange}
          disabled={disabled}
        />
      </div>
      <p className="text-xs text-[var(--color-ink-fade)]">
        经纬度用于八字真太阳时换算，可从地图软件获取
      </p>
    </div>
  );
}

// ───────── helpers ─────────

function valueToDraft(value: RegionPickerValue | null): DraftValue {
  if (!value) {
    const provinces = getProvinces();
    const firstProvince = provinces[0] ?? "";
    const cities = getCities(firstProvince);
    const firstCity = cities[0] ?? "";
    const districts = getDistricts(firstProvince, firstCity);
    return {
      province: firstProvince,
      city: firstCity,
      district: districts[0] ?? "",
    };
  }
  return {
    province: value.province,
    city: value.city,
    district: value.district ?? "",
  };
}
