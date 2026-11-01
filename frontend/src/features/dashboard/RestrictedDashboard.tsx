// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  CheckSquare,
  Camera,
  Calendar,
  Clock,
  Building2,
  CheckCircle2,
  X,
  ChevronLeft,
  Image as ImageIcon,
} from 'lucide-react';
import { Card, Badge, Skeleton, AuthImage } from '@/shared/ui';
import { apiGet, API_BASE } from '@/shared/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { ProjectStatusBadge } from '@/features/projects/ProjectStatusBadge';

interface ProjectItem {
  id: string;
  name: string;
  description?: string;
  status: string;
  location?: string;
  created_at?: string;
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority?: string;
  due_date?: string;
  project_id?: string;
  project_name?: string;
  assigned_to_name?: string;
}

interface PhotoItem {
  id: string;
  file_name: string;
  description?: string;
  project_id: string;
  project_name?: string;
  created_at: string;
  captured_at?: string;
  file_size?: number;
}

export function RestrictedDashboard() {
  const userFullName = useAuthStore((s) => s.userFullName);
  const userEmail = useAuthStore((s) => s.userEmail);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);

  // 1. Projects Query
  const { data: projects, isLoading: projectsLoading } = useQuery<ProjectItem[]>({
    queryKey: ['restricted-dashboard-projects'],
    queryFn: () => apiGet<ProjectItem[]>('/v1/projects/'),
    staleTime: 60_000,
  });

  // 2. My Tasks Query
  const { data: tasksData, isLoading: tasksLoading } = useQuery<{ items?: TaskItem[] } | TaskItem[]>({
    queryKey: ['restricted-dashboard-tasks'],
    queryFn: async () => {
      try {
        return await apiGet<{ items?: TaskItem[] }>('/v1/tasks/my-tasks/');
      } catch {
        return await apiGet<TaskItem[]>('/v1/tasks/?limit=10').catch(() => []);
      }
    },
    staleTime: 60_000,
  });

  const tasks: TaskItem[] = Array.isArray(tasksData)
    ? tasksData
    : tasksData?.items ?? [];

  // 3. Latest Site Photos Query
  const { data: photosData, isLoading: photosLoading } = useQuery<{ items?: PhotoItem[] } | PhotoItem[]>({
    queryKey: ['restricted-dashboard-photos'],
    queryFn: async () => {
      try {
        return await apiGet<{ items?: PhotoItem[] }>('/v1/documents/photos/?limit=8');
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const photos: PhotoItem[] = Array.isArray(photosData)
    ? photosData
    : photosData?.items ?? [];

  const openTasksCount = tasks.filter((tk) => tk.status !== 'completed').length;

  return (
    <div className="space-y-7 pb-14 pt-2">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-border-light bg-gradient-to-r from-oe-blue/10 via-surface-elevated to-surface-secondary/50 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-oe-blue/20 bg-oe-blue/5 px-3 py-1 text-xs font-semibold text-oe-blue">
              <span>سامانه کنترل پروژه رویال استارز</span>
              <span>·</span>
              <span>مشاهده‌گر و کارشناس</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-content-primary">
              خوش آمدید، {userFullName || userEmail?.split('@')[0] || 'همکار گرامی'}
            </h1>
            <p className="text-xs text-content-tertiary">
              خلاصه وضعیت پروژه‌ها، وظایف در دست اقدام و جدیدترین تصاویر ثبت‌شده در کارگاه
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-border-light bg-surface-elevated px-4 py-2.5 text-center shadow-xs">
              <span className="block text-2xs text-content-tertiary">پروژه‌های دردسترس</span>
              <span className="text-lg font-bold text-content-primary tabular-nums">
                {projects?.length ?? '—'}
              </span>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-elevated px-4 py-2.5 text-center shadow-xs">
              <span className="block text-2xs text-content-tertiary">وظایف جاری</span>
              <span className="text-lg font-bold text-oe-blue tabular-nums">
                {openTasksCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 1: Assigned Projects ────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-oe-blue/10 text-oe-blue">
              <FolderKanban size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-content-primary">پروژه‌های من</h2>
              <p className="text-2xs text-content-tertiary">پروژه‌های دارای دسترسی شما در سازمان</p>
            </div>
          </div>
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-xs font-medium text-oe-blue hover:underline"
          >
            <span>مشاهده همه پروژه‌ها</span>
            <ChevronLeft size={14} className="rtl:rotate-0 rotate-180" />
          </Link>
        </div>

        {projectsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={140} className="w-full rounded-xl" />
            ))}
          </div>
        ) : !projects || projects.length === 0 ? (
          <Card padding="lg" className="border-border-light">
            <EmptyState
              icon={<FolderKanban size={28} className="text-content-tertiary" />}
              title="پروژه‌ای یافت نشد"
              description="در حال حاضر به هیچ پروژه‌ای اختصاص داده نشده‌اید."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 6).map((project) => (
              <Card
                key={project.id}
                padding="md"
                className="group relative flex flex-col justify-between border-border-light bg-surface-elevated hover:border-oe-blue/40 hover:shadow-md transition-all duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/projects/${project.id}?tab=photos`}
                      className="font-semibold text-content-primary group-hover:text-oe-blue transition-colors line-clamp-1 text-sm"
                    >
                      {project.name}
                    </Link>
                    <ProjectStatusBadge status={project.status} size="sm" />
                  </div>
                  {project.description && (
                    <p className="mt-1.5 text-xs text-content-secondary line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                  )}
                  {project.location && (
                    <p className="mt-2 text-2xs text-content-tertiary flex items-center gap-1">
                      <Building2 size={12} className="shrink-0" />
                      <span>{project.location}</span>
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border-light/70 flex items-center justify-between text-2xs">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/projects/${project.id}?tab=photos`}
                      className="inline-flex items-center gap-1 rounded-md bg-surface-secondary px-2.5 py-1 text-content-secondary hover:bg-oe-blue/10 hover:text-oe-blue transition-colors font-medium"
                    >
                      <Camera size={12} />
                      <span>تصاویر کارگاه</span>
                    </Link>
                    <Link
                      to={`/projects/${project.id}/tasks`}
                      className="inline-flex items-center gap-1 rounded-md bg-surface-secondary px-2.5 py-1 text-content-secondary hover:bg-oe-blue/10 hover:text-oe-blue transition-colors font-medium"
                    >
                      <CheckSquare size={12} />
                      <span>وظایف</span>
                    </Link>
                  </div>
                  <Link
                    to={`/projects/${project.id}?tab=photos`}
                    className="text-content-tertiary group-hover:text-oe-blue transition-colors"
                    title="مشاهده پروژه"
                  >
                    <ChevronLeft size={16} className="rtl:rotate-0 rotate-180" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: Tasks & Action Items ─────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckSquare size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-content-primary">وظایف در دست اقدام</h2>
              <p className="text-2xs text-content-tertiary">وظایف و پیگیری‌های محول‌شده به شما</p>
            </div>
          </div>
          <Link
            to="/tasks"
            className="inline-flex items-center gap-1 text-xs font-medium text-oe-blue hover:underline"
          >
            <span>مشاهده همه وظایف</span>
            <ChevronLeft size={14} className="rtl:rotate-0 rotate-180" />
          </Link>
        </div>

        {tasksLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={52} className="w-full rounded-xl" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <Card padding="md" className="border-border-light text-center py-8">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/20 text-green-500 mb-2">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-sm font-medium text-content-primary">وظیفه بازی برای شما ثبت نشده است</p>
            <p className="text-xs text-content-tertiary mt-0.5">تمام کارهای محوله تا این لحظه انجام شده‌اند.</p>
          </Card>
        ) : (
          <div className="divide-y divide-border-light rounded-xl border border-border-light bg-surface-elevated shadow-xs overflow-hidden">
            {tasks.slice(0, 5).map((task) => {
              const isCompleted = task.status === 'completed';
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-secondary/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isCompleted ? 'bg-green-100 text-green-600 dark:bg-green-950/30' : 'bg-surface-secondary text-content-tertiary'}`}>
                      {isCompleted ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isCompleted ? 'line-through text-content-tertiary' : 'text-content-primary'}`}>
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-2xs text-content-tertiary">
                        {task.project_name && (
                          <span className="font-medium text-content-secondary">
                            {task.project_name}
                          </span>
                        )}
                        {task.due_date && (
                          <span className="flex items-center gap-0.5">
                            <Calendar size={11} />
                            <span>{new Date(task.due_date).toLocaleDateString('fa-IR')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={isCompleted ? 'success' : task.priority === 'urgent' || task.priority === 'high' ? 'error' : 'neutral'}
                    size="sm"
                  >
                    {isCompleted ? 'تکمیل‌شده' : task.priority === 'urgent' ? 'فوری' : task.priority === 'high' ? 'مهم' : 'عادی'}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 3: Latest Site Photos ──────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Camera size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-content-primary">آخرین تصاویر کارگاه</h2>
              <p className="text-2xs text-content-tertiary">تصاویر مستندسازی مراحل پیشرفت پروژه‌ها</p>
            </div>
          </div>
          <Link
            to="/files"
            className="inline-flex items-center gap-1 text-xs font-medium text-oe-blue hover:underline"
          >
            <span>مشاهده همه تصاویر و اسناد</span>
            <ChevronLeft size={14} className="rtl:rotate-0 rotate-180" />
          </Link>
        </div>

        {photosLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={140} className="w-full rounded-xl" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <Card padding="md" className="border-border-light text-center py-8">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary text-content-tertiary mb-2">
              <ImageIcon size={20} />
            </div>
            <p className="text-sm font-medium text-content-primary">تصویری یافت نشد</p>
            <p className="text-xs text-content-tertiary mt-0.5">هنوز تصویری از کارگاه‌های تحت نظر بارگذاری نشده است.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.slice(0, 8).map((photo) => {
              const thumbUrl = `${API_BASE}/v1/documents/photos/${photo.id}/thumb`;
              return (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="group relative cursor-pointer overflow-hidden rounded-xl border border-border-light bg-surface-secondary/40 aspect-4/3 shadow-xs hover:border-oe-blue/50 hover:shadow-md transition-all duration-200"
                >
                  <AuthImage
                    src={thumbUrl}
                    alt={photo.description || photo.file_name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    fallback={
                      <div className="flex h-full w-full items-center justify-center bg-surface-secondary text-content-tertiary">
                        <Camera size={24} />
                      </div>
                    }
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-end text-white text-start">
                    <p className="text-xs font-medium line-clamp-1">
                      {photo.description || photo.file_name}
                    </p>
                    {photo.project_name && (
                      <span className="text-[10px] text-white/80 truncate">
                        {photo.project_name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Photo Lightbox Modal ────────────────────────────────────────────── */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-surface-elevated rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-content-primary truncate">
                  {selectedPhoto.description || selectedPhoto.file_name}
                </h3>
                {selectedPhoto.project_name && (
                  <p className="text-2xs text-content-tertiary">پروژه: {selectedPhoto.project_name}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-content-tertiary hover:bg-surface-secondary hover:text-content-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 bg-black/95 flex items-center justify-center p-2 overflow-hidden min-h-[350px]">
              <AuthImage
                src={`${API_BASE}/v1/documents/photos/${selectedPhoto.id}/file`}
                alt={selectedPhoto.description || selectedPhoto.file_name}
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
              />
            </div>
            <div className="px-4 py-2.5 border-t border-border-light bg-surface-secondary/40 flex items-center justify-between text-xs text-content-secondary">
              <span>تاریخ ثبت: {new Date(selectedPhoto.captured_at || selectedPhoto.created_at).toLocaleDateString('fa-IR')}</span>
              <Link
                to={`/projects/${selectedPhoto.project_id}?tab=photos`}
                className="inline-flex items-center gap-1 text-oe-blue hover:underline text-2xs font-medium"
                onClick={() => setSelectedPhoto(null)}
              >
                <span>مشاهده در گالری پروژه</span>
                <ChevronLeft size={13} className="rtl:rotate-0 rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
