import { DboAsset } from '../models/dbo.models';

export function getProperty(obj: DboAsset | Record<string, unknown>, path: string): unknown {
  const record = obj as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, path)) {
    return record[path];
  }

  let target: Record<string, unknown> = record;
  let resolvedPath = path;

  if (record['Data'] && !path.startsWith('Data.')) {
    target = record['Data'] as Record<string, unknown>;
  } else if (path.startsWith('Data.')) {
    resolvedPath = path.substring(5);
    target = record['Data'] as Record<string, unknown>;
  }

  return resolvedPath.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, target);
}

export function matchesFilter(item: DboAsset, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const isAdvanced =
    trimmed.includes('<') ||
    trimmed.includes('>') ||
    trimmed.includes('=') ||
    trimmed.includes('!=');

  if (isAdvanced) {
    try {
      const operators = ['<=', '>=', '!=', '=', '<', '>'] as const;
      let op: (typeof operators)[number] | null = null;
      for (const candidate of operators) {
        if (trimmed.includes(candidate)) {
          op = candidate;
          break;
        }
      }
      if (!op) return false;

      const parts = trimmed.split(op);
      const key = parts[0].trim();
      const rawVal = parts[1].trim();
      const actualVal = getProperty(item, key);
      const compareVal = isNaN(Number(rawVal))
        ? rawVal.replace(/['"]/g, '')
        : parseFloat(rawVal);

      if (actualVal === undefined || actualVal === null) return false;

      switch (op) {
        case '<':
          return (actualVal as number) < (compareVal as number);
        case '>':
          return (actualVal as number) > (compareVal as number);
        case '<=':
          return (actualVal as number) <= (compareVal as number);
        case '>=':
          return (actualVal as number) >= (compareVal as number);
        case '=':
          return actualVal == compareVal;
        case '!=':
          return actualVal != compareVal;
      }
    } catch {
      return false;
    }
    return false;
  }

  const lowerQ = trimmed.toLowerCase();
  const tags = item.Tags ?? [];
  return (
    item.AssetName.toLowerCase().includes(lowerQ) ||
    item.AssetId.toLowerCase().includes(lowerQ) ||
    tags.some((t) => t.toLowerCase().includes(lowerQ))
  );
}

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}

export function wrapText(str: string, maxLength: number): string {
  if (!str) return '';
  const words = str.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] ?? '';

  for (let i = 1; i < words.length; i++) {
    if (currentLine.length + 1 + words[i].length <= maxLength) {
      currentLine += ' ' + words[i];
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines.join('\n');
}
