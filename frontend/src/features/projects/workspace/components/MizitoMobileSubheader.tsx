import { ProjectAvatar } from '@/shared/ui/ProjectAvatar';
import { useNavigate } from 'react-router-dom';
import { MzIcon } from './MzIcon';
import { toPersianDigits } from '@/shared/lib/jalali';

export interface MizitoMobileSubheaderProps {
  project: { id: string; name: string; picture_url?: string | null; color?: string | null };
  /** Opens ProjectSettingsModal (owned by MizitoProjectWorkspace). */
  onOpenSettings: () => void;
  /** Same handler as the summary panel online-meeting button. */
  onStartMeeting: () => void;
}

/** Mobile-only (<768px) project header row above the chat: back, avatar, title, meeting, more. */
export function MizitoMobileSubheader({ project, onOpenSettings, onStartMeeting }: MizitoMobileSubheaderProps) {
  const navigate = useNavigate();

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

      <ProjectAvatar name={project.name} pictureUrl={project.picture_url} color={project.color} size={32} />

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
