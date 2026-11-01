// Admin-controlled help banners. One row per banner key (the DismissibleInfo storageKey),
// stored on the backend (oe_info_banner). Everyone reads, only the system admin writes.

import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/shared/lib/api';

export interface InfoBannerSetting {
  visible: boolean;
  text: string | null;
}

const BASE = '/v1/info-banners';
export const INFO_BANNERS_KEY = ['info-banners'] as const;

export function useInfoBanners() {
  return useQuery({
    queryKey: INFO_BANNERS_KEY,
    queryFn: () => apiGet<Record<string, InfoBannerSetting>>(`${BASE}/`),
    staleTime: 5 * 60 * 1000,
  });
}

export const infoBannersApi = {
  save: (pageKey: string, body: InfoBannerSetting) =>
    apiPut<{ page_key: string } & InfoBannerSetting>(`${BASE}/${encodeURIComponent(pageKey)}/`, body),
};

/** Pure rule: admin always sees the banner; others only when switched on. */
export function bannerShownTo(isAdmin: boolean, setting: InfoBannerSetting | undefined): boolean {
  return isAdmin || setting?.visible === true;
}
