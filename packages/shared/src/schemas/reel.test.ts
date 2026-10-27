import { describe, expect, it } from 'vitest';
import { reelFileProblem } from './reel';

const mb = 1024 * 1024;

describe('reelFileProblem', () => {
  it('accepts short MP4, MOV and WebM clips under 50 MB', () => {
    expect(reelFileProblem({ type: 'video/mp4', size: 20 * mb }, 30)).toBeNull();
    expect(reelFileProblem({ type: 'video/quicktime', size: 5 * mb }, 60.2)).toBeNull();
    expect(reelFileProblem({ type: 'video/webm', size: mb }, 3)).toBeNull();
  });

  it('rejects other formats, big files, long clips and unreadable durations', () => {
    expect(reelFileProblem({ type: 'video/x-msvideo', size: mb }, 10)).toMatch(/MP4/);
    expect(reelFileProblem({ type: 'video/mp4', size: 51 * mb }, 10)).toMatch(/50 MB/);
    expect(reelFileProblem({ type: 'video/mp4', size: mb }, 75)).toMatch(/60 seconds/);
    expect(reelFileProblem({ type: 'video/mp4', size: mb }, Number.NaN)).toMatch(/read/);
  });
});
