export interface MarkdownEditResult {
  value: string;
  start: number;
  end: number;
}

/** Wrap the current selection (or insert a placeholder) with markdown markers. */
export function wrapMarkdownInline(
  source: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string,
  placeholder = 'text',
): MarkdownEditResult {
  const from = Math.max(0, Math.min(start, end));
  const to = Math.max(0, Math.max(start, end));
  const selected = source.slice(from, to);
  const inner = selected || placeholder;
  const next = source.slice(0, from) + prefix + inner + suffix + source.slice(to);
  const innerStart = from + prefix.length;
  return {
    value: next,
    start: innerStart,
    end: innerStart + inner.length,
  };
}

/** Turn the current line into a heading (or strip heading markers for body). */
export function applyMarkdownHeading(
  source: string,
  start: number,
  end: number,
  level: 0 | 1 | 2 | 3,
): MarkdownEditResult {
  const from = Math.max(0, Math.min(start, source.length));
  const lineStart = source.lastIndexOf('\n', from - 1) + 1;
  let lineEnd = source.indexOf('\n', from);
  if (lineEnd === -1) lineEnd = source.length;
  const line = source.slice(lineStart, lineEnd);
  const stripped = line.replace(/^#{1,6}\s+/, '');
  const prefix = level === 0 ? '' : `${'#'.repeat(level)} `;
  const nextLine = prefix + stripped;
  const next = source.slice(0, lineStart) + nextLine + source.slice(lineEnd);
  const caret = lineStart + nextLine.length;
  return { value: next, start: caret, end: caret };
}

/** Wrap the selection as a markdown link. */
export function insertMarkdownLink(
  source: string,
  start: number,
  end: number,
  url: string,
  placeholder = 'link text',
): MarkdownEditResult {
  const href = url.trim();
  if (!href) {
    return { value: source, start, end };
  }
  const from = Math.max(0, Math.min(start, end));
  const to = Math.max(0, Math.max(start, end));
  const selected = source.slice(from, to);
  const label = selected || placeholder;
  const snippet = `[${label}](${href})`;
  const next = source.slice(0, from) + snippet + source.slice(to);
  const labelStart = from + 1;
  return {
    value: next,
    start: labelStart,
    end: labelStart + label.length,
  };
}
