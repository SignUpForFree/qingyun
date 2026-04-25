"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { REGIONS, findProvince, findCity, type City } from "@/lib/regions/data";

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
  /** 是否要求填写区/县 — 默认 false，spec MVP 不强制 */
  requireDistrict?: boolean;
}

/**
 * 出生地选择器（省 → 市 → 区文本，自动带出经纬度）
 *
 * - 省/市来自 lib/regions/data.ts 内置 34 一级行政区 + 主要城市
 * - 区/县接受文本输入（MVP 简化，不联动具体县级数据）
 * - 切换省时自动清空市；切换市时自动写入经纬度
 * - value 为 null 表示用户尚未完成任意一步
 */
export function RegionPicker({
  value,
  onChange,
  className,
  disabled,
  requireDistrict = false,
}: RegionPickerProps) {
  const province = value?.province ?? "";
  const city = value?.city ?? "";
  const district = value?.district ?? "";

  const cityOptions: readonly City[] = React.useMemo(() => {
    if (!province) return [];
    return findProvince(province)?.cities ?? [];
  }, [province]);

  const handleProvinceChange = (next: string | null) => {
    if (!next) return;
    // 切省：清空市/区/经纬度，等待用户选市
    onChange({
      province: next,
      city: "",
      district: "",
      longitude: 0,
      latitude: 0,
    });
  };

  const handleCityChange = (next: string | null) => {
    if (!next || !province) return;
    const c = findCity(province, next);
    if (!c) return;
    onChange({
      province,
      city: next,
      district: value?.district ?? "",
      longitude: c.lng,
      latitude: c.lat,
    });
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!value) return;
    onChange({ ...value, district: e.target.value });
  };

  const isComplete = Boolean(value?.province && value?.city);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-2 gap-2">
        <Select value={province} onValueChange={handleProvinceChange} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="出生省份" />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map((p) => (
              <SelectItem key={p.name} value={p.name}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={city}
          onValueChange={handleCityChange}
          disabled={disabled || !province}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={province ? "出生城市" : "先选省"} />
          </SelectTrigger>
          <SelectContent>
            {cityOptions.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Input
        placeholder={requireDistrict ? "出生区/县（必填）" : "出生区/县（选填）"}
        value={district}
        onChange={handleDistrictChange}
        disabled={disabled || !isComplete}
      />

      {isComplete && (
        <p className="text-xs text-[var(--color-ink-fade)]">
          经度 {value!.longitude.toFixed(4)}° · 纬度 {value!.latitude.toFixed(4)}° · 用于八字真太阳时换算
        </p>
      )}
    </div>
  );
}
