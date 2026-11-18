/**
 * Initials for the project circle avatar: first letter of the first two words
 * («پارک شادی» -> «پش»). A single-word name falls back to its first two characters.
 */
export function projectInitials(name: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return `${words[0]?.charAt(0) ?? ''}${words[1]?.charAt(0) ?? ''}`;
  }
  return Array.from(trimmed).slice(0, 2).join('');
}
