// What kind of step comes next? (stuck / forced / free choice, and conflicts)
// Pure logic: no DOM.

import { canFire, W } from './net';
import type { Marking, Net } from './net';

// 0 enabled = stuck, 1 = forced, 2 or more = free choice
export type Kind = 'stuck' | 'forced' | 'free';

// Konflikt at one place: these enabled transitions all take tokens from it,
// and the place doesn't have enough tokens for all of them
export type Conflict = { place: string; transitions: string[] };

export type NextStep = {
  kind: Kind;
  enabled: string[];        // keys of all enabled transitions, in net order
  conflicts: Conflict[];
  noConflict: string[];     // enabled transitions that are in no conflict
};

// Keys of all transitions that can fire in marking m
export function enabledTransitions(net: Net, m: Marking): string[] {
  const result: string[] = [];
  for (const t in net.transitions) {
    if (canFire(net, m, t)) result.push(t);
  }
  return result;
}

// For every place: do at least 2 enabled transitions need more tokens from it than it has?
export function findConflicts(net: Net, m: Marking, enabled: string[]): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const p in net.places) {
    // enabled transitions with an arrow p → t
    const takers = enabled.filter((t) => W(net, p, t) > 0);
    if (takers.length < 2) continue;

    // how many tokens they need from p all together
    let needed = 0;
    for (const t of takers) needed += W(net, p, t);

    if (needed > m[p]) conflicts.push({ place: p, transitions: takers });
  }

  return conflicts;
}

// Count the enabled transitions and look for conflicts
export function classify(net: Net, m: Marking): NextStep {
  const enabled = enabledTransitions(net, m);
  const conflicts = findConflicts(net, m, enabled);

  let kind: Kind;
  if (enabled.length === 0) kind = 'stuck';
  else if (enabled.length === 1) kind = 'forced';
  else kind = 'free';

  // enabled transitions that appear in none of the conflicts
  const noConflict = enabled.filter((t) => !conflicts.some((c) => c.transitions.includes(t)));

  return { kind, enabled, conflicts, noConflict };
}
