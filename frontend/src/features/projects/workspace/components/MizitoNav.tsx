import { Link, NavLink } from 'react-router-dom';

interface NavItemProps {
  to: string;
  label: string;
  dot: string;
  end?: boolean;
  /** null: follow the router match. true/false: forced highlight (used by pages outside the nav's route). */
  active?: boolean | null;
}

function NavItem({ to, label, dot, end = false, active = null }: NavItemProps) {
  const content = (
    <>
      <span className="mz-dot" style={{ background: dot }} aria-hidden="true" />
      <span>{label}</span>
    </>
  );
  if (active === null) {
    return (
      <NavLink to={to} end={end} className="mz-nav-item">
        {content}
      </NavLink>
    );
  }
  return (
    <Link to={to} className="mz-nav-item" aria-current={active ? 'page' : undefined}>
      {content}
    </Link>
  );
}

/**
 * Mizito left-column nav (P5 port). Items without an OCE route are intentionally omitted.
 * `activeTo` (optional) forces exactly one item highlighted, e.g. `/correspondence` on the letters page.
 */
export function MizitoNav({ activeTo }: { activeTo?: string } = {}) {
  const forced = (to: string) => (activeTo === undefined ? null : activeTo === to);
  return (
    <nav className="mz-nav" aria-label="منوی میزیتو" data-testid="mizito-nav">
      <NavItem to="/" end label="داشبورد" dot="var(--mz-primary)" active={forced('/')} />
      <hr />
      <NavItem to="/chat" label="گفتگو" dot="var(--mz-chat)" active={forced('/chat')} />
      <NavItem to="/projects" label="پروژه‌ها" dot="var(--mz-project)" active={forced('/projects')} />
      <NavItem to="/tasks" label="وظایف" dot="var(--mz-task)" active={forced('/tasks')} />
      <NavItem to="/correspondence" label="نامه‌ها" dot="var(--mz-inbox)" active={forced('/correspondence')} />
      <hr />
    </nav>
  );
}
