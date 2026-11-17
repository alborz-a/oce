import { NavLink } from 'react-router-dom';

interface NavItemProps {
  to: string;
  label: string;
  dot: string;
  end?: boolean;
}

function NavItem({ to, label, dot, end = false }: NavItemProps) {
  return (
    <NavLink to={to} end={end} className="mz-nav-item">
      <span className="mz-dot" style={{ background: dot }} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  );
}

/** Mizito left-column nav (P5 port). Items without an OCE route are intentionally omitted. */
export function MizitoNav() {
  return (
    <nav className="mz-nav" aria-label="منوی میزیتو" data-testid="mizito-nav">
      <NavItem to="/" end label="داشبورد" dot="var(--mz-primary)" />
      <hr />
      <NavItem to="/chat" label="گفتگو" dot="var(--mz-chat)" />
      <NavItem to="/projects" label="پروژه‌ها" dot="var(--mz-project)" />
      <NavItem to="/tasks" label="وظایف" dot="var(--mz-task)" />
      <NavItem to="/correspondence" label="نامه‌ها" dot="var(--mz-inbox)" />
      <hr />
    </nav>
  );
}
