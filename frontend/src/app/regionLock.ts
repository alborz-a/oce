// [RSC-IRAN] Region lock configuration for Iran deployment
export const REGION_LOCK = import.meta.env.VITE_OE_REGION_LOCK !== 'false';

export const LOCKED = {
  language: 'fa',
  currency: 'IRR',
  country: 'IR',
  calendar: 'jalali',
  weekStart: 6, // 6 = Saturday (first day of week in Iran)
} as const;
