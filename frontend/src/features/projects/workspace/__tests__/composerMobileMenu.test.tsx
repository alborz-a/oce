import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ProjectStreamComposer } from '../components/ProjectStreamComposer';

function renderComposer() {
  return render(
    <ProjectStreamComposer
      projectId="proj-1"
      currentUser={{ id: 'u-1', full_name: 'آرش پیرنیا' }}
      members={[]}
      tasks={[]}
      replyTo={null}
      onCancelReply={vi.fn()}
      onSend={vi.fn().mockResolvedValue(undefined)}
    />,
  );
}

describe('ProjectStreamComposer mobile layout', () => {
  it('renders the 9-dot menu button (md:hidden) that opens a popover with the secondary buttons', () => {
    renderComposer();

    const menuBtn = screen.getByTestId('composer-mobile-menu-btn');
    expect(menuBtn.parentElement!.className).toContain('md:hidden');
    expect(screen.queryByTestId('composer-mobile-menu')).not.toBeInTheDocument();

    fireEvent.click(menuBtn);
    const menu = screen.getByTestId('composer-mobile-menu');
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(5);
    expect(within(menu).getByTestId('composer-menu-task')).toHaveTextContent('+ وظیفه');
    expect(within(menu).getByTestId('composer-menu-minutes')).toHaveTextContent('+ صورتجلسه');
  });

  it('keeps desktop secondary buttons hidden below md and shown from md up', () => {
    renderComposer();

    expect(screen.getByTestId('composer-emoji-btn').className).toContain('hidden md:inline-flex');
    expect(screen.getByTestId('composer-mention-btn').className).toContain('hidden md:inline-flex');
    expect(screen.getByTestId('composer-attach-btn').className).toContain('hidden md:inline-flex');
  });

  it('keeps the send button visible with a mirrored send icon for RTL', () => {
    renderComposer();

    const sendBtn = screen.getByTestId('composer-send-btn');
    expect(sendBtn).toBeVisible();
    const icon = sendBtn.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute('class')).toContain('rtl:-scale-x-100');
  });
});
