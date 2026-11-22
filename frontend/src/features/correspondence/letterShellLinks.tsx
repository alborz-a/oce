import { Link, type LinkProps } from 'react-router-dom';
import { isRestrictedRouteAllowed } from '@/app/restrictedRoutes';

/**
 * True when a letters link stays inside the Mizito shell: the letters list,
 * a project workspace, or a project's letters. Anything else (raw OCE pages
 * such as /contacts, /rfi, /transmittals) must not be reachable from letters.
 */
export function isShellSafePath(to: string): boolean {
  return isRestrictedRouteAllowed(to);
}

/**
 * Drop-in for `Link` inside the letters page. A link that would leave the shell
 * renders as plain text, so the label stays readable but the navigation is gone.
 */
export function ShellLink({ to, className, children, ...rest }: LinkProps) {
  const path = typeof to === 'string' ? to : '';
  if (!isShellSafePath(path)) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link to={to} className={className} {...rest}>
      {children}
    </Link>
  );
}
