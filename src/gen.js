/* Builds the animated SVG assets for the GitHub profile README.
   Text is converted to outlines (the site's fonts), so it renders the same
   everywhere; animations are SMIL, which GitHub plays inside <img>.
   Run from this folder: npm install && npm run build  (writes ../assets) */
const fs = require('fs');
const path = require('path');
const ot = require('opentype.js');

const OUT = path.join(__dirname, '..', 'assets');
fs.mkdirSync(OUT, { recursive: true });
const font = n => ot.loadSync(path.join(__dirname, 'fonts', n + '.woff'));
const F = { sg: font('sg700'), pj: font('pj400'), pjb: font('pj600'), mono: font('jb400'), monoM: font('jb500') };

/* ── Text → path ───────────────────────────────────────────────── */
function layout(f, str, size, tracking = 0) {
  const glyphs = f.stringToGlyphs(str);
  const scale = size / f.unitsPerEm;
  let x = 0;
  const placed = [];
  glyphs.forEach((g, i) => {
    placed.push({ g, x });
    x += g.advanceWidth * scale + tracking;
    if (i < glyphs.length - 1) x += f.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  return { placed, width: x - (glyphs.length ? tracking : 0), scale };
}
/* Each glyph (per font and size) is defined once in <defs> and placed with
   <use>, which keeps text-heavy SVGs small. Arrows the mono subset lacks are
   drawn by hand. svgDoc() collects the definitions used by each document. */
let glyphDefs = new Map();
const fontId = new Map(Object.entries(F).map(([k, v]) => [v, k]));
function glyphUse(f, g, size, x, y) {
  const id = `${fontId.get(f)}${String(size).replace('.', '_')}-${g.index}`;
  if (!glyphDefs.has(id)) glyphDefs.set(id, `<path id="${id}" d="${g.getPath(0, 0, size).toPathData(1)}"/>`);
  return `<use href="#${id}" x="${x.toFixed(1)}" y="${y.toFixed(1)}"/>`;
}
function drawnArrow(ch, x, y, size, w) {
  const s = size, mid = y - s * 0.32;
  if (ch === '→') return `<path d="M${(x + w * 0.12).toFixed(1)} ${mid.toFixed(1)}H${(x + w * 0.86).toFixed(1)}M${(x + w * 0.58).toFixed(1)} ${(mid - s * 0.2).toFixed(1)}L${(x + w * 0.86).toFixed(1)} ${mid.toFixed(1)}L${(x + w * 0.58).toFixed(1)} ${(mid + s * 0.2).toFixed(1)}" fill="none" stroke="currentColor" stroke-width="${(s * 0.08).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  /* ↗ */ return `<path d="M${(x + w * 0.2).toFixed(1)} ${(y - s * 0.08).toFixed(1)}L${(x + w * 0.8).toFixed(1)} ${(y - s * 0.68).toFixed(1)}M${(x + w * 0.36).toFixed(1)} ${(y - s * 0.68).toFixed(1)}H${(x + w * 0.8).toFixed(1)}V${(y - s * 0.24).toFixed(1)}" fill="none" stroke="currentColor" stroke-width="${(s * 0.08).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function text(f, str, x, y, size, { fill = '#fafafa', anchor = 'start', tracking = 0 } = {}) {
  const l = layout(f, str, size, tracking);
  const x0 = anchor === 'middle' ? x - l.width / 2 : anchor === 'end' ? x - l.width : x;
  const chars = [...str];
  const parts = l.placed.map((p, i) => {
    const ch = chars[i];
    if (ch === ' ') return '';
    if (ch === '→' || ch === '↗') return drawnArrow(ch, x0 + p.x, y, size, p.g.advanceWidth * l.scale || size * 0.6);
    return glyphUse(f, p.g, size, x0 + p.x, y);
  }).join('');
  return { svg: `<g fill="${fill}" color="${fill}">${parts}</g>`, width: l.width, x0 };
}
const measure = (f, str, size, tracking = 0) => layout(f, str, size, tracking).width;
function wrap(f, str, size, maxWidth) {
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (measure(f, next, size) > maxWidth && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function svgDoc(w, h, body, title) {
  const defs = [...glyphDefs.values(), ...iconDefs.values()].join('');
  glyphDefs = new Map(); iconDefs = new Map();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><defs>${defs}</defs>${body}</svg>\n`;
}
let iconDefs = new Map();

/* ── Torus knot (same geometry as the site's hero knot) ──────────── */
function buildTube(p, q, NC, NT, sc, tr) {
  const cv = [];
  for (let i = 0; i <= NC; i++) {
    const t = (i / NC) * Math.PI * 2, r = (Math.cos(q * t) + 2) * sc;
    cv.push([r * Math.cos(p * t), r * Math.sin(p * t), -Math.sin(q * t) * sc]);
  }
  const rings = [];
  for (let i = 0; i <= NC; i++) {
    const nxt = cv[(i + 1) % (NC + 1)], prv = cv[i > 0 ? i - 1 : NC];
    let tx = nxt[0] - prv[0], ty = nxt[1] - prv[1], tz = nxt[2] - prv[2];
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    let bx = -tz, bz = tx; const bl = Math.hypot(bx, bz);
    if (bl < 0.001) { bx = 1; bz = 0; } else { bx /= bl; bz /= bl; }
    const nx = -bz * ty, ny = bz * tx - bx * tz, nz = bx * ty;
    const ring = [];
    for (let j = 0; j < NT; j++) {
      const a = (j / NT) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      ring.push([cv[i][0] + tr * (ca * nx + sa * bx), cv[i][1] + tr * ca * ny, cv[i][2] + tr * (ca * nz + sa * bz)]);
    }
    rings.push(ring);
  }
  return { rings, NC, NT };
}
function projector(rx, ry, cx, cy, fov) {
  const cyr = Math.cos(ry), syr = Math.sin(ry), cxr = Math.cos(rx), sxr = Math.sin(rx);
  return (x, y, z) => {
    const x1 = x * cyr - z * syr, z1 = x * syr + z * cyr;
    const y2 = y * cxr - z1 * sxr, z2 = y * sxr + z1 * cxr;
    const s = fov / (fov + z2);
    return [cx + x1 * s, cy + y2 * s, s];
  };
}
function knotPaths({ rings, NC, NT }, proj, rStep, cStep) {
  const P = rings.map(r => r.map(([x, y, z]) => proj(x, y, z)));
  const f = n => n.toFixed(1);
  let d = '';
  for (let j = 0; j < NT; j += rStep) d += 'M' + P.map(ring => f(ring[j][0]) + ' ' + f(ring[j][1])).join('L');
  for (let i = 0; i <= NC; i += cStep) d += 'M' + P[i].map(([x, y]) => f(x) + ' ' + f(y)).join('L') + 'Z';
  return d;
}
function knot(cx, cy, scale) {
  const k1 = buildTube(2, 3, 150, 12, 88 * scale, 23 * scale);
  const k2 = buildTube(3, 5, 100, 8, 58 * scale, 15 * scale);
  const fov = 420 * scale;
  const t = 3, rx = t * 0.13, ry = t * 0.2;
  const main = knotPaths(k1, projector(rx, ry, cx, cy, fov), 2, 8);
  const accent = knotPaths(k2, projector(-rx * 0.8 + 0.4, ry * 0.9 + 1.1, cx, cy, fov), 2, 6);
  const pp = projector(rx * 0.22, ry * 0.22, cx, cy, fov);
  let dots = '';
  for (let i = 0; i < 160; i++) {
    const phi = Math.acos(1 - 2 * (i + 0.5) / 160), th = Math.PI * (1 + Math.sqrt(5)) * i, r = (115 + (i % 5) * 9) * scale;
    const [x, y, s] = pp(r * Math.sin(phi) * Math.cos(th), r * Math.sin(phi) * Math.sin(th), r * Math.cos(phi));
    const z = Math.max(0.8, s * 1.6);
    dots += `M${x.toFixed(1)} ${y.toFixed(1)}h${z.toFixed(1)}v${z.toFixed(1)}h-${z.toFixed(1)}z`;
  }
  return `<g fill="none" stroke-linejoin="round">` +
    `<path d="${main}" stroke="#d4d4d8" stroke-opacity="0.42" stroke-width="0.9"/>` +
    `<path d="${accent}" stroke="#71717a" stroke-opacity="0.5" stroke-width="0.8"/>` +
    `<path d="${dots}" fill="#fafafa" fill-opacity="0.35" stroke="none"/></g>`;
}

/* ── 1. Header ──────────────────────────────────────────────────── */
function header() {
  const W = 1200, H = 300;
  const label = text(F.mono, 'FULLSTACK & AI ENGINEER', 64, 92, 13, { fill: '#a1a1aa', tracking: 2.8 });
  const name = layout(F.sg, 'Alan Teixidó', 76);
  const nameD = name.placed.map(p => p.g.getPath(60 + p.x, 170, 76).toPathData(2)).join('');
  const sub = text(F.pj, 'AI agents, the APIs behind them and the apps on top — Barcelona', 64, 230, 20, { fill: '#a1a1aa' });
  const dom = text(F.monoM, 'alanteixido', W - 64 - measure(F.mono, '.dev', 14), H - 34, 14, { fill: '#d4d4d8', anchor: 'end' });
  const tld = text(F.mono, '.dev', W - 64, H - 34, 14, { fill: '#71717a', anchor: 'end' });
  const kx = 990, ky = 140;
  return svgDoc(W, H, `
<defs>
  <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><rect x="12" y="12" width="1.4" height="1.4" fill="#ffffff" fill-opacity="0.09"/></pattern>
  <linearGradient id="fadeDots" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.35" stop-color="#fff"/><stop offset="0.75" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="dotsMask"><rect width="${W}" height="${H}" fill="url(#fadeDots)"/></mask>
  <linearGradient id="metal" gradientUnits="userSpaceOnUse" x1="60" y1="0" x2="${60 + name.width}" y2="0">
    <stop offset="0" stop-color="#d4d4d8"/><stop offset="0.3" stop-color="#fafafa"/><stop offset="0.55" stop-color="#a1a1aa"/><stop offset="0.75" stop-color="#ffffff"/><stop offset="1" stop-color="#b4b4bc"/>
  </linearGradient>
  <linearGradient id="glint" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="160" y2="0">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    <animateTransform attributeName="gradientTransform" type="translate" values="-200 0;${name.width + 260} 0;${name.width + 260} 0" keyTimes="0;0.28;1" dur="7s" begin="1s" repeatCount="indefinite"/>
  </linearGradient>
  <linearGradient id="rule" x1="0" x2="1"><stop offset="0" stop-color="#fafafa"/><stop offset="0.6" stop-color="#71717a"/><stop offset="1" stop-color="#71717a" stop-opacity="0"/></linearGradient>
  <linearGradient id="horizon" gradientUnits="userSpaceOnUse" x1="700" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.45" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0.55"/></linearGradient>
  <filter id="glow" x="-10%" y="-400%" width="120%" height="900%"><feGaussianBlur stdDeviation="4"/></filter>
  <clipPath id="frame"><rect width="${W}" height="${H}" rx="16"/></clipPath>
</defs>
<g clip-path="url(#frame)">
  <rect width="${W}" height="${H}" fill="#09090b"/>
  <rect width="${W}" height="${H}" fill="url(#dots)" mask="url(#dotsMask)"/>
  <g>${knot(kx, ky, 0.26)}<animateTransform attributeName="transform" type="rotate" from="0 ${kx} ${ky}" to="360 ${kx} ${ky}" dur="90s" repeatCount="indefinite"/></g>
  <g>
    <line x1="700" y1="205" x2="${W}" y2="205" stroke="url(#horizon)" stroke-width="6" filter="url(#glow)" opacity="0.5" stroke-dasharray="500" stroke-dashoffset="500"><animate attributeName="stroke-dashoffset" from="500" to="0" dur="1.6s" begin="0.4s" fill="freeze"/></line>
    <line x1="700" y1="205" x2="${W}" y2="205" stroke="url(#horizon)" stroke-width="1.2" stroke-dasharray="500" stroke-dashoffset="500"><animate attributeName="stroke-dashoffset" from="500" to="0" dur="1.6s" begin="0.4s" fill="freeze"/></line>
  </g>
  ${label.svg}
  <rect x="${64 + label.width + 14}" y="87" width="34" height="1" fill="#71717a"/>
  <path d="${nameD}" fill="url(#metal)"/>
  <path d="${nameD}" fill="url(#glint)"/>
  <rect x="64" y="190" width="240" height="2" rx="1" fill="url(#rule)" transform="scale(0 1)">
    <animateTransform attributeName="transform" type="scale" from="0 1" to="1 1" dur="0.9s" begin="0.2s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>
  </rect>
  ${sub.svg}
  ${dom.svg}${tld.svg}
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="16" fill="none" stroke="#27272a"/>
</g>`, 'Alan Teixidó — Fullstack & AI Engineer');
}

/* ── 2. Terminal (types itself, then answers like Ask my CV) ─────── */
function terminal() {
  const W = 880, size = 15, lh = 27, cw = measure(F.mono, '0', size);
  const left = 28, top = 76;
  const lines = [
    { kind: 'cmd', prompt: '$', text: 'alan --status', at: 0.5 },
    { kind: 'out', parts: [['→ ', '#71717a'], ['Building AI agents @ Plain Concepts', '#d4d4d8']], at: 1.5 },
    { kind: 'out', parts: [['→ ', '#71717a'], ['Stack: .NET · Python · React · React Native', '#d4d4d8']], at: 1.65 },
    { kind: 'out', parts: [['→ ', '#71717a'], ['Based in Barcelona, Spain', '#d4d4d8']], at: 1.8 },
    { kind: 'cmd', prompt: '$', text: 'ask "what has Alan built with RAG?"', at: 2.6 },
    { kind: 'stream', parts: [['→ ', '#71717a'], ['AI agents on Vertex AI that answer from company documents,', '#e4e4e7']], at: 5.0 },
    { kind: 'stream', parts: [['  ', '#71717a'], ['plus the ingestion pipeline and the FastAPI backend behind them.', '#e4e4e7']], at: 6.0 },
    { kind: 'caret', at: 7.2 },
  ];
  const H = top + lines.length * lh + 30;
  const TYPE = 0.055;
  let defs = '', body = '';
  lines.forEach((l, i) => {
    const y = top + i * lh;
    if (l.kind === 'cmd') {
      const p = text(F.mono, l.prompt + ' ', left, y, size, { fill: '#a1a1aa' });
      const c = text(F.monoM, l.text, left + 2 * cw, y, size, { fill: '#fafafa' });
      const n = l.text.length;
      const values = Array.from({ length: n + 1 }, (_, k) => (2 * cw + k * cw).toFixed(1)).join(';');
      defs += `<clipPath id="type${i}"><rect x="${left}" y="${y - lh + 6}" width="0" height="${lh}"><animate attributeName="width" values="${values}" calcMode="discrete" dur="${(n * TYPE).toFixed(2)}s" begin="${l.at}s" fill="freeze"/></rect></clipPath>`;
      body += `<g clip-path="url(#type${i})">${p.svg}${c.svg}</g>`;
      // caret that rides along while typing
      body += `<rect x="${left + 2 * cw}" y="${y - size + 2}" width="${(cw * 0.55).toFixed(1)}" height="${size + 2}" fill="#d4d4d8" opacity="0"><set attributeName="opacity" to="1" begin="${l.at}s"/><animate attributeName="x" values="${Array.from({ length: n + 1 }, (_, k) => (left + 2 * cw + k * cw).toFixed(1)).join(';')}" calcMode="discrete" dur="${(n * TYPE).toFixed(2)}s" begin="${l.at}s" fill="freeze"/><set attributeName="opacity" to="0" begin="${(l.at + n * TYPE + 0.15).toFixed(2)}s"/></rect>`;
    } else if (l.kind === 'out' || l.kind === 'stream') {
      let x = left, segs = '';
      for (const [s, col] of l.parts) { const t = text(F.mono, s, x, y, size, { fill: col }); segs += t.svg; x += s.length * cw; }
      const total = l.parts.reduce((a, [s]) => a + s.length, 0) * cw;
      if (l.kind === 'out') {
        body += `<g opacity="0">${segs}<set attributeName="opacity" to="1" begin="${l.at}s" fill="freeze"/></g>`;
      } else {
        defs += `<clipPath id="stream${i}"><rect x="${left}" y="${y - lh + 6}" width="0" height="${lh}"><animate attributeName="width" from="0" to="${total.toFixed(1)}" dur="0.9s" begin="${l.at}s" fill="freeze"/></rect></clipPath>`;
        body += `<g clip-path="url(#stream${i})">${segs}</g>`;
      }
    } else if (l.kind === 'caret') {
      const p = text(F.mono, '$', left, y, size, { fill: '#a1a1aa' });
      body += `<g opacity="0">${p.svg}<rect x="${left + 2 * cw}" y="${y - size + 2}" width="${(cw * 0.55).toFixed(1)}" height="${size + 2}" fill="#d4d4d8"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.5;0.5;1" dur="1.1s" repeatCount="indefinite"/></rect><set attributeName="opacity" to="1" begin="${l.at}s" fill="freeze"/></g>`;
    }
  });
  // "thinking..." between the question and the streamed answer
  const think = text(F.mono, '→ thinking...', left, top + 5 * lh, size, { fill: '#71717a' });
  body += `<g opacity="0">${think.svg}<set attributeName="opacity" to="1" begin="4.75s"/><set attributeName="opacity" to="0" begin="5.0s"/></g>`;
  const title = text(F.mono, 'alan@barcelona: ~', 92, 31, 12, { fill: '#71717a' });
  const badgeText = 'try it on alanteixido.dev';
  const bw = measure(F.mono, badgeText, 11.5) + 22;
  const badge = text(F.mono, badgeText, W - 20 - bw / 2, 30.5, 11.5, { fill: '#a1a1aa', anchor: 'middle' });
  return svgDoc(W, H, `
<defs>${defs}<clipPath id="win"><rect width="${W}" height="${H}" rx="14"/></clipPath></defs>
<g clip-path="url(#win)">
  <rect width="${W}" height="${H}" fill="#0f0f12"/>
  <rect width="${W}" height="48" fill="#141418"/>
  <rect y="47.5" width="${W}" height="1" fill="#27272a"/>
  <circle cx="26" cy="24" r="6" fill="#71717a"/><circle cx="46" cy="24" r="6" fill="#52525b"/><circle cx="66" cy="24" r="6" fill="#3f3f46"/>
  ${title.svg}
  <rect x="${W - 20 - bw}" y="13" width="${bw.toFixed(1)}" height="23" rx="11.5" fill="none" stroke="#3f3f46"/>${badge.svg}
  ${body}
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="#27272a"/>
</g>`, 'Terminal: alan --status, then ask "what has Alan built with RAG?" and the AI answers');
}

/* ── 3. Project cards ───────────────────────────────────────────── */
function card({ tag, title, desc, tech }) {
  const W = 436, H = 228, pad = 24;
  const tagW = measure(F.mono, tag, 10.5, 1.2) + 20;
  const tagT = text(F.mono, tag, pad + 10, pad + 15.5, 10.5, { fill: '#a1a1aa', tracking: 1.2 });
  const arrow = text(F.mono, '↗', W - pad, pad + 18, 18, { fill: '#71717a', anchor: 'end' });
  const tl = layout(F.sg, title, 25);
  const titleD = tl.placed.map(p => p.g.getPath(pad + p.x, 86, 25).toPathData(2)).join('');
  const lines = wrap(F.pj, desc, 14, W - 2 * pad).slice(0, 3);
  const descSvg = lines.map((ln, i) => text(F.pj, ln, pad, 116 + i * 21, 14, { fill: '#a1a1aa' }).svg).join('');
  let x = pad, chips = '';
  for (const t of tech) {
    const w = measure(F.mono, t, 11) + 16;
    chips += `<rect x="${x}" y="${H - pad - 22}" width="${w.toFixed(1)}" height="22" rx="6" fill="#18181b" stroke="#27272a"/>` + text(F.mono, t, x + 8, H - pad - 7, 11, { fill: '#d4d4d8' }).svg;
    x += w + 8;
  }
  return svgDoc(W, H, `
<defs><linearGradient id="t" gradientUnits="userSpaceOnUse" x1="${pad}" x2="${pad + tl.width}"><stop offset="0" stop-color="#fafafa"/><stop offset="0.6" stop-color="#d4d4d8"/><stop offset="1" stop-color="#a1a1aa"/></linearGradient>
<radialGradient id="g" cx="0.85" cy="0" r="0.9"><stop offset="0" stop-color="#ffffff" stop-opacity="0.07"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="#0f0f12" stroke="#27272a"/>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="url(#g)"/>
<rect x="${pad}" y="${pad}" width="${tagW.toFixed(1)}" height="22" rx="11" fill="none" stroke="#3f3f46"/>${tagT.svg}${arrow.svg}
<path d="${titleD}" fill="url(#t)"/>${descSvg}${chips}`, `${title}: ${desc}`);
}

/* ── 4. Stack with logos ────────────────────────────────────────── */
const DEVICON = 'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0';   // pinned, so icons do not change between runs
const attr = (tag, n) => (tag.match(new RegExp(`\\s${n}="([^"]*)"`)) || [])[1];
const cp = new Map(), colour = new Map(), glyph = new Map();
async function loadDevicon() {
  const get = async p => {
    const res = await fetch(`${DEVICON}/${p}`);
    if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
    return res.text();
  };
  const [css, dfont] = await Promise.all([get('devicon.min.css'), get('fonts/devicon.svg')]);
  for (const [, sels, c] of css.matchAll(/([^{}]+)\{\s*content:\s*"(\\[0-9a-f]+|[^"])"\s*;?\s*\}/gi)) {
    const v = c.startsWith('\\') ? parseInt(c.slice(1), 16) : c.codePointAt(0);
    for (const [, k] of sels.matchAll(/\.(devicon-[\w-]+):before/g)) cp.set(k, v);
  }
  for (const [, sels, v] of css.matchAll(/([^{}]+)\{\s*color:\s*(#[0-9a-f]{3,8})\s*;?\s*\}/gi)) for (const [, k] of sels.matchAll(/\.(devicon-[\w-]+)\.colored/g)) colour.set(k, v);
  for (const [tag] of dfont.matchAll(/<glyph[^>]*>/g)) {
    const u = attr(tag, 'unicode'); if (!u) continue;
    const v = u.startsWith('&#x') ? parseInt(u.slice(3), 16) : u.codePointAt(0);
    glyph.set(v, attr(tag, 'd'));
  }
}
function devicon(cls, x, y, s) {                     // 1024-unit glyphs, y-up from baseline at 960
  const k = s / 1024;
  const id = 'i-' + cls.replace('devicon-', '');
  if (!iconDefs.has(id)) {
    const d = glyph.get(cp.get(cls)).replace(/-?\d*\.\d+/g, n => ' ' + Math.round(+n));   // 1024 units: integers are plenty (space keeps numbers apart)
    iconDefs.set(id, `<path id="${id}" transform="translate(0 ${(960 * k).toFixed(2)}) scale(${k.toFixed(5)} ${(-k).toFixed(5)})" d="${d}"/>`);
  }
  return `<use href="#${id}" x="${x}" y="${y}" fill="${colour.get(cls) || '#fafafa'}"/>`;
}
const STACK = [
  ['AI & agents', [['Google ADK', 'devicon-googlecloud-plain'], ['Vertex AI', 'devicon-googlecloud-plain'], ['RAG'], ['Azure Bot Service', 'devicon-azure-plain'], ['Claude API'], ['Gemini API']]],
  ['Backend', [['.NET', 'devicon-dotnetcore-plain'], ['C#', 'devicon-csharp-plain'], ['Python', 'devicon-python-plain'], ['FastAPI', 'devicon-fastapi-plain'], ['PostgreSQL', 'devicon-postgresql-plain']]],
  ['Frontend', [['React', 'devicon-react-original'], ['Next.js', 'devicon-nextjs-plain'], ['TypeScript', 'devicon-typescript-plain'], ['Vue', 'devicon-vuejs-plain'], ['Tailwind', 'devicon-tailwindcss-plain']]],
  ['Mobile', [['React Native', 'devicon-react-original'], ['Expo'], ['Kotlin', 'devicon-kotlin-plain'], ['Firebase', 'devicon-firebase-plain']]],
  ['Cloud & DevOps', [['Azure', 'devicon-azure-plain'], ['Azure DevOps', 'devicon-azuredevops-plain'], ['Google Cloud', 'devicon-googlecloud-plain'], ['Docker', 'devicon-docker-plain'], ['Git', 'devicon-git-plain']]],
];
function stack() {
  const W = 880, rowH = 44, labelW = 150, top = 26, padX = 28;
  let body = '';
  STACK.forEach(([label, items], r) => {
    const y = top + r * rowH;
    body += text(F.mono, label.toUpperCase(), padX, y + 20, 11, { fill: '#71717a', tracking: 1.4 }).svg;
    let x = padX + labelW;
    for (const [name, icon] of items) {
      const tw = measure(F.pjb, name, 13);
      const w = tw + (icon ? 42 : 24);
      body += `<rect x="${x}" y="${y + 2}" width="${w.toFixed(1)}" height="30" rx="8" fill="#111114" stroke="#27272a"/>`;
      if (icon) body += devicon(icon, x + 11, y + 9, 16);
      body += text(F.pjb, name, x + (icon ? 33 : 12), y + 22, 13, { fill: '#e4e4e7' }).svg;
      x += w + 8;
    }
  });
  const H = top + STACK.length * rowH + 18;
  const panel = `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="#0f0f12" stroke="#27272a"/>`;
  return svgDoc(W, H, panel + body, 'Stack: ' + STACK.map(([l, i]) => `${l}: ${i.map(x => x[0]).join(', ')}`).join('; '));
}

/* ── 5. Buttons ─────────────────────────────────────────────────── */
function button(label, primary) {
  const tw = measure(F.pjb, label, 14);
  const W = Math.ceil(tw + 44), H = 40;
  return svgDoc(W, H, `
<defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#e4e4e7"/><stop offset="1" stop-color="#b4b4bc"/></linearGradient></defs>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${(H - 1) / 2}" fill="${primary ? 'url(#m)' : '#0f0f12'}" stroke="${primary ? '#d4d4d8' : '#3f3f46'}"/>
${text(F.pjb, label, W / 2, 25.5, 14, { fill: primary ? '#09090b' : '#e4e4e7', anchor: 'middle' }).svg}`, label);
}

/* ── Write ───────────────────────────────────────────────────────── */
async function main() {
  await loadDevicon();
  const files = {
    'header.svg': header(),
    'terminal.svg': terminal(),
    'card-ask.svg': card({ tag: 'LIVE · AI', title: 'Ask my CV', desc: 'AI assistant in my website’s terminal that answers only from my CV. Python service behind nginx calling the Gemini API, streamed answers, guardrails and a zero budget.', tech: ['Python', 'nginx', 'Gemini API', 'systemd'] }),
    'card-genai.svg': card({ tag: 'CASE STUDY', title: 'GenAI Data Platform', desc: 'Natural-language analytics: an LLM turns business questions into governed SQL and publishes the results as Metabase dashboards.', tech: ['Python', 'PostgreSQL', 'Text-to-SQL', 'Metabase'] }),
    'card-fit.svg': card({ tag: 'LIVE · AI', title: 'Fit', desc: 'Personal training app with an AI coach built on the Claude API with tool use over my own data, plus Strava and Health Connect.', tech: ['Next.js', 'Supabase', 'Claude API'] }),
    'card-protactics.svg': card({ tag: 'FULLSTACK', title: 'ProTactics', desc: 'Football club management platform: training planner, player tracking and an interactive drag-and-drop tactics board.', tech: ['Vue 3', 'Node.js', 'PostgreSQL', 'JWT'] }),
    'stack.svg': stack(),
    'btn-website.svg': button('alanteixido.dev', true),
    'btn-linkedin.svg': button('LinkedIn', false),
    'btn-email.svg': button('Email', false),
  };
  for (const [name, svg] of Object.entries(files)) {
    fs.writeFileSync(path.join(OUT, name), svg);
    console.log(name.padEnd(20), (svg.length / 1024).toFixed(1) + ' KB');
  }
}
main().catch(err => { console.error(err.message); process.exit(1); });
