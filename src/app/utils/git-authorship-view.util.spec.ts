import { DboAsset } from '../models/dbo.models';
import {
  gitContributorPie,
  gitContributors,
  gitCreatedBy,
  gitLastUpdated,
  hasGitAuthorship,
} from './git-authorship-view.util';

const toolAsset: DboAsset = {
  AssetId: 'tool-1',
  AssetName: 'Pillow',
  AssetType: 'Tool',
  Data: {
    CreatedBy: 'Jason Ribeira <jason@simx.com>',
    CreatedOn: '2020-08-09',
    LastUpdatedBy: 'alex.brandt <alex.brandt@simxvr.com>',
    LastUpdatedOn: '2026-02-04',
    Contributors: [
      { Name: 'alex.brandt <alex.brandt@simxvr.com>', Commits: 14 },
      { Name: 'Caolan <caolan@simx.com>', Commits: 8 },
    ],
  },
};

describe('git-authorship-view', () => {
  it('parses created, updated, and contributor rows', () => {
    expect(gitCreatedBy(toolAsset)).toEqual({
      name: 'Jason Ribeira',
      email: 'jason@simx.com',
      date: '2020-08-09',
    });
    expect(gitLastUpdated(toolAsset)).toEqual({
      name: 'alex.brandt',
      email: 'alex.brandt@simxvr.com',
      date: '2026-02-04',
    });
    expect(gitContributors(toolAsset)).toEqual([
      { name: 'alex.brandt', email: 'alex.brandt@simxvr.com', commits: 14 },
      { name: 'Caolan', email: 'caolan@simx.com', commits: 8 },
    ]);
    expect(hasGitAuthorship(toolAsset)).toBeTrue();
  });

  it('returns empty when git fields are missing', () => {
    const empty: DboAsset = {
      AssetId: 'x',
      AssetName: 'X',
      AssetType: 'Tool',
      Data: { AssetKey: 'x' },
    };
    expect(gitCreatedBy(empty)).toBeNull();
    expect(gitLastUpdated(empty)).toBeNull();
    expect(gitContributors(empty)).toEqual([]);
    expect(hasGitAuthorship(empty)).toBeFalse();
  });

  it('builds a themed pie with a translucent remainder for other commits', () => {
    const pie = gitContributorPie({
      ...toolAsset,
      Data: {
        ...toolAsset.Data,
        ContributorOtherCommits: 5,
      },
    });
    expect(pie).toBeTruthy();
    expect(pie!.named.map((s) => s.color)).toEqual([
      'var(--contributor-slice-1)',
      'var(--contributor-slice-2)',
    ]);
    expect(pie!.named[0].commits).toBe(14);
    expect(pie!.otherCommits).toBe(5);
    expect(pie!.totalCommits).toBe(27);
    expect(pie!.wedges.length).toBe(3);
    expect(pie!.wedges.map((w) => w.label)).toEqual([
      '14 Commits',
      '8 Commits',
      '5 Commits',
    ]);
    expect(pie!.wedges[2].color).toBe('rgba(0, 0, 0, 0.5)');
    expect(pie!.wedges[0].d).toContain('A 50 50');
    expect(pie!.named.length).toBe(2);
  });
});
