// Pure helpers for chat photo frames: detect bare image URLs in message text
// (imported messages may carry no attachment object). No network access here.

const IMAGE_URL_RE = /https?:\/\/[^\s<>"']+/gi;
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)$/i;

/** Returns http(s) URLs in text whose path ends with an image extension. Query strings (presigned URLs) are allowed. */
export function extractImageUrls(text: string | null | undefined): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const match of text.match(IMAGE_URL_RE) ?? []) {
    const cleaned = match.replace(/[.,;:!?)\]]+$/, '');
    let pathname: string;
    try {
      pathname = new URL(cleaned).pathname;
    } catch {
      continue;
    }
    if (IMAGE_EXT_RE.test(pathname) && !found.includes(cleaned)) found.push(cleaned);
  }
  return found;
}

/** True when the message is only image URLs (whitespace allowed), so its text can be hidden behind the frame. */
export function isBareImageUrlMessage(text: string | null | undefined): boolean {
  if (!text) return false;
  const urls = extractImageUrls(text);
  if (urls.length === 0) return false;
  let rest = text;
  for (const url of urls) rest = rest.split(url).join('');
  return rest.trim() === '';
}

export interface LightboxPhotoRef {
  id: string;
  url: string;
  name: string;
}

/** Flattens photo refs of a list in order, dropping duplicate ids, for lightbox prev/next navigation. */
export function collectLightboxPhotos(refs: LightboxPhotoRef[]): LightboxPhotoRef[] {
  const seen = new Set<string>();
  const out: LightboxPhotoRef[] = [];
  for (const ref of refs) {
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);
    out.push(ref);
  }
  return out;
}

/** Index wrap for RTL-aware navigation: step -1 (previous) or +1 (next), wrapping at both ends. */
export function wrapIndex(current: number, step: number, length: number): number {
  if (length <= 0) return 0;
  return (((current + step) % length) + length) % length;
}
