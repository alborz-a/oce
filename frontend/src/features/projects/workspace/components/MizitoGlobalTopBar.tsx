import { useState } from 'react';
import { Bell, ChevronDown, HelpCircle, Menu, Search, Settings } from 'lucide-react';
import { MzIcon } from './MzIcon';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBrandingStore } from '@/stores/useBrandingStore';
import { Logo } from '@/shared/ui';

export interface MizitoGlobalTopBarProps {
  /** Hamburger click: opens the Mizito switcher drawer (host decides the target). */
  onMenuClick: () => void;
  /** Opens the OCE app menu; offered as an item in the brand dropdown. */
  onOpenAppMenu?: () => void;
}

const FALLBACK_BRAND = 'رویال استارز';

/** Global dark-blue top bar of the Mizito workspace (menu, logo + company dropdown, search, quick icons, avatar). */
export function MizitoGlobalTopBar({ onMenuClick, onOpenAppMenu }: MizitoGlobalTopBarProps) {
  const navigate = useNavigate();
  const fullName = useAuthStore((s) => s.userFullName);
  const logout = useAuthStore((s) => s.logout);
  const company = useBrandingStore((s) => s.companyName.trim());
  const [menuOpen, setMenuOpen] = useState(false);

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
      className="sticky top-0 z-40 flex h-[52px] items-center gap-3 px-4 text-white"
      style={{ background: '#2b4162' }}
    >
      <button type="button" onClick={onMenuClick} aria-label="منو" className={iconBtn}>
        <Menu size={20} />
      </button>

      <div className="relative flex min-w-0 items-center">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-testid="mizito-brand"
          className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 hover:bg-white/10"
        >
          <Logo size="xs" />
          <span className="truncate whitespace-nowrap text-[15px] font-bold">{company || FALLBACK_BRAND}</span>
          <ChevronDown size={14} className="shrink-0 text-white/80" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            data-testid="mizito-brand-menu"
            className="absolute start-0 top-full z-50 mt-2 w-48 rounded-md bg-white py-1 shadow-lg"
          >
            {onOpenAppMenu && (
              <button
                type="button"
                role="menuitem"
                className={menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  onOpenAppMenu();
                }}
              >
                منوی برنامه
              </button>
            )}
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

      <button
        type="button"
        onClick={openSearch}
        className="ms-auto hidden h-8 w-[280px] items-center gap-2 rounded-md bg-white/15 px-3 text-[12.5px] text-white/80 hover:bg-white/25 md:flex"
      >
        <Search size={14} />
        <span>جستجو</span>
      </button>

      <div className="flex items-center gap-1 md:ms-0 ms-auto">
        <button type="button" onClick={() => navigate('/notifications')} aria-label="اعلان‌ها" className={iconBtn}>
          <Bell size={17} />
        </button>
        <button type="button" onClick={() => navigate('/tasks')} aria-label="وظایف" className={iconBtn}>
          <MzIcon name="bookmark" size={17} />
        </button>
        <button type="button" onClick={() => navigate('/projects')} aria-label="گفتگو" className={iconBtn}>
          <MzIcon name="chat" size={17} />
        </button>
        <button type="button" onClick={() => navigate('/settings')} aria-label="تنظیمات" className={iconBtn}>
          <Settings size={17} />
        </button>
        <button type="button" onClick={() => navigate('/profile')} aria-label="راهنما" className={iconBtn}>
          <HelpCircle size={17} />
        </button>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          aria-label="پروفایل"
          className="ms-1 inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#e0e3e8] text-[13px] font-bold text-[#37474f] shadow-[0_1px_3px_rgba(0,0,0,.28)]"
        >
          {(fullName ?? '؟').trim().charAt(0)}
        </button>
      </div>
    </header>
  );
}
