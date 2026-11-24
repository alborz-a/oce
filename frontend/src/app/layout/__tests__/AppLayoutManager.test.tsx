import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from '../AppLayout';
import { useAuthStore } from '@/stores/useAuthStore';

vi.mock('../Sidebar', () => ({
  Sidebar: () => <div data-testid="oce-sidebar" />,
  FloatingRecentButton: () => null,
}));
vi.mock('../Header', () => ({
  Header: () => <div data-testid="oce-header" />,
  resolvePageTitleKey: () => null,
}));
vi.mock('../DesktopToolbar', () => ({ DesktopToolbar: () => <div data-testid="oce-toolbar" /> }));
vi.mock('@/features/projects/workspace/components/MizitoGlobalTopBar', () => ({
  MizitoGlobalTopBar: () => <div data-testid="mizito-bar" />,
}));
vi.mock('@/features/projects/workspace/mizitoSwitcherBridge', () => ({ toggleMizitoSwitcher: () => false }));
vi.mock('../FloatingQueuePanel', () => ({ FloatingQueuePanel: () => null }));
vi.mock('@/shared/ui', () => ({ FeedbackDialog: () => null }));
vi.mock('@/shared/ui/GlobalProgress', () => ({ GlobalProgress: () => null }));
vi.mock('@/shared/ui/GlobalUploadIndicator', () => ({ GlobalUploadIndicator: () => null }));
vi.mock('@/shared/ui/DwgUploadIndicator', () => ({ DwgUploadIndicator: () => null }));
vi.mock('@/shared/ui/GlobalCatalogueInstallIndicator', () => ({ GlobalCatalogueInstallIndicator: () => null }));
vi.mock('@/shared/ui/DemoBanner', () => ({ DemoBanner: () => null }));
vi.mock('@/shared/ui/ReviewPromptCard', () => ({ ReviewPromptCard: () => null }));
vi.mock('@/features/erp-chat/FloatingChatButton', () => ({ FloatingChatButton: () => null }));
vi.mock('@/features/erp-chat/FloatingChatPanel', () => ({ FloatingChatPanel: () => null }));
vi.mock('@/features/dashboard/components/DashboardBackdrop', () => ({
  DashboardBackdrop: () => null,
  backdropVariantForPath: () => 'default',
}));
vi.mock('@/features/global_presence', () => ({ useGlobalPresenceSocket: () => undefined }));
vi.mock('@/shared/hooks/useOnlineStatus', () => ({ useOfflineSync: () => undefined }));
vi.mock('@/shared/hooks/usePartnerPackLocale', () => ({ usePartnerPackLocale: () => undefined }));

function renderLayout() {
  return render(
    <MemoryRouter>
      <AppLayout title="x">
        <div>page</div>
      </AppLayout>
    </MemoryRouter>,
  );
}

describe('AppLayout chrome by role', () => {
  beforeEach(() => useAuthStore.setState({ isAuthenticated: true }));

  it('manager gets OCE sidebar, toolbar, header and no Mizito bar', () => {
    useAuthStore.setState({ userRole: 'manager' });
    renderLayout();
    expect(screen.getByTestId('oce-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('oce-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('oce-header')).toBeInTheDocument();
    expect(screen.queryByTestId('mizito-bar')).toBeNull();
  });

  it('normal user keeps Mizito bar without sidebar or toolbar', () => {
    useAuthStore.setState({ userRole: 'viewer' });
    renderLayout();
    expect(screen.queryByTestId('oce-sidebar')).toBeNull();
    expect(screen.queryByTestId('oce-toolbar')).toBeNull();
    expect(screen.getByTestId('mizito-bar')).toBeInTheDocument();
  });
});
