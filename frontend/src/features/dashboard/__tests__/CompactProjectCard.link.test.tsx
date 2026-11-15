// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * The admin project card is a real link to its project.
 *
 * The whole card is one anchor, so keyboard focus and middle-click work the
 * same way a click does. The card holds no inner anchor.
 *
 * Run:  npx vitest run src/features/dashboard/__tests__/CompactProjectCard.link.test.tsx
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { CompactProjectCard } from '../components/CompactProjectCard';

describe('CompactProjectCard is a link to its project', () => {
  it('links the whole card to /projects/<id>', () => {
    render(
      <MemoryRouter>
        <CompactProjectCard id="p-alpha" name="Alpha" currency="EUR" />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/projects/p-alpha');
    expect(link.textContent).toContain('Alpha');
  });

  it('keeps the card inside the link rather than nesting anchors', () => {
    const { container } = render(
      <MemoryRouter>
        <CompactProjectCard id="p-alpha" name="Alpha" boqCount={3} />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('a').length).toBe(1);
    expect(container.querySelectorAll('a a').length).toBe(0);
  });
});
