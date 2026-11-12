// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Camera, Trash2, KeyRound, Check } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardContent, Badge } from '@/shared/ui';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import { apiGet, apiPatch, apiPost, fetchWithAuth, API_BASE } from '@/shared/lib/api';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string | null;
  created_at?: string;
}

export function ProfilePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const syncRoleFromServer = useAuthStore((s) => s.syncRoleFromServer);
  const fileRef = useRef<HTMLInputElement>(null);

  // Profile data
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/v1/users/me/'),
    staleTime: 60_000,
  });

  // Name form state
  const [fullName, setFullName] = useState('');
  const [nameInitialized, setNameInitialized] = useState(false);
  if (profile && !nameInitialized) {
    setFullName(profile.full_name || '');
    setNameInitialized(true);
  }

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Mutation for updating profile info
  const nameMutation = useMutation({
    mutationFn: (name: string) => apiPatch<UserProfile>('/v1/users/me/', { full_name: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      void syncRoleFromServer();
      addToast({
        type: 'success',
        title: t('toasts.profile_updated', { defaultValue: 'اطلاعات با موفقیت ذخیره شد' }),
      });
    },
    onError: (err: Error) => {
      addToast({
        type: 'error',
        title: t('common.error', { defaultValue: 'خطا در ثبت اطلاعات' }),
        message: err.message,
      });
    },
  });

  // Avatar upload / remove
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetchWithAuth(`${API_BASE}/v1/users/me/avatar/`, {
        method: 'PUT',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      queryClient.invalidateQueries({ queryKey: ['me'] });
      addToast({
        type: 'success',
        title: t('settings.avatar_saved', { defaultValue: 'تصویر پروفایل به‌روزرسانی شد' }),
      });
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: t('settings.avatar_failed', { defaultValue: 'خطا در بارگذاری تصویر' }),
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleAvatarDelete = async () => {
    setAvatarBusy(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/v1/users/me/avatar/`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      queryClient.invalidateQueries({ queryKey: ['me'] });
      addToast({
        type: 'success',
        title: t('toasts.avatar_deleted', { defaultValue: 'تصویر پروفایل حذف شد' }),
      });
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: t('common.error', { defaultValue: 'خطا در حذف تصویر' }),
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setAvatarBusy(false);
    }
  };

  // Password change submission
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError(t('auth.password_min_length', { defaultValue: 'رمز عبور باید حداقل ۸ کاراکتر باشد' }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('auth.passwords_do_not_match', { defaultValue: 'رمز عبور جدید با تکرار آن یکسان نیست' }));
      return;
    }

    try {
      const tokens = await apiPost<{ access_token: string; refresh_token: string }>(
        '/v1/users/me/change-password/',
        { current_password: currentPassword, new_password: newPassword },
      );
      // Server rotates the token pair on password change; keep the session alive.
      const remember = localStorage.getItem('oe_remember') === '1';
      const email = useAuthStore.getState().userEmail ?? undefined;
      useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token, remember, email);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      addToast({
        type: 'success',
        title: t('auth.password_changed', { defaultValue: 'رمز عبور با موفقیت تغییر کرد' }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.password_change_failed', { defaultValue: 'خطا در تغییر رمز عبور' });
      setPasswordError(msg);
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'مدیر ارشد سامانه';
      case 'manager':
        return 'مدیر پروژه';
      case 'editor':
        return 'کارشناس پروژه';
      case 'viewer':
      default:
        return 'مشاهده‌گر / کارشناس';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 pt-2">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-content-primary">
            {t('nav.profile', { defaultValue: 'پروفایل کاربری' })}
          </h1>
          <p className="text-xs text-content-tertiary mt-1">
            {t('settings.profile_subtitle', { defaultValue: 'اطلاعات شخصی، تصویر پروفایل و تنظیمات امنیتی حساب کاربری' })}
          </p>
        </div>
      </div>

      {/* Main Profile Card */}
      <Card padding="lg" className="border-border-light shadow-sm">
        <CardHeader
          title={t('settings.profile_title', { defaultValue: 'اطلاعات کاربری' })}
          subtitle={t('settings.profile_description', { defaultValue: 'مشخصات هویتی و نقش سازمانی شما در پروژه' })}
        />
        <CardContent className="mt-4 space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-border-light">
            <div className="relative group">
              <div className="h-20 w-20 rounded-full ring-4 ring-oe-blue/20 overflow-hidden bg-surface-secondary flex items-center justify-center">
                <UserAvatar
                  url={profile?.avatar_url}
                  alt={profile?.full_name || 'User'}
                  className="h-20 w-20 text-lg font-bold"
                  fallback={
                    <span className="text-xl font-bold text-oe-blue">
                      {profile?.full_name?.charAt(0)?.toUpperCase() || profile?.email?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  }
                />
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="flex-1 text-center sm:text-start space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-base font-semibold text-content-primary">
                  {profile?.full_name || t('common.user', { defaultValue: 'کاربر' })}
                </h2>
                <Badge variant="blue" size="sm">
                  {getRoleLabel(profile?.role)}
                </Badge>
              </div>
              <p className="text-xs text-content-tertiary flex items-center justify-center sm:justify-start gap-1">
                <Mail size={13} className="shrink-0" />
                <span>{profile?.email}</span>
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={avatarBusy}
                  onClick={() => fileRef.current?.click()}
                  icon={<Camera size={14} />}
                >
                  {profile?.avatar_url
                    ? t('settings.avatar_change', { defaultValue: 'تغییر تصویر' })
                    : t('settings.avatar_upload', { defaultValue: 'بارگذاری تصویر' })}
                </Button>
                {profile?.avatar_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={avatarBusy}
                    onClick={handleAvatarDelete}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    icon={<Trash2 size={14} />}
                  >
                    {t('common.delete', { defaultValue: 'حذف تصویر' })}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Edit Name Form: system admin only (backend enforces it too) */}
          {profile?.role === 'admin' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              nameMutation.mutate(fullName);
            }}
            className="space-y-4 max-w-lg"
          >
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1.5">
                {t('common.full_name', { defaultValue: 'نام و نام خانوادگی' })}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="نام کامل خود را وارد کنید"
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={nameMutation.isPending || fullName === profile?.full_name}
                >
                  {t('common.save', { defaultValue: 'ذخیره' })}
                </Button>
              </div>
            </div>
          </form>
          )}
        </CardContent>
      </Card>

      {/* Security & Password Card */}
      <Card padding="lg" className="border-border-light shadow-sm">
        <CardHeader
          title={t('auth.change_password', { defaultValue: 'تغییر رمز عبور' })}
          subtitle={t('auth.change_password_hint', { defaultValue: 'برای افزایش امنیت، از رمز عبور با حداقل ۸ کاراکتر استفاده کنید' })}
        />
        <CardContent className="mt-4">
          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">
                {t('auth.current_password', { defaultValue: 'رمز عبور فعلی' })}
              </label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">
                {t('auth.new_password', { defaultValue: 'رمز عبور جدید' })}
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">
                {t('auth.confirm_password', { defaultValue: 'تکرار رمز عبور جدید' })}
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {passwordError && (
              <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200 dark:border-red-800/40">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="text-xs text-green-600 bg-green-50 dark:bg-green-950/30 p-2.5 rounded-lg border border-green-200 dark:border-green-800/40 flex items-center gap-1.5">
                <Check size={14} />
                <span>{t('auth.password_changed', { defaultValue: 'رمز عبور با موفقیت به‌روزرسانی شد' })}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="secondary"
              size="md"
              icon={<KeyRound size={15} />}
              disabled={!currentPassword || !newPassword || !confirmPassword}
            >
              {t('auth.change_password_submit', { defaultValue: 'ثبت رمز عبور جدید' })}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
