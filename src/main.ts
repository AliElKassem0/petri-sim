// The page: dropdown, buttons, panels and the state of the simulation.
// The rules live in net.ts / analysis.ts, the drawing in render.ts / animate.ts.

import './style.css';
import { explain, fire, initialMarking, placeName, transitionName, W } from './net';
import type { Explanation, Marking, Net, RuleLine } from './net';
import { classify, enabledTransitions } from './analysis';
import type { Conflict, NextStep } from './analysis';
import { groupName, presetGroups, presets } from './presets';
import { drawTokens, pulsePlace, renderNet, setArcActive, setTransitionState } from './render';
import type { NetView } from './render';
import { moveDot, prefersReducedMotion } from './animate';

// ---------- Timing (at speed 1×) ----------

const DOT_MS = 650;        // one dot travelling along one arc
const STAGGER_MS = 150;    // gap between dots on the same arc (weight > 1)
const AUTO_MS = 1800;      // auto-play fires one random step this often
const FLASH_MS = 400;      // red flash when a transition can't fire
const SEQUENCE_SHOWN = 12; // the sequence readout shows the last 12 steps

const THEME_KEY = 'petri-sim-theme';

// ---------- Page elements (from index.html) ----------

function byId<T extends Element>(id: string): T {
  const found = document.querySelector<T>(`#${id}`);
  if (found === null) throw new Error(`index.html has no element with id "${id}"`);
  return found;
}

const svg = byId<SVGSVGElement>('net-svg');
const netSelect = byId<HTMLSelectElement>('net-select');
const prevNetBtn = byId<HTMLButtonElement>('prev-net');
const nextNetBtn = byId<HTMLButtonElement>('next-net');
const netEyebrow = byId<HTMLElement>('net-eyebrow');
const netTitle = byId<HTMLElement>('net-title');
const statStep = byId<HTMLElement>('stat-step');
const statTokens = byId<HTMLElement>('stat-tokens');
const statDelta = byId<HTMLElement>('stat-delta');
const statEnabled = byId<HTMLElement>('stat-enabled');
const stepBtn = byId<HTMLButtonElement>('step-btn');
const playBtn = byId<HTMLButtonElement>('play-btn');
const playLabel = byId<HTMLElement>('play-label');
const backBtn = byId<HTMLButtonElement>('back-btn');
const resetBtn = byId<HTMLButtonElement>('reset-btn');
const themeBtn = byId<HTMLButtonElement>('theme-toggle');
const checkBox = byId<HTMLElement>('check');
const readMarking = byId<HTMLElement>('r-marking');
const readEnabled = byId<HTMLElement>('r-enabled');
const readNext = byId<HTMLElement>('r-next');
const readSequence = byId<HTMLElement>('r-sequence');
const speedInputs = document.querySelectorAll<HTMLInputElement>('input[name="speed"]');

// ---------- State ----------

// What Back needs to undo one step (a firing or a place edit)
type UndoEntry = { marking: Marking; sequenceLength: number };

let netIndex = 0;
let net: Net = presets[0];
let marking: Marking = initialMarking(net);
let view: NetView;
let undoStack: UndoEntry[] = [];
let sequence: string[] = [];            // keys of the fired transitions, in order
let busy = false;                       // true while tokens are moving
let autoTimer: number | undefined;      // set while auto-play runs
let speed = 1;
let generation = 0;                     // +1 on every load, so a running animation knows it is outdated
let lastDelta: number | null = null;    // token change of the last firing (−2 on slide 40)
let shownMarking: Marking = {};         // marking shown in the readout last time, to highlight changes

// ---------- Small helpers ----------

// Create an HTML element with a class and text. Text is set with textContent,
// so names are always shown as plain text (never parsed as HTML).
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// Re-adding a class doesn't restart its CSS animation; remove it, let the browser
// measure the element, then add it again.
function restartAnimation(element: Element, className: string): void {
  element.classList.remove(className);
  element.getBoundingClientRect();
  element.classList.add(className);
}

function totalTokens(m: Marking): number {
  let sum = 0;
  for (const p in m) sum += m[p];
  return sum;
}

function plural(count: number, word: string): string {
  return count === 1 ? `${count} ${word}` : `${count} ${word}s`;
}

// ---------- Explanation panel ----------

function showMessage(text: string): void {
  checkBox.replaceChildren(el('p', 'check-message', text));
  restartAnimation(checkBox, 'fresh');
}

function ruleBlock(name: string, description: string, lines: RuleLine[]): HTMLElement {
  const block = el('div', 'rule-block');

  const head = el('p', 'rule-head');
  head.append(el('span', 'rule-name', name), ` ${description}`);

  const list = el('ul', 'rule-lines');
  for (const line of lines) {
    const item = el('li', line.ok ? 'ok' : 'bad');
    item.append(el('span', 'mark', line.ok ? '✓' : '✗'), el('span', 'line-text', line.text));
    list.append(item);
  }

  block.append(head, list);
  return block;
}

function showCheck(t: string, ex: Explanation): void {
  const title = el('p', 'check-title');
  title.append('Can ', el('strong', '', transitionName(net, t)), ' fire?');

  const verdict = ex.ok
    ? el('p', 'verdict ok', 'Enabled: it fires. Tokens leave the input places, then arrive in the output places.')
    : el('p', 'verdict bad', 'Not enabled: it cannot fire in this marking.');

  checkBox.replaceChildren(
    title,
    ruleBlock('Rule 1', 'every input place has at least the arrow weight in tokens', ex.rule1),
    ruleBlock('Rule 2', 'after firing, every output place stays within its capacity', ex.rule2),
    verdict,
  );
  restartAnimation(checkBox, 'fresh');
}

// ---------- Readout under the net ----------

function renderMarking(): void {
  readMarking.replaceChildren();
  const filled = Object.keys(net.places).filter((p) => marking[p] > 0);

  if (filled.length === 0) {
    readMarking.append(el('span', 'empty', 'all places empty'));
  }
  filled.forEach((p, i) => {
    if (i > 0) readMarking.append(el('span', 'sep', '·'));
    const chip = el('span', 'chip');
    chip.append(el('span', 'chip-name', placeName(net, p)), el('span', 'chip-value', String(marking[p])));
    if (marking[p] !== shownMarking[p]) chip.classList.add('changed');
    readMarking.append(chip);
  });

  shownMarking = { ...marking };
}

function renderEnabled(next: NextStep): void {
  readEnabled.replaceChildren();
  if (next.enabled.length === 0) {
    readEnabled.append(el('span', 'empty', 'none'));
    return;
  }
  // each enabled transition is a small button that fires it
  for (const t of next.enabled) {
    const button = el('button', 'chip chip-btn', transitionName(net, t));
    button.type = 'button';
    button.title = `Fire ${transitionName(net, t)}`;
    button.addEventListener('click', () => onTransitionClick(t));
    readEnabled.append(button);
  }
}

// "Camping vs Hotel (both need the token in Unterkunft)"
function conflictText(c: Conflict): string {
  const names = c.transitions.map((t) => transitionName(net, t));
  const who = names.length === 2 ? 'both' : 'all';
  const what = marking[c.place] === 1 ? 'the token' : 'the tokens';
  return `${names.join(' vs ')} (${who} need ${what} in ${placeName(net, c.place)})`;
}

function renderNextStep(next: NextStep): void {
  readNext.replaceChildren();
  const names = next.enabled.map((t) => transitionName(net, t));

  const main = el('p', 'next-main');
  if (next.kind === 'stuck') {
    main.append(el('span', 'tag stuck', 'stuck'), 'nothing can fire in this marking');
  } else if (next.kind === 'forced') {
    main.append(el('span', 'tag forced', 'forced'), `only ${names[0]} can fire`);
  } else {
    main.append(el('span', 'tag free', 'free choice'), `any of ${names.join(', ')}`);
  }
  readNext.append(main);

  if (next.kind !== 'free') return;

  for (const c of next.conflicts) {
    const line = el('p', 'next-conflict');
    line.append(el('span', 'tag konf', 'Konflikt'), conflictText(c));
    readNext.append(line);
  }

  if (next.conflicts.length === 0) {
    readNext.append(el('p', 'next-sub', 'They share no tokens, so they are nebenläufig: only the order differs.'));
  } else if (next.noConflict.length > 0) {
    const free = next.noConflict.map((t) => transitionName(net, t));
    const verb = free.length === 1 ? "doesn't" : "don't";
    readNext.append(el('p', 'next-sub', `${free.join(', ')} ${verb} compete for tokens with anything.`));
  }
}

function renderSequence(): void {
  readSequence.replaceChildren();
  if (sequence.length === 0) {
    readSequence.append(el('span', 'empty', 'nothing fired yet'));
    return;
  }

  let shown = sequence;
  if (sequence.length > SEQUENCE_SHOWN) {
    shown = sequence.slice(-SEQUENCE_SHOWN);
    readSequence.append(el('span', 'seq-more', '…'), el('span', 'arrow', '→'));
  }
  shown.forEach((t, i) => {
    if (i > 0) readSequence.append(el('span', 'arrow', '→'));
    const isLatest = i === shown.length - 1;
    readSequence.append(el('span', isLatest ? 'chip seq latest' : 'chip seq', transitionName(net, t)));
  });
}

function renderStats(next: NextStep): void {
  statStep.textContent = String(sequence.length);
  statTokens.textContent = String(totalTokens(marking));
  statEnabled.textContent = String(next.enabled.length);

  if (lastDelta === null) {
    statDelta.hidden = true;
    return;
  }
  statDelta.hidden = false;
  if (lastDelta > 0) {
    statDelta.textContent = `+${lastDelta}`;
    statDelta.className = 'delta up';
  } else if (lastDelta < 0) {
    statDelta.textContent = `−${-lastDelta}`;
    statDelta.className = 'delta down';
  } else {
    statDelta.textContent = '±0';
    statDelta.className = 'delta zero';
  }
}

// Recolour the bars and rebuild every readout for the current marking
function refresh(): NextStep {
  const next = classify(net, marking);
  for (const t in net.transitions) {
    setTransitionState(view, t, next.enabled.includes(t) ? 'on' : 'off');
  }
  renderMarking();
  renderEnabled(next);
  renderNextStep(next);
  renderSequence();
  renderStats(next);
  backBtn.disabled = undoStack.length === 0;
  return next;
}

// ---------- Firing ----------

// Red flash on a transition that can't fire, then back to its normal colour
function flashDisabled(t: string): void {
  setTransitionState(view, t, 'bad');
  const myGeneration = generation;
  window.setTimeout(() => {
    if (myGeneration !== generation) return;
    if (busy) setTransitionState(view, t, 'off');
    else refresh();
  }, FLASH_MS);
}

async function fireTransition(t: string): Promise<void> {
  if (busy) return;

  const ex = explain(net, marking, t);
  showCheck(t, ex);
  if (!ex.ok) {
    flashDisabled(t);
    return;
  }

  busy = true;
  document.body.classList.add('busy');
  const myGeneration = generation;
  const before = marking;
  const after = fire(net, before, t); // the engine decides the result; the animation only shows it
  undoStack.push({ marking: before, sequenceLength: sequence.length });

  // 1. Take the tokens out of the input places right away
  const shown: Marking = { ...before };
  for (const p in net.places) {
    const takes = W(net, p, t);
    if (takes > 0) {
      shown[p] -= takes;
      drawTokens(view, p, shown[p]);
    }
  }
  setTransitionState(view, t, 'fire');

  if (!prefersReducedMotion()) {
    // 2. One dot per token travels from each input place into t
    const incoming: Promise<void>[] = [];
    net.arcs.forEach((arc, i) => {
      if (arc.to !== t) return;
      setArcActive(view, i, true);
      for (let k = 0; k < arc.weight; k++) {
        incoming.push(moveDot(view.movingLayer, view.arcPoints[i], (k * STAGGER_MS) / speed, DOT_MS / speed));
      }
    });
    await Promise.all(incoming);
    if (myGeneration !== generation) return; // another net was loaded meanwhile

    // 3. Then one dot per token travels from t into each output place
    const outgoing: Promise<void>[] = [];
    net.arcs.forEach((arc, i) => {
      if (arc.to === t) setArcActive(view, i, false);
      if (arc.from !== t) return;
      setArcActive(view, i, true);
      for (let k = 0; k < arc.weight; k++) {
        const dot = moveDot(view.movingLayer, view.arcPoints[i], (k * STAGGER_MS) / speed, DOT_MS / speed);
        // the place gets +1 when its dot arrives
        const arrived = dot.then(() => {
          if (myGeneration !== generation) return;
          shown[arc.to] += 1;
          drawTokens(view, arc.to, shown[arc.to]);
          pulsePlace(view, arc.to);
        });
        outgoing.push(arrived);
      }
    });
    await Promise.all(outgoing);
    if (myGeneration !== generation) return;
  }

  // 4. Show the engine's result and add t to the sequence
  marking = after;
  for (const p in net.places) drawTokens(view, p, marking[p]);
  net.arcs.forEach((_arc, i) => setArcActive(view, i, false));
  sequence.push(t);
  lastDelta = totalTokens(after) - totalTokens(before);
  busy = false;
  document.body.classList.remove('busy');
  refresh();
}

function onTransitionClick(t: string): void {
  if (busy) return;
  stopAutoPlay();
  fireTransition(t);
}

// ---------- Buttons ----------

function randomStep(): void {
  if (busy) return;
  const enabled = enabledTransitions(net, marking);
  if (enabled.length === 0) {
    stopAutoPlay();
    showMessage('No transition is enabled, so the net has come to a stop in this marking. Press Reset to start over, or Back to undo.');
    return;
  }
  const pick = enabled[Math.floor(Math.random() * enabled.length)];
  fireTransition(pick);
}

function startAutoPlay(): void {
  if (autoTimer !== undefined) return;
  autoTimer = window.setInterval(randomStep, AUTO_MS / speed);
  playBtn.classList.add('playing');
  playBtn.setAttribute('aria-pressed', 'true');
  playLabel.textContent = 'Pause';
  randomStep();
}

function stopAutoPlay(): void {
  if (autoTimer === undefined) return;
  window.clearInterval(autoTimer);
  autoTimer = undefined;
  playBtn.classList.remove('playing');
  playBtn.setAttribute('aria-pressed', 'false');
  playLabel.textContent = 'Auto-play';
}

function toggleAutoPlay(): void {
  if (autoTimer === undefined) startAutoPlay();
  else stopAutoPlay();
}

// Restore the marking and sequence from before the last firing or place edit
function goBack(): void {
  stopAutoPlay();
  if (busy) return;
  const entry = undoStack.pop();
  if (entry === undefined) {
    showMessage('Nothing to undo yet.');
    return;
  }
  marking = { ...entry.marking };
  sequence = sequence.slice(0, entry.sequenceLength);
  lastDelta = null;
  for (const p in net.places) drawTokens(view, p, marking[p]);
  refresh();
  showMessage('Went back one step.');
}

// Editable nets: a click adds one token; past K (or 4 without K) it wraps to 0
function editPlace(p: string): void {
  if (busy) return;
  stopAutoPlay();
  undoStack.push({ marking: { ...marking }, sequenceLength: sequence.length });

  const max = net.places[p].capacity ?? 4;
  const count = marking[p] >= max ? 0 : marking[p] + 1;
  marking = { ...marking, [p]: count };
  lastDelta = null;

  drawTokens(view, p, count);
  if (!prefersReducedMotion()) pulsePlace(view, p);
  refresh();
  showMessage(`${placeName(net, p)} now has ${plural(count, 'token')}. Click a transition to see whether it can fire.`);
}

// ---------- Loading a net ----------

// Enter and Space work like a click on focused SVG groups
function onActivate(target: SVGElement, action: () => void): void {
  target.addEventListener('click', action);
  target.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  });
}

function loadNet(index: number): void {
  generation++;
  stopAutoPlay();
  busy = false;
  document.body.classList.remove('busy');

  netIndex = index;
  net = presets[index];
  marking = initialMarking(net);
  undoStack = [];
  sequence = [];
  lastDelta = null;
  shownMarking = { ...marking };

  view = renderNet(svg, net, marking);
  for (const t in view.transitionGroups) {
    onActivate(view.transitionGroups[t], () => onTransitionClick(t));
  }
  if (net.editable) {
    for (const p in view.placeGroups) {
      onActivate(view.placeGroups[p], () => editPlace(p));
    }
  }

  netSelect.value = String(index);
  netEyebrow.textContent = groupName(net);
  netTitle.textContent = net.title;
  document.title = `${net.title} · Petri-Sim`;
  window.history.replaceState(null, '', `#${index + 1}`);
  restartAnimation(svg, 'enter');

  showMessage(net.hint);
  refresh();
}

// "#3" in the address → net 3 (index 2). Anything else → null.
function indexFromHash(): number | null {
  const n = Number(window.location.hash.slice(1));
  if (Number.isInteger(n) && n >= 1 && n <= presets.length) return n - 1;
  return null;
}

function loadRelative(step: number): void {
  const count = presets.length;
  loadNet((netIndex + step + count) % count);
}

// ---------- Theme ----------

function currentTheme(): 'light' | 'dark' {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function toggleTheme(): void {
  const theme = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // storage blocked: the theme just isn't remembered
  }
}

// ---------- Wiring it all up ----------

// The dropdown lists the nets under their type (<optgroup>).
// An option's value is the net's position in `presets`.
for (const group of presetGroups) {
  const optgroup = el('optgroup');
  optgroup.label = group.name;
  for (const p of group.nets) {
    const option = el('option', undefined, p.title);
    option.value = String(presets.indexOf(p));
    optgroup.append(option);
  }
  netSelect.append(optgroup);
}

netSelect.addEventListener('change', () => loadNet(Number(netSelect.value)));
prevNetBtn.addEventListener('click', () => loadRelative(-1));
nextNetBtn.addEventListener('click', () => loadRelative(1));

stepBtn.addEventListener('click', () => {
  stopAutoPlay();
  randomStep();
});
playBtn.addEventListener('click', toggleAutoPlay);
backBtn.addEventListener('click', goBack);
resetBtn.addEventListener('click', () => loadNet(netIndex));
themeBtn.addEventListener('click', toggleTheme);

for (const input of speedInputs) {
  input.addEventListener('change', () => {
    speed = Number(input.value);
    // restart auto-play with the new interval
    if (autoTimer !== undefined) {
      window.clearInterval(autoTimer);
      autoTimer = window.setInterval(randomStep, AUTO_MS / speed);
    }
  });
}

// Keyboard shortcuts (not while typing in a form field, not with Cmd / Ctrl / Alt)
document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target as Element;
  if (target.closest('input, select, textarea')) return;

  switch (event.key.toLowerCase()) {
    case 'n':
      stopAutoPlay();
      randomStep();
      break;
    case 'p':
      toggleAutoPlay();
      break;
    case 'b':
      goBack();
      break;
    case 'r':
      loadNet(netIndex);
      break;
    case '[':
      loadRelative(-1);
      break;
    case ']':
      loadRelative(1);
      break;
    default:
      return; // not a shortcut: let the browser handle the key
  }
  event.preventDefault();
});

// Back / forward in the browser, or a link like "#5"
window.addEventListener('hashchange', () => {
  const index = indexFromHash();
  if (index !== null && index !== netIndex) loadNet(index);
});

loadNet(indexFromHash() ?? 0);
