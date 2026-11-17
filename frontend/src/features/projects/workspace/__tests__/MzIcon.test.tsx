import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MzIcon } from '../components/MzIcon';

describe('MzIcon', () => {
  it('renders the ligature name as text inside an aria-hidden span', () => {
    const html = renderToStaticMarkup(<MzIcon name="arrow_back" />);
    expect(html).toContain('>arrow_back</span>');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="mz-icon"');
  });

  it('applies size and flip class when requested', () => {
    const html = renderToStaticMarkup(<MzIcon name="chevron_right" size={24} flipRtl />);
    expect(html).toContain('font-size:24px');
    expect(html).toContain('icon-flip-horizontal');
  });
});
