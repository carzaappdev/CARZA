import { describe, expect, it } from 'vitest';
import { createPostSchema } from './post';

const uid = '11111111-1111-4111-8111-111111111111';
const photo = {
  path: `${uid}/22222222-2222-4222-8222-222222222222.webp`,
  width: 1200,
  height: 900,
};

describe('createPostSchema', () => {
  it('accepts text, photos, or both', () => {
    expect(createPostSchema.safeParse({ body: 'hi', photos: [], replyToId: null }).success).toBe(
      true,
    );
    expect(createPostSchema.safeParse({ body: '', photos: [photo], replyToId: null }).success).toBe(
      true,
    );
  });

  it('rejects empty posts (whitespace counts as empty)', () => {
    expect(createPostSchema.safeParse({ body: '   ', photos: [], replyToId: null }).success).toBe(
      false,
    );
  });

  it('caps length and photo count', () => {
    expect(
      createPostSchema.safeParse({ body: 'x'.repeat(501), photos: [], replyToId: null }).success,
    ).toBe(false);
    expect(
      createPostSchema.safeParse({ body: '', photos: Array(5).fill(photo), replyToId: null })
        .success,
    ).toBe(false);
  });

  it('rejects photo paths outside the expected shape', () => {
    const bad = { ...photo, path: `../${uid}/x.webp` };
    expect(createPostSchema.safeParse({ body: '', photos: [bad], replyToId: null }).success).toBe(
      false,
    );
  });
});
