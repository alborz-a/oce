import { useNavigate } from 'react-router-dom';
import { MzIcon } from './MzIcon';
import { projectInitials } from '../utils/projectInitials';
import { toPersianDigits } from '@/shared/lib/jalali';
import { AuthImage } from '@/shared/ui/AuthImage';

export interface MizitoMobileSubheaderProps {
  project: { id: string; name: string; avatar_url?: string | null };
  /** Opens ProjectSettingsModal (owned by MizitoProjectWorkspace). */
  onOpenSettings: () => void;
  /** Same handler as the summary panel online-meeting button. */
  onStartMeeting: () => void;
}

/** Mobile-only (<768px) project header row above the chat: back, avatar, title, meeting, more. */
export function MizitoMobileSubheader({ project, onOpenSettings, onStartMeeting }: MizitoMobileSubheaderProps) {
  const navigate = useNavigate();
  const avatarUrl = typeof project.avatar_url === 'string' && project.avatar_url.trim() ? project.avatar_url.trim() : null;

  return (
    <div className="mz-mobile-subheader" dir="rtl" data-testid="mobile-subheader">
      <button
        type="button"
        aria-label="بازگشت"
        data-testid="mobile-subheader-back"
        className="mz-mobile-subheader-btn"
        onClick={() => navigate('/projects')}
      >
        <MzIcon name="arrow_back" size={24} color="#fff" flipRtl />
      </button>

      {avatarUrl ? (
        <AuthImage src={avatarUrl} alt={project.name} className="mz-mobile-subheader-avatar object-cover" />
      ) : (
        <span className="mz-mobile-subheader-avatar" aria-hidden="true">
          {projectInitials(project.name)}
        </span>
      )}

      <MzIcon name="star" size={13} color="#fb0" />

      <span className="mz-mobile-subheader-title" title={project.name}>
        {toPersianDigits(project.name)}
      </span>

      <button
        type="button"
        onClick={onStartMeeting}
        className="mz-mobile-subheader-meeting"
        data-testid="mobile-subheader-meeting"
      >
        <MzIcon name="videocam" size={18} color="#fff" />
        <span>جلسه آنلاین</span>
      </button>

      <button
        type="button"
        aria-label="بیشتر"
        data-testid="mobile-subheader-more"
        className="mz-mobile-subheader-btn"
        onClick={onOpenSettings}
      >
        <MzIcon name="more_vert" size={24} color="#fff" />
      </button>
    </div>
  );
}
