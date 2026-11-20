import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { A2UI_PROTOCOL_VERSION } from '../a2ui/index.js';

export interface UpstreamPillarCheckResult {
  pillar: 'icm' | 'okf' | 'a2ui';
  repository: string;
  branch: string;
  status: 'up-to-date' | 'commit-drift' | 'new-protocol-version' | 'offline';
  pinnedVersion?: string;
  upstreamCurrentVersion?: string;
  pinnedCommit: string;
  upstreamHeadCommit?: string;
  paperUrl?: string;
  message: string;
}

async function fetchLatestTrackedCommit(
  repoSlug: string,
  branch: string,
  trackedPaths: string[],
  headers: Record<string, string>,
  timeoutMs: number
): Promise<{ commit?: string; httpFailed: boolean }> {
  const pathsToQuery = trackedPaths.length > 0 ? trackedPaths : [''];
  let anySuccess = false;
  const results = await Promise.all(
    pathsToQuery.map(async (trackedPath) => {
      try {
        const pathParam = trackedPath ? `&path=${encodeURIComponent(trackedPath)}` : '';
        const res = await fetch(
          `https://api.github.com/repos/${repoSlug}/commits?sha=${encodeURIComponent(branch)}${pathParam}&per_page=1`,
          {
            headers,
            signal: AbortSignal.timeout(timeoutMs),
          }
        );
        if (!res.ok) return undefined;
        anySuccess = true;
        const commitArr = (await res.json()) as Array<{
          sha?: string;
          commit?: { committer?: { date?: string } };
        }>;
        const top = Array.isArray(commitArr) ? commitArr[0] : undefined;
        if (!top || typeof top.sha !== 'string') return undefined;
        return {
          sha: top.sha,
          dateMs: top.commit?.committer?.date ? Date.parse(top.commit.committer.date) || 0 : 0,
        };
      } catch {
        return undefined;
      }
    })
  );
  const valid = results.filter((c): c is { sha: string; dateMs: number } => Boolean(c));
  if (valid.length === 0) {
    return { commit: undefined, httpFailed: !anySuccess };
  }
  valid.sort((a, b) => b.dateMs - a.dateMs);
  return { commit: valid[0].sha, httpFailed: false };
}

/**
 * Checks all three open architectural pillars pinned in `specification/UPSTREAM_LOCK.json`
 * (`icm`: `RinDig/Interpretable-Context-Methodology`, `okf`: `open-knowledge-format/open-knowledge-format`,
 * `a2ui`: `google/A2UI`) against live upstream GitHub commits and version manifests at zero dependency cost.
 */
export async function checkUpstreamSpecs(options?: {
  lockPath?: string;
  timeoutMs?: number;
}): Promise<{
  status: 'up-to-date' | 'commit-drift' | 'new-protocol-version' | 'offline';
  pillars: {
    icm: UpstreamPillarCheckResult;
    okf: UpstreamPillarCheckResult;
    a2ui: UpstreamPillarCheckResult;
  };
  summary: string;
}> {
  const lockCandidates = options?.lockPath
    ? [path.resolve(options.lockPath)]
    : [
        path.resolve(process.cwd(), 'specification', 'UPSTREAM_LOCK.json'),
        fileURLToPath(new URL('../../specification/UPSTREAM_LOCK.json', import.meta.url)),
      ];
  const resolvedLock = lockCandidates.find((p) => fs.existsSync(p));
  if (!resolvedLock) {
    throw new Error('Missing specification/UPSTREAM_LOCK.json');
  }
  const lockJson = JSON.parse(fs.readFileSync(resolvedLock, 'utf-8'));
  const timeoutMs = options?.timeoutMs ?? 6000;
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'open-knowledge-studio-spec-check',
  };

  const checkIcmPillar = async (): Promise<UpstreamPillarCheckResult> => {
    const repoSlug = String(
      lockJson?.icm?.repository || 'RinDig/Interpretable-Context-Methodology'
    );
    const branch = String(lockJson?.icm?.branch || 'main');
    const pinnedCommit = String(lockJson?.icm?.commit || '');
    const paperUrl = lockJson?.icm?.paperUrl ? String(lockJson.icm.paperUrl) : undefined;
    const trackedPaths: string[] =
      Array.isArray(lockJson?.icm?.trackedPaths) && lockJson.icm.trackedPaths.length > 0
        ? lockJson.icm.trackedPaths.map((p: unknown) => String(p))
        : ['_core', 'README.md'];

    const headInfo = await fetchLatestTrackedCommit(
      repoSlug,
      branch,
      trackedPaths,
      headers,
      timeoutMs
    );
    if (!headInfo.commit) {
      return {
        pillar: 'icm',
        repository: repoSlug,
        branch,
        status: 'offline',
        pinnedCommit,
        paperUrl,
        message: `Offline or GitHub API rate-limited for ${repoSlug}; local pin is ${pinnedCommit.slice(0, 12)}.`,
      };
    }
    if (pinnedCommit && headInfo.commit !== pinnedCommit) {
      return {
        pillar: 'icm',
        repository: repoSlug,
        branch,
        status: 'commit-drift',
        pinnedCommit,
        upstreamHeadCommit: headInfo.commit,
        paperUrl,
        message: `Newer upstream commit(s) on ${repoSlug}@${branch}: ${headInfo.commit.slice(0, 12)} (local pin: ${pinnedCommit.slice(0, 12)}).`,
      };
    }
    return {
      pillar: 'icm',
      repository: repoSlug,
      branch,
      status: 'up-to-date',
      pinnedCommit,
      upstreamHeadCommit: headInfo.commit,
      paperUrl,
      message: `ICM conventions are up to date with ${repoSlug}@${branch} (${headInfo.commit.slice(0, 12)}).`,
    };
  };

  const checkOkfPillar = async (): Promise<UpstreamPillarCheckResult> => {
    const repoSlug = String(
      lockJson?.okf?.repository || 'open-knowledge-format/open-knowledge-format'
    );
    const branch = String(lockJson?.okf?.branch || 'main');
    const pinnedVersion = String(lockJson?.okf?.okfVersion || '0.3');
    const pinnedCommit = String(lockJson?.okf?.commit || '');
    const rawSpecUrl = String(
      lockJson?.okf?.rawSpecUrl ||
        `https://raw.githubusercontent.com/${repoSlug}/${branch}/SPEC.md`
    );
    const trackedPaths: string[] =
      Array.isArray(lockJson?.okf?.trackedPaths) && lockJson.okf.trackedPaths.length > 0
        ? lockJson.okf.trackedPaths.map((p: unknown) => String(p))
        : ['SPEC.md'];

    let upstreamCurrentVersion: string | undefined;
    let rawSpecOk = false;
    try {
      const specRes = await fetch(rawSpecUrl, {
        headers: { 'User-Agent': headers['User-Agent'] },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (specRes.ok) {
        rawSpecOk = true;
        const specSnippet = (await specRes.text()).slice(0, 1024);
        const verMatch = specSnippet.match(/\*\*Version\s+([0-9]+(?:\.[0-9]+)*)\*\*/i);
        if (verMatch) {
          upstreamCurrentVersion = verMatch[1];
        }
      }
    } catch {
      // Handled below if commit check also fails
    }

    const headInfo = await fetchLatestTrackedCommit(
      repoSlug,
      branch,
      trackedPaths,
      headers,
      timeoutMs
    );
    if (!rawSpecOk && !headInfo.commit) {
      return {
        pillar: 'okf',
        repository: repoSlug,
        branch,
        status: 'offline',
        pinnedVersion,
        pinnedCommit,
        message: `Offline or unreachable for ${repoSlug}; local pin is OKF v${pinnedVersion} @ ${pinnedCommit.slice(0, 12)}.`,
      };
    }
    if (upstreamCurrentVersion && upstreamCurrentVersion !== pinnedVersion) {
      return {
        pillar: 'okf',
        repository: repoSlug,
        branch,
        status: 'new-protocol-version',
        pinnedVersion,
        upstreamCurrentVersion,
        pinnedCommit,
        upstreamHeadCommit: headInfo.commit,
        message: `New upstream OKF version available: v${upstreamCurrentVersion} (local pin: v${pinnedVersion} @ ${pinnedCommit.slice(0, 12)}).`,
      };
    }
    if (headInfo.commit && pinnedCommit && headInfo.commit !== pinnedCommit) {
      return {
        pillar: 'okf',
        repository: repoSlug,
        branch,
        status: 'commit-drift',
        pinnedVersion,
        upstreamCurrentVersion: upstreamCurrentVersion || pinnedVersion,
        pinnedCommit,
        upstreamHeadCommit: headInfo.commit,
        message: `OKF v${pinnedVersion} has newer upstream commit(s) on ${repoSlug}@${branch}: ${headInfo.commit.slice(0, 12)} (local pin: ${pinnedCommit.slice(0, 12)}).`,
      };
    }
    return {
      pillar: 'okf',
      repository: repoSlug,
      branch,
      status: 'up-to-date',
      pinnedVersion,
      upstreamCurrentVersion: upstreamCurrentVersion || pinnedVersion,
      pinnedCommit,
      upstreamHeadCommit: headInfo.commit,
      message: `Vendored OKF v${pinnedVersion} SPEC.md is up to date with ${repoSlug}@${branch} (${(headInfo.commit || pinnedCommit).slice(0, 12)}).`,
    };
  };

  const checkA2uiPillar = async (): Promise<UpstreamPillarCheckResult> => {
    const pinnedProtocolVersion = String(lockJson?.a2ui?.protocolVersion || A2UI_PROTOCOL_VERSION);
    const pinnedCommit = String(lockJson?.a2ui?.commit || '');
    const versionsUrl = String(
      lockJson?.a2ui?.versionsUrl ||
        'https://raw.githubusercontent.com/google/A2UI/main/specification/versions.json'
    );
    const repoSlug = String(lockJson?.a2ui?.repository || 'google/A2UI');
    const branch = String(lockJson?.a2ui?.branch || 'main');
    const trackedPaths: string[] =
      Array.isArray(lockJson?.a2ui?.trackedPaths) && lockJson.a2ui.trackedPaths.length > 0
        ? lockJson.a2ui.trackedPaths.map((p: unknown) => String(p))
        : ['specification/v1_0', 'specification/versions.json', 'catalogs/basic/v1/catalog.json'];

    try {
      const verRes = await fetch(versionsUrl, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!verRes.ok) {
        return {
          pillar: 'a2ui',
          repository: repoSlug,
          branch,
          status: 'offline',
          pinnedVersion: pinnedProtocolVersion,
          pinnedCommit,
          message: `Unable to fetch upstream versions.json (HTTP ${verRes.status}); local pin is A2UI v${pinnedProtocolVersion} @ ${pinnedCommit.slice(0, 12)}.`,
        };
      }
      const rawVersionsPayload = (await verRes.json()) as
        | Array<{ version?: string; status?: string }>
        | { versions?: Array<{ version?: string; status?: string }> };
      const versionsList = Array.isArray(rawVersionsPayload)
        ? rawVersionsPayload
        : Array.isArray(rawVersionsPayload?.versions)
          ? rawVersionsPayload.versions
          : [];
      const currentEntry = versionsList.find((v) => v?.status === 'current');
      const upstreamCurrentVersion = String(currentEntry?.version || '').replace(/^v/i, '');

      const headInfo = await fetchLatestTrackedCommit(
        repoSlug,
        branch,
        trackedPaths,
        headers,
        timeoutMs
      );
      const upstreamHeadCommit = headInfo.commit;

      if (upstreamCurrentVersion && upstreamCurrentVersion !== pinnedProtocolVersion) {
        return {
          pillar: 'a2ui',
          repository: repoSlug,
          branch,
          status: 'new-protocol-version',
          pinnedVersion: pinnedProtocolVersion,
          upstreamCurrentVersion,
          pinnedCommit,
          upstreamHeadCommit,
          message: `New upstream A2UI current version available: v${upstreamCurrentVersion} (local pin: v${pinnedProtocolVersion} @ ${pinnedCommit.slice(0, 12)}).`,
        };
      }
      if (upstreamHeadCommit && pinnedCommit && upstreamHeadCommit !== pinnedCommit) {
        return {
          pillar: 'a2ui',
          repository: repoSlug,
          branch,
          status: 'commit-drift',
          pinnedVersion: pinnedProtocolVersion,
          upstreamCurrentVersion: upstreamCurrentVersion || pinnedProtocolVersion,
          pinnedCommit,
          upstreamHeadCommit,
          message: `A2UI v${pinnedProtocolVersion} is current, with newer upstream commit(s) on ${repoSlug}@${branch}: ${upstreamHeadCommit.slice(0, 12)} (local pin: ${pinnedCommit.slice(0, 12)}).`,
        };
      }
      return {
        pillar: 'a2ui',
        repository: repoSlug,
        branch,
        status: 'up-to-date',
        pinnedVersion: pinnedProtocolVersion,
        upstreamCurrentVersion: upstreamCurrentVersion || pinnedProtocolVersion,
        pinnedCommit,
        upstreamHeadCommit,
        message: `Vendored A2UI v${pinnedProtocolVersion} specification is up to date with ${repoSlug}@${branch} (${(upstreamHeadCommit || pinnedCommit).slice(0, 12)}).`,
      };
    } catch (err: any) {
      return {
        pillar: 'a2ui',
        repository: repoSlug,
        branch,
        status: 'offline',
        pinnedVersion: pinnedProtocolVersion,
        pinnedCommit,
        message: `Offline or unreachable (${err?.message || 'network error'}); local pin is A2UI v${pinnedProtocolVersion} @ ${pinnedCommit.slice(0, 12)}.`,
      };
    }
  };

  const [icm, okf, a2ui] = await Promise.all([
    checkIcmPillar(),
    checkOkfPillar(),
    checkA2uiPillar(),
  ]);
  const all = [icm, okf, a2ui];
  let status: 'up-to-date' | 'commit-drift' | 'new-protocol-version' | 'offline' = 'up-to-date';
  if (all.some((p) => p.status === 'new-protocol-version')) {
    status = 'new-protocol-version';
  } else if (all.some((p) => p.status === 'commit-drift')) {
    status = 'commit-drift';
  } else if (all.some((p) => p.status === 'offline')) {
    status = 'offline';
  }

  return {
    status,
    pillars: { icm, okf, a2ui },
    summary: `ICM (${icm.status}) | OKF v${okf.pinnedVersion || '0.3'} (${okf.status}) | A2UI v${a2ui.pinnedVersion || A2UI_PROTOCOL_VERSION} (${a2ui.status})`,
  };
}
