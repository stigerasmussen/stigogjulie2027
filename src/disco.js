// Disco mirror-mosaic objects. Each <canvas data-disco="name"> gets its own small renderer.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const V = THREE.Vector3;
const COL = {
  red: 0xff392b,
  plum: 0x4e1a45,
  cheese: 0xffd23f,
  bread: 0xd8973a,
  gold: 0xf2b630,
  silver: 0xeef0f6,
  mustard: 0xffd23a,
  pink: 0xff8fb4,
  crust: 0xd98a26,
};
const GROUT = { red: 0x6a120c, gold: 0x8a6418, silver: 0x6a6272, mustard: 0x8a6a10, pink: 0x7a3048, crust: 0x7a4810, plum: 0x1c0518, cheese: 0x9a7a10, bread: 0x6a4210 };

// ---------- parametric surfaces: f(u,v) -> {p, c} where c is a point "inside" for normal orientation
function lathe(prof) { // prof(v) -> [r, y]
  return (u, v) => {
    const [r, y] = prof(v); const a = u * Math.PI * 2;
    return { p: new V(r * Math.cos(a), y, r * Math.sin(a)), c: new V(0, y, 0) };
  };
}
function polyProfile(pts) { // linear by arc length through [r,y] points
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const T = L[L.length - 1];
  return v => {
    const d = v * T; let i = 1;
    while (i < L.length - 1 && L[i] < d) i++;
    const t = (d - L[i - 1]) / (L[i] - L[i - 1] || 1);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
  };
}
const ellipsoid = (rx, ry) => lathe(v => { const a = Math.PI * v; return [rx * Math.sin(a), -ry * Math.cos(a)]; });
function capsule(r, len) { // along y, total length len
  const h = len / 2 - r; const capL = Math.PI * r / 2, tot = 2 * capL + 2 * h;
  return lathe(v => {
    const d = v * tot;
    if (d < capL) { const a = d / r; return [r * Math.sin(a), -h - r * Math.cos(a)]; }
    if (d < capL + 2 * h) return [r, -h + (d - capL)];
    const a = (d - capL - 2 * h) / r; return [r * Math.cos(a), h + r * Math.sin(a)];
  });
}
function tube(curve, ra, rb = ra, ref = new V(0, 0, 1)) { // curve(v)->V ; elliptical cross-section
  return (u, v) => {
    const e = 1e-3, c = curve(v), t = curve(Math.min(1, v + e)).sub(curve(Math.max(0, v - e))).normalize();
    let n = new V().crossVectors(ref, t); if (n.lengthSq() < 1e-6) n = new V(1, 0, 0).cross(t);
    n.normalize(); const b = new V().crossVectors(t, n);
    const a = u * Math.PI * 2;
    const r = typeof ra === 'function' ? ra(v) : ra, rr = typeof rb === 'function' ? rb(v) : rb;
    return { p: c.clone().addScaledVector(n, Math.cos(a) * r).addScaledVector(b, Math.sin(a) * rr), c };
  };
}
function smoothOutline(raw, sig) { // raw: closed list of [x,y], uniformly sampled
  const N = raw.length, R = Math.ceil(sig * 3), wts = []; let ws = 0;
  for (let k = -R; k <= R; k++) { const w = Math.exp(-(k * k) / (2 * sig * sig)); wts.push(w); ws += w; }
  return raw.map((_, i) => { let x = 0, y = 0; for (let k = -R; k <= R; k++) { const q = raw[((i + k) % N + N) % N], w = wts[k + R]; x += q[0] * w; y += q[1] * w; } return [x / ws, y / ws]; });
}
function resample(poly, N) { // closed polyline -> N points evenly spaced by arc length
  const L = [0]; for (let i = 1; i <= poly.length; i++) { const a = poly[i - 1], b = poly[i % poly.length]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const T = L[poly.length], out = []; let j = 1;
  for (let i = 0; i < N; i++) { const d = i / N * T; while (L[j] < d) j++; const a = poly[j - 1], b = poly[j % poly.length], t = (d - L[j - 1]) / (L[j] - L[j - 1] || 1); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  return out;
}
function puffy(pts, c, depth, kPow, zPow) {
  const N = pts.length;
  const H = u => { const f = u * N, i = Math.floor(f) % N, j = (i + 1) % N, a = f - Math.floor(f); return new V(pts[i][0] + (pts[j][0] - pts[i][0]) * a, pts[i][1] + (pts[j][1] - pts[i][1]) * a, 0); };
  return (u, v) => {
    const phi = Math.PI * (v - 0.5), k = Math.pow(Math.cos(phi), kPow);
    const p = c.clone().add(H(u).sub(c).multiplyScalar(k)); p.z = depth * Math.sign(phi) * Math.pow(Math.abs(Math.sin(phi)), zPow);
    return { p, c: new V(c.x, c.y, 0) };
  };
}
function heart(depth = 0.6) {
  const N = 720, raw = [];
  for (let i = 0; i < N; i++) { const t = i / N * Math.PI * 2; raw.push([(16 * Math.sin(t) ** 3) / 17, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]); }
  return puffy(smoothOutline(raw, 34), new V(0, 0.1, 0), depth, 0.42, 0.9);
}
function slab(pts, c, D, bulge) { // flat faces with a rounded edge band
  const N = pts.length, a = 0.36;
  const H = u => { const f = u * N, i = Math.floor(f) % N, j = (i + 1) % N, t = f - Math.floor(f); return new V(pts[i][0] + (pts[j][0] - pts[i][0]) * t, pts[i][1] + (pts[j][1] - pts[i][1]) * t, 0); };
  return (u, v) => {
    let r, z;
    if (v < a) { r = v / a; z = -D; }
    else if (v > 1 - a) { r = (1 - v) / a; z = D; }
    else { const th = Math.PI * ((v - a) / (1 - 2 * a) - 0.5); r = 1 + bulge * Math.cos(th); z = D * Math.sin(th); }
    const p = c.clone().add(H(u).sub(c).multiplyScalar(r)); p.z = z;
    return { p, c: new V(c.x, c.y, 0) };
  };
}
const TOAST_HALF = [[0, -0.95], [0.8, -0.95], [0.8, 0.28], [0.98, 0.42], [1.04, 0.68], [0.9, 0.92], [0.6, 1.04], [0.25, 1.06]];
const mirror = half => half.concat(half.slice(1).reverse().map(([x, y]) => [-x, y]));
function offsetXY(S, dx, dy, rot, dz) {
  const cs = Math.cos(rot), sn = Math.sin(rot);
  return (u, v) => {
    const { p, c } = S(u, v);
    p.set(p.x * cs - p.y * sn + dx, p.x * sn + p.y * cs + dy, p.z + dz);
    c.set(c.x * cs - c.y * sn + dx, c.x * sn + c.y * cs + dy, dz);
    return { p, c };
  };
}
function toast(D = 0.12) {
  return slab(smoothOutline(resample(mirror(TOAST_HALF), 720), 14), new V(0, 0.05, 0), D, 0.1);
}
function butter() {
  // melted butter squeezed out between the slices, dripping over the bottom and right edge
  const poly = [[0, 1.1], [0.62, 1.08], [0.94, 0.95], [1.08, 0.68], [1.02, 0.42], [0.86, 0.28],
    [0.86, 0.05], [0.98, -0.02], [1.02, -0.28], [0.94, -0.36], [0.86, -0.3], [0.86, -0.92],
    [0.66, -0.98], [0.6, -1.14], [0.5, -1.2], [0.42, -1.12], [0.38, -0.99],
    [0.02, -0.99], [-0.04, -1.3], [-0.16, -1.38], [-0.26, -1.28], [-0.3, -0.99],
    [-0.52, -0.99], [-0.58, -1.06], [-0.68, -1.08], [-0.74, -0.99], [-0.86, -0.94],
    [-0.86, 0.28], [-1.02, 0.42], [-1.08, 0.68], [-0.94, 0.95], [-0.62, 1.08]];
  return slab(smoothOutline(resample(poly, 900), 8), new V(0, 0.05, 0), 0.055, 0.25);
}
function balloon(pts, c, R, dome) {
  // inflate a flat silhouette like a balloon: thin parts become round tubes, wide parts a soft pillow
  const N = pts.length; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
  const h = 0.012, gw = Math.ceil((x1 - x0) / h) + 3, gh = Math.ceil((y1 - y0) / h) + 3, ox = x0 - h, oy = y0 - h;
  const grid = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const px = ox + i * h, py = oy + j * h; let best = 1e9, inside = false;
    for (let k = 0, m = N - 1; k < N; m = k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[m];
      const dx = px - ax, dy = py - ay; const d2 = dx * dx + dy * dy; if (d2 < best) best = d2;
      if ((ay > py) !== (by > py) && px < (bx - ax) * (py - ay) / (by - ay) + ax) inside = !inside;
    }
    grid[j * gw + i] = inside ? Math.sqrt(best) : 0;
  }
  const dist = (x, y) => {
    const fx = Math.min(gw - 1.001, Math.max(0, (x - ox) / h)), fy = Math.min(gh - 1.001, Math.max(0, (y - oy) / h));
    const i = Math.floor(fx), j = Math.floor(fy), a = fx - i, b = fy - j, g = (ii, jj) => grid[jj * gw + ii];
    return (g(i, j) * (1 - a) + g(i + 1, j) * a) * (1 - b) + (g(i, j + 1) * (1 - a) + g(i + 1, j + 1) * a) * b;
  };
  const H = u => { const f = u * N, i = Math.floor(f) % N, j = (i + 1) % N, t = f - Math.floor(f); return [pts[i][0] + (pts[j][0] - pts[i][0]) * t, pts[i][1] + (pts[j][1] - pts[i][1]) * t]; };
  return (u, v) => {
    const side = v < 0.5 ? -1 : 1, r = v < 0.5 ? 2 * v : 2 - 2 * v;
    const [hx, hy] = H(u), x = c.x + (hx - c.x) * r, y = c.y + (hy - c.y) * r, d = dist(x, y);
    const z = d < R ? Math.sqrt(Math.max(0, d * (2 * R - d))) : R + dome * Math.pow(d - R, 0.8);
    return { p: new V(x, y, side * z), c: new V(c.x, c.y, 0) };
  };
}
function handSign() {
  // a pointing hand cut like a mirror sign: index finger along +x, thumb resting on top
  const poly = [[-1.12, 0.02], [-1.05, -0.3], [-0.6, -0.44], [-0.24, -0.58], [0.06, -0.56], [0.2, -0.44],
    [0.16, -0.34], [0.3, -0.32], [0.38, -0.2], [0.32, -0.1], [0.42, -0.04], [0.5, 0.02],
    [1.28, 0.04], [1.4, 0.1], [1.42, 0.2], [1.36, 0.28], [1.26, 0.3], [0.56, 0.3],
    [0.62, 0.38], [0.62, 0.5], [0.52, 0.58], [0.2, 0.6], [-0.18, 0.52], [-0.55, 0.46], [-1.05, 0.34]];
  return slab(smoothOutline(resample(poly, 1000), 7), new V(-0.2, 0.0, 0), 0.13, 0.12);
}

function cheese() {
  // a slice melting down the toast: rounded top, three drips of different lengths
  const poly = [[-0.6, 0.72], [0.56, 0.74], [0.6, 0.0], [0.5, -0.18],
    [0.48, -0.46], [0.38, -0.6], [0.26, -0.5], [0.22, -0.22],
    [0.14, -0.28], [0.12, -0.9], [0.0, -1.06], [-0.14, -0.92], [-0.18, -0.32],
    [-0.28, -0.26], [-0.32, -0.66], [-0.44, -0.78], [-0.56, -0.66], [-0.58, -0.2], [-0.62, -0.05]];
  const pts = smoothOutline(resample(poly, 900), 9);
  const base = slab(pts, new V(0, 0.25, 0), 0.03, 0.2), rot = -0.12, cs = Math.cos(rot), sn = Math.sin(rot);
  return (u, v) => {
    const { p, c } = base(u, v);
    const x = p.x * cs - p.y * sn, y = p.x * sn + p.y * cs;
    let z = p.z + 0.215;
    if (y < -0.9) z -= Math.pow(-0.9 - y, 1.3) * 1.1; // the long drip bends over the crust
    p.set(x, y, z); c.set(c.x * cs - c.y * sn, c.x * sn + c.y * cs, 0.215);
    return { p, c };
  };
}

// ---------- tiling a surface with little mirror squares
function tileSurface(S, o) {
  const t = o.tile, out = [];
  const M = 24, N = 400;
  // rows along v by mean arc length
  const cum = [0];
  for (let j = 1; j <= N; j++) {
    let s = 0;
    for (let i = 0; i < M; i++) { const u = (i + 0.5) / M; s += S(u, j / N).p.distanceTo(S(u, (j - 1) / N).p); }
    cum.push(cum[j - 1] + s / M);
  }
  const Lv = cum[N], rows = Math.max(1, Math.round(Lv / t));
  const vAt = d => { let j = 1; while (j < N && cum[j] < d) j++; return (j - 1 + (d - cum[j - 1]) / (cum[j] - cum[j - 1] || 1)) / N; };
  const rowV = []; for (let k = 0; k < rows; k++) rowV.push(vAt((k + 0.5) * Lv / rows));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V(), basis = new THREE.Matrix4();
  for (let k = 0; k < rows; k++) {
    const v = rowV[k];
    const dv = (k === 0 ? rowV[1 % rows] - 0 : k === rows - 1 ? 1 - rowV[k - 1] : rowV[k + 1] - rowV[k - 1]) / 2 || 1 / rows;
    const K = 160, cu = [0];
    let prev = S(0, v).p;
    for (let i = 1; i <= K; i++) { const p = S(i / K, v).p; cu.push(cu[i - 1] + p.distanceTo(prev)); prev = p; }
    const C = cu[K]; if (C < t * 0.25) continue;
    const n = Math.max(1, Math.round(C / t)), phase = o.rand();
    for (let i = 0; i < n; i++) {
      const d = ((i + phase) / n) * C; let j = 1; while (j < K && cu[j] < d) j++;
      const u = (j - 1 + (d - cu[j - 1]) / (cu[j] - cu[j - 1] || 1)) / K;
      const { p, c } = S(u, v);
      const e = 1e-3;
      const Su = S((u + e) % 1, v).p.sub(S((u - e + 1) % 1, v).p);
      const Sv = S(u, Math.min(1, v + e)).p.sub(S(u, Math.max(0, v - e)).p);
      const hgt = Sv.length() / (Math.min(1, v + e) - Math.max(0, v - e)) * dv;
      let N3 = new V().crossVectors(Sv, Su);
      if (N3.lengthSq() < 1e-12) continue;
      N3.normalize(); if (N3.dot(p.clone().sub(c)) < 0) N3.negate();
      const X = Su.normalize(), Y = new V().crossVectors(N3, X).normalize(); X.crossVectors(Y, N3);
      basis.makeBasis(X, Y, N3);
      // jitter for sparkle
      const jit = o.jitter ?? 0.09, j1 = (o.rand() - 0.5) * jit, j2 = (o.rand() - 0.5) * jit;
      q.setFromRotationMatrix(basis).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(j1, j2, 0)));
      const w = Math.min(C / n, t * 1.6) * 0.9, h = Math.min(hgt, t * 1.6) * 0.9;
      if (w < t * 0.12 || h < t * 0.12) continue;
      sc.set(w, h, t * 0.1);
      m.compose(p.clone().addScaledVector(N3, t * 0.04), q, sc);
      if (o.xf) m.premultiply(o.xf);
      const col = typeof o.color === 'function' ? o.color(p, u, v) : o.color;
      out.push({ m: m.clone(), col });
    }
  }
  return out;
}
function groutGeo(S, xf, segU = 64, segV = 48) {
  const pos = [], idx = [];
  for (let j = 0; j <= segV; j++) for (let i = 0; i <= segU; i++) { const p = S(i / segU % 1, j / segV).p; pos.push(p.x, p.y, p.z); }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
    const a = j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  // weld the seam (u=0 and u=1 are the same points) and any collapsed rows (poles), so the surface shades smoothly
  const n = g.attributes.normal, P = g.attributes.position, W = segU + 1, v3 = new THREE.Vector3(), q = new THREE.Vector3();
  for (let j = 0; j <= segV; j++) {
    const a = j * W, b = a + segU;
    v3.fromBufferAttribute(n, a).add(q.fromBufferAttribute(n, b)).normalize();
    n.setXYZ(a, v3.x, v3.y, v3.z); n.setXYZ(b, v3.x, v3.y, v3.z);
    const p0 = q.fromBufferAttribute(P, a).clone(), p1 = new THREE.Vector3().fromBufferAttribute(P, a + (segU >> 1));
    if (p0.distanceToSquared(p1) < 1e-8) { // whole row is one point
      const sum = new THREE.Vector3();
      const nb = j === 0 ? W : -W; // use the neighbouring row to estimate an outward normal
      for (let i = 0; i < segU; i++) sum.add(v3.fromBufferAttribute(n, a + nb + i));
      sum.normalize(); for (let i = 0; i <= segU; i++) n.setXYZ(a + i, sum.x, sum.y, sum.z);
    }
  }
  n.needsUpdate = true;
  if (xf) g.applyMatrix4(xf); return g;
}

// ---------- shapes
const T = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) =>
  new THREE.Matrix4().compose(new V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V(s, s, s));
const SHAPES = {
  heart: (ds) => [{ S: heart(0.5), color: ds.color || 'red' }],
  kettlebell: () => {
    const R = 0.86, yb = -0.7, rb = Math.sqrt(R * R - yb * yb), a0 = Math.asin(yb / R);
    const body = lathe(v => {
      const flat = rb / (rb + R * (Math.PI / 2 - a0)); // share of profile on bottom disk
      if (v < flat) return [rb * (v / flat), yb];
      const a = a0 + (v - flat) / (1 - flat) * (Math.PI / 2 - a0); return [R * Math.cos(a), R * Math.sin(a)];
    });
    const arch = v => { const a = Math.PI * (0.02 + 0.96 * v); return new V(0.56 * Math.cos(a), 0.45 + 0.95 * Math.pow(Math.sin(a), 0.7), 0); };
    return [{ S: body, color: 'silver' }, { S: tube(arch, 0.15), color: 'silver' }];
  },
  sun: () => {
    const parts = [{ S: ellipsoid(0.6, 0.6), color: 'gold' }];
    const rp = [[0.17, 0.42]], tipR = 0.065, tipY = 1.02;
    for (let i = 0; i <= 10; i++) { const a = Math.atan2(0.17 - tipR, tipY - 0.42) * (1 - i / 10) + (Math.PI / 2) * (i / 10); rp.push([tipR * Math.cos(a), tipY + tipR * Math.sin(a)]); }
    const ray = lathe(polyProfile(rp));
    for (let k = 0; k < 10; k++) {
      parts.push({ S: ray, color: 'gold', xf: new THREE.Matrix4().makeRotationZ(k * Math.PI / 5).multiply(new THREE.Matrix4().makeScale(1, k % 2 ? 0.9 : 1.05, 0.8)) });
    }
    return parts;
  },
  toast: () => {
    const edge = z0 => p => (Math.abs(p.z - z0) < 0.105 ? 'crust' : 'bread');
    return [
      { S: offsetXY(toast(), 0, 0, 0, -0.19), color: edge(-0.19) },
      { S: offsetXY(butter(), 0, 0, 0.02, 0), color: 'cheese', tileScale: 0.72 },
      { S: offsetXY(toast(), 0.04, -0.03, 0.07, 0.19), color: edge(0.19) },
    ];
  },
  frame: (ds) => {
    // silver mirror-tile picture frame: a flat-faced moulding with a slim bead along the inner edge
    const A = +ds.aspect || 1, t = +ds.thick || 0.09;
    const loop = (w, h, rc) => {
      const hw = w / 2, hh = h / 2, raw = [];
      [[hw - rc, hh - rc, 0], [-hw + rc, hh - rc, 1], [-hw + rc, -hh + rc, 2], [hw - rc, -hh + rc, 3]].forEach(([cx, cy, q]) => {
        for (let i = 0; i <= 16; i++) { const a = (q + i / 16) * Math.PI / 2; raw.push([cx + rc * Math.cos(a), cy + rc * Math.sin(a)]); }
      });
      const pts = resample(raw, 1600);
      return v => { const f = (v % 1) * pts.length, i = Math.floor(f) % pts.length, j = (i + 1) % pts.length, k = f - Math.floor(f);
        return new V(pts[i][0] + (pts[j][0] - pts[i][0]) * k, pts[i][1] + (pts[j][1] - pts[i][1]) * k, 0); };
    };
    const mw = t * 0.78; // main moulding width
    return [
      { S: tube(loop(A - mw, 1 - mw, t * 0.5), mw / 2, t * 0.2), color: 'silver', tileScale: 0.26, jitter: 0.02 },
      { S: tube(loop(A - 2 * mw + 0.006, 1 - 2 * mw + 0.006, t * 0.2), t * 0.085, t * 0.085), color: 'silver', tileScale: 0.15, jitter: 0.015 },
    ];
  },
  phone: () => {
    // a phone: silver body with rounded corners, a plum screen and a little camera pill
    const rrect = (w, h, r) => { const hw = w / 2, hh = h / 2, raw = [];
      [[hw - r, hh - r, 0], [-hw + r, hh - r, 1], [-hw + r, -hh + r, 2], [hw - r, -hh + r, 3]].forEach(([cx, cy, q]) => {
        for (let i = 0; i <= 16; i++) { const a = (q + i / 16) * Math.PI / 2; raw.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } });
      return resample(raw, 900); };
    const D = 0.07;
    return [
      { S: slab(rrect(0.92, 1.86, 0.17), new V(0, 0, 0), D, 0.12), color: 'silver', tileScale: 0.8 },
      { S: offsetXY(slab(rrect(0.8, 1.72, 0.12), new V(0, 0, 0), 0.008, 0), 0, 0, 0, D + 0.012), color: 'plum', tileScale: 0.8, jitter: 0.04 },
      { S: offsetXY(slab(rrect(0.24, 0.07, 0.035), new V(0, 0, 0), 0.006, 0), 0, 0.76, 0, D + 0.03), color: 'silver', tileScale: 0.35 },
    ];
  },
  cake: () => {
    // three tiers with soft rounded edges, a frosting rim on each tier and a cherry on top
    const tier = (r, h, y0) => {
      const e = 0.06, pts = [[0, y0]];
      for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (Math.PI / 2) * i / 6; pts.push([r - e + e * Math.cos(a), y0 + e + e * Math.sin(a)]); }
      for (let i = 0; i <= 6; i++) { const a = (Math.PI / 2) * i / 6; pts.push([r - e + e * Math.cos(a), y0 + h - e + e * Math.sin(a)]); }
      pts.push([0, y0 + h]);
      return lathe(polyProfile(pts));
    };
    const rim = (r, y) => tube(v => new V(r * Math.cos(v * Math.PI * 2), y, r * Math.sin(v * Math.PI * 2)), 0.05, 0.05, new V(0, 1, 0));
    return [
      { S: tier(0.95, 0.62, -1.0), color: 'silver' },
      { S: rim(0.93, -0.38), color: 'red', tileScale: 0.7 },
      { S: tier(0.7, 0.52, -0.38), color: 'pink' },
      { S: rim(0.68, 0.14), color: 'silver', tileScale: 0.7 },
      { S: tier(0.46, 0.44, 0.14), color: 'silver' },
      { S: rim(0.44, 0.58), color: 'red', tileScale: 0.7 },
      { S: ellipsoid(0.15, 0.15), color: 'red', xf: T(0, 0.74, 0), tileScale: 0.7 },
    ];
  },
  hand: () => {
    // pointing hand built from separate soft pieces, so fingers and thumb read clearly
    const rr = (x0, y0, x1, y1, sig = 10) => { // rounded capsule outline
      const r = (y1 - y0) / 2, cy = (y0 + y1) / 2, pts = [];
      for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + Math.PI * i / 16; pts.push([x1 - r + r * Math.cos(a), cy + r * Math.sin(a)]); }
      for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 + Math.PI * i / 16; pts.push([x0 + r + r * Math.cos(a), cy + r * Math.sin(a)]); }
      return smoothOutline(resample(pts, 500), sig);
    };
    const palm = [[-1.0, -0.24], [-0.4, -0.38], [0.2, -0.46], [0.42, -0.36], [0.48, -0.1], [0.52, 0.07],
      [1.32, 0.09], [1.44, 0.17], [1.42, 0.29], [1.3, 0.33], [0.5, 0.33], [0.1, 0.44], [-0.45, 0.44], [-1.0, 0.3], [-1.07, 0.03]];
    const part = (S, dz = 0, ts = 0.78) => ({ S: offsetXY(S, 0, 0, 0, dz), color: 'silver', tileScale: ts });
    return [
      part(balloon(smoothOutline(resample(palm, 900), 6), new V(-0.25, 0.04, 0), 0.13, 0.16), 0, 0.8),
      part(balloon(rr(0.02, -0.08, 0.58, 0.12), new V(0.3, 0.02, 0), 0.1, 0.05), 0.09),
      part(balloon(rr(0.0, -0.28, 0.55, -0.08), new V(0.27, -0.18, 0), 0.1, 0.05), 0.09),
      part(balloon(rr(-0.04, -0.46, 0.46, -0.27), new V(0.21, -0.36, 0), 0.095, 0.05), 0.08),
      { S: offsetXY(balloon(rr(-0.3, 0.32, 0.72, 0.53), new V(0.21, 0.42, 0), 0.105, 0.05), 0, 0, -0.08, 0.11), color: 'silver', tileScale: 0.78 },
    ];
  },
  handOld: () => {
    // soft pointing hand, all silver: pillowy palm, tapered fingers with round tips
    const round = (R0, R1, e0, e1) => v => {
      let k = 1;
      if (v < e0) { const t = 1 - v / e0; k = Math.sqrt(Math.max(0, 1 - t * t)); }
      if (v > 1 - e1) { const t = (v - (1 - e1)) / e1; k = Math.sqrt(Math.max(0, 1 - t * t)); }
      return Math.max(0.004, (R0 + (R1 - R0) * v) * k);
    };
    const line = (a, b) => v => new V(...a).lerp(new V(...b), v);
    const curl = (x, y, z, r) => v => { const a = Math.PI / 2 - v * Math.PI * 1.25; return new V(x + r * Math.cos(a), y - r + r * Math.sin(a), z); };
    const palm = [[-0.55, -0.42], [0.36, -0.46], [0.48, -0.3], [0.48, 0.3], [0.34, 0.42], [-0.5, 0.38], [-0.6, 0.0]];
    const parts = [
      { S: puffy(smoothOutline(resample(palm, 600), 22), new V(-0.05, 0, 0), 0.27, 0.45, 0.9), color: 'silver' },
      { S: tube(line([0.2, 0.2, 0.04], [1.38, 0.24, 0.04]), round(0.13, 0.112, 0.02, 0.1)), color: 'silver', tileScale: 0.8 },
      { S: tube(line([-0.12, 0.3, 0.17], [0.6, 0.4, 0.19]), round(0.135, 0.115, 0.02, 0.17)), color: 'silver', tileScale: 0.8 },
      { S: tube(line([-0.46, 0.0, 0], [-1.0, -0.02, 0]), round(0.29, 0.27, 0.0, 0.22)), color: 'silver' },
    ];
    [[0.3, 0.04, 0.05, 0.13, 0.122], [0.28, -0.18, 0.04, 0.125, 0.117], [0.24, -0.38, 0.03, 0.11, 0.105]].forEach(([x, y, z, r, R]) =>
      parts.push({ S: tube(curl(x, y, z, r), round(R, R * 0.95, 0.0, 0.0)), color: 'silver', tileScale: 0.8 }));
    return parts;
  },
  note: () => {
    // a single eighth note: tilted oval head, slender stem, flowing tapered flag
    const sx = 0.33, top = 1.55;
    const flag = v => { // cubic bezier from the stem top, out and down
      const P = [[sx, top], [sx + 0.04, top - 0.38], [sx + 0.62, top - 0.42], [sx + 0.5, top - 1.02]];
      const a = 1 - v, b = [a * a * a, 3 * a * a * v, 3 * a * v * v, v * v * v];
      return new V(b.reduce((s, w, i) => s + w * P[i][0], 0), b.reduce((s, w, i) => s + w * P[i][1], 0), 0);
    };
    return [
      { S: ellipsoid(0.42, 0.3), color: 'silver', xf: T(0, -0.05, 0, 0, 0, 0.4).multiply(new THREE.Matrix4().makeScale(1, 1, 0.72)) },
      { S: tube(v => new V(sx, 0.0 + (top - 0.03) * v, 0), 0.068), color: 'silver', tileScale: 0.75 },
      { S: tube(flag, v => 0.088 * Math.pow(1 - v, 0.55) + 0.01, v => (0.088 * Math.pow(1 - v, 0.55) + 0.01) * 0.8), color: 'silver', tileScale: 0.7 },
    ];
  },
};

// ---------- environment (pink room with bright panels) for reflections
function makeChromeEnv(renderer) {
  const scene = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 128, 64), cols = [], p = g.attributes.position, c = new THREE.Color();
  const stops = [[-1, '#0c0c0c'], [-0.5, '#2a2a28'], [-0.12, '#9a9a94'], [-0.02, '#e8e8e4'], [0, '#050505'], [0.05, '#0a0a0a'], [0.09, '#ffffff'], [0.4, '#a9b0b6'], [0.75, '#e9ecef'], [1, '#ffffff']];
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 10; let k = 0; while (k < stops.length - 2 && y > stops[k + 1][0]) k++;
    const [y0, a] = stops[k], [y1, b] = stops[k + 1], t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    c.set(a).lerp(new THREE.Color(b), t); cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, col, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(s), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); scene.add(m); };
  panel(6, 2.2, -2, 6, 5, '#ffffff', 6);
  panel(1.6, 7, 7.5, 1, 2, '#ffffff', 5);
  panel(1.2, 7, -7.5, 0.5, 1.5, '#ffffff', 3.5);
  panel(5, 3.2, 6, 4.5, -5, '#000000', 1);
  panel(4, 3, -6, 5, -4, '#1a1a1a', 1);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(scene, 0.006).texture; pm.dispose();
  return tex;
}
function makeEnv(renderer) {
  const scene = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 32, 16), cols = [];
  const top = new THREE.Color(0xfff2f6), mid = new THREE.Color(0xf0c4d2), bot = new THREE.Color(0x24081c);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 10, c = y > 0 ? mid.clone().lerp(top, y) : mid.clone().lerp(bot, -y);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, c, s) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(s), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); scene.add(m);
  };
  panel(5, 3, 0, 6, 5, 0xffffff, 4);
  panel(3, 3, -7, 2, 3, 0xffffff, 3);
  panel(2, 5, 7, 1, 1, 0xffffff, 2.5);
  panel(3, 2, 2, 3, -7, 0xffd0dc, 2);
  panel(4, 2, -3, -2, 7, 0x2a0820, 1);
  panel(2, 2, 5, -3, -5, 0xff5040, 1.5);
  panel(14, 1.2, 0, 0.6, -8, 0x1a0614, 1);
  panel(1.2, 6, -7.5, 0, -3, 0x1a0614, 1);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(scene, 0.015).texture; pm.dispose();
  return tex;
}

function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let shared = null;
function getShared() {
  if (shared !== null) return shared;
  try {
    const c = document.createElement('canvas');
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, powerPreference: 'low-power' });
    r.setPixelRatio(1); r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
    shared = { r, env: makeEnv(r), chromeEnv: makeChromeEnv(r), W: 0, H: 0 };
  } catch (e) { shared = false; }
  return shared;
}
function build(canvas) {
  const name = canvas.dataset.disco, def = SHAPES[name]; if (!def) return null;
  const ortho = !!canvas.dataset.ortho;
  const sh = getShared(); if (!sh) { canvas.remove(); return null; }
  const renderer = sh.r, ctx = canvas.getContext('2d');
  const scene = new THREE.Scene(); scene.environment = sh.env;
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc0d0, 1.4); rim.position.set(-3, 1, -2); scene.add(rim);
  const obj = new THREE.Group(); scene.add(obj);
  const rand = seeded(name.length * 9973 + name.charCodeAt(0) + (canvas.dataset.color || '').length * 31);
  const tile = +(canvas.dataset.tile || 0.064);
  const buckets = {};
  const iconStyle = document.documentElement.dataset.icons || 'chrome';
  const chrome = iconStyle !== 'disco';
  if (iconStyle === 'chrome') {
    scene.environment = sh.chromeEnv;
    scene.children.filter(o => o.isLight).forEach(l => (l.intensity *= 0.35));
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.05, envMapIntensity: 1.15, side: THREE.DoubleSide });
    for (const part of def(canvas.dataset)) obj.add(new THREE.Mesh(groutGeo(part.S, part.xf, 220, 170), mat));
  } else if (iconStyle === 'tegnet') {
    // chrome style: smooth surfaces with posterised two-tone reflections, like an inked drawing of polished metal
    const css = getComputedStyle(document.documentElement);
    const dark = new THREE.Color((css.getPropertyValue('--icon-dark') || '#1f3c42').trim());
    const light = new THREE.Color((css.getPropertyValue('--icon-light') || '#ffffff').trim());
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uDark: { value: dark }, uLight: { value: light } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uDark; uniform vec3 uLight; varying vec3 vN; varying vec3 vV;
        void main() {
          vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
          float f = dot(n, normalize(vV));
          vec3 r = reflect(-normalize(vV), n);
          float t = r.y + 0.24 * sin(r.x * 1.9 + 0.6) + 0.08 * sin(r.z * 3.0 + r.x * 1.3);
          bool ink = (t > -0.04 && t < 0.3) || t < -0.62 || f < 0.24;
          bool glint = (t > 0.6 && t < 0.64) || (t > -0.36 && t < -0.32);
          gl_FragColor = vec4((ink || glint) ? uDark : uLight, 1.0);
        }`,
    });
    for (const part of def(canvas.dataset)) obj.add(new THREE.Mesh(groutGeo(part.S, part.xf, 180, 140), mat));
  }
  for (const part of (chrome ? [] : def(canvas.dataset))) {
    const tiles = tileSurface(part.S, { tile: tile * (part.tileScale || 1), rand, color: part.color, xf: part.xf, jitter: part.jitter });
    for (const t of tiles) (buckets[t.col] ||= []).push(t.m);
    const gcol = typeof part.color === 'string' ? part.color : 'silver';
    obj.add(new THREE.Mesh(groutGeo(part.S, part.xf), new THREE.MeshStandardMaterial({ color: GROUT[gcol], roughness: 0.7, metalness: 0.3 })));
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  for (const [c, mats] of Object.entries(buckets)) {
    const mat = new THREE.MeshStandardMaterial({ color: COL[c], metalness: 1, roughness: 0.16, envMapIntensity: 1.35 });
    const im = new THREE.InstancedMesh(box, mat, mats.length);
    const tint = new THREE.Color();
    mats.forEach((m, i) => { im.setMatrixAt(i, m); const k = 0.72 + rand() * 0.38; im.setColorAt(i, tint.setRGB(k, k, k)); });
    obj.add(im);
  }
  // center + fit
  const bb = new THREE.Box3().setFromObject(obj), ctr = bb.getCenter(new V()), sph = bb.getBoundingSphere(new THREE.Sphere());
  if (!ortho) obj.children.forEach(ch => ch.position.sub(ctr));
  const cam = ortho ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100) : new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const dist = sph.radius / Math.sin(THREE.MathUtils.degToRad(13)) * 0.98;
  cam.position.set(0, sph.radius * 0.18, dist); cam.lookAt(0, 0, 0);
  const tiltX = +(canvas.dataset.tilt || 0.12), spin = canvas.dataset.spin || 'y', baseRot = +(canvas.dataset.rot || 0);
  const amp = +(canvas.dataset.amp || 0.7), rz = +(canvas.dataset.rz || 0);
  obj.rotation.x = tiltX;
  let w = 0, h = 0, pw = 0, ph = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect(); if (!r.width || !r.height) return;
    if (r.width === w && r.height === h) return; w = r.width; h = r.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    pw = canvas.width = Math.round(w * dpr); ph = canvas.height = Math.round(h * dpr);
    if (pw > sh.W || ph > sh.H) { sh.W = Math.max(sh.W, pw); sh.H = Math.max(sh.H, ph); renderer.setSize(sh.W, sh.H, false); }
    cam.aspect = w / h;
    if (ortho) { const e = +(canvas.dataset.margin || 0.1), A = +canvas.dataset.aspect || 1; cam.left = -(A / 2 + e); cam.right = A / 2 + e; cam.top = 0.5 + e; cam.bottom = -(0.5 + e); cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix(); }
    if (!ortho) { if (cam.aspect < 1) cam.position.setLength(dist / cam.aspect); else cam.position.setLength(dist); }
    if (!ortho) cam.updateProjectionMatrix();
  };
  const phase = rand() * 10, st = stateOf(canvas);
  let lastT = 0;
  const render = (time) => {
    resize();
    const dt = lastT ? Math.min(0.05, (time - lastT) / 1000) : 0.016; lastT = time;
    // user spin: integrate angular velocity, let it ease out; tilt springs back when let go
    st.ry += st.vy * dt; st.rx += st.vx * dt;
    const damp = Math.exp(-dt * (st.held ? 6 : 1.1));
    st.vy *= damp; st.vx *= damp;
    if (!st.held) st.rx *= Math.exp(-dt * 1.4);
    const s = (reduce ? 4000 : time) / 1000;
    if (ortho) { // the frame stays flat; only the light glints across the tiles
      obj.rotation.set(0, Math.sin(s * 0.6 + phase) * 0.05, Math.sin(s * 0.4 + phase) * 0.01); obj.position.set(0, 0, 0);
      renderer.setViewport(0, 0, pw, ph); renderer.setScissor(0, 0, pw, ph); renderer.setScissorTest(true); renderer.render(scene, cam);
      ctx.clearRect(0, 0, pw, ph); ctx.drawImage(renderer.domElement, 0, sh.H - ph, pw, ph, 0, 0, pw, ph); return;
    }
    if (spin === 'z') { obj.rotation.z = baseRot + s * 0.25; obj.rotation.y = Math.sin(s * 0.6 + phase) * 0.35 + st.ry; }
    else if (spin === 'rock') { obj.rotation.y = baseRot + Math.sin(s * 0.5 + phase) * amp + st.ry; obj.rotation.z = rz + Math.sin(s * 0.8 + phase) * 0.06; }
    else if (spin === 'tap') { obj.rotation.y = baseRot + Math.sin(s * 0.7 + phase) * amp + st.ry; obj.rotation.z = rz; }
    else { obj.rotation.y = baseRot + s * 0.35 + st.ry; obj.rotation.z = rz; }
    obj.rotation.x = tiltX + st.rx;
    if (spin === 'tap') { const k = Math.pow(Math.max(0, Math.sin(s * 2.4)), 3) * sph.radius * 0.09; obj.position.set(Math.cos(rz) * k, Math.sin(rz) * k, 0); }
    else obj.position.y = Math.sin(s * 1.1 + phase) * sph.radius * 0.03;
    if (!pw) return;
    renderer.setViewport(0, 0, pw, ph); renderer.setScissor(0, 0, pw, ph); renderer.setScissorTest(true);
    renderer.render(scene, cam);
    ctx.clearRect(0, 0, pw, ph);
    ctx.drawImage(renderer.domElement, 0, sh.H - ph, pw, ph, 0, 0, pw, ph);
  };
  return { canvas, render, st };
}

// ---------- drag to move (also over the text), flick to spin, double-click to send home
const states = new WeakMap();
function stateOf(c) { let st = states.get(c); if (!st) states.set(c, st = { rx: 0, ry: 0, vx: 0, vy: 0, held: false, x: 0, y: 0 }); return st; }
const busy = st => st.held || Math.abs(st.vy) > 0.02 || Math.abs(st.vx) > 0.02 || Math.abs(st.rx) > 0.01;

function attachDrag(canvas) {
  const slot = canvas.parentElement, st = stateOf(canvas);
  const grab = document.createElement('div'); grab.className = 'grab'; grab.setAttribute('aria-hidden', 'true');
  slot.appendChild(grab);
  let start, last, base;
  const place = () => { slot.style.transform = (st.x || st.y) ? `translate3d(${st.x}px, ${st.y}px, 0)` : ''; };
  grab.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    e.preventDefault(); grab.setPointerCapture(e.pointerId);
    const r = slot.getBoundingClientRect(); base = { l: r.left - st.x, r: r.right - st.x, w: r.width };
    start = { x: e.clientX - st.x, y: e.clientY - st.y }; last = { x: e.clientX, y: e.clientY, t: performance.now() };
    st.held = true; slot.classList.add('is-held'); document.documentElement.classList.add('played'); slot.classList.remove('is-homing'); kick();
  });
  grab.addEventListener('pointermove', e => {
    if (!st.held) return;
    const now = performance.now(), dt = Math.max(8, now - last.t), dx = e.clientX - last.x, dy = e.clientY - last.y;
    // moving the object also turns it, like rolling it under your hand
    st.vy = st.vy * 0.5 + (dx / dt) * 2.2; st.vx = st.vx * 0.5 + (dy / dt) * 1.4;
    last = { x: e.clientX, y: e.clientY, t: now };
    const m = base.w * 0.35, vw = document.documentElement.clientWidth;
    st.x = Math.min(vw - base.r + m, Math.max(-base.l - m, e.clientX - start.x));
    st.y = e.clientY - start.y; place();
  });
  const up = e => {
    if (!st.held) return; st.held = false; slot.classList.remove('is-held');
    if (performance.now() - last.t > 90) { st.vx *= 0.2; st.vy *= 0.2; } // held still before letting go: no throw
    st.vy *= 2.2; st.vx *= 1.6; kick();
  };
  grab.addEventListener('pointerup', up); grab.addEventListener('pointercancel', up);
  grab.addEventListener('dblclick', () => { st.x = st.y = 0; slot.classList.add('is-homing'); place(); });
  grab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); st.vy += 9; kick(); } });
}

const items = new Map();
let visible = new Set(), raf = 0;
const loop = (t) => {
  raf = 0; let again = !reduce && visible.size > 0;
  visible.forEach(it => { it.render(t); if (busy(it.st)) again = true; });
  if (again) raf = requestAnimationFrame(loop);
};
const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
const io = new IntersectionObserver(es => {
  for (const e of es) {
    let it = items.get(e.target);
    if (e.isIntersecting) {
      if (!it) { it = build(e.target); if (!it) continue; items.set(e.target, it); e.target.classList.add('is-ready'); }
      visible.add(it);
    } else if (it && !it.st.held) visible.delete(it);
  }
  kick();
}, { rootMargin: '300px 0px' });
document.querySelectorAll('canvas[data-disco]').forEach(c => { attachDrag(c); io.observe(c); });

function showLayoutTool() {
  if (document.querySelector('.layout-btn')) return;
  const wrap = document.querySelector('.wrap');
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'layout-btn'; btn.textContent = 'Kopiér placeringer';
  const out = document.createElement('textarea'); out.className = 'layout-out'; out.readOnly = true; out.hidden = true;
  document.body.append(btn, out);
  btn.addEventListener('click', () => {
    const cw = wrap.clientWidth, rows = [];
    document.querySelectorAll('canvas[data-disco]').forEach(c => {
      const st = stateOf(c), slot = c.parentElement;
      if (!slot.offsetParent) return; // hidden at this width
      const id = [...slot.classList].filter(k => /^(f-|s-|desk|mob)/.test(k)).join('.') || c.dataset.disco;
      rows.push(`${id}: ${(st.x / cw * 100).toFixed(1)}cqw ${(st.y / cw * 100).toFixed(1)}cqw`);
    });
    const txt = `Placeringer (skærmbredde ${innerWidth}px)\n` + rows.join('\n');
    out.value = txt; out.hidden = false; out.select();
    const done = () => { btn.textContent = 'Kopieret – send det til Claude'; };
    try { navigator.clipboard.writeText(txt).then(done, () => { btn.textContent = 'Markér teksten og kopiér den'; }); }
    catch (e) { btn.textContent = 'Markér teksten og kopiér den'; }
  });
}
// open the helper: #placering in the address (also when added after load), Shift+P, or holding the big title for 1.5 s
const wantTool = () => /placering/.test(location.hash);
if (wantTool()) showLayoutTool();
addEventListener('hashchange', () => { if (wantTool()) showLayoutTool(); });
addEventListener('keydown', e => { if (e.shiftKey && (e.key === 'P' || e.key === 'p')) showLayoutTool(); });
{
  const t = document.querySelector('.hero h1'); let timer = 0;
  if (t) {
    t.addEventListener('pointerdown', () => { timer = setTimeout(showLayoutTool, 1500); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => t.addEventListener(ev, () => clearTimeout(timer)));
  }
}
addEventListener('resize', kick);
