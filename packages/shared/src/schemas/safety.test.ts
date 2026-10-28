import { describe, expect, it } from 'vitest';
import { reportSchema } from './safety';

const id = '6f1c0b1e-8a6f-4f7a-9a51-1d6c0f2a7b10';

describe('reportSchema', () => {
  it('accepts social targets and trims details', () => {
    const r = reportSchema.parse({
      targetType: 'post',
      targetId: id,
      reason: 'spam',
      details: '  x ',
    });
    expect(r.details).toBe('x');
  });
  it('rejects marketplace targets and unknown reasons', () => {
    expect(
      reportSchema.safeParse({ targetType: 'listing', targetId: id, reason: 'spam' }).success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({ targetType: 'post', targetId: id, reason: 'stolen' }).success,
    ).toBe(false);
  });
});
