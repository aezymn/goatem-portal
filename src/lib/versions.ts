/**
 * The change log's version scheme.
 *
 * Two kinds of release:
 *
 *   - a NEW UPDATE bumps the minor: 0.1 → 0.2 → … → 0.9 → 1.0. Nine is
 *     the last minor in a series, so the update after 0.9 rolls the major
 *     rather than becoming 0.10.
 *   - a CONTINUATION of the current release appends a third number and
 *     counts up from zero: 0.9 → 0.9.0 → 0.9.1 → 0.9.2 → … with no
 *     ceiling, because "we shipped a bit more of the same update" can
 *     happen any number of times.
 *
 * Stored as three numbers as well as a display string: sorting "0.10"
 * after "0.9" only works numerically, and as text it comes out backwards.
 */

export interface Version {
  major: number;
  minor: number;
  /** Null for a plain release; a number for each continuation of it. */
  patch: number | null;
}

/** The last minor before the major rolls over. */
const LAST_MINOR = 9;

export function formatVersion(v: Version): string {
  return v.patch === null
    ? `${v.major}.${v.minor}`
    : `${v.major}.${v.minor}.${v.patch}`;
}

/** Parses "0.9" or "0.9.3", tolerating a leading v and stray spaces.
 * Returns null for anything else rather than guessing. */
export function parseVersion(raw: string): Version | null {
  const cleaned = raw.trim().replace(/^v/i, "");
  const m = /^(\d{1,4})\.(\d{1,4})(?:\.(\d{1,6}))?$/.exec(cleaned);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: m[3] === undefined ? null : Number(m[3]),
  };
}

/** Newest first. A plain release sorts BEFORE its own continuations,
 * since 0.9 came out before 0.9.0 did. */
export function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return b.major - a.major;
  if (a.minor !== b.minor) return b.minor - a.minor;
  const ap = a.patch ?? -1;
  const bp = b.patch ?? -1;
  return bp - ap;
}

export type ReleaseKind = "update" | "continuation";

/**
 * What the next version should be.
 *
 * `latest` is the highest version already published or drafted, or null
 * when this is the very first post — which starts at 0.1 rather than 0.0,
 * because a release nobody can point at isn't a release.
 */
export function nextVersion(
  latest: Version | null,
  kind: ReleaseKind
): Version {
  if (!latest) return { major: 0, minor: 1, patch: null };

  if (kind === "update") {
    // 0.9 is the end of the 0.x series: the next update is 1.0, not 0.10.
    return latest.minor >= LAST_MINOR
      ? { major: latest.major + 1, minor: 0, patch: null }
      : { major: latest.major, minor: latest.minor + 1, patch: null };
  }

  // A continuation stays on the current release line and counts up from
  // zero the first time.
  return {
    major: latest.major,
    minor: latest.minor,
    patch: latest.patch === null ? 0 : latest.patch + 1,
  };
}
