import {
  applyMarkdownHeading,
  insertMarkdownLink,
  wrapMarkdownInline,
} from './markdown-edit.util';

describe('wrapMarkdownInline', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(wrapMarkdownInline('hello world', 0, 5, '**', '**')).toEqual({
      value: '**hello** world',
      start: 2,
      end: 7,
    });
  });

  it('inserts a placeholder when nothing is selected', () => {
    expect(wrapMarkdownInline('ab', 1, 1, '*', '*', 'text')).toEqual({
      value: 'a*text*b',
      start: 2,
      end: 6,
    });
  });
});

describe('applyMarkdownHeading', () => {
  it('prefixes the current line', () => {
    expect(applyMarkdownHeading('alpha\nbeta', 7, 7, 2)).toEqual({
      value: 'alpha\n## beta',
      start: 13,
      end: 13,
    });
  });

  it('replaces an existing heading marker', () => {
    expect(applyMarkdownHeading('## Title', 3, 3, 1)).toEqual({
      value: '# Title',
      start: 7,
      end: 7,
    });
  });

  it('strips heading markers for body text', () => {
    expect(applyMarkdownHeading('### Title', 0, 0, 0)).toEqual({
      value: 'Title',
      start: 5,
      end: 5,
    });
  });
});

describe('insertMarkdownLink', () => {
  it('wraps selected text as a link', () => {
    expect(insertMarkdownLink('see docs here', 4, 8, 'https://example.com')).toEqual({
      value: 'see [docs](https://example.com) here',
      start: 5,
      end: 9,
    });
  });

  it('inserts placeholder label when nothing is selected', () => {
    expect(insertMarkdownLink('', 0, 0, 'https://x.test')).toEqual({
      value: '[link text](https://x.test)',
      start: 1,
      end: 10,
    });
  });

  it('leaves the source unchanged when the url is blank', () => {
    expect(insertMarkdownLink('keep', 0, 4, '  ')).toEqual({
      value: 'keep',
      start: 0,
      end: 4,
    });
  });
});
