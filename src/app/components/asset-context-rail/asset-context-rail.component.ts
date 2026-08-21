import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DboAsset } from '../../models/dbo.models';
import { AssetMetaPanelComponent } from '../asset-meta-panel/asset-meta-panel.component';
import {
  GitContributorPie,
  GitContributorSlice,
  GitPersonView,
  commitCountLabel,
  gitContributorPie,
  gitCreatedBy,
  gitLastUpdated,
  hasGitAuthorship,
} from '../../utils/git-authorship-view.util';

const CONTEXT_OPEN_KEY = 'asset-viewer.context-open';

function readContextOpen(): boolean {
  try {
    const stored = localStorage.getItem(CONTEXT_OPEN_KEY);
    if (stored === '0') return false;
    if (stored === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

@Component({
  selector: 'app-asset-context-rail',
  standalone: true,
  imports: [CommonModule, AssetMetaPanelComponent],
  templateUrl: './asset-context-rail.component.html',
  styleUrl: './asset-context-rail.component.scss',
  host: {
    '[class.collapsed]': '!open()',
  },
})
export class AssetContextRailComponent {
  @Input({ required: true }) asset!: DboAsset;

  readonly open = signal(readContextOpen());
  readonly pieTip = signal<string | null>(null);

  toggle(): void {
    const next = !this.open();
    this.open.set(next);
    try {
      localStorage.setItem(CONTEXT_OPEN_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  hasGitAuthorship(): boolean {
    return hasGitAuthorship(this.asset);
  }

  gitCreatedBy(): GitPersonView | null {
    return gitCreatedBy(this.asset);
  }

  gitLastUpdated(): GitPersonView | null {
    return gitLastUpdated(this.asset);
  }

  gitContributorPie(): GitContributorPie | null {
    return gitContributorPie(this.asset);
  }

  contributorHoverTitle(slice: GitContributorSlice): string {
    const commits = commitCountLabel(slice.commits);
    return slice.email ? `${commits}\n${slice.email}` : commits;
  }

  contributorPieLabel(pie: GitContributorPie): string {
    const named = pie.named.map((s) => `${s.name} ${s.commits}`);
    if (pie.otherCommits > 0) named.push(`others ${pie.otherCommits}`);
    return `Contributor commits: ${named.join(', ')}`;
  }
}
