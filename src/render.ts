// Builds the SVG drawing of a net. Only drawing, no game logic:
// main.ts decides what is enabled and calls the functions below to show it.

import { placeName, transitionName } from './net';
import type { Arc, LabelPos, Marking, Net } from './net';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const SVG_WIDTH = 680;
const DEFAULT_RADIUS = 20;
const BAR_LONG = 36;        // length of a transition bar
const BAR_SHORT = 9;        // thickness of a transition bar
const BAR_PORT = 12;        // arcs meet a bar at most this far from its centre
const OPPOSITE_SHIFT = 8;   // two arcs between the same pair (slide 42) are moved apart by this much
const WEIGHT_OFFSET = 13;   // distance of the weight number from its arc
const LABEL_GAP_X = 10;     // label distance from the shape, left / right
const LABEL_GAP_Y = 14;     // label distance (to the middle of the text), top / bottom
const TOKEN_RADIUS = 4;
const HIT_SIZE = 44;        // invisible click area around a transition bar

export type Point = { x: number; y: number };

// What arcs connect to: a circle (place) or a rectangle (transition bar)
type Shape =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'rect'; x: number; y: number; halfW: number; halfH: number };

// Colour of a transition bar: enabled, not enabled, firing, clicked while not enabled
export type TransitionState = 'on' | 'off' | 'fire' | 'bad';

// Handles to the parts of the drawing that main.ts and animate.ts change later
export type NetView = {
  net: Net;
  placeGroups: Record<string, SVGGElement>;      // clickable group of each place
  tokenGroups: Record<string, SVGGElement>;      // the dots (or number) inside each place
  transitionGroups: Record<string, SVGGElement>; // clickable group of each transition
  transitionBars: Record<string, SVGRectElement>;
  arcPaths: SVGPathElement[];                    // same order as net.arcs
  arcPoints: Point[][];                          // corner points of each arc, same order
  movingLayer: SVGGElement;                      // travelling dots and ripples go here (on top)
};

// Where the dots sit inside a place for 0 to 5 tokens (like a dice)
const TOKEN_LAYOUTS: [number, number][][] = [
  [],
  [[0, 0]],
  [[-6, 0], [6, 0]],
  [[-6, 4], [6, 4], [0, -6]],
  [[-6, -6], [6, -6], [-6, 6], [6, 6]],
  [[-7, -7], [7, -7], [0, 0], [-7, 7], [7, 7]],
];

// ---------- Small helpers ----------

// Create an SVG element, set its attributes and (optionally) add it to a parent
function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const name in attrs) el.setAttribute(name, String(attrs[name]));
  if (parent) parent.appendChild(el);
  return el;
}

// Text centred vertically on y. anchor says which end of the text sits at x.
function svgText(
  parent: Element,
  x: number,
  y: number,
  text: string,
  className: string,
  anchor: 'start' | 'middle' | 'end' = 'middle',
): SVGTextElement {
  const el = svgEl('text', { x, y, class: className, 'text-anchor': anchor, 'dominant-baseline': 'central' }, parent);
  el.textContent = text;
  return el;
}

// Hover tooltip with the full name (useful for the unlabelled places in the trip)
function addTooltip(parent: Element, text: string): void {
  const title = svgEl('title', {}, parent);
  title.textContent = text;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// ---------- Geometry ----------

function shapeOf(net: Net, key: string): Shape {
  const place = net.places[key];
  if (place !== undefined) {
    return { kind: 'circle', x: place.x, y: place.y, r: place.r ?? DEFAULT_RADIUS };
  }
  const tr = net.transitions[key];
  if (tr.horizontal) {
    return { kind: 'rect', x: tr.x, y: tr.y, halfW: BAR_LONG / 2, halfH: BAR_SHORT / 2 };
  }
  return { kind: 'rect', x: tr.x, y: tr.y, halfW: BAR_SHORT / 2, halfH: BAR_LONG / 2 };
}

function centre(shape: Shape): Point {
  return { x: shape.x, y: shape.y };
}

// The point inside a shape that an arc starts from or aims at.
// Circle: its centre. Bar: the point on its middle line closest to `other`
// (but at most BAR_PORT from the centre), so several arcs into one bar don't
// all end in the same spot (slide 40: e₁, e₂, e₃ → t).
function anchorPoint(shape: Shape, other: Point): Point {
  if (shape.kind === 'circle') return centre(shape);
  if (shape.halfW > shape.halfH) {
    // horizontal bar: slide along x
    return { x: clamp(other.x, shape.x - BAR_PORT, shape.x + BAR_PORT), y: shape.y };
  }
  // vertical bar: slide along y
  return { x: shape.x, y: clamp(other.y, shape.y - BAR_PORT, shape.y + BAR_PORT) };
}

// Walk from `from` (inside the shape) towards `toward`; return where we leave the shape
function exitPoint(shape: Shape, from: Point, toward: Point): Point {
  const len = distance(from, toward);
  if (len === 0) return from;
  const dx = (toward.x - from.x) / len;
  const dy = (toward.y - from.y) / len;

  let t: number; // how far we walk
  if (shape.kind === 'circle') {
    // solve |from + t·d − centre| = r for t (a quadratic equation)
    const fx = from.x - shape.x;
    const fy = from.y - shape.y;
    const b = fx * dx + fy * dy;
    const c = fx * fx + fy * fy - shape.r * shape.r;
    t = -b + Math.sqrt(Math.max(b * b - c, 0));
  } else {
    // distance to the left/right side and to the top/bottom side; we hit the nearer one first
    let tx = Infinity;
    if (dx > 0) tx = (shape.x + shape.halfW - from.x) / dx;
    if (dx < 0) tx = (shape.x - shape.halfW - from.x) / dx;
    let ty = Infinity;
    if (dy > 0) ty = (shape.y + shape.halfH - from.y) / dy;
    if (dy < 0) ty = (shape.y - shape.halfH - from.y) / dy;
    t = Math.min(tx, ty);
  }
  return { x: from.x + t * dx, y: from.y + t * dy };
}

// Unit vector at a right angle to the line a → b
function sideways(a: Point, b: Point): Point {
  const len = distance(a, b) || 1;
  return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
}

// Is there an arc going the other way between the same two nodes? (slide 42)
function hasOppositeArc(net: Net, arc: Arc): boolean {
  return net.arcs.some((other) => other.from === arc.to && other.to === arc.from && other.via === undefined);
}

// The corner points of an arc: start on the edge of the source shape,
// then the bend points, then the end on the edge of the target shape
function arcGeometry(net: Net, arc: Arc): Point[] {
  const from = shapeOf(net, arc.from);
  const to = shapeOf(net, arc.to);
  const via: Point[] = (arc.via ?? []).map(([x, y]) => ({ x, y }));

  if (via.length > 0) {
    const firstBend = via[0];
    const lastBend = via[via.length - 1];
    const start = exitPoint(from, anchorPoint(from, firstBend), firstBend);
    const end = exitPoint(to, anchorPoint(to, lastBend), lastBend);
    return [start, ...via, end];
  }

  let a = anchorPoint(from, centre(to));
  let b = anchorPoint(to, centre(from));

  // Slide 42: s → t and t → s are drawn as two parallel lines, 8 px either side
  if (hasOppositeArc(net, arc)) {
    const side = sideways(a, b);
    a = { x: a.x - side.x * OPPOSITE_SHIFT, y: a.y - side.y * OPPOSITE_SHIFT };
    b = { x: b.x - side.x * OPPOSITE_SHIFT, y: b.y - side.y * OPPOSITE_SHIFT };
  }

  return [exitPoint(from, a, b), exitPoint(to, b, a)];
}

function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) total += distance(points[i], points[i + 1]);
  return total;
}

// The point `fraction` of the way along the polyline (0 = start, 1 = end),
// and the direction of the line at that point (a unit vector)
export function pointAlong(points: Point[], fraction: number): { point: Point; dir: Point } {
  let remaining = polylineLength(points) * fraction;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = distance(a, b);
    const isLastSegment = i === points.length - 2;

    if (remaining <= len || isLastSegment) {
      if (len === 0) return { point: a, dir: { x: 1, y: 0 } };
      const k = Math.min(remaining / len, 1);
      return {
        point: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k },
        dir: { x: (b.x - a.x) / len, y: (b.y - a.y) / len },
      };
    }
    remaining -= len;
  }
  return { point: points[0], dir: { x: 1, y: 0 } };
}

// "M x y L x y L x y" for an SVG path
function pathData(points: Point[]): string {
  const parts = points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  return 'M' + parts.join(' L');
}

// ---------- Drawing ----------

function addArrowMarker(defs: Element, id: string, className: string): void {
  const marker = svgEl('marker', {
    id,
    viewBox: '0 0 10 10',
    refX: 8,                // the tip of the arrow sits exactly at the end of the line
    refY: 5,
    markerWidth: 11,
    markerHeight: 11,
    markerUnits: 'userSpaceOnUse',
    orient: 'auto-start-reverse',
  }, defs);
  svgEl('path', { class: className, d: 'M2 1L8 5L2 9' }, marker);
}

function drawLabel(parent: Element, x: number, y: number, halfW: number, halfH: number, text: string, pos: LabelPos): void {
  switch (pos) {
    case 'top':
      svgText(parent, x, y - halfH - LABEL_GAP_Y, text, 'pn-label');
      break;
    case 'bottom':
      svgText(parent, x, y + halfH + LABEL_GAP_Y, text, 'pn-label');
      break;
    case 'left':
      svgText(parent, x - halfW - LABEL_GAP_X, y, text, 'pn-label', 'end');
      break;
    case 'right':
      svgText(parent, x + halfW + LABEL_GAP_X, y, text, 'pn-label', 'start');
      break;
  }
}

function drawArc(view: NetView, layer: Element, arc: Arc): void {
  const points = arcGeometry(view.net, arc);
  const path = svgEl('path', { class: 'pn-arc', d: pathData(points), 'marker-end': 'url(#pn-arrow)' }, layer);
  view.arcPaths.push(path);
  view.arcPoints.push(points);

  if (arc.weight > 1) {
    // the number sits at the middle of the arc, moved sideways (at a right angle to the arc)
    const { point, dir } = pointAlong(points, 0.5);
    const x = point.x - dir.y * WEIGHT_OFFSET;
    const y = point.y + dir.x * WEIGHT_OFFSET;
    svgText(layer, x, y, String(arc.weight), 'pn-weight');
  }
}

function drawPlace(view: NetView, layer: Element, p: string, count: number): void {
  const net = view.net;
  const place = net.places[p];
  const r = place.r ?? DEFAULT_RADIUS;
  const name = placeName(net, p);

  const group = svgEl('g', { class: 'pn-node' }, layer);
  if (net.editable) {
    group.classList.add('pn-click');
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', `Add a token to ${name}`);
  }
  addTooltip(group, name);

  svgEl('circle', { class: 'pn-place', cx: place.x, cy: place.y, r }, group);
  view.tokenGroups[p] = svgEl('g', { class: 'pn-tokens' }, group);

  if (place.capacity !== undefined) {
    svgText(group, place.x + r + 4, place.y - r, `K = ${place.capacity}`, 'pn-cap', 'start');
  }
  if (place.label !== undefined) {
    drawLabel(group, place.x, place.y, r, r, place.label, place.labelPos ?? 'top');
  }

  view.placeGroups[p] = group;
  drawTokens(view, p, count);
}

function drawTransition(view: NetView, layer: Element, t: string): void {
  const tr = view.net.transitions[t];
  const halfW = tr.horizontal ? BAR_LONG / 2 : BAR_SHORT / 2;
  const halfH = tr.horizontal ? BAR_SHORT / 2 : BAR_LONG / 2;
  const name = transitionName(view.net, t);

  const group = svgEl('g', { class: 'pn-node pn-click', tabindex: 0, role: 'button', 'aria-label': `Fire ${name}` }, layer);
  addTooltip(group, name);

  // invisible bigger square, so the thin bar is easy to hit (and shows the focus ring)
  svgEl('rect', {
    class: 'pn-hit',
    x: tr.x - HIT_SIZE / 2,
    y: tr.y - HIT_SIZE / 2,
    width: HIT_SIZE,
    height: HIT_SIZE,
    rx: 8,
  }, group);

  const bar = svgEl('rect', {
    class: 'pn-tr off',
    x: tr.x - halfW,
    y: tr.y - halfH,
    width: halfW * 2,
    height: halfH * 2,
    rx: 1.5,
  }, group);

  if (tr.label !== undefined) {
    drawLabel(group, tr.x, tr.y, halfW, halfH, tr.label, tr.labelPos ?? 'top');
  }

  view.transitionGroups[t] = group;
  view.transitionBars[t] = bar;
}

// Draw the whole net into the <svg>, replacing whatever was there
export function renderNet(svg: SVGSVGElement, net: Net, marking: Marking): NetView {
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${net.height}`);
  svg.setAttribute('aria-label', `Petri net: ${net.title}`);

  // two arrowheads: normal, and accent-coloured for arcs that are in use
  const defs = svgEl('defs', {}, svg);
  addArrowMarker(defs, 'pn-arrow', 'pn-head');
  addArrowMarker(defs, 'pn-arrow-active', 'pn-head active');

  // layers, from bottom to top
  const arcLayer = svgEl('g', { class: 'pn-arcs' }, svg);
  const nodeLayer = svgEl('g', { class: 'pn-nodes' }, svg);
  const movingLayer = svgEl('g', { class: 'pn-moving' }, svg);

  const view: NetView = {
    net,
    placeGroups: {},
    tokenGroups: {},
    transitionGroups: {},
    transitionBars: {},
    arcPaths: [],
    arcPoints: [],
    movingLayer,
  };

  for (const arc of net.arcs) drawArc(view, arcLayer, arc);
  for (const p in net.places) drawPlace(view, nodeLayer, p, marking[p]);
  for (const t in net.transitions) drawTransition(view, nodeLayer, t);

  return view;
}

// ---------- Updates after the first drawing ----------

// Redraw the tokens of one place: dots for 1–5, otherwise (or with showNumbers) the number
export function drawTokens(view: NetView, p: string, count: number): void {
  const group = view.tokenGroups[p];
  const place = view.net.places[p];
  group.replaceChildren();

  if (view.net.showNumbers || count > 5) {
    svgText(group, place.x, place.y, String(count), 'pn-count');
    return;
  }
  for (const [dx, dy] of TOKEN_LAYOUTS[count]) {
    svgEl('circle', { class: 'pn-token', cx: place.x + dx, cy: place.y + dy, r: TOKEN_RADIUS }, group);
  }
}

export function setTransitionState(view: NetView, t: string, state: TransitionState): void {
  const bar = view.transitionBars[t];
  if (state === 'bad') {
    // Setting the same class again doesn't restart a CSS animation.
    // Removing it and letting the browser measure the element in between does.
    bar.setAttribute('class', 'pn-tr');
    bar.getBoundingClientRect();
  }
  bar.setAttribute('class', `pn-tr ${state}`);
}

// Highlight an arc (accent colour) while tokens travel along it
export function setArcActive(view: NetView, index: number, active: boolean): void {
  const path = view.arcPaths[index];
  path.setAttribute('class', active ? 'pn-arc active' : 'pn-arc');
  path.setAttribute('marker-end', active ? 'url(#pn-arrow-active)' : 'url(#pn-arrow)');
}

// A ring that grows out of a place and fades, when a token arrives
export function pulsePlace(view: NetView, p: string): void {
  const place = view.net.places[p];
  const ring = svgEl('circle', {
    class: 'pn-ripple',
    cx: place.x,
    cy: place.y,
    r: place.r ?? DEFAULT_RADIUS,
  }, view.movingLayer);
  ring.addEventListener('animationend', () => ring.remove());
  window.setTimeout(() => ring.remove(), 1000); // in case the animation never runs
}
