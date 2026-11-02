import { describe, expect, it } from 'vitest';
import { extractTags, mentionAtCaret, normalizeTag, splitRichText } from './rich-text';

describe('splitRichText', () => {
  it('finds mentions and tags but not emails or mid-word symbols', () => {
    expect(splitRichText('Cars & coffee w/ @Priya_S #E46 #e46 me@mail.com a#b')).toEqual([
      { type: 'text', value: 'Cars & coffee w/ ' },
      { type: 'mention', value: '@Priya_S', username: 'priya_s' },
      { type: 'text', value: ' ' },
      { type: 'tag', value: '#E46', tag: 'e46' },
      { type: 'text', value: ' ' },
      { type: 'tag', value: '#e46', tag: 'e46' },
      { type: 'text', value: ' me@mail.com a#b' },
    ]);
  });
  it('ignores too-short handles and tags that start with a digit', () => {
    expect(splitRichText('@ab #1 #ok')).toEqual([
      { type: 'text', value: '@ab #1 ' },
      { type: 'tag', value: '#ok', tag: 'ok' },
    ]);
  });
});

describe('tags', () => {
  it('dedupes and normalizes', () => {
    expect(extractTags('#WRX day. #wrx #sti')).toEqual(['wrx', 'sti']);
    expect(normalizeTag('#E46')).toBe('e46');
    expect(normalizeTag('drop table')).toBeNull();
  });
});

describe('mentionAtCaret', () => {
  it('finds the @name being typed', () => {
    expect(mentionAtCaret('hey @ma', 7)).toEqual({ start: 4, end: 7, query: 'ma' });
    expect(mentionAtCaret('@j', 2)).toEqual({ start: 0, end: 2, query: 'j' });
  });
  it('ignores emails, a bare @ and text after a space', () => {
    expect(mentionAtCaret('me@gmail', 8)).toBeNull();
    expect(mentionAtCaret('hey @', 5)).toBeNull();
    expect(mentionAtCaret('@mark is here', 13)).toBeNull();
  });
  it('uses the caret, not the end of the text', () => {
    expect(mentionAtCaret('@ab and more', 3)).toEqual({ start: 0, end: 3, query: 'ab' });
  });
});
