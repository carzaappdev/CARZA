import { describe, expect, it } from 'vitest';
import { fail, ok } from './result';

describe('result helpers', () => {
  it('ok wraps data', () => {
    expect(ok({ id: '1' })).toEqual({ ok: true, data: { id: '1' } });
  });

  it('fail omits fieldErrors when not given', () => {
    expect(fail('FORBIDDEN', 'No')).toEqual({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'No' },
    });
  });

  it('fail includes fieldErrors when given', () => {
    const r = fail('VALIDATION', 'Check the form', { price: ['Required'] });
    expect(r).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION',
        message: 'Check the form',
        fieldErrors: { price: ['Required'] },
      },
    });
  });
});
