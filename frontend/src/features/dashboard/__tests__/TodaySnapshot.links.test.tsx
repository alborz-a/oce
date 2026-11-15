// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * Today widget tiles (tasks, RFIs, safety) are real links.
 *
 * Without a selected project the tiles go to the portfolio list; with one
 * selected they go to that project's pages. Each tile is one anchor, so a
 * middle-click or keyboard Enter opens the page the same way a click does.
 *
 * Run:  npx vitest run src/features/dashboard/__tests__/TodaySnapshot.links.test.tsx
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useProjectContextStore } from '@/stores/useProjectContextStore';
import { TodaySnapshot } from '../DashboardPage';

const CARD = {
  id: 'p-alpha',
  name: 'Alpha',
  open_tasks: 2,
  open_rfis: 1,
  open_incidents: 0,
};

function renderSnapshot() {
  return render(
    <MemoryRouter>
      <TodaySnapshot cards={[CARD] as never} />
    </MemoryRouter>,
  );
}

function hrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
}

describe('Today widget tiles are links', () => {
  beforeEach(() => {
    useProjectContextStore.setState({ activeProjectId: null, activeProjectName: '' });
  });

  it('points every tile at the portfolio list when no project is selected', () => {
    const { container } = renderSnapshot();
    expect(hrefs(container)).toEqual(['/projects', '/projects', '/projects']);
  });

  it('points every tile at the selected project when one is chosen', () => {
    useProjectContextStore.setState({ activeProjectId: CARD.id, activeProjectName: CARD.name });
    const { container } = renderSnapshot();
    expect(hrefs(container)).toEqual(['/tasks', '/rfi', '/safety']);
  });

  it('never nests one anchor inside another', () => {
    const { container } = renderSnapshot();
    expect(container.querySelectorAll('a a').length).toBe(0);
  });
});
