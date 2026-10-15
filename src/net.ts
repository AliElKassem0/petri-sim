// Petri net types and the firing rule (slides 36–39).
// Pure logic: no DOM, no drawing. Positions are only stored here for render.ts.

// Where a label is drawn, relative to its shape
export type LabelPos = 'top' | 'bottom' | 'left' | 'right';

// A place (Stelle), drawn as a circle
export type Place = {
  x: number; y: number;         // centre, in SVG coordinates
  tokens: number;               // tokens at the start (M0)
  capacity?: number;            // K, missing = ∞
  label?: string;               // text drawn next to the circle (missing = no text)
  name?: string;                // full name for the readouts, e.g. "Reisevorbereitungen" (missing = label, then the key)
  labelPos?: LabelPos;          // default 'top'
  r?: number;                   // radius, default 20
};

// A transition, drawn as a bar
export type Transition = {
  x: number; y: number;         // centre
  horizontal?: boolean;         // default false = vertical bar (9 wide, 36 tall); true = 36 wide, 9 tall
  label?: string;
  name?: string;
  labelPos?: LabelPos;          // default 'top'
};

// An arrow from a place to a transition, or from a transition to a place
export type Arc = {
  from: string; to: string;
  weight: number;
  via?: [number, number][];     // optional bend points, drawn as a polyline
};

// The whole net: places and transitions by key, all arrows
export type Net = {
  title: string;                // shown in the dropdown
  hint: string;                 // shown in the explanation panel when the net is loaded
  height: number;               // SVG height; width is always 680
  showNumbers?: boolean;        // draw token counts as numbers instead of dots
  editable?: boolean;           // clicking a place changes its tokens
  places: Record<string, Place>;
  transitions: Record<string, Transition>;
  arcs: Arc[];
};

// A marking: how many tokens each place has right now, e.g. { e1: 2, e2: 5 }
export type Marking = Record<string, number>;

// One line of the explanation panel, e.g. "e₂: has 5, arrow weight 2 → 5 ≥ 2"
export type RuleLine = { text: string; ok: boolean };

// Everything the explanation panel shows for one transition
export type Explanation = { ok: boolean; rule1: RuleLine[]; rule2: RuleLine[] };

// M0: read the starting tokens out of the net
export function initialMarking(net: Net): Marking {
  const m: Marking = {};
  for (const p in net.places) m[p] = net.places[p].tokens;
  return m;
}

// Name for the readouts: name, else label, else the key (e.g. "e1")
export function placeName(net: Net, p: string): string {
  const place = net.places[p];
  return place.name ?? place.label ?? p;
}

export function transitionName(net: Net, t: string): string {
  const transition = net.transitions[t];
  return transition.name ?? transition.label ?? t;
}

// W(from, to): weight of the arrow from -> to, or 0 if there is none
export function W(net: Net, from: string, to: string): number {
  return net.arcs
    .filter((a) => a.from === from && a.to === to)
    .reduce((sum, a) => sum + a.weight, 0);
}

// Slide 39: can transition t fire in marking m?
export function canFire(net: Net, m: Marking, t: string): boolean {
  for (const p in net.places) {
    // Rule 1: every input place has at least the arrow weight in tokens
    if (m[p] < W(net, p, t)) return false;

    // Rule 2: every output place stays within its capacity AFTER firing
    const after = m[p] - W(net, p, t) + W(net, t, p);
    const cap = net.places[p].capacity ?? Infinity;
    if (W(net, t, p) > 0 && after > cap) return false;
  }
  return true;
}

// Slide 39: fire t, M'(p) = M(p) - W(p,t) + W(t,p) for every place p
export function fire(net: Net, m: Marking, t: string): Marking {
  const next: Marking = { ...m };
  for (const p in net.places) next[p] = m[p] - W(net, p, t) + W(net, t, p);
  return next;
}

// Same check as canFire, but written out line by line for the explanation panel
export function explain(net: Net, m: Marking, t: string): Explanation {
  const rule1: RuleLine[] = [];
  const rule2: RuleLine[] = [];

  for (const p in net.places) {
    const name = placeName(net, p);
    const takes = W(net, p, t); // tokens t takes out of p
    const gives = W(net, t, p); // tokens t puts into p

    // Rule 1, only for input places (arrow p → t)
    if (takes > 0) {
      const ok = m[p] >= takes;
      const sign = ok ? '≥' : '<';
      rule1.push({ ok, text: `${name}: has ${m[p]}, arrow weight ${takes} → ${m[p]} ${sign} ${takes}` });
    }

    // Rule 2, only for output places (arrow t → p), counted after firing
    if (gives > 0) {
      const after = m[p] - takes + gives;

      // The sum, e.g. "2 − 1 + 1 = 2". The "− 1" only appears if t also takes from p (self-loop).
      let sum = `${m[p]}`;
      if (takes > 0) sum += ` − ${takes}`;
      sum += ` + ${gives} = ${after}`;

      const cap = net.places[p].capacity;
      if (cap === undefined) {
        rule2.push({ ok: true, text: `${name}: ${sum} ≤ ∞ (no capacity given)` });
      } else {
        const ok = after <= cap;
        const sign = ok ? '≤' : '>';
        rule2.push({ ok, text: `${name}: ${sum} ${sign} K = ${cap}` });
      }
    }
  }

  // t can fire only if every single line is ok
  const ok = rule1.every((line) => line.ok) && rule2.every((line) => line.ok);

  if (rule1.length === 0) {
    rule1.push({ ok: true, text: 'no input places, so rule 1 is automatically true' });
  }
  if (rule2.length === 0) {
    rule2.push({ ok: true, text: 'no output places, so rule 2 is automatically true' });
  }

  return { ok, rule1, rule2 };
}
