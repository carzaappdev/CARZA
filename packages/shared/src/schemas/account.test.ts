import { describe, expect, it } from 'vitest';
import { deleteConfirmationMatches } from './account';

describe('deleteConfirmationMatches', () => {
  it('accepts the username, with or without @ and in any case', () => {
    expect(deleteConfirmationMatches('mia_e46', 'mia_e46')).toBe(true);
    expect(deleteConfirmationMatches(' @Mia_E46 ', 'mia_e46')).toBe(true);
  });
  it('rejects anything else', () => {
    expect(deleteConfirmationMatches('', 'mia_e46')).toBe(false);
    expect(deleteConfirmationMatches('mia', 'mia_e46')).toBe(false);
    expect(deleteConfirmationMatches('delete', 'mia_e46')).toBe(false);
  });
});
