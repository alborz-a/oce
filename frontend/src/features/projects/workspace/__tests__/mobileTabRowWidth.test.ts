import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '..', 'workspace.css'), 'utf8');
describe('project tabs row width on mobile', () => {
  it('gives the tabs row its own full-width line below 768px', () => {
    const mobileBlock = css.slice(css.lastIndexOf('@media (max-width: 767.98px) {'));
    expect(mobileBlock).toContain('.mizito-workspace-light .mz-top-tabbar {');
    expect(mobileBlock).toMatch(/\.mz-top-tabbar > div:first-child \{\s*flex: 0 0 100%;\s*inline-size: 100%;/);
    expect(mobileBlock).toMatch(/nav\[role='tablist'\] \{\s*inline-size: 100%;/);
  });
});
