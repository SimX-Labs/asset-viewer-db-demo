import { DboAsset } from '../models/dbo.models';
import { gitDisplayName, gitEmail } from './git-identity.util';

export interface GitPersonView {
  name: string;
  email: string;
  date: string | null;
}

export interface GitContributorView {
  name: string;
  email: string;
  commits: number;
}

export interface GitContributorSlice extends GitContributorView {
  color: string;
}

export interface GitContributorWedge {
  color: string;
  commits: number;
  d: string;
  label: string;
}

export interface GitContributorPie {
  named: GitContributorSlice[];
  wedges: GitContributorWedge[];
  otherCommits: number;
  totalCommits: number;
}

/** Procedure Blue, Clinical Indigo / content-heavy, then content-light. */
export const CONTRIBUTOR_PIE_COLORS = [
  'var(--contributor-slice-1)',
  'var(--contributor-slice-2)',
  'var(--contributor-slice-3)',
] as const;
export const CONTRIBUTOR_OTHER_COLOR = 'rgba(0, 0, 0, 0.5)';

export function gitCreatedBy(asset: DboAsset): GitPersonView | null {
  return gitPerson(asset, 'CreatedBy', 'CreatedOn');
}

export function gitLastUpdated(asset: DboAsset): GitPersonView | null {
  return gitPerson(asset, 'LastUpdatedBy', 'LastUpdatedOn');
}

export function gitContributors(asset: DboAsset): GitContributorView[] {
  const list = asset.Data?.['Contributors'];
  if (!Array.isArray(list)) return [];
  const out: GitContributorView[] = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const rawName = String((row as { Name?: unknown }).Name ?? '').trim();
    const commits = Number((row as { Commits?: unknown }).Commits);
    const name = gitDisplayName(rawName);
    if (!name || !Number.isFinite(commits)) continue;
    out.push({ name, email: gitEmail(rawName), commits });
  }
  return out;
}

export function gitContributorOtherCommits(asset: DboAsset): number {
  const n = Number(asset.Data?.['ContributorOtherCommits']);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function gitContributorPie(asset: DboAsset): GitContributorPie | null {
  const named = gitContributors(asset)
    .slice(0, CONTRIBUTOR_PIE_COLORS.length)
    .map((c, i) => ({ ...c, color: CONTRIBUTOR_PIE_COLORS[i] }));
  const otherCommits = gitContributorOtherCommits(asset);
  const namedCommits = named.reduce((sum, c) => sum + c.commits, 0);
  const totalCommits = namedCommits + otherCommits;
  if (totalCommits <= 0) return null;
  const slices = [
    ...named.map((c) => ({ color: c.color, commits: c.commits })),
    ...(otherCommits > 0
      ? [{ color: CONTRIBUTOR_OTHER_COLOR, commits: otherCommits }]
      : []),
  ];
  return {
    named,
    wedges: pieWedges(slices, totalCommits),
    otherCommits,
    totalCommits,
  };
}

export function commitCountLabel(commits: number): string {
  return `${commits} ${commits === 1 ? 'Commit' : 'Commits'}`;
}

function pieWedges(
  slices: { color: string; commits: number }[],
  total: number,
): GitContributorWedge[] {
  let cursor = 0;
  return slices.map((slice) => {
    const start = cursor / total;
    cursor += slice.commits;
    return {
      color: slice.color,
      commits: slice.commits,
      d: pieWedgePath(start, cursor / total),
      label: commitCountLabel(slice.commits),
    };
  });
}

function pieWedgePath(startFrac: number, endFrac: number): string {
  const span = Math.min(1, Math.max(0, endFrac - startFrac));
  if (span <= 0) return '';
  if (span >= 1 - 1e-9) {
    return 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z';
  }
  const tau = Math.PI * 2;
  const start = -Math.PI / 2 + startFrac * tau;
  const end = -Math.PI / 2 + endFrac * tau;
  const x1 = 50 + 50 * Math.cos(start);
  const y1 = 50 + 50 * Math.sin(start);
  const x2 = 50 + 50 * Math.cos(end);
  const y2 = 50 + 50 * Math.sin(end);
  const large = span > 0.5 ? 1 : 0;
  return `M 50 50 L ${x1} ${y1} A 50 50 0 ${large} 1 ${x2} ${y2} Z`;
}

export function hasGitAuthorship(asset: DboAsset): boolean {
  return !!gitCreatedBy(asset) || !!gitLastUpdated(asset) || gitContributors(asset).length > 0;
}

function gitPerson(asset: DboAsset, nameKey: string, dateKey: string): GitPersonView | null {
  const raw = asset.Data?.[nameKey];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const name = gitDisplayName(raw);
  if (!name) return null;
  const date = asset.Data?.[dateKey];
  return {
    name,
    email: gitEmail(raw),
    date: typeof date === 'string' && date.trim() ? date.trim() : null,
  };
}
