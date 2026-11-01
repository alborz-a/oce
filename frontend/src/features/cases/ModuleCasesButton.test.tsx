import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModuleCasesButton } from './ModuleCasesButton';
import { useAuthStore } from '@/stores/useAuthStore';

function renderAt(role: string) {
  useAuthStore.setState({ userRole: role });
  return render(
    <MemoryRouter initialEntries={['/boq']}>
      <ModuleCasesButton />
    </MemoryRouter>,
  );
}

describe('ModuleCasesButton visibility', () => {
  afterEach(() => useAuthStore.setState({ userRole: null }));

  it('renders nothing for non-admins', () => {
    const { container } = renderAt('editor');
    expect(container.firstChild).toBeNull();
  });

  it('renders the badge for the system admin', () => {
    const { container } = renderAt('admin');
    expect(container.firstChild).not.toBeNull();
  });
});
