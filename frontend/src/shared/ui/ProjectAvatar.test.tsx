import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectAvatar, projectColorHex, projectInitials } from './ProjectAvatar';

describe('ProjectAvatar', () => {
  it('shows the picture when pictureUrl is set', () => {
    render(<ProjectAvatar name="Tower A" pictureUrl="https://s3.example/p.png" color="red" />);
    const img = screen.getByTestId('project-avatar-picture');
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', 'https://s3.example/p.png');
    expect(img).toHaveAttribute('alt', 'Tower A');
    expect(screen.queryByTestId('project-avatar-initials')).toBeNull();
  });

  it('falls back to initials on the mapped colour when there is no picture', () => {
    render(<ProjectAvatar name="Tower Block" pictureUrl={null} color="light-blue" size={40} />);
    const el = screen.getByTestId('project-avatar-initials');
    expect(el).toHaveTextContent('TB');
    expect(el.style.backgroundColor).toBe('rgb(91, 184, 245)');
    expect(el.style.width).toBe('40px');
    expect(screen.queryByTestId('project-avatar-picture')).toBeNull();
  });

  it('uses grey for a missing or unknown colour', () => {
    const { unmount } = render(<ProjectAvatar name="Solo" />);
    expect(screen.getByTestId('project-avatar-initials').style.backgroundColor).toBe('rgb(138, 143, 152)');
    unmount();
    render(<ProjectAvatar name="Solo" color="magenta" />);
    expect(screen.getByTestId('project-avatar-initials').style.backgroundColor).toBe('rgb(138, 143, 152)');
  });
});

describe('projectColorHex', () => {
  it('maps every Mizito colour name', () => {
    expect(projectColorHex('red-dark')).toBe('#A40E26');
    expect(projectColorHex('brown')).toBe('#8B5E3C');
    expect(projectColorHex(' Green ')).toBe('#30A46C');
  });
});

describe('projectInitials', () => {
  it('takes up to two initials, code-point safe', () => {
    expect(projectInitials('alpha beta gamma')).toBe('AB');
    expect(projectInitials('  solo ')).toBe('S');
    expect(projectInitials('برج آزادی')).toBe('بآ');
    expect(projectInitials('   ')).toBe('?');
  });
});
