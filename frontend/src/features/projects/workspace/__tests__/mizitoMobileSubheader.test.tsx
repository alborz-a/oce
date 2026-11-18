import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MizitoMobileSubheader } from '../components/MizitoMobileSubheader';
import { projectInitials } from '../utils/projectInitials';

vi.mock('@/shared/ui/AuthImage', () => ({
  AuthImage: () => <img alt="" />,
}));

describe('MizitoMobileSubheader', () => {
  it('renders back, more and meeting controls and wires their handlers', () => {
    const onOpenSettings = vi.fn();
    const onStartMeeting = vi.fn();
    render(
      <MemoryRouter>
        <MizitoMobileSubheader
          project={{ id: 'p1', name: 'پارک شادی', avatar_url: null }}
          onOpenSettings={onOpenSettings}
          onStartMeeting={onStartMeeting}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('mobile-subheader-back')).toHaveAttribute('aria-label', 'بازگشت');
    expect(screen.getByTestId('mobile-subheader-more')).toHaveAttribute('aria-label', 'بیشتر');
    expect(screen.getByTestId('mobile-subheader-meeting')).toHaveTextContent('جلسه آنلاین');

    fireEvent.click(screen.getByTestId('mobile-subheader-more'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('mobile-subheader-meeting'));
    expect(onStartMeeting).toHaveBeenCalledTimes(1);
  });

  it('derives initials for the circle avatar from the project name', () => {
    expect(projectInitials('پارک شادی')).toBe('پش');
    expect(projectInitials('ساختمان')).toBe('سا');
  });
});
