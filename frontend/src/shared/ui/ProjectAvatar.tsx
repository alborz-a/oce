import type { CSSProperties } from 'react';

/** Mizito project colour names mapped to hex. Unknown or missing names use grey. */
export const PROJECT_COLOR_HEX: Record<string, string> = {
  grey: '#8A8F98',
  red: '#E5484D',
  purple: '#8E4EC6',
  'light-blue': '#5BB8F5',
  blue: '#3B82F6',
  green: '#30A46C',
  'red-dark': '#A40E26',
  brown: '#8B5E3C',
};

const FALLBACK_COLOR = PROJECT_COLOR_HEX.grey;

export function projectColorHex(color: string | null | undefined): string {
  if (!color) return FALLBACK_COLOR;
  return PROJECT_COLOR_HEX[color.trim().toLowerCase()] ?? FALLBACK_COLOR;
}

/** Up to two initials from the first letters of the first two words (code-point safe). */
export function projectInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
    .toUpperCase();
}

interface ProjectAvatarProps {
  name: string;
  /** Presigned picture URL; when empty the initials on the colour are shown. */
  pictureUrl?: string | null;
  /** Mizito colour name (grey, red, purple, light-blue, blue, green, red-dark, brown). */
  color?: string | null;
  /** Edge length in px. */
  size?: number;
  className?: string;
}

/**
 * Project picture (avatar). Shows the project picture when present, otherwise
 * initials on the project colour. The picture URL is presigned, so a plain
 * `<img>` is enough (no bearer token needed).
 */
export function ProjectAvatar({ name, pictureUrl, color, size = 32, className }: ProjectAvatarProps) {
  const box: CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: Math.max(4, Math.round(size / 5)),
  };

  if (pictureUrl) {
    return (
      <img
        src={pictureUrl}
        alt={name}
        data-testid="project-avatar-picture"
        className={className ?? 'object-cover'}
        style={box}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      data-testid="project-avatar-initials"
      className={`inline-flex select-none items-center justify-center font-semibold text-white ${className ?? ''}`}
      style={{
        ...box,
        backgroundColor: projectColorHex(color),
        fontSize: Math.max(10, Math.round(size * 0.4)),
        lineHeight: 1,
      }}
    >
      {projectInitials(name)}
    </span>
  );
}
