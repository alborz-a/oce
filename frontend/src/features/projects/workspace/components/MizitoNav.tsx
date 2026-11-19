import { Link, NavLink } from 'react-router-dom';
import { useProjectContextStore } from '@/stores/useProjectContextStore';
import { toPersianDigits } from '@/shared/lib/jalali';
import { MzIcon } from './MzIcon';

export interface MizitoNavCounts {
  /** My tasks not completed, due before today (red pill on وظایف). */
  taskOverdue?: number;
  /** My tasks not completed, due today or later (green pill on وظایف). */
  taskOpen?: number;
  projects?: number;
  letters?: number;
}

interface NavPill {
  key: string;
  count?: number;
  tone: 'red' | 'green';
}

interface NavItemProps {
  to: string;
  label: string;
  icon: string;
  color: string;
  end?: boolean;
  /** null: follow the router match. true/false: forced highlight (used by pages outside the nav's route). */
  active?: boolean | null;
  /** Badge key (projects|letters) and its count; badge renders only when count > 0. */
  badgeKey?: keyof MizitoNavCounts;
  count?: number;
  /** Extra small pills after the label; each renders only when its count > 0. */
  pills?: NavPill[];
}

function NavItem({ to, label, icon, color, end = false, active = null, badgeKey, count, pills }: NavItemProps) {
  const visiblePills = (pills ?? []).filter((p) => p.count && p.count > 0);
  const content = (
    <>
      <MzIcon name={icon} size={24} color={color} />
      <span>{label}</span>
      {badgeKey && count && count > 0 ? (
        <span className="mz-nav-badge" data-testid={`mz-nav-badge-${badgeKey}`}>
          {toPersianDigits(count)}
        </span>
      ) : null}
      {visiblePills.length > 0 ? (
        <span className="mz-nav-badges">
          {visiblePills.map((p) => (
            <span
              key={p.key}
              className={`mz-nav-badge mz-nav-badge--${p.tone}`}
              data-testid={`mz-nav-badge-${p.key}`}
            >
              {toPersianDigits(p.count ?? 0)}
            </span>
          ))}
        </span>
      ) : null}
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
 * Mizito left-column nav (P5 port).
 * `activeTo` (optional) forces exactly one item highlighted, e.g. `/correspondence` on the letters page.
 */
export function MizitoNav({
  onOpenCompanyChat,
  activeTo,
  counts,
}: { onOpenCompanyChat?: () => void; activeTo?: string; counts?: MizitoNavCounts } = {}) {
  const forced = (to: string) => (activeTo === undefined ? null : activeTo === to);
  const activeProjectId = useProjectContextStore((s) => s.activeProjectId);
  // Project-scoped letters link so RestrictedRouteGuard keeps the user in the active project.
  const lettersTo = activeProjectId ? `/projects/${activeProjectId}/correspondence` : '/correspondence';
  return (
    <nav className="mz-nav" aria-label="منوی میزیتو" data-testid="mizito-nav">
      <NavItem to="/" end label="داشبورد" icon="home" color="#db4437" active={forced('/')} />
      <hr />
      {onOpenCompanyChat ? (
        <button
          type="button"
          className="mz-nav-item"
          onClick={onOpenCompanyChat}
          data-testid="mizito-nav-company-chat"
        >
          <MzIcon name="chat" size={24} color="#4285f4" />
          <span>گفتگو</span>
        </button>
      ) : (
        <NavItem to="/chat" label="گفتگو" icon="chat" color="#4285f4" active={forced('/chat')} />
      )}
      <NavItem to="/projects" label="پروژه‌ها" icon="library_books" color="#1f5c88" active={forced('/projects')} badgeKey="projects" count={counts?.projects} />
      <NavItem
        to="/tasks"
        label="وظایف"
        icon="offline_pin"
        color="#0f9d58"
        active={forced('/tasks')}
        pills={[
          { key: 'task-overdue', count: counts?.taskOverdue, tone: 'red' },
          { key: 'task-open', count: counts?.taskOpen, tone: 'green' },
        ]}
      />
      <NavItem to={lettersTo} label="نامه‌ها" icon="inbox" color="#ff6839" active={forced('/correspondence')} badgeKey="letters" count={counts?.letters} />
      <NavItem to="/notes" label="یادداشتهای من" icon="assignment" color="#fb0" active={forced('/notes')} />
      <NavItem to="/customers" label="پرونده مشتریان" icon="perm_contact_calendar" color="#607d8b" active={forced('/customers')} />
      <NavItem to="/monitoring" label="مانیتورینگ" icon="assessment" color="#039be5" active={forced('/monitoring')} />
      <hr />
    </nav>
  );
}
