import { MzIcon } from './MzIcon';
import { ArrowRight, Star } from 'lucide-react';
import { useState } from 'react';
import type { Project } from '@/features/projects/api';
import { TeamStrip } from '@/features/projects/components/TeamStrip';
import { toPersianDigits } from '@/shared/lib/jalali';
import { AuthImage } from '@/shared/ui/AuthImage';
import type { ProjectSummaryStats, StatusBreakdown, WorkspaceMember } from '../types';
import { ProjectSettingsModal } from './ProjectSettingsModal';

export interface ProjectRightSummaryPanelProps {
  project: Project;
  stats: ProjectSummaryStats;
  members?: WorkspaceMember[];
  currentUserId?: string | null;
  canManageMembers?: boolean;
  canOpenSettings?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onBack?: () => void;
  onOpenSettings?: () => void;
  onStartOnlineMeeting?: () => void;
  onOpenLetters?: () => void;
  onBoardClick?: (boardKey: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  className?: string;
}

const STATUS_COLORS = {
  done: '#27b6ba',
  inProgress: '#ffb024',
  delayed: '#e95e51',
  remaining: '#b0b4bb',
} as const;

interface Segment {
  key: 'done' | 'inProgress' | 'delayed' | 'remaining';
  label: string;
  pct: number;
  color: string;
  lightText: boolean;
}

function breakdownSegments(b: StatusBreakdown): Segment[] {
  return [
    { key: 'done', label: 'انجام شده', pct: b.donePct, color: STATUS_COLORS.done, lightText: true },
    {
      key: 'inProgress',
      label: 'دارای پیشرفت',
      pct: b.inProgressPct,
      color: STATUS_COLORS.inProgress,
      lightText: false,
    },
    {
      key: 'delayed',
      label: 'دارای تاخیر',
      pct: b.delayedPct,
      color: STATUS_COLORS.delayed,
      lightText: true,
    },
    {
      key: 'remaining',
      label: 'باقیمانده',
      pct: b.remainingPct,
      color: STATUS_COLORS.remaining,
      lightText: false,
    },
  ];
}

function SegmentedProgressBar({
  segments,
  height = 15,
  minLabelPct = 12,
}: {
  segments: readonly Segment[];
  height?: number;
  minLabelPct?: number;
}) {
  const hasAny = segments.some((s) => s.pct > 0);
  if (!hasAny) {
    return (
      <div
        className="w-full overflow-hidden rounded-full bg-[#e5e7eb]"
        style={{ height }}
      />
    );
  }

  return (
    <div
      className="flex w-full overflow-hidden rounded-full bg-[#d5d8dc]"
      style={{ height }}
    >
      {segments.map((seg) =>
        seg.pct > 0 ? (
          <div
            key={seg.key}
            title={`${seg.label}: ${toPersianDigits(seg.pct)}٪`}
            style={{
              width: `${seg.pct}%`,
              backgroundColor: seg.color,
            }}
            className={`flex items-center justify-center overflow-hidden text-[10px] font-semibold leading-none tabular-nums ${
              seg.lightText ? 'text-white' : 'text-[#374151]'
            }`}
          >
            {seg.pct >= minLabelPct ? `${toPersianDigits(seg.pct)}٪` : null}
          </div>
        ) : null,
      )}
    </div>
  );
}

function StatusDonutWidget({
  title,
  breakdown,
  testId,
}: {
  title: string;
  breakdown: StatusBreakdown;
  testId: string;
}) {
  const segments = breakdownSegments(breakdown);
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <section
      className="border-b border-[#f0f2f5] px-3 py-3"
      aria-label={title}
      data-testid={testId}
    >
      <h3 className="mb-2.5 text-center text-[12.5px] font-semibold text-[#374151]">
        {title}
      </h3>

      <div className="flex items-center justify-between gap-3">
        {/* Legend on start (right in RTL) */}
        <ul className="min-w-0 flex-1 space-y-1.5">
          {segments.map((seg) => (
            <li
              key={seg.key}
              className="flex items-center justify-between gap-2 text-[11.5px] text-[#4b5563]"
            >
              <span className="flex items-center gap-1.5 truncate">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 bg-white"
                  style={{ borderColor: seg.color }}
                />
                <span className="truncate">{seg.label}</span>
              </span>
              <span className="shrink-0 font-medium text-[#1f2937] tabular-nums">
                {toPersianDigits(seg.pct)}٪
              </span>
            </li>
          ))}
        </ul>

        {/* Donut SVG on end (left in RTL) */}
        <svg
          width="80"
          height="80"
          viewBox="0 0 76 76"
          aria-hidden="true"
          className="shrink-0"
        >
          <circle
            cx="38"
            cy="38"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="7"
          />
          {breakdown.totalWeight > 0 &&
            segments.map((seg) => {
              if (seg.pct <= 0) return null;
              const arcLen = (seg.pct / 100) * circumference;
              const dashArray = `${arcLen} ${circumference}`;
              const dashOffset = -cumulativeOffset;
              cumulativeOffset += arcLen;
              return (
                <circle
                  key={seg.key}
                  cx="38"
                  cy="38"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="7"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 38 38)"
                />
              );
            })}
        </svg>
      </div>
    </section>
  );
}

export function ProjectRightSummaryPanel({
  project,
  stats,
  members,
  currentUserId,
  canManageMembers = false,
  onBack,
  onStartOnlineMeeting,
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
  className = '',
}: ProjectRightSummaryPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const avatarUrl =
    typeof project.metadata?.avatar_url === 'string' && project.metadata.avatar_url.trim()
      ? project.metadata.avatar_url.trim()
      : null;

  if (collapsed) {
    return (
      <aside
        className={`project-info-container mz-summary-col mz-summary-col--collapsed items-center py-2 ${className}`}
        aria-label="خلاصه پروژه (جمع‌شده)"
        data-testid="project-right-summary-panel"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded="false"
          aria-label="باز کردن پنل اطلاعات پروژه"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#5b5e66] hover:bg-[#f2f4f7] hover:text-mz-project"
        >
          <MzIcon name="chevron_right" size={17} className="icon-flip-horizontal" />
        </button>
      </aside>
    );
  }

  const overallSegments = breakdownSegments(stats.overall);

  return (
    <aside
      className={`project-info-container mz-summary-col ${className}`}
      data-mobile-open={mobileOpen ? 'true' : 'false'}
      aria-label={`اطلاعات پروژه ${project.name}`}
      data-testid="project-right-summary-panel"
    >
      {/* 1. Project Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[#e5e7eb] px-2.5 py-2.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="بازگشت به فهرست پروژه‌ها"
            data-testid="summary-back-button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#5b5e66] hover:bg-[#f2f4f7] hover:text-[#1f2937]"
          >
            <ArrowRight size={17} />
          </button>
        )}

        {avatarUrl && (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-mz-project">
            <AuthImage
              src={avatarUrl}
              alt={project.name}
              className="h-7 w-7 rounded-full object-cover"
            />
          </div>
        )}

        <h2
          className="flex min-w-0 flex-1 items-center gap-1 truncate text-[13.5px] font-bold text-[#1f2937]"
          title={project.name}
        >
          <span className="min-w-0 truncate">{toPersianDigits(project.name)}</span>
          <Star
            size={13}
            fill="currentColor"
            aria-hidden="true"
            data-testid="summary-star-badge"
            className="shrink-0 text-mz-star"
          />
        </h2>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded="true"
            aria-label="جمع کردن پنل اطلاعات پروژه"
            data-testid="summary-collapse-button"
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f2f4f7] hover:text-[#1f2937] md:inline-flex"
          >
            <MzIcon name="chevron_right" size={15} />
          </button>
        )}

        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="بستن پنل اطلاعات پروژه"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f2f4f7] md:hidden"
          >
            <MzIcon name="close" size={15} />
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="mz-scroll-area flex-1 pb-4">
        {/* 2. Members + Online Meeting */}
        <section className="border-b border-[#f0f2f5] px-3 py-3" aria-label="اعضا و جلسه آنلاین">
          <div className="flex items-start gap-2">
            <span className="shrink-0 pt-1 text-[12px] font-medium text-[#4b5563]">اعضا:</span>
            <div className="min-w-0 flex-1">
              <TeamStrip
                projectId={project.id}
                canManage={canManageMembers}
                currentUserId={currentUserId ?? undefined}
                initialMembers={members}
                variant="summary"
                onEditClick={() => setSettingsOpen(true)}
              />
            </div>
          </div>

          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={onStartOnlineMeeting}
              className="mz-online-meeting-btn"
              data-testid="online-meeting-button"
            >
              <MzIcon name="videocam" size={14} />
              <span>جلسه آنلاین</span>
            </button>
          </div>
        </section>

        {/* 3. Overall Weighted Project Status */}
        <section
          className="border-b border-[#f0f2f5] px-3 py-3.5"
          aria-label="وضعیت کلی پروژه"
          data-testid="summary-overall-status"
        >
          {stats.remainingCount === 0 ? (
            <div className="flex flex-col items-center py-2 text-center">
              <p className="text-[12.5px] font-semibold text-[#374151]">
                وضعیت کلی پروژه: «تعداد کار باقیمانده: ۰»
              </p>
              <div
                className="mt-3 flex items-center justify-center text-[#8bc34a]"
                data-testid="summary-all-done-check"
              >
                <MzIcon name="done_all" size={44} />
              </div>
            </div>
          ) : (
            <>
              <h3 className="mb-2.5 text-center text-[12px] font-semibold text-[#374151]">
                وضعیت کلی پروژه{' '}
                <span className="font-normal text-[#6b7280]">(بر اساس وزن وظایف)</span>
              </h3>

              <SegmentedProgressBar segments={overallSegments} height={15} minLabelPct={10} />

              <div className="mt-2.5 grid grid-cols-4 gap-1 text-center">
                {overallSegments.map((seg) => (
                  <div key={seg.key} className="min-w-0">
                    <div className="truncate text-[10.5px] text-[#5b5e66]">{seg.label}</div>
                    <div className="mt-0.5 text-[11.5px] font-bold text-mz-value tabular-nums">
                      {toPersianDigits(seg.pct)}٪
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* 4. Two SVG Donut Charts: My Tasks vs Others' Tasks */}
        <StatusDonutWidget
          title="کارهای من"
          breakdown={stats.mine}
          testId="summary-donut-mine"
        />
        <StatusDonutWidget
          title="کارهای دیگران"
          breakdown={stats.others}
          testId="summary-donut-others"
        />
      </div>
      <ProjectSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        projectId={project.id}
        projectName={project.name}
      />
    </aside>
  );
}
