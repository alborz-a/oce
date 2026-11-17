import type { CSSProperties } from 'react';
import '../mzIcons.css';

export interface MzIconProps {
  /** Material Icons ligature name, e.g. `arrow_back`. */
  name: string;
  /** Pixel size of the glyph. Default 18. */
  size?: number;
  /** Glyph colour. Pass a token value or a CSS colour; inherits when omitted. */
  color?: string;
  className?: string;
  style?: CSSProperties;
  /** Mirror horizontally in RTL layouts (ligatures that point a direction). */
  flipRtl?: boolean;
}

/**
 * Material Icons ligature glyph. Decorative only: always aria-hidden,
 * the surrounding button must carry the accessible label.
 */
export function MzIcon({ name, size = 18, color, className, style, flipRtl = false }: MzIconProps) {
  const classes = ['mz-icon', flipRtl ? 'icon-flip-horizontal' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <span
      aria-hidden="true"
      className={classes}
      style={{ fontSize: `${size}px`, width: `${size}px`, height: `${size}px`, color, ...style }}
    >
      {name}
    </span>
  );
}
