import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-next-path';

describe('safeNextPath', () => {
  it.each([
    ['/account/listings', '/account/listings'],
    ['/search?make=toyota&page=2', '/search?make=toyota&page=2'],
    ['/listings/abc#photos', '/listings/abc#photos'],
    ['/', '/'],
  ])('allows same-origin path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['https://evil.com'],
    ['//evil.com'],
    ['/\\evil.com'],
    ['\\\\evil.com'],
    ['javascript:alert(1)'],
    ['/\t/evil.com'],
    ['/\n/evil.com'],
    ['evil.com/path'],
    ['http:/evil.com'],
    ['/.//evil.com'],
    ['/..//evil.com'],
    ['/%2e//evil.com'],
    ['/a/..//evil.com'],
    ['/./\\evil.com'],
    ['/%2e%2e//evil.com'],
    ['/.\\/evil.com'],
    ['/./\\/evil.com'],
  ])('rejects %j', (input) => {
    expect(safeNextPath(input)).toBe('/');
  });

  it('uses the provided fallback', () => {
    expect(safeNextPath('//evil.com', '/account')).toBe('/account');
  });
});
