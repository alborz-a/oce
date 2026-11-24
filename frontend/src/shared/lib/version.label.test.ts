import { describe, expect, it } from 'vitest';
import { versionLabel } from './version';

describe('versionLabel', () => {
  it('maps RSD-x.y to RSC vx.y', () => {
    expect(versionLabel('RSD-1.2')).toBe('RSC v1.2');
    expect(versionLabel('RSD-10.0')).toBe('RSC v10.0');
  });

  it('leaves any other value unchanged', () => {
    expect(versionLabel('RSD-1.2.3')).toBe('RSD-1.2.3');
    expect(versionLabel('18.5.0')).toBe('18.5.0');
    expect(versionLabel('dev')).toBe('dev');
  });
});
