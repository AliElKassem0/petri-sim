import { describe, expect, test } from 'vitest';
import { canFire, explain, fire, initialMarking } from '../src/net';
import type { Marking, Net } from '../src/net';
import { classify, enabledTransitions } from '../src/analysis';
import { forSchleife, konfusion, reise, slide40, slide41, slide42 } from '../src/presets';

// Fire the transitions one after another. Each one must be enabled when its turn comes.
function fireAll(net: Net, m: Marking, transitions: string[]): Marking {
  let current = m;
  for (const t of transitions) {
    expect(canFire(net, current, t), `${t} should be enabled`).toBe(true);
    current = fire(net, current, t);
  }
  return current;
}

describe('Slide 40', () => {
  test('t fires once, then e3 is empty', () => {
    const m0 = initialMarking(slide40);
    expect(m0).toEqual({ e1: 2, e2: 5, e3: 1, a1: 0, a2: 2 });
    expect(canFire(slide40, m0, 't')).toBe(true);

    const m1 = fire(slide40, m0, 't');
    expect(m1).toEqual({ e1: 1, e2: 3, e3: 0, a1: 1, a2: 3 });
    expect(canFire(slide40, m1, 't')).toBe(false); // e3: 0 < 1
  });
});

describe('Slide 41', () => {
  test('s = 0: only t1', () => {
    expect(canFire(slide41, { s: 0 }, 't1')).toBe(true);
    expect(canFire(slide41, { s: 0 }, 't2')).toBe(false);
  });

  test('s = 2: t1 blocked by K, t2 enabled', () => {
    expect(canFire(slide41, { s: 2 }, 't1')).toBe(false); // 2 + 1 = 3 > 2
    expect(canFire(slide41, { s: 2 }, 't2')).toBe(true);
  });
});

describe('Slide 42 (self-loop trap)', () => {
  test('s = 2: t enabled, because 2 − 1 + 1 = 2 ≤ 2', () => {
    expect(canFire(slide42, { s: 2 }, 't')).toBe(true);
  });

  test('s = 0: t not enabled', () => {
    expect(canFire(slide42, { s: 0 }, 't')).toBe(false);
  });
});

describe('for-Schleife', () => {
  test('Abbruch only after exactly 3 passes', () => {
    const m0 = initialMarking(forSchleife);

    // before the 3rd pass, Abbruch is not enabled
    const m2 = fireAll(forSchleife, m0, ['tb', 'tr', 'tb', 'tr']);
    expect(canFire(forSchleife, m2, 'tx')).toBe(false);

    const m3 = fireAll(forSchleife, m2, ['tb', 'tr']);
    expect(m3.n).toBe(0);
    expect(m3.c).toBe(3);
    expect(m3.s).toBe(1);
    expect(canFire(forSchleife, m3, 'tx')).toBe(true);
    expect(canFire(forSchleife, m3, 'tb')).toBe(false);
  });
});

describe('Konfusion', () => {
  test('t2 first: nothing enabled afterwards', () => {
    const m = fire(konfusion, initialMarking(konfusion), 't2');
    expect(enabledTransitions(konfusion, m)).toEqual([]);
  });

  test('t1 first: only t3 enabled afterwards', () => {
    const m = fire(konfusion, initialMarking(konfusion), 't1');
    expect(enabledTransitions(konfusion, m)).toEqual(['t3']);
  });
});

describe('Reise', () => {
  test('after the start bar: enabled transitions and conflicts', () => {
    const m = fire(reise, initialMarking(reise), 'f0');
    const next = classify(reise, m);

    // Camping, Hotel, Zug, Auto, Fuß, packen
    expect(next.enabled).toEqual(['cmp', 'htl', 'zug', 'aut', 'fus', 'pck']);
    expect(next.conflicts).toEqual([
      { place: 'U', transitions: ['cmp', 'htl'] },
      { place: 'Tr', transitions: ['zug', 'aut', 'fus'] },
    ]);
    expect(next.noConflict).toEqual(['pck']);
  });
});

describe('Classification', () => {
  test('slide 40 after one firing: stuck', () => {
    const m = fire(slide40, initialMarking(slide40), 't');
    expect(classify(slide40, m).kind).toBe('stuck');
  });

  test('slide 41 with s = 0: forced (t1)', () => {
    const next = classify(slide41, { s: 0 });
    expect(next.kind).toBe('forced');
    expect(next.enabled).toEqual(['t1']);
  });

  test('slide 41 with s = 1: free, no conflict (nebenläufig)', () => {
    const next = classify(slide41, { s: 1 });
    expect(next.kind).toBe('free');
    expect(next.conflicts).toEqual([]);
  });
});

describe('explain()', () => {
  test('slide 40: rule 1 and rule 2 lines', () => {
    const ex = explain(slide40, initialMarking(slide40), 't');
    expect(ex.ok).toBe(true);
    expect(ex.rule1[1]).toEqual({ ok: true, text: 'e₂: has 5, arrow weight 2 → 5 ≥ 2' });
    expect(ex.rule2[1]).toEqual({ ok: true, text: 'a₂: 2 + 1 = 3 ≤ ∞ (no capacity given)' });
  });

  test('slide 40 after firing: e3 fails rule 1', () => {
    const m = fire(slide40, initialMarking(slide40), 't');
    const ex = explain(slide40, m, 't');
    expect(ex.ok).toBe(false);
    expect(ex.rule1[2]).toEqual({ ok: false, text: 'e₃: has 0, arrow weight 1 → 0 < 1' });
  });

  test('slide 42: self-loop counted after firing', () => {
    const ex = explain(slide42, { s: 2 }, 't');
    expect(ex.ok).toBe(true);
    expect(ex.rule2).toEqual([{ ok: true, text: 's: 2 − 1 + 1 = 2 ≤ K = 2' }]);
  });

  test('slide 41: no input place, and K blocks t1', () => {
    const ex = explain(slide41, { s: 2 }, 't1');
    expect(ex.ok).toBe(false);
    expect(ex.rule1).toEqual([{ ok: true, text: 'no input places, so rule 1 is automatically true' }]);
    expect(ex.rule2).toEqual([{ ok: false, text: 's: 2 + 1 = 3 > K = 2' }]);
  });
});
