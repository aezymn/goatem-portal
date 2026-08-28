/**
 * Turning two timestamps into "what is this person doing right now".
 *
 * Deliberately pure and shared: the roster computes this in the browser
 * on a ticking clock (so a page left open doesn't insist everyone is
 * still online), the profile page computes it once on the server, and
 * both need to agree on what the words mean.
 */

/** A heartbeat lands every HEARTBEAT_MS while a tab is open and visible;
 * anything inside this window means the portal is genuinely in front of
 * them. Generous enough that one dropped request doesn't blink someone
 * offline. */
export const SEEN_WINDOW_MS = 2.5 * 60 * 1000;

/** No interaction for this long, with the tab still open, is "away" —
 * the five minutes asked for. */
export const IDLE_AFTER_MS = 5 * 60 * 1000;

/** How often an open tab checks in. */
export const HEARTBEAT_MS = 60 * 1000;

export type PresenceState = "online" | "away" | "offline" | "never";

export interface Presence {
  state: PresenceState;
  label: string;
  /** Full sentence for a tooltip — the exact time behind the rounding. */
  title: string;
}

export interface PresenceInput {
  hasSignedIn: boolean;
  /** ISO strings, or null. Sign-in counts as activity, and is the only
   * signal for anyone who last used the portal before presence existed. */
  lastActiveAt?: string | null;
  lastSeenAt?: string | null;
  lastSignInAt?: string | null;
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Reading the clock, kept here rather than inline in a component.
 *
 * On a server component the current time is just another thing fetched
 * at render — but `Date.now()` written inside a component body trips
 * React's purity rule, and rightly so as a general habit. This is the one
 * place allowed to look.
 */
export function nowMs(): number {
  return Date.now();
}

export function presenceFor(input: PresenceInput, now = nowMs()): Presence {
  const active = ms(input.lastActiveAt) ?? ms(input.lastSignInAt);
  const seen = ms(input.lastSeenAt);

  if (active === null) {
    return input.hasSignedIn
      ? {
          state: "offline",
          label: "Signed in",
          title: "Has signed in, but hasn't been seen since activity tracking started",
        }
      : {
          state: "never",
          label: "Never",
          title: "Has never signed into the portal",
        };
  }

  const sinceActive = now - active;
  const onSite = seen !== null && now - seen < SEEN_WINDOW_MS;

  if (onSite && sinceActive < IDLE_AFTER_MS) {
    return { state: "online", label: "Online", title: "Active on the portal now" };
  }
  if (onSite) {
    return {
      state: "away",
      label: "Away",
      title: `Has the portal open but hasn't done anything for ${relative(sinceActive)}`,
    };
  }
  return {
    state: "offline",
    label: `Active ${relative(sinceActive)} ago`,
    title: `Last active ${new Date(active).toLocaleString()}`,
  };
}

/** Coarse on purpose. "3h" is the useful answer; "3h 14m" is noise in a
 * column you're scanning down. */
export function relative(deltaMs: number): string {
  const mins = Math.floor(deltaMs / 60_000);
  if (mins < 1) return "moments";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}
