import type { Arc, Net } from './net';

// Coordinates come from petri-netz-labor-reference.html.

// Short way to write an arrow. Weight 1 if not given, like on the slides.
function arc(from: string, to: string, weight = 1, via?: [number, number][]): Arc {
  return { from, to, weight, via };
}

// Slide 40: the firing rule with weights
export const slide40: Net = {
  title: 'Firing rule',
  hint: 'Click the bar t to check both rules and fire it.',
  height: 345,
  showNumbers: true,
  places: {
    e1: { x: 230, y: 70, tokens: 2, label: 'e₁', labelPos: 'left' },
    e2: { x: 340, y: 70, tokens: 5, label: 'e₂', labelPos: 'left' },
    e3: { x: 450, y: 70, tokens: 1, label: 'e₃', labelPos: 'left' },
    a1: { x: 280, y: 300, tokens: 0, label: 'a₁', labelPos: 'left' },
    a2: { x: 400, y: 300, tokens: 2, label: 'a₂', labelPos: 'left' },
  },
  transitions: {
    t: { x: 340, y: 185, horizontal: true, label: 't', labelPos: 'right' },
  },
  arcs: [
    arc('e1', 't'),
    arc('e2', 't', 2),
    arc('e3', 't'),
    arc('t', 'a1'),
    arc('t', 'a2'),
  ],
};

// Slide 41: t₁ has no input place, only K = 2 stops it
export const slide41: Net = {
  title: 'No input place',
  hint: 't₁ has no input place, so rule 1 always holds. Fire t₁ three times and watch rule 2 stop it at K = 2.',
  height: 190,
  places: {
    s: { x: 340, y: 100, tokens: 0, capacity: 2, label: 's', labelPos: 'bottom' },
  },
  transitions: {
    t1: { x: 220, y: 100, label: 't₁' },
    t2: { x: 460, y: 100, label: 't₂' },
  },
  arcs: [
    arc('t1', 's'),
    arc('s', 't2'),
  ],
};

// Slide 42: self-loop on s with K = 2 (the exam trap)
export const slide42: Net = {
  title: 'Self-loop',
  hint: 'Click t. Then click the place s to change its tokens (0 → 1 → 2) and try again.',
  height: 190,
  editable: true,
  places: {
    s: { x: 400, y: 100, tokens: 2, capacity: 2, label: 's', labelPos: 'bottom' },
  },
  transitions: {
    t: { x: 290, y: 100, label: 't' },
  },
  arcs: [
    arc('t', 's'),
    arc('s', 't'),
  ],
};

// Slides 44–47: modelling elements

export const vorherNachher: Net = {
  title: 'Vorher-Nachher',
  hint: 't moves the token from vorher to nachher.',
  height: 350,
  editable: true,
  places: {
    a: { x: 220, y: 170, tokens: 1, label: 'vorher', labelPos: 'top' },
    b: { x: 460, y: 170, tokens: 0, label: 'nachher', labelPos: 'top' },
  },
  transitions: {
    t: { x: 340, y: 170, label: 't' },
  },
  arcs: [
    arc('a', 't'),
    arc('t', 'b'),
  ],
};

export const notwendig: Net = {
  title: 'Notwendige Bedingung',
  hint: 't needs a token in p₁ and in p₂. Click t (gray), then click p₂ to give it a token and try again.',
  height: 350,
  editable: true,
  places: {
    p1: { x: 230, y: 110, tokens: 1, label: 'p₁', labelPos: 'left' },
    p2: { x: 230, y: 230, tokens: 0, label: 'p₂', labelPos: 'left' },
    q: { x: 470, y: 170, tokens: 0, label: 'q', labelPos: 'top' },
  },
  transitions: {
    t: { x: 350, y: 170, label: 't' },
  },
  arcs: [
    arc('p1', 't'),
    arc('p2', 't'),
    arc('t', 'q'),
  ],
};

export const hinreichend: Net = {
  title: 'Hinreichende Bedingung',
  hint: 'q gets a token if t₁ or t₂ fires. Either one alone is enough for t₃ to continue.',
  height: 350,
  editable: true,
  places: {
    a: { x: 200, y: 110, tokens: 1, label: 'a', labelPos: 'left' },
    b: { x: 200, y: 230, tokens: 1, label: 'b', labelPos: 'left' },
    q: { x: 430, y: 170, tokens: 0, label: 'q', labelPos: 'top' },
    r: { x: 610, y: 170, tokens: 0, label: 'r', labelPos: 'top' },
  },
  transitions: {
    t1: { x: 310, y: 110, label: 't₁' },
    t2: { x: 310, y: 230, label: 't₂' },
    t3: { x: 520, y: 170, label: 't₃' },
  },
  arcs: [
    arc('a', 't1'),
    arc('b', 't2'),
    arc('t1', 'q'),
    arc('t2', 'q'),
    arc('q', 't3'),
    arc('t3', 'r'),
  ],
};

export const alternative: Net = {
  title: 'Alternative (Konflikt)',
  hint: 't₁ and t₂ both need the one token in p. Whichever fires first disables the other.',
  height: 350,
  editable: true,
  places: {
    p: { x: 220, y: 170, tokens: 1, label: 'p', labelPos: 'left' },
    q: { x: 460, y: 170, tokens: 0, label: 'q', labelPos: 'right' },
  },
  transitions: {
    t1: { x: 340, y: 100, label: 't₁' },
    t2: { x: 340, y: 240, label: 't₂', labelPos: 'bottom' },
  },
  arcs: [
    arc('p', 't1'),
    arc('p', 't2'),
    arc('t1', 'q'),
    arc('t2', 'q'),
  ],
};

export const wiederholung: Net = {
  title: 'Wiederholung',
  hint: 'Press Auto-play a few times after Reset. Each time the token is back in s, Rumpf and Abbruch are in conflict, so the loop ends after a random number of passes.',
  height: 350,
  editable: true,
  places: {
    s: { x: 200, y: 190, tokens: 1, label: 's', labelPos: 'left' },
    b: { x: 460, y: 190, tokens: 0, label: 'b', labelPos: 'right' },
    e: { x: 460, y: 90, tokens: 0, label: 'Ende', labelPos: 'right' },
  },
  transitions: {
    tb: { x: 330, y: 190, label: 'Rumpf', labelPos: 'bottom' },
    tr: { x: 330, y: 280, label: 'zurück', labelPos: 'bottom' },
    tx: { x: 330, y: 90, label: 'Abbruch', labelPos: 'top' },
  },
  arcs: [
    arc('s', 'tb'),
    arc('tb', 'b'),
    arc('b', 'tr', 1, [[460, 280]]),
    arc('tr', 's', 1, [[200, 280]]),
    arc('s', 'tx', 1, [[200, 90]]),
    arc('tx', 'e'),
  ],
};

export const forSchleife: Net = {
  title: 'for-Schleife (n = 3)',
  hint: 'Each pass moves one token from n into Zähler. Abbruch needs 3 tokens in Zähler (arrow weight 3), so it fires after exactly 3 passes. Try Auto-play.',
  height: 350,
  editable: true,
  places: {
    s: { x: 180, y: 225, tokens: 1, label: 's', labelPos: 'left' },
    n: { x: 255, y: 140, tokens: 3, label: 'n', labelPos: 'left' },
    c: { x: 410, y: 140, tokens: 0, label: 'Zähler', labelPos: 'right' },
    b: { x: 480, y: 225, tokens: 0, label: 'b', labelPos: 'right' },
    e: { x: 590, y: 60, tokens: 0, label: 'Ende', labelPos: 'top' },
  },
  transitions: {
    tb: { x: 330, y: 225, label: 'Rumpf', labelPos: 'bottom' },
    tr: { x: 330, y: 305, label: 'zurück', labelPos: 'bottom' },
    tx: { x: 480, y: 60, label: 'Abbruch', labelPos: 'top' },
  },
  arcs: [
    arc('s', 'tb'),
    arc('n', 'tb'),
    arc('tb', 'b'),
    arc('tb', 'c'),
    arc('b', 'tr', 1, [[480, 305]]),
    arc('tr', 's', 1, [[180, 305]]),
    arc('s', 'tx', 1, [[180, 60]]),
    arc('c', 'tx', 3),
    arc('tx', 'e'),
  ],
};

export const konfusion: Net = {
  title: 'Konfusion',
  hint: 't₂ conflicts with t₁ and with t₃ at once. Fire t₁ first: t₂ is dead, t₃ still fires. Reset, then fire t₂ first: both tokens are gone.',
  height: 350,
  editable: true,
  places: {
    p1: { x: 240, y: 120, tokens: 1, label: 'p₁', labelPos: 'left' },
    p2: { x: 240, y: 240, tokens: 1, label: 'p₂', labelPos: 'left' },
  },
  transitions: {
    t1: { x: 380, y: 60, label: 't₁', labelPos: 'right' },
    t2: { x: 380, y: 180, label: 't₂', labelPos: 'right' },
    t3: { x: 380, y: 300, label: 't₃', labelPos: 'right' },
  },
  arcs: [
    arc('p1', 't1'),
    arc('p1', 't2'),
    arc('p2', 't2'),
    arc('p2', 't3'),
  ],
};

// Slide 43: the trip, combines all the patterns
export const reise: Net = {
  title: 'Reise',
  hint: 'Click the bar right of Reisevorb. to start, or press Auto-play and watch the whole trip run.',
  height: 440,
  places: {
    R: { x: 40, y: 235, r: 18, tokens: 1, label: 'Reisevorb.', labelPos: 'top', name: 'Reisevorbereitungen' },
    U: { x: 150, y: 100, r: 18, tokens: 0, label: 'Unterkunft', labelPos: 'left' },
    Tr: { x: 150, y: 235, r: 18, tokens: 0, label: 'Transport', labelPos: 'bottom', name: 'Transportmittel' },
    Gp: { x: 150, y: 375, r: 18, tokens: 0, label: 'Gepäck', labelPos: 'left' },
    H: { x: 330, y: 125, r: 18, tokens: 0, name: 'Hotel gewählt' },
    Uf: { x: 510, y: 100, r: 18, tokens: 0, name: 'Unterkunft geklärt' },
    Z: { x: 330, y: 180, r: 18, tokens: 0, name: 'Zug gewählt' },
    Au: { x: 330, y: 235, r: 18, tokens: 0, name: 'Auto gewählt' },
    Tf: { x: 510, y: 235, r: 18, tokens: 0, name: 'Transport geklärt' },
    Gf: { x: 510, y: 375, r: 18, tokens: 0, label: 'gepackt', labelPos: 'top' },
    Re: { x: 640, y: 235, r: 18, tokens: 0, label: 'Reise', labelPos: 'top' },
  },
  transitions: {
    f0: { x: 95, y: 235, name: 'Start' },
    cmp: { x: 240, y: 40, label: 'Camping' },
    htl: { x: 240, y: 125, label: 'Hotel' },
    res: { x: 420, y: 125, label: 'Reserv.' },
    zug: { x: 240, y: 180, label: 'Zug' },
    tic: { x: 420, y: 180, label: 'Ticket' },
    aut: { x: 240, y: 235, label: 'Auto' },
    tnk: { x: 420, y: 235, label: 'tanken' },
    fus: { x: 240, y: 305, label: 'Fuß' },
    pck: { x: 240, y: 375, label: 'packen' },
    fer: { x: 585, y: 235, label: 'fertig', labelPos: 'bottom' },
    noc: { x: 560, y: 420, label: 'nochmal', labelPos: 'top' },
  },
  arcs: [
    // Start: one token splits into three branches
    arc('R', 'f0'),
    arc('f0', 'U'),
    arc('f0', 'Tr'),
    arc('f0', 'Gp'),
    // Unterkunft: Camping or Hotel (+ Reserv.)
    arc('U', 'cmp'),
    arc('U', 'htl'),
    arc('htl', 'H'),
    arc('H', 'res'),
    arc('cmp', 'Uf'),
    arc('res', 'Uf'),
    // Transportmittel: Zug (+ Ticket), Auto (+ tanken) or Fuß
    arc('Tr', 'zug'),
    arc('zug', 'Z'),
    arc('Z', 'tic'),
    arc('tic', 'Tf'),
    arc('Tr', 'aut'),
    arc('aut', 'Au'),
    arc('Au', 'tnk'),
    arc('tnk', 'Tf'),
    arc('Tr', 'fus'),
    arc('fus', 'Tf', 1, [[460, 305]]),
    // Gepäck
    arc('Gp', 'pck'),
    arc('pck', 'Gf'),
    // fertig joins the three branches, nochmal goes back to the start
    arc('Uf', 'fer'),
    arc('Tf', 'fer'),
    arc('Gf', 'fer'),
    arc('fer', 'Re'), // missing in the spec and the reference page, but fertig must give Reise its token
    arc('Re', 'noc', 1, [[640, 420]]),
    arc('noc', 'R', 1, [[40, 420]]),
  ],
};

// The nets sorted by type, for the dropdown
export type PresetGroup = { name: string; nets: Net[] };

export const presetGroups: PresetGroup[] = [
  { name: 'Schaltregel', nets: [slide40, slide41, slide42] },
  {
    name: 'Modellierungselemente',
    nets: [vorherNachher, notwendig, hinreichend, alternative, wiederholung, forSchleife, konfusion],
  },
  { name: 'Gesamtbeispiel', nets: [reise] },
];

// All nets in one list, in dropdown order
export const presets: Net[] = [];
for (const group of presetGroups) presets.push(...group.nets);

// Name of the group a net belongs to, e.g. "Modellierungselemente"
export function groupName(net: Net): string {
  for (const group of presetGroups) {
    if (group.nets.includes(net)) return group.name;
  }
  return '';
}
