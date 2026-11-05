// [RSC-IRAN] Icon-only button with a tooltip. The label is the tooltip, the
// aria-label and the native title, so touch and screen readers get it too.
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> {
  /** Tooltip and accessible name. Required: an icon alone says nothing. */
  label: string;
  icon: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
}

const VARIANT: Record<NonNullable<IconButtonProps['variant']>, string> = {
  primary: 'bg-oe-blue text-white hover:bg-oe-blue-hover',
  secondary:
    'border border-border-light text-content-secondary hover:bg-surface-secondary hover:text-content-primary',
  ghost: 'text-content-tertiary hover:bg-surface-secondary hover:text-content-primary',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'secondary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <span className="group/ib relative inline-flex shrink-0">
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={clsx(
          'inline-flex items-center justify-center rounded-lg transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-oe-blue/40',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
          VARIANT[variant],
          className,
        )}
        {...rest}
      >
        {icon}
      </button>
      <span
        role="tooltip"
        className={clsx(
          'pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap',
          'rounded-md bg-content-primary px-2 py-1 text-[11px] font-medium text-surface-primary shadow-lg',
          'opacity-0 transition-opacity delay-150 group-hover/ib:opacity-100 group-focus-within/ib:opacity-100',
        )}
      >
        {label}
      </span>
    </span>
  );
});
