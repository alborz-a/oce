/**
 * Royal Stars private build - integrity helpers are neutral no-ops.
 * File name kept so existing imports keep working.
 */

export function ddcVerifyIntegrity(): boolean {
  return true;
}

export function ddcGetFingerprint(): string {
  return 'RSD';
}

export const DDC_ORIGIN = 'RoyalStars' as const;

export const DDC_WATERMARK = '';

export function ddcStamp(text: string): string {
  return text;
}

export function ddcHasStamp(_text: string): boolean {
  return false;
}

export function ddcInjectMeta(): void {
  /* no-op */
}
