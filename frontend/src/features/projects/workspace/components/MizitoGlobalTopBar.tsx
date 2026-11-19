import { useEffect, useState } from 'react';
import { MzIcon } from './MzIcon';
import '../workspace.css';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBrandingStore } from '@/stores/useBrandingStore';
import { apiGet } from '@/shared/lib/api';
import { UserAvatar } from '@/shared/ui/UserAvatar';

export interface MizitoGlobalTopBarProps {
  /** Hamburger click: opens the Mizito switcher drawer (host decides the target). Single hamburger on mobile and desktop. */
  onMenuClick: () => void;
}

const FALLBACK_BRAND = 'رویال استارز';

/** Global dark-blue top bar of the Mizito workspace (menu, logo + plain title, search, quick icons, avatar with user menu). */
export function MizitoGlobalTopBar({ onMenuClick }: MizitoGlobalTopBarProps) {
  const navigate = useNavigate();
  const fullName = useAuthStore((s) => s.userFullName);
  const logout = useAuthStore((s) => s.logout);
  const company = useBrandingStore((s) => s.companyName.trim());
  const logoDataUrl = useBrandingStore((s) => s.logoDataUrl);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Same route as the OCE header (`/v1/users/me/`, `avatar_url`).
  useEffect(() => {
    let cancelled = false;
    apiGet<{ avatar_url?: string | null }>('/v1/users/me/')
      .then((me) => {
        if (!cancelled) setAvatarUrl(me?.avatar_url ?? null);
      })
      .catch(() => {
        if (!cancelled) setAvatarUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openSearch = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  };
  const iconBtn =
    'inline-flex h-8 w-8 items-center justify-center rounded-full text-white/85 hover:bg-white/15 hover:text-white';
  const menuItem = 'block w-full px-3 py-2 text-start text-[13px] text-[#37474f] hover:bg-[#f2f4f7]';

  return (
    <header
      dir="rtl"
      data-testid="mizito-global-topbar"
      className="sticky top-0 z-40 flex h-14 items-center gap-3 px-4 text-white"
      style={{ background: '#4285f4', height: 56, minHeight: 56 }}
    >
      <button type="button" onClick={onMenuClick} aria-label="منو" className={iconBtn}>
        <MzIcon name="menu" size={20} />
      </button>

      <div className="flex min-w-0 items-center gap-2" data-testid="mizito-brand">
        <img src={logoDataUrl ?? '/company-logo.svg'} alt="" className="mz-brand-logo h-11 w-11 shrink-0 object-contain" />
        <span className="truncate whitespace-nowrap text-[15px] font-bold">{company || FALLBACK_BRAND}</span>
      </div>

      <button
        type="button"
        onClick={openSearch}
        className="ms-auto hidden h-8 w-[190px] items-center gap-2 rounded-[4px] bg-white/[0.16] px-3 text-[12.5px] text-white/80 hover:bg-white/25 md:flex"
      >
        <MzIcon name="search" size={14} />
        <span>جستجو</span>
      </button>

      <div className="flex items-center gap-1 md:ms-0 ms-auto">
        <button type="button" onClick={() => navigate('/tasks')} aria-label="وظایف" className={iconBtn}>
          <MzIcon name="bookmark" size={17} />
        </button>
        <button type="button" onClick={() => navigate('/profile')} aria-label="راهنما" className={iconBtn}>
          <MzIcon name="help" size={17} flipRtl />
        </button>
        <button type="button" onClick={() => navigate('/projects')} aria-label="گفتگو" className={iconBtn}>
          <MzIcon name="question_answer" size={17} />
        </button>
        <button type="button" onClick={() => navigate('/settings')} aria-label="تنظیمات" className={iconBtn}>
          <MzIcon name="settings" size={17} />
        </button>
        <div className="relative ms-1 flex items-center">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="منوی کاربر"
            data-testid="mizito-avatar"
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#e0e3e8] text-[13px] font-bold text-[#37474f] shadow-[0_1px_3px_rgba(0,0,0,.28)]"
          >
            {avatarUrl ? (
              <UserAvatar url={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              (fullName ?? '؟').trim().charAt(0)
            )}
          </button>
          {menuOpen && (
            <div
              role="menu"
              data-testid="mizito-user-menu"
              className="absolute end-0 top-full z-50 mt-2 w-48 rounded-md bg-white py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className={menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/profile');
                }}
              >
                پروفایل
              </button>
              <button
                type="button"
                role="menuitem"
                className={menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                  window.location.href = '/login';
                }}
              >
                خروج
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
