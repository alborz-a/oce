import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Guards the Mizito theme: mz-* colour vars and Shabnam font must stay defined
// in workspace.css and exposed through tailwind.config.js (no hardcoded hex).
const root = resolve(__dirname, '../../../../../');
const css = readFileSync(resolve(__dirname, '../workspace.css'), 'utf8');
const config = readFileSync(resolve(root, 'tailwind.config.js'), 'utf8');

describe('Mizito theme tokens', () => {
  it('defines mz colour vars under .mz-shell in workspace.css', () => {
    expect(css).toContain('.mz-shell {');
    for (const name of ['project', 'task', 'inbox', 'purple', 'pink', 'chat', 'appbar']) {
      expect(css).toContain(`--mz-${name}:`);
      expect(css).toContain(`--mz-${name}-ch:`);
    }
  });

  it('exposes mz colours and the mz font through tailwind.config.js', () => {
    expect(config).toContain('mz: Object.fromEntries(');
    expect(config).toContain('`var(--mz-${k})`');
    expect(config).toContain("mz: ['Shabnam'");
  });

  it('declares the Shabnam font-face with font-display swap', () => {
    expect(css).toContain("font-family: 'Shabnam';");
    expect(css).toContain('/fonts/Shabnam.woff2');
    expect(css).toContain('font-display: swap;');
  });
});
