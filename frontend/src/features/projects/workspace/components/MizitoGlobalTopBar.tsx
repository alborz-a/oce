import { Bell, Bookmark, HelpCircle, Menu, MessageSquare, Search, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBrandingStore } from '@/stores/useBrandingStore';

export interface MizitoGlobalTopBarProps {
  onMenuClick: () => void;
}

const FALLBACK_BRAND = 'پورتال رویال استار';

/** Global dark-blue top bar of the Mizito workspace (menu, brand, search, quick icons, avatar). */
export function MizitoGlobalTopBar({ onMenuClick }: MizitoGlobalTopBarProps) {
  const navigate = useNavigate();
  const fullName = useAuthStore((s) => s.userFullName);
  const company = useBrandingStore((s) => s.companyName.trim());

  const openSearch = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  };
  const iconBtn =
    'inline-flex h-8 w-8 items-center justify-center rounded-full text-white/85 hover:bg-white/15 hover:text-white';

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
      <span className="text-[17px] font-bold">{company || 'OCE'}</span>
      <span className="hidden text-[12.5px] text-white/80 md:inline">{company ? '' : FALLBACK_BRAND}</span>

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
          <Bookmark size={17} />
        </button>
        <button type="button" onClick={() => navigate('/projects')} aria-label="گفتگو" className={iconBtn}>
          <MessageSquare size={17} />
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
          className="ms-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-[13px] font-bold"
        >
          {(fullName ?? '؟').trim().charAt(0)}
        </button>
      </div>
    </header>
  );
}
