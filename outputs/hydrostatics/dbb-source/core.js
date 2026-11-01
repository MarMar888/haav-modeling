
/* DBB core: shapes, geometry maths, project model, summaries, CSV.
   Needs a global THREE. Exposes DBBCore (browser: window.DBBCore, node: module.exports). */
(function (root) {
  'use strict';
  var T = root.THREE;
  /* The Hull Generator core (src/hullgen.js): curves, loft to a table, bulb. A browser page loads it before this file. */
  var HG_CACHE = null;
  function HG() {
    if (HG_CACHE) return HG_CACHE;
    HG_CACHE = root.HullGenCore || null;
    if (!HG_CACHE && typeof require === 'function') { try { HG_CACHE = require('./hullgen.js'); } catch (e) { HG_CACHE = null; } }
    return HG_CACHE;
  }
  var D2R = Math.PI / 180;
  var FORMAT = 'dbb-block-editor';
  var VERSION = 2;

  /* ---------- shape library ----------
     Every shape fits a unit bounding box centred on the origin (Z up).
     vf   = volume as a fraction of the bounding box
     plan = plan-view (footprint) area as a fraction of L x B, when the shape is not tilted */
  var SHAPES = {
    box:      { label: 'Box',           vf: 1,            plan: 1 },
    cylinder: { label: 'Cylinder',      vf: Math.PI / 4,  plan: Math.PI / 4 },
    halfcyl:  { label: 'Half cylinder', vf: Math.PI / 4,  plan: 1 },
    cone:     { label: 'Cone',          vf: Math.PI / 12, plan: Math.PI / 4 },
    pyramid:  { label: 'Pyramid',       vf: 1 / 3,        plan: 1 },
    wedge:    { label: 'Wedge',         vf: 1 / 2,        plan: 1 },
    sphere:   { label: 'Sphere',        vf: Math.PI / 6,  plan: Math.PI / 4 }
  };
  var SHAPE_ORDER = ['box', 'cylinder', 'halfcyl', 'cone', 'pyramid', 'wedge', 'sphere'];

  var METRICS = {
    volume: { label: 'Volume',               unit: 'm³' },
    area:   { label: 'Area',                 unit: 'm²' },
    length: { label: 'Overall length (X)',   unit: 'm' },
    beam:   { label: 'Overall beam (Y)',     unit: 'm' },
    height: { label: 'Overall height (Z)',   unit: 'm' },
    mass:   { label: 'Weight of linked blocks', unit: 't' },
    totalmass: { label: 'Total weight (with structure)', unit: 't' },
    gt: { label: 'Gross tonnage (GT, estimate)', unit: 'GT' }
  };

  var geomCache = {};
  var edgeCache = {};

  /* Is the point (u, v, w), in the block's unit cube [-0.5, 0.5]^3, inside the unit shape? Matches makeGeometry (axis along local z for
     cylinder, cone and pyramid with the apex at +z; half cylinder and wedge are extruded along local y). */
  function shapeContains(kind, u, v, w, eps) {
    eps = eps || 0;
    switch (kind) {
      case 'cylinder': return u * u + v * v <= 0.25 + eps;
      case 'sphere':   return u * u + v * v + w * w <= 0.25 + eps;
      case 'cone':     { var r = 0.5 * (0.5 - w); return w >= -0.5 - eps && Math.sqrt(u * u + v * v) <= r + eps; }
      case 'pyramid':  { var s = 0.5 * (0.5 - w); return w >= -0.5 - eps && Math.max(Math.abs(u), Math.abs(v)) <= s + eps; }
      case 'halfcyl':  { var q = (w + 0.5); return w >= -0.5 - eps && (u * u) / 0.25 + q * q <= 1 + eps; }
      case 'wedge':    return w >= -0.5 - eps && w <= u + eps;
      default:         { var rt = RT[kind]; if (!rt) return true; var G = STL_GRID, gi = Math.min(G - 1, Math.max(0, Math.floor((u + 0.5) * G))), gj = Math.min(G - 1, Math.max(0, Math.floor((v + 0.5) * G))), gk = Math.min(G - 1, Math.max(0, Math.floor((w + 0.5) * G))); return rt.grid[(gi * G + gj) * G + gk] === 1; }
    }
  }

  function makeGeometry(kind) {
    if (geomCache[kind]) return geomCache[kind];
    var g, s;
    switch (kind) {
      case 'cylinder':
        g = new T.CylinderGeometry(0.5, 0.5, 1, 48);
        g.rotateX(Math.PI / 2);
        break;
      case 'cone':
        g = new T.ConeGeometry(0.5, 1, 48);
        g.rotateX(Math.PI / 2);
        break;
      case 'pyramid':
        g = new T.ConeGeometry(Math.SQRT1_2, 1, 4);
        g.rotateY(Math.PI / 4);
        g.rotateX(Math.PI / 2);
        break;
      case 'sphere':
        g = new T.SphereGeometry(0.5, 32, 20);
        break;
      case 'halfcyl':
        s = new T.Shape();
        s.moveTo(-0.5, -0.5);
        s.lineTo(0.5, -0.5);
        s.absellipse(0, -0.5, 0.5, 1, 0, Math.PI, false, 0);
        s.closePath();
        g = new T.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 32, steps: 1 });
        g.rotateX(Math.PI / 2);
        g.translate(0, 0.5, 0);
        break;
      case 'wedge':
        s = new T.Shape();
        s.moveTo(-0.5, -0.5);
        s.lineTo(0.5, -0.5);
        s.lineTo(0.5, 0.5);
        s.closePath();
        g = new T.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, steps: 1 });
        g.rotateX(Math.PI / 2);
        g.translate(0, 0.5, 0);
        break;
      default:
        g = new T.BoxGeometry(1, 1, 1);
    }
    geomCache[kind] = g;
    return g;
  }

  function makeEdges(kind) {
    if (!edgeCache[kind]) edgeCache[kind] = new T.EdgesGeometry(makeGeometry(kind), 30);
    return edgeCache[kind];
  }


  /* ---------- imported (STL) shapes ----------
     An STL becomes one shape in the library. The mesh is reduced on import (vertex clustering) to a few thousand triangles and
     stored as 16-bit coordinates in the unit cube, so a project file stays small. Volume and centroid come from the original mesh.
     CUSTOM holds the stored data by id, RT the runtime data (point-in-shape grid, vertices). Nothing is ever removed from them, so undo works. */
  var CUSTOM = {}, RT = {}, STL_GRID = 96, STL_TARGET = 25000, STL_MAX_BYTES = 500 * 1024 * 1024;

  function b64u16(a) {
    var u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), s = '', k = 0x8000;
    for (var i = 0; i < u8.length; i += k) s += String.fromCharCode.apply(null, u8.subarray(i, i + k));
    return btoa(s);
  }
  function u16b64(s) {
    var bin = atob(s), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Uint16Array(u8.buffer, 0, u8.length >> 1);
  }

  /* point-in-shape grid by casting a ray along z through the centre of every column (odd-even rule); also the footprint fraction */
  function buildGrid(pos, ntri) {
    var G = STL_GRID, cols = new Array(G * G), t, i, j, k;
    for (t = 0; t < ntri; t++) {
      var o = t * 9, ax = pos[o], ay = pos[o + 1], az = pos[o + 2], bx = pos[o + 3], by = pos[o + 4], bz = pos[o + 5], cx = pos[o + 6], cy = pos[o + 7], cz = pos[o + 8];
      var det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(det) < 1e-14) continue;
      var i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) + 0.5) * G - 0.5)), i1 = Math.min(G - 1, Math.ceil((Math.max(ax, bx, cx) + 0.5) * G));
      var j0 = Math.max(0, Math.floor((Math.min(ay, by, cy) + 0.5) * G - 0.5)), j1 = Math.min(G - 1, Math.ceil((Math.max(ay, by, cy) + 0.5) * G));
      for (i = i0; i <= i1; i++) for (j = j0; j <= j1; j++) {
        var px = (i + 0.5 + 0.0137) / G - 0.5, py = (j + 0.5 + 0.0291) / G - 0.5;
        var l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det, l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        (cols[i * G + j] || (cols[i * G + j] = [])).push(l1 * az + l2 * bz + l3 * cz);
      }
    }
    var grid = new Uint8Array(G * G * G), occ = 0;
    for (i = 0; i < G * G; i++) {
      var c = cols[i];
      if (!c || c.length < 2) continue;
      c.sort(function (a, b) { return a - b; });
      var any = false;
      for (j = 0; j + 1 < c.length; j += 2) {
        var k0 = Math.max(0, Math.ceil((c[j] + 0.5) * G - 0.5)), k1 = Math.min(G - 1, Math.floor((c[j + 1] + 0.5) * G - 0.5));
        for (k = k0; k <= k1; k++) { grid[i * G + k] = 1; any = true; }
      }
      if (any) occ++;
    }
    return { grid: grid, plan: occ / (G * G) };
  }

  function customGeometry(pos, ntri) {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  /* is a stored shape well formed? */
  function validShape(d) {
    if (!d || typeof d !== 'object' || typeof d.id !== 'string' || !/^stl_[a-z0-9_]{1,40}$/.test(d.id)) return false;
    if (typeof d.v !== 'string' || typeof d.i !== 'string' || d.v.length > 8e6 || d.i.length > 8e6) return false;
    if (!(d.vf > 0 && d.vf <= 1) || !Array.isArray(d.c) || d.c.length !== 3 || !d.c.every(function (x) { return isFinite(x) && Math.abs(x) <= 0.5; })) return false;
    if (!Array.isArray(d.size) || d.size.length !== 3 || !d.size.every(function (x) { return isFinite(x) && x > 0; })) return false;
    try {
      var v = u16b64(d.v), ix = u16b64(d.i), nv = v.length / 3;
      if (nv < 4 || v.length % 3 || ix.length < 12 || ix.length % 3) return false;
      for (var q = 0; q < ix.length; q++) if (ix[q] >= nv) return false;
    } catch (e) { return false; }
    return true;
  }

  function registerShape(d) {
    if (SHAPES[d.id] && SHAPES[d.id].custom) return true;
    if (!validShape(d)) return false;
    var v = u16b64(d.v), ix = u16b64(d.i), nt = ix.length / 3, pos = new Float32Array(nt * 9), pts = new Float32Array(v.length), q, k;
    for (q = 0; q < v.length; q++) pts[q] = v[q] / 65535 - 0.5;
    for (q = 0; q < nt; q++) for (var a = 0; a < 3; a++) for (k = 0; k < 3; k++) pos[q * 9 + a * 3 + k] = pts[ix[q * 3 + a] * 3 + k];
    var gr = buildGrid(pos, nt);
    CUSTOM[d.id] = d;
    RT[d.id] = { grid: gr.grid, pts: pts };
    SHAPES[d.id] = { label: String(d.label || 'Imported shape').slice(0, 40), vf: d.vf, plan: gr.plan, custom: true };
    SHAPE_CENTROID[d.id] = d.c.slice();
    geomCache[d.id] = customGeometry(pos, nt);
    delete edgeCache[d.id];
    return true;
  }

  /* STL reader: binary or ASCII; returns {n, get(i, out9)} */
  function parseSTL(buf) {
    if (buf.byteLength > STL_MAX_BYTES) throw new Error('The file is larger than 500 MB.');
    var n = 0, bin = false, dv = new DataView(buf), u8 = new Uint8Array(buf);
    if (buf.byteLength >= 84) {
      n = dv.getUint32(80, true);
      var head = String.fromCharCode.apply(null, u8.subarray(0, 5)).toLowerCase();
      bin = 84 + 50 * n === buf.byteLength || (head !== 'solid' && 84 + 50 * n <= buf.byteLength);
    }
    if (bin) {
      return { n: n, ascii: false, get: function (i, o) { var p = 84 + 50 * i + 12; for (var k = 0; k < 9; k++) o[k] = dv.getFloat32(p + 4 * k, true); } };
    }
    var txt = new TextDecoder().decode(buf), re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g, m, f = [];
    while ((m = re.exec(txt))) { f.push(+m[1], +m[2], +m[3]); }
    if (!f.length || f.length % 9) throw new Error('This does not look like an STL file.');
    var fa = new Float32Array(f);
    return { n: fa.length / 9, ascii: true, get: function (i, o) { for (var k = 0; k < 9; k++) o[k] = fa[i * 9 + k]; } };
  }

  /* guess the unit of an STL from its largest size: more than 300 is taken as millimetres */
  function guessUnit(dims) { return Math.max(dims[0], dims[1], dims[2]) > 300 ? 'mm' : 'm'; }
  var UNIT_SCALE = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254 };

  /* reduce a parsed STL: opts.up is 'z' (default) or 'y'. Result: {v, i (Uint16 arrays), vf, c, dims, closed, tris0, tris, verts} */
  function reduceSTL(src, opts) {
    opts = opts || {};
    var n = src.n, o = new Float64Array(9), up = opts.up === 'y', t, k;
    if (!n) throw new Error('The file has no triangles.');
    function get(i) {
      src.get(i, o);
      if (up) for (var q = 0; q < 9; q += 3) { var y = o[q + 1], z = o[q + 2]; o[q + 1] = -z; o[q + 2] = y; }
    }
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (t = 0; t < n; t++) {
      get(t);
      for (k = 0; k < 9; k++) { var c = k % 3, x = o[k]; if (!isFinite(x)) throw new Error('The file has invalid numbers.'); if (x < mn[c]) mn[c] = x; if (x > mx[c]) mx[c] = x; }
    }
    var dims = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], mid = [(mx[0] + mn[0]) / 2, (mx[1] + mn[1]) / 2, (mx[2] + mn[2]) / 2];
    var maxd = Math.max(dims[0], dims[1], dims[2]);
    if (!(maxd > 0)) throw new Error('The model has no size.');
    var dd = dims.map(function (d) { return Math.max(d, maxd * 1e-4); });
    // volume, centroid and closedness of the original mesh (relative to the box centre)
    var V = 0, cs = [0, 0, 0], av = [0, 0, 0], aabs = 0;
    for (t = 0; t < n; t++) {
      get(t);
      var ax = o[0] - mid[0], ay = o[1] - mid[1], az = o[2] - mid[2], bx = o[3] - mid[0], by = o[4] - mid[1], bz = o[5] - mid[2], cx = o[6] - mid[0], cy = o[7] - mid[1], cz = o[8] - mid[2];
      var vol = (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      V += vol; cs[0] += vol * (ax + bx + cx) / 4; cs[1] += vol * (ay + by + cy) / 4; cs[2] += vol * (az + bz + cz) / 4;
      var ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
      var nx = (uy * wz - uz * wy) / 2, ny = (uz * wx - ux * wz) / 2, nz = (ux * wy - uy * wx) / 2;
      av[0] += nx; av[1] += ny; av[2] += nz; aabs += Math.sqrt(nx * nx + ny * ny + nz * nz);
    }
    var closed = aabs > 0 && Math.sqrt(av[0] * av[0] + av[1] * av[1] + av[2] * av[2]) / aabs < 0.01 && Math.abs(V) > 1e-9 * maxd * maxd * maxd;
    var boxV = dd[0] * dd[1] * dd[2], vf = Math.min(1, Math.max(0.02, Math.abs(V) / boxV));
    var cen = Math.abs(V) > 0 ? [cs[0] / V / dd[0], cs[1] / V / dd[1], cs[2] / V / dd[2]] : [0, 0, 0];
    cen = cen.map(function (x) { return Math.max(-0.5, Math.min(0.5, x)); });

    // vertex clustering
    function cluster(R) {
      var h = maxd / R, map = new Map(), sx = [], sy = [], sz = [], cnt = [], tri = [], id = [0, 0, 0];
      for (var tt = 0; tt < n; tt++) {
        get(tt);
        for (var a = 0; a < 3; a++) {
          var ix = Math.min(4095, Math.floor((o[a * 3] - mn[0]) / h)), iy = Math.min(4095, Math.floor((o[a * 3 + 1] - mn[1]) / h)), iz = Math.min(4095, Math.floor((o[a * 3 + 2] - mn[2]) / h));
          var key = (ix * 4096 + iy) * 4096 + iz, ci = map.get(key);
          if (ci === undefined) { ci = cnt.length; map.set(key, ci); sx.push(0); sy.push(0); sz.push(0); cnt.push(0); }
          sx[ci] += o[a * 3]; sy[ci] += o[a * 3 + 1]; sz[ci] += o[a * 3 + 2]; cnt[ci]++;
          id[a] = ci;
        }
        if (id[0] !== id[1] && id[1] !== id[2] && id[0] !== id[2]) tri.push(id[0], id[1], id[2]);
      }
      return { sx: sx, sy: sy, sz: sz, cnt: cnt, tri: tri };
    }
    var R = n <= STL_TARGET ? 4000 : 48, cl = cluster(R), guard = 0;
    while (n > STL_TARGET && guard++ < 4) {
      var nt = cl.tri.length / 3;
      if ((nt <= STL_TARGET * 1.15 && nt >= STL_TARGET * 0.5 && cl.cnt.length < 65000) || R >= 4000) break;
      R = Math.max(8, Math.min(4000, R * Math.sqrt(STL_TARGET * 0.9 / Math.max(1, nt))));
      cl = cluster(R);
    }
    while (cl.cnt.length >= 65000 && R > 8) { R = Math.floor(R * 0.8); cl = cluster(R); }
    // keep the used vertices only, and write them as 16-bit coordinates in the unit cube
    var remap = new Int32Array(cl.cnt.length).fill(-1), nv = 0, idx = new Uint16Array(cl.tri.length), vs = [];
    for (t = 0; t < cl.tri.length; t++) {
      var c0 = cl.tri[t];
      if (remap[c0] < 0) {
        remap[c0] = nv++;
        var q = [(cl.sx[c0] / cl.cnt[c0] - mid[0]) / dd[0], (cl.sy[c0] / cl.cnt[c0] - mid[1]) / dd[1], (cl.sz[c0] / cl.cnt[c0] - mid[2]) / dd[2]];
        for (k = 0; k < 3; k++) vs.push(Math.max(0, Math.min(65535, Math.round((q[k] + 0.5) * 65535))));
      }
      idx[t] = remap[c0];
    }
    if (idx.length < 12 || nv < 4) throw new Error('The model is too small or too flat to import.');
    return { v: new Uint16Array(vs), i: idx, vf: vf, c: cen, dims: dims, closed: closed, tris0: n, tris: idx.length / 3, verts: nv };
  }

  /* the stored data of a shape, from a reduced mesh; scale turns the file units into metres */
  function makeShapeData(red, label, scale, id, bytes0) {
    return {
      id: id, label: String(label || 'Imported shape').slice(0, 40), v: b64u16(red.v), i: b64u16(red.i), vf: Math.round(red.vf * 1e5) / 1e5,
      c: red.c.map(function (x) { return Math.round(x * 1e5) / 1e5; }),
      size: red.dims.map(function (d) { return Math.round(d * scale * 1e4) / 1e4 || 0.0001; }),
      closed: red.closed, tris0: red.tris0, tris: red.tris, bytes0: bytes0 || 0
    };
  }

  /* ---------- block maths ---------- */
  function num(v, d) {
    v = Number(v);
    return isFinite(v) ? v : d;
  }

  function blockMatrix(b) {
    var q = new T.Quaternion().setFromEuler(new T.Euler(b.rotation[0] * D2R, b.rotation[1] * D2R, b.rotation[2] * D2R, 'XYZ'));
    return new T.Matrix4().compose(
      new T.Vector3(b.position[0], b.position[1], b.position[2]), q,
      new T.Vector3(b.size[0], b.size[1], b.size[2]));
  }

  function blockVolume(b) {
    return SHAPES[b.shape].vf * b.size[0] * b.size[1] * b.size[2];
  }

  /* Gross tonnage, estimate by the 1969 Tonnage Convention: GT = K1 x V, K1 = 0.2 + 0.02 log10(V), V the volume of the enclosed spaces in m3.
     A block counts when it is not marked as an open space (b.gt === false). Overlapping blocks count twice. */
  function grossTonnage(model) {
    var V = 0, n = 0;
    model.blocks.forEach(function (b) { if (b.gt !== false) { V += blockVolume(b); n++; } });
    var K1 = V > 0 ? 0.2 + 0.02 * Math.log(V) / Math.LN10 : 0;
    return { V: V, K1: K1, GT: K1 * V, n: n };
  }

  function worldVerts(b) {
    var rt = RT[b.shape], pa = rt ? null : makeGeometry(b.shape).attributes.position;
    var m = blockMatrix(b);
    var v = new T.Vector3();
    var cnt = rt ? rt.pts.length / 3 : pa.count;
    var out = new Array(cnt * 3);
    for (var i = 0; i < cnt; i++) {
      if (rt) v.set(rt.pts[i * 3], rt.pts[i * 3 + 1], rt.pts[i * 3 + 2]); else v.fromBufferAttribute(pa, i);
      v.applyMatrix4(m);
      out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
    }
    return out;
  }

  function blockWorldBox(b) {
    var w = worldVerts(b);
    var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (var i = 0; i < w.length; i += 3) {
      for (var k = 0; k < 3; k++) {
        if (w[i + k] < min[k]) min[k] = w[i + k];
        if (w[i + k] > max[k]) max[k] = w[i + k];
      }
    }
    return { min: min, max: max };
  }

  function hull2D(pts) {
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var n = pts.length;
    if (n < 3) return pts;
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lower = [], upper = [], i;
    for (i = 0; i < n; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) lower.pop();
      lower.push(pts[i]);
    }
    for (i = n - 1; i >= 0; i--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) upper.pop();
      upper.push(pts[i]);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }

  function polyArea(p) {
    var s = 0;
    for (var i = 0; i < p.length; i++) {
      var j = (i + 1) % p.length;
      s += p[i][0] * p[j][1] - p[j][0] * p[i][1];
    }
    return Math.abs(s) / 2;
  }

  /* Plan-view footprint. Exact when the block is only turned about the vertical axis;
     otherwise the area of the convex hull of its projected corners (all shapes are convex). */
  function blockPlanArea(b) {
    var tilted = Math.abs(b.rotation[0]) > 1e-6 || Math.abs(b.rotation[1]) > 1e-6;
    if (!tilted) return SHAPES[b.shape].plan * b.size[0] * b.size[1];
    var w = worldVerts(b), pts = [];
    for (var i = 0; i < w.length; i += 3) pts.push([w[i], w[i + 1]]);
    return polyArea(hull2D(pts));
  }

  function blockArea(b) {
    return b.areaOverride != null ? b.areaOverride : blockPlanArea(b);
  }

  /* ---------- groups ---------- */
  function defaultGroups() {
    return [
      { id: 'g_task',   name: 'Task related systems',      color: '#9aa3b0', parent: null,     visible: true },
      { id: 'g_cargo',  name: 'Cargo spaces',              color: '#e0603c', parent: 'g_task', visible: true, density: 0.6 },
      { id: 'g_ah',     name: 'Anchor handling and towing', color: '#f2a93b', parent: 'g_task', visible: true, density: 0.4 },
      { id: 'g_oc',     name: 'Offshore construction',     color: '#8e63c9', parent: 'g_task', visible: true, density: 0.4 },
      { id: 'g_ship',   name: 'Ship systems',              color: '#9aa3b0', parent: null,     visible: true },
      { id: 'g_struct', name: 'Ship structure',            color: '#8c97a8', parent: 'g_ship', visible: true, density: 0.15 },
      { id: 'g_outfit', name: 'Ship outfitting',           color: '#2fa7b8', parent: 'g_ship', visible: true, density: 0.15 },
      { id: 'g_acc',    name: 'Accommodation',             color: '#4fae6a', parent: 'g_ship', visible: true, density: 0.12 },
      { id: 'g_mach',   name: 'Machinery',                 color: '#e9cf3a', parent: 'g_ship', visible: true, density: 0.4 },
      { id: 'g_tanks',  name: 'Tanks and voids',           color: '#3f72d6', parent: 'g_ship', visible: true, density: 0.85 }
    ];
  }

  function groupMap(model) {
    var m = {};
    model.groups.forEach(function (g) { m[g.id] = g; });
    return m;
  }

  /* Tree order: [{group, depth}] */
  function groupOrder(model) {
    var kids = {}, out = [], seen = {};
    model.groups.forEach(function (g) {
      var k = g.parent || '';
      (kids[k] = kids[k] || []).push(g);
    });
    function walk(parentKey, depth) {
      (kids[parentKey] || []).forEach(function (g) {
        if (seen[g.id]) return;
        seen[g.id] = true;
        out.push({ group: g, depth: depth });
        walk(g.id, depth + 1);
      });
    }
    walk('', 0);
    return out;
  }

  function groupPath(model, id) {
    var map = groupMap(model), names = [], guard = 0, g = map[id];
    while (g && guard++ < 50) { names.unshift(g.name); g = g.parent ? map[g.parent] : null; }
    return names.join(' / ');
  }

  function isGroupVisible(model, id) {
    var map = groupMap(model), g = map[id], guard = 0;
    while (g && guard++ < 50) {
      if (g.visible === false) return false;
      g = g.parent ? map[g.parent] : null;
    }
    return true;
  }

  function descendantIds(model, id) {
    var out = [id], i = 0;
    while (i < out.length) {
      var cur = out[i++];
      model.groups.forEach(function (g) { if (g.parent === cur && out.indexOf(g.id) < 0) out.push(g.id); });
    }
    return out;
  }

  /* ---------- summaries ---------- */
  function envelope(model) {
    if (!model.blocks.length) return null;
    var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    model.blocks.forEach(function (b) {
      var bx = blockWorldBox(b);
      for (var k = 0; k < 3; k++) {
        if (bx.min[k] < min[k]) min[k] = bx.min[k];
        if (bx.max[k] > max[k]) max[k] = bx.max[k];
      }
    });
    return { min: min, max: max, length: max[0] - min[0], beam: max[1] - min[1], height: max[2] - min[2] };
  }

  function summarize(model) {
    var own = {}, total = { n: 0, vol: 0, area: 0 };
    model.groups.forEach(function (g) { own[g.id] = { n: 0, vol: 0, area: 0 }; });
    model.blocks.forEach(function (b) {
      var o = own[b.group];
      var v = blockVolume(b), a = blockArea(b);
      if (o) { o.n++; o.vol += v; o.area += a; }
      total.n++; total.vol += v; total.area += a;
    });
    var order = groupOrder(model);
    var rows = order.map(function (r) {
      var ids = descendantIds(model, r.group.id);
      var t = { n: 0, vol: 0, area: 0 };
      ids.forEach(function (id) { var o = own[id]; if (o) { t.n += o.n; t.vol += o.vol; t.area += o.area; } });
      return { group: r.group, depth: r.depth, own: own[r.group.id], total: t, hasKids: ids.length > 1 };
    });
    return { rows: rows, total: total, envelope: envelope(model) };
  }

  /* ---------- mass and centres of gravity ----------
     Mass of a block = density x volume x fill. The density comes from the block, else its group, else the parent groups, else a default.
     A block may also carry a typed mass. The centre of gravity is the centroid of the shape, rotated and scaled with the block.
     Structure and outfitting (hull steel, piping, cabling) is a share of the displacement, spread evenly over the hull volume. */
  var DEFAULT_DENSITY = 0.3, DEFAULT_STRUCT_PCT = 25;
  /* centroid of each unit shape, in its unit cube (see makeGeometry): apex shapes have it a quarter of the height above the base */
  var SHAPE_CENTROID = {
    box: [0, 0, 0], cylinder: [0, 0, 0], sphere: [0, 0, 0],
    halfcyl: [0, 0, -0.5 + 4 / (3 * Math.PI)], cone: [0, 0, -0.25], pyramid: [0, 0, -0.25], wedge: [1 / 6, 0, -1 / 6]
  };

  function blockCentroid(b) {
    var c = SHAPE_CENTROID[b.shape] || [0, 0, 0];
    var v = new T.Vector3(c[0], c[1], c[2]).applyMatrix4(blockMatrix(b));
    return [v.x, v.y, v.z];
  }

  /* density of a group: its own value, else the nearest parent's, else the default; own tells which it was */
  function groupDensity(model, id) {
    var map = groupMap(model), g = map[id], first = g, guard = 0;
    while (g && guard++ < 50) {
      if (typeof g.density === 'number' && isFinite(g.density)) return { value: g.density, own: g === first };
      g = g.parent ? map[g.parent] : null;
    }
    return { value: DEFAULT_DENSITY, own: false };
  }

  function blockMass(model, b) {
    var vol = blockVolume(b), fill = typeof b.fill === 'number' && isFinite(b.fill) ? Math.min(100, Math.max(0, b.fill)) : 100;
    var gd = groupDensity(model, b.group);
    var d = typeof b.density === 'number' && isFinite(b.density) ? b.density : gd.value;
    var typed = typeof b.massOverride === 'number' && isFinite(b.massOverride);
    return { mass: typed ? Math.max(0, b.massOverride) : d * vol * fill / 100, density: d, fill: fill, volume: vol, typed: typed, ownDensity: d !== gd.value || typeof b.density === 'number', groupDensity: gd.value };
  }

  /* hull volume up to the main deck: its volume and centroid (x from the aft end of the model, y centreline, z above the baseline) */
  function hullCentroid(h) {
    var nz = 48, nu = 160, dz = h.depth / nz, V = 0, Mx = 0, Mz = 0;
    for (var j = 0; j < nz; j++) {
      var t = (j + 0.5) / nz, r = hullXRange(h, t), len = r[1] - r[0];
      for (var i = 0; i < nu; i++) {
        var dv = 2 * hullHalf(h, (i + 0.5) / nu, t) * len / nu * dz;
        V += dv; Mx += dv * (r[0] + (i + 0.5) / nu * len); Mz += dv * (j + 0.5) * dz;
      }
    }
    return V > 0 ? { V: V, x: Mx / V, y: h.y || 0, z: Mz / V } : { V: 0, x: h.x + h.loa / 2, y: h.y || 0, z: h.depth / 2 };
  }

  function weightSummary(model) {
    var own = {};
    model.groups.forEach(function (g) { own[g.id] = { n: 0, m: 0, mx: 0, my: 0, mz: 0 }; });
    var tot = { n: 0, m: 0, mx: 0, my: 0, mz: 0 };
    model.blocks.forEach(function (b) {
      var q = blockMass(model, b), c = blockCentroid(b), o = own[b.group];
      if (o) { o.n++; o.m += q.mass; o.mx += q.mass * c[0]; o.my += q.mass * c[1]; o.mz += q.mass * c[2]; }
      tot.n++; tot.m += q.mass; tot.mx += q.mass * c[0]; tot.my += q.mass * c[1]; tot.mz += q.mass * c[2];
    });
    function fin(a) {
      return { n: a.n, mass: a.m, lcg: a.m > 0 ? a.mx / a.m : null, tcg: a.m > 0 ? a.my / a.m : null, vcg: a.m > 0 ? a.mz / a.m : null };
    }
    var rows = groupOrder(model).map(function (r) {
      var a = { n: 0, m: 0, mx: 0, my: 0, mz: 0 };
      descendantIds(model, r.group.id).forEach(function (id) {
        var o = own[id]; if (!o) return;
        a.n += o.n; a.m += o.m; a.mx += o.mx; a.my += o.my; a.mz += o.mz;
      });
      return { group: r.group, depth: r.depth, total: fin(a), density: groupDensity(model, r.group.id) };
    });
    var pct = typeof model.structPct === 'number' && isFinite(model.structPct) ? Math.min(100, Math.max(0, model.structPct)) : DEFAULT_STRUCT_PCT;
    var hd = modelHydro(model), st = { n: 0, m: 0, mx: 0, my: 0, mz: 0 };
    if (hd) hd.hulls.forEach(function (e) {
      var ms = pct / 100 * e.h.disp;
      if (model.st && model.st.steelOn === true && (model.hulls || []).length === 1) ms = stSteel(model, e.hull).mass;
      if (!(ms > 0)) return;
      var c = hullCentroid(e.hull);
      st.m += ms; st.mx += ms * c.x; st.my += ms * c.y; st.mz += ms * c.z;
    });
    var all = { n: tot.n, m: tot.m + st.m, mx: tot.mx + st.mx, my: tot.my + st.my, mz: tot.mz + st.mz };
    var out = { rows: rows, blocks: fin(tot), struct: fin(st), pct: pct, total: fin(all), hasHull: !!hd,
      disp: hd ? hd.total.disp : null, lcb: hd ? hd.total.LCB : null, tcb: hd ? hd.total.TCB : null, kb: hd ? hd.total.KB : null,
      margin: null, marginPct: null, lcgMinusLcb: null };
    if (hd && hd.total.disp > 0) {
      out.margin = hd.total.disp - all.m;
      out.marginPct = 100 * out.margin / hd.total.disp;
      if (out.total.lcg != null) out.lcgMinusLcb = out.total.lcg - hd.total.LCB;
    }
    return out;
  }

  /* ---------- requirements ---------- */
  function tol(thr) { return 1e-6 * Math.max(1, Math.abs(thr)); }

  /* a block can serve several requirements; b.reqs is the list of requirement ids (an old b.req string is still understood) */
  function blockReqs(b) { return Array.isArray(b.reqs) ? b.reqs : (b.req ? [b.req] : []); }
  function hasReq(b, id) { return blockReqs(b).indexOf(id) >= 0; }
  function evaluateRequirements(model, summary) {
    var env = (summary || summarize(model)).envelope, hc = hullCheck(model);
    return model.requirements.map(function (r) {
      var achieved = 0, n = 0, shared = 0, names = [];
      if (r.metric === 'volume' || r.metric === 'area' || r.metric === 'mass') {
        model.blocks.forEach(function (b) {
          if (hasReq(b, r.id)) {
            n++; names.push(b.name); if (blockReqs(b).length > 1) shared++;
            achieved += r.metric === 'volume' ? blockVolume(b) : r.metric === 'area' ? blockArea(b) : blockMass(model, b).mass;
          }
        });
      } else if (r.metric === 'gt') {
        var gtr = grossTonnage(model);
        achieved = gtr.GT; n = gtr.n;
      } else if (r.metric === 'totalmass') {
        achieved = weightSummary(model).total.mass;
        n = model.blocks.length;
      } else {
        achieved = env ? env[r.metric] : 0;
        n = model.blocks.length;
      }
      function ok(thr) {
        if (thr == null) return null;
        return r.sense === 'max' ? achieved <= thr + tol(thr) : achieved >= thr - tol(thr);
      }
      /* fail: the shall is not met. ok: the shall is met, within the should. excess: beyond the should (more than asked for).
         With only a should, meeting it is ok and missing it is fail. */
      function statusOf(val) {
        var s = r.sense === 'max';
        function o(thr) { return thr == null ? null : (s ? val <= thr + tol(thr) : val >= thr - tol(thr)); }
        if (r.shall == null && r.should == null) return 'none';
        if (r.shall == null) return o(r.should) === true ? 'ok' : 'fail';
        if (o(r.shall) !== true) return 'fail';
        if (r.should != null && (s ? val < r.should - tol(r.should) : val > r.should + tol(r.should))) return 'excess';
        return 'ok';
      }
      var status = statusOf(achieved);
      var mS = margin(achieved, r.sense, r.shall), mH = margin(achieved, r.sense, r.should);
      var mShow = status === 'excess' ? mH : (r.shall != null ? mS : mH);
      // what is left once only the part of each block inside the hulls counts (estimate; volume and area requirements)
      var insideVal = null, statusIn = null;
      if (hc && (r.metric === 'volume' || r.metric === 'area')) {
        insideVal = 0;
        model.blocks.forEach(function (b) {
          if (!hasReq(b, r.id)) return;
          var q = hc.byId[b.id], full = r.metric === 'volume' ? blockVolume(b) : blockArea(b);
          insideVal += q ? full * (1 - q.shareBlock) : full;
        });
        statusIn = statusOf(insideVal);
      }
      return { req: r, achieved: achieved, n: n, shared: shared, blocks: names, status: status, marginShall: mS, marginShould: mH, margin: mShow, inside: insideVal, statusInside: statusIn };
    });
  }

  var STATUS_LABEL = { ok: 'Within range', excess: 'Excess over should', fail: 'Not met', none: 'No target' };
  /* signed margin against a target, in percent: plus is better than the target (more for "at least", less for "at most") */
  function margin(val, sense, thr) {
    if (thr == null || thr === 0) return null;
    return (sense === 'max' ? (thr - val) : (val - thr)) / Math.abs(thr) * 100;
  }
  function mpc(m) { return m == null ? null : Math.round(m * 10) / 10; }
  function fmtMargin(m) { return m == null ? '' : (m >= 0 ? '+' : '\u2212') + Math.abs(m).toFixed(Math.abs(m) < 10 ? 1 : 0) + '%'; }
  function statusText(status, r) {
    var only = r.shall == null;
    return status === 'ok' ? (only ? 'Meets should' : 'Meets shall') : status === 'fail' ? (only ? 'Fails should' : 'Fails shall') : status === 'excess' ? 'Excess over should' : 'No target';
  }

  /* ---------- project model ---------- */
  /* a new, blank project: the task-related group starts without sub-groups (the user adds their own); ship systems as usual */
  function blankProject(name) {
    var m = emptyProject(name);
    m.groups = m.groups.filter(function (g) { return g.parent !== 'g_task'; });
    return m;
  }
  function emptyProject(name) {
    return { app: FORMAT, version: VERSION, name: name || 'Untitled design', groups: defaultGroups(), requirements: [], blocks: [], hulls: [], rho: 1.025, draught: null, waterline: true, float: false, structPct: DEFAULT_STRUCT_PCT };
  }

  function mkBlock(id, name, shape, group, req, x0, x1, y0, y1, z0, z1) {
    return {
      id: id, name: name, shape: shape, group: group, reqs: req ? [req] : [],
      position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
      size: [x1 - x0, y1 - y0, z1 - z0],
      rotation: [0, 0, 0], areaOverride: null, hidden: false, density: null, fill: 100, massOverride: null, freeSurface: false, deck: false, gt: true
    };
  }

  /* Examples keep only the groups they use (and the parents of those): New still starts from the full Levander set. */
  function pruneGroups(m) {
    var used = {};
    m.blocks.forEach(function (b) { used[b.group] = true; });
    var gm = groupMap(m), keep = {};
    Object.keys(used).forEach(function (id) {
      var g = gm[id], guard = 0;
      while (g && guard++ < 50) { keep[g.id] = true; g = g.parent ? gm[g.parent] : null; }
    });
    m.groups = m.groups.filter(function (g) { return keep[g.id]; });
    return m;
  }
  /* mass settings of an example: group densities, and per block density, fill or typed mass */
  function gdens(m, id, d) { m.groups.forEach(function (g) { if (g.id === id) g.density = d; }); }
  /* The example floats at its own weight: the chosen draught is set to the level draught that carries it. Float stays off. */
  function settle(m) {
    m.float = true; autoFloat(m); m.float = false;
    m.draught = Math.round(m.draught * 100) / 100; syncDraught(m);
  }
  function tune(m, id, patch) { m.blocks.forEach(function (b) { if (b.id === id) for (var k in patch) b[k] = patch[k]; }); }

  /* Very small teaching example: 5 blocks, 3 requirements. */
  function simpleExample() {
    var m = emptyProject('Simple example');
    m.requirements = [
      { id: 'r_cargo', name: 'Cargo volume',      metric: 'volume', sense: 'min', shall: 400, should: 600 },
      { id: 'r_acc',   name: 'Accommodation area', metric: 'area',  sense: 'min', shall: 70,  should: 100 },
      { id: 'r_loa',   name: 'Overall length',    metric: 'length', sense: 'max', shall: 32,  should: 30 }
    ];
    m.blocks = [
      mkBlock('b1', 'Cargo hold',      'box', 'g_cargo',  'r_cargo', 12, 30, -4, 4, 0, 3.5),
      mkBlock('b2', 'Machinery room',  'box', 'g_mach',   null,      0, 8, -4, 4, 0, 4),
      mkBlock('b3', 'Fuel oil tanks',  'box', 'g_tanks',  null,      8, 12, -4, 4, 0, 4),
      mkBlock('b4', 'Accommodation',   'box', 'g_acc',    'r_acc',   20, 30, -4, 4, 4, 7),
      mkBlock('b5', 'Wheelhouse',      'box', 'g_outfit', null,      22, 28, -3, 3, 7, 9.4)
    ];
    m.hulls = [addHullTo(m, fitHull(m, 'cargo', 4, 2.4))];
    tune(m, 'b1', { fill: 55 });                       // hold partly full, which also trims the vessel level
    tune(m, 'b3', { fill: 98 });
    pruneGroups(m);
    settle(m);
    return m;
  }

  /* Small catamaran, about 24 m: two slender demihulls with machinery, tanks and crew cabins, and a cross-deck saloon above. */
  function catamaranExample() {
    var m = emptyProject('Catamaran example');
    m.requirements = [
      { id: 'r_pax',  name: 'Passenger saloon area', metric: 'area',   sense: 'min', shall: 150, should: 210 },
      { id: 'r_fuel', name: 'Fuel oil volume',       metric: 'volume', sense: 'min', shall: 25,  should: 60 },
      { id: 'r_loa',  name: 'Overall length',        metric: 'length', sense: 'max', shall: 26,  should: 20 },
      { id: 'r_beam', name: 'Overall beam',          metric: 'beam',   sense: 'max', shall: 14,  should: 13 }
    ];
    var B = [];
    [['P', 4.1, 5.9], ['S', -5.9, -4.1]].forEach(function (s, i) {
      var k = i * 3;
      B.push(mkBlock('b' + (k + 1), 'Engine room ' + s[0],  'box', 'g_mach',  null,     2, 9,    s[1], s[2], 0.4, 3));
      B.push(mkBlock('b' + (k + 2), 'Fuel oil tank ' + s[0], 'box', 'g_tanks', 'r_fuel', 9, 15,   s[1], s[2], 0.4, 3));
      B.push(mkBlock('b' + (k + 3), 'Crew cabins ' + s[0],  'box', 'g_acc',   null,     15, 21,   s[1], s[2], 0.4, 3));
    });
    B.push(mkBlock('b7', 'Aft working deck',  'box', 'g_cargo',  null,    0, 6,   -6.6, 6.6, 3.2, 3.5));
    B.push(mkBlock('b8', 'Passenger saloon',  'box', 'g_acc',    'r_pax', 6, 21,  -6.6, 6.6, 3.2, 6.2));
    B.push(mkBlock('b9', 'Wheelhouse',        'box', 'g_outfit', null,    14, 19, -3, 3,     6.2, 8.6));
    m.blocks = B;
    m.hulls = [];
    [5, -5].forEach(function (y) { m.hulls.push(addHullTo(m, fitHull(m, 'demihull', 3, 1.6, { y: y, beam: 3.2 }))); });
    gdens(m, 'g_mach', 0.25); gdens(m, 'g_acc', 0.08); gdens(m, 'g_outfit', 0.06);   // light craft: lightly built spaces
    m.structPct = 15;                                   // aluminium hull
    tune(m, 'b2', { fill: 60 }); tune(m, 'b5', { fill: 60 });
    pruneGroups(m);
    settle(m);
    return m;
  }

  /* Small trimaran, about 36 m: a main hull with the machinery and accommodation, two small outriggers with tanks, and a cross deck above. */
  function trimaranExample() {
    var m = emptyProject('Trimaran example');
    m.requirements = [
      { id: 'r_acc',  name: 'Accommodation area', metric: 'area',   sense: 'min', shall: 150, should: 250 },
      { id: 'r_fuel', name: 'Fuel oil volume',    metric: 'volume', sense: 'min', shall: 25,  should: 50 },
      { id: 'r_loa',  name: 'Overall length',     metric: 'length', sense: 'max', shall: 40,  should: 33 },
      { id: 'r_beam', name: 'Overall beam',       metric: 'beam',   sense: 'max', shall: 14,  should: 12.5 }
    ];
    var B = [];
    B.push(mkBlock('b1', 'Steering and waterjet room', 'box', 'g_mach',   null,     1, 6,   -1.3, 1.3, 0.4, 3.5));
    B.push(mkBlock('b2', 'Engine room',                'box', 'g_mach',   null,     6, 16,  -1.3, 1.3, 0.4, 3.5));
    B.push(mkBlock('b3', 'Fuel oil tank',              'box', 'g_tanks',  'r_fuel', 24, 30, -1.3, 1.3, 0.4, 3.5));
    B.push(mkBlock('b4', 'Crew cabins',                'box', 'g_acc',    'r_acc',  16, 24, -1.3, 1.3, 0.4, 3.5));
    B.push(mkBlock('b5', 'Bow thruster room',          'box', 'g_outfit', null,     30, 34, -1.3, 1.3, 0.4, 3.5));
    B.push(mkBlock('b6', 'Ballast tank P',             'box', 'g_tanks',  null,     20, 32, 4.7, 5.7,  0.4, 3.5));
    B.push(mkBlock('b7', 'Ballast tank S',             'box', 'g_tanks',  null,     20, 32, -5.7, -4.7, 0.4, 3.5));
    B.push(mkBlock('b8', 'Aft working deck',           'box', 'g_cargo',  null,     0, 10,  -6.4, 6.4, 3.7, 4));
    B.push(mkBlock('b9', 'Accommodation and mess',     'box', 'g_acc',    'r_acc',  10, 28, -6, 6,     3.7, 6.7));
    B.push(mkBlock('b10', 'Wheelhouse',                'box', 'g_outfit', null,     22, 27, -2.5, 2.5, 6.7, 9.1));
    m.blocks = B;
    m.hulls = [addHullTo(m, fitHull(m, 'demihull', 3.5, 2.0, { y: 0, beam: 3.6 }))];
    [5.2, -5.2].forEach(function (y) { m.hulls.push(addHullTo(m, fitHull(m, 'demihull', 3.5, 0.9, { y: y, beam: 1.6 }))); });
    gdens(m, 'g_mach', 0.3); gdens(m, 'g_acc', 0.04); gdens(m, 'g_outfit', 0.06);
    m.structPct = 15;
    tune(m, 'b3', { fill: 100 }); tune(m, 'b6', { fill: 100 }); tune(m, 'b7', { fill: 100 });   // ballast and fuel forward, aft deck lightly loaded: level trim
    tune(m, 'b8', { fill: 38 });
    pruneGroups(m);
    settle(m);
    return m;
  }

  /* Very simplified R/V Gunnerus. Dimensions: LOA 36.25 m, B 9.6 m, depth to 1-deck 4.287 m, A-deck 6.6 m.
     Space areas and tank volumes from the GA metadata (shiplab.github.io/gunnerus); positions are approximate. */
  /* Approximate table of offsets of R/V Gunnerus (half-breadths, m; rows up to 4 m height; from the vessel.js data in shiplab/gunnerus, CC BY-NC 4.0) */
  var GUN_OFFS = { xs: [0.0,0.58,1.16,1.74,2.32,2.9,3.48,4.06,4.64,5.22,5.8,6.38,6.96,7.54,8.12,8.7,9.28,9.86,10.44,11.02,11.6,12.18,12.76,13.34,13.92,14.5,15.08,15.66,16.24,16.82,17.4,17.98,18.56,19.14,19.72,20.3,20.88,21.46,22.04,22.62,23.2,23.78,24.36,24.94,25.52,26.1,26.68,27.26,27.84,28.42,29.0,29.58,30.16,30.74,31.32,31.9,32.48,33.06,33.64,34.22,34.8,35.38,35.96,36.25], zs: [0.0,0.5,1.0,1.5,2.0,2.5,3.0,3.5,4.0], half: [
    [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.114,0.2,0.19,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,null,null,null,null,null,null,null],
    [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.344,1.047,1.666,3.396,3.409,3.43,3.476,3.598,3.704,3.747,3.731,3.648,3.528,3.397,3.258,3.116,2.972,2.825,2.675,2.523,2.369,2.214,2.058,1.901,1.745,1.59,1.437,1.285,1.135,0.987,0.838,0.69,0.542,0.395,0.263,0.168,0.084,0.0,0.0,0.0,null,null,null,null],
    [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.546,1.345,3.51,3.512,3.52,3.657,3.903,4.092,4.223,4.32,4.391,4.447,4.474,4.491,4.494,4.482,4.457,4.418,4.367,4.296,4.205,4.096,3.97,3.832,3.682,3.522,3.355,3.179,2.997,2.812,2.622,2.429,2.235,2.043,1.853,1.667,1.482,1.3,1.12,0.943,0.77,0.607,0.457,0.3,0.127,0.0,null,null,null],
    [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.544,1.099,1.692,3.489,3.519,3.526,3.734,4.028,4.253,4.411,4.522,4.601,4.657,4.695,4.727,4.736,4.746,4.753,4.742,4.732,4.717,4.698,4.679,4.646,4.598,4.54,4.474,4.392,4.292,4.18,4.054,3.909,3.746,3.571,3.391,3.207,3.013,2.816,2.617,2.417,2.216,2.014,1.825,1.636,1.449,1.263,1.09,0.942,0.795,0.649,0.476,0.166,0.0,null,null],
    [0.708,0.938,1.211,1.513,1.828,2.177,2.966,3.131,3.288,3.625,3.91,4.151,4.343,4.483,4.587,4.665,4.721,4.761,4.785,4.797,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.796,4.784,4.772,4.739,4.702,4.656,4.598,4.529,4.447,4.352,4.242,4.114,3.966,3.798,3.612,3.417,3.213,3.006,2.797,2.59,2.384,2.181,1.982,1.788,1.597,1.409,1.233,1.069,0.923,0.786,0.63,0.361,0.0,null,null],
    [3.421,3.6,3.772,3.937,4.097,4.248,4.377,4.486,4.575,4.648,4.705,4.748,4.779,4.796,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.801,4.799,4.786,4.757,4.721,4.676,4.62,4.551,4.465,4.361,4.239,4.101,3.945,3.772,3.582,3.376,3.156,2.929,2.701,2.474,2.248,2.027,1.811,1.6,1.395,1.201,1.019,0.845,0.689,0.537,0.174,0.0,null,null],
    [4.571,4.622,4.667,4.706,4.74,4.766,4.786,4.797,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.803,4.801,4.8,4.794,4.773,4.74,4.694,4.633,4.556,4.464,4.355,4.229,4.088,3.929,3.754,3.56,3.349,3.121,2.884,2.639,2.387,2.129,1.865,1.595,1.321,1.042,0.759,0.472,0.181,0.0,0.0,0.0,null,null],
    [4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.805,4.801,4.802,4.801,4.797,4.778,4.743,4.693,4.628,4.551,4.462,4.36,4.241,4.103,3.947,3.776,3.589,3.382,3.157,2.916,2.658,2.376,2.069,1.74,1.377,0.95,0.452,0.0,0.0,0.0,0.0,0.0,null,null],
    [4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.805,4.8,4.803,4.802,4.801,4.798,4.777,4.738,4.686,4.624,4.552,4.471,4.375,4.26,4.129,3.986,3.827,3.647,3.444,3.216,2.97,2.703,2.397,2.047,1.657,1.222,0.731,0.084,0.0,0.0,0.0,0.0,null,null]
  ] };

  function gunnerusExample() {
    var m = emptyProject('Gunnerus (simplified)');
    m.groups.push({ id: 'g_res', name: 'Research and survey', color: '#c2548a', parent: 'g_task', visible: true });
    m.requirements = [
      { id: 'r_hold', name: 'Cargo hold volume',        metric: 'volume', sense: 'min', shall: 35,  should: 40 },
      { id: 'r_lab',  name: 'Labs and data room area',  metric: 'area',   sense: 'min', shall: 36,  should: 40 },
      { id: 'r_work', name: 'Aft working deck area',    metric: 'area',   sense: 'min', shall: 70,  should: 90 },
      { id: 'r_cab',  name: 'Cabin area',               metric: 'area',   sense: 'min', shall: 100, should: 120 },
      { id: 'r_fuel', name: 'Fuel oil volume',          metric: 'volume', sense: 'min', shall: 55,  should: 65 },
      { id: 'r_loa',  name: 'Overall length',           metric: 'length', sense: 'max', shall: 38,  should: 36 },
      { id: 'r_beam', name: 'Overall beam',             metric: 'beam',   sense: 'max', shall: 10,  should: 9.6 }
    ];
    var B = [];
    // Below 1-deck (z 1.0 to 4.287 above the tank top)
    B.push(mkBlock('b1',  'Engine room',                 'box', 'g_mach',   null,     10, 20, -4.2, 4.2, 2, 4.287));
    B.push(mkBlock('b2',  'ECR and switchboards',        'box', 'g_mach',   null,     20, 23, -3.7, 3.7, 2, 4.287));
    B.push(mkBlock('b3',  'Cabins below 1-deck',         'box', 'g_acc',    'r_cab',  0.5, 10, -3.7, 3.7, 2.7, 4.287));
    B.push(mkBlock('b4',  'Cargo hold',                  'box', 'g_cargo',  'r_hold', 26, 30.5, -1.6, 1.6, 1.7, 4.287));
    B.push(mkBlock('b5',  'Thruster room',               'box', 'g_outfit', null,     31, 32.5, -0.5, 0.5, 3.5, 4.287));
    // Tank top (z 0 to 1.0)
    B.push(mkBlock('b6',  'Fuel oil tank P',             'box', 'g_tanks',  'r_fuel', 13.3, 22.5, 0.4, 2.5, 0.5, 2));
    B.push(mkBlock('b7',  'Fuel oil tank S',             'box', 'g_tanks',  'r_fuel', 13.3, 22.5, -2.5, -0.4, 0.5, 2));
    B.push(mkBlock('b8',  'Fresh and technical water',   'box', 'g_tanks',  null,     22.5, 27.5, -1.5, 1.5, 0.6, 2));
    B.push(mkBlock('b9',  'Waste and sludge tanks',      'box', 'g_tanks',  null,     23, 26, -1.7, 1.7, 2, 4.287));
    // 1-deck (z 4.287 to 6.6)
    B.push(mkBlock('b10', 'Aft working deck',            'box', 'g_res',    'r_work', 0, 9, -4.5, 4.5, 4.287, 4.587));
    B.push(mkBlock('b11', 'Wet lab, dry lab, data room', 'box', 'g_res',    'r_lab',  9, 12.9, -4.8, 4.8, 4.287, 6.6));
    B.push(mkBlock('b12', 'Cabins 1-deck',               'box', 'g_acc',    'r_cab',  12.9, 16, -4.8, 4.8, 4.287, 6.6));
    B.push(mkBlock('b13', 'Workshop and stores',         'box', 'g_outfit', null,     16, 19, -4.8, 4.8, 4.287, 6.6));
    // A-deck (z 6.6 to 8.9) and wheelhouse
    B.push(mkBlock('b14', 'A-deck: day room and galley', 'box', 'g_acc',    null,     12.9, 19, -4.2, 4.2, 6.6, 8.9));
    B.push(mkBlock('b15', 'Wheelhouse',                  'box', 'g_outfit', null,     14, 18, -2.5, 2.5, 8.9, 11.4));
    m.blocks = B;
    var gh = libraryHull('gunnerus');
    gh.x = -0.8;                                       // places the hull so that it floats level
    m.hulls = [addHullTo(m, gh)];
    m.hulls[0].name = HULL_LIBRARY.gunnerus.label;
    tune(m, 'b1', { massOverride: 140 });              // engine room: weight typed in
    tune(m, 'b6', { fill: 40 }); tune(m, 'b7', { fill: 40 }); tune(m, 'b8', { fill: 80 });
    pruneGroups(m);
    settle(m); m.draught = Math.round((m.draught + 0.01) * 100) / 100; syncDraught(m);
    return m;
  }

  /* Illustrative PSV, divided with Levander's taxonomy. x forward from the aft end, y to port, z up from baseline. */
  function exampleProject() {
    var m = emptyProject('PSV example');
    m.requirements = [
      { id: 'r_liq',   name: 'Liquid cargo volume',  metric: 'volume', sense: 'min', shall: 2000, should: 2800 },
      { id: 'r_deck',  name: 'Cargo deck area',      metric: 'area',   sense: 'min', shall: 600,  should: 800 },
      { id: 'r_dry',   name: 'Dry bulk volume',      metric: 'volume', sense: 'min', shall: 200,  should: 300 },
      { id: 'r_fuel',  name: 'Fuel oil volume',      metric: 'volume', sense: 'min', shall: 800,  should: 1200 },
      { id: 'r_cabin', name: 'Cabin area',           metric: 'area',   sense: 'min', shall: 600,  should: 700 },
      { id: 'r_loa',   name: 'Overall length',       metric: 'length', sense: 'max', shall: 90,   should: 85 },
      { id: 'r_beam',  name: 'Overall beam',         metric: 'beam',   sense: 'max', shall: 20,   should: 18 }
    ];
    var B = [];
    // Task related systems / Cargo spaces
    B.push(mkBlock('b1',  'Open cargo deck',       'box',      'g_cargo',  'r_deck', 0, 52, -7.5, 7.5, 7.5, 7.9));
    B.push(mkBlock('b2',  'Brine tanks',           'box',      'g_cargo',  'r_liq',  6, 24, -6, 6, 1.5, 7.5));
    B.push(mkBlock('b3',  'Drill water tanks',     'box',      'g_cargo',  'r_liq',  24, 42, -6, 6, 1.5, 7.5));
    B.push(mkBlock('b4',  'Dry bulk tank P',       'cylinder', 'g_cargo',  'r_dry',  42, 47, 0.8, 5.8, 1.5, 7.5));
    B.push(mkBlock('b5',  'Dry bulk tank S',       'cylinder', 'g_cargo',  'r_dry',  42, 47, -5.8, -0.8, 1.5, 7.5));
    B.push(mkBlock('b6',  'Cargo pump room',       'box',      'g_cargo',  null,     47, 51, -6, 6, 1.5, 7.5));
    // Ship systems / Machinery
    B.push(mkBlock('b7',  'Engine room',           'box',      'g_mach',   null,     51, 67, -8, 8, 1.5, 7.5));
    B.push(mkBlock('b8',  'Auxiliary machinery',   'box',      'g_mach',   null,     67, 73, -6, 6, 1.5, 7.5));
    B.push(mkBlock('b9',  'Engine casing and funnel', 'box',   'g_mach',   null,     68, 74, -3, 3, 10.3, 18.7));
    // Ship systems / Tanks and voids
    B.push(mkBlock('b10', 'Fuel oil tanks',        'box',      'g_tanks',  'r_fuel', 6, 50, -8, 8, 0, 1.5));
    B.push(mkBlock('b11', 'Ballast tanks',         'box',      'g_tanks',  null,     51, 73, -8, 8, 0, 1.5));
    B.push(mkBlock('b12', 'Forepeak tank',         'box',      'g_tanks',  null,     79, 85, -4, 4, 0, 3.5));
    // Ship systems / Ship outfitting
    B.push(mkBlock('b13', 'Steering gear room',    'box',      'g_outfit', null,     0, 6, -6, 6, 1.5, 7.5));
    B.push(mkBlock('b14', 'Bow thruster room',     'box',      'g_outfit', null,     73, 79, -5, 5, 1.5, 5.5));
    B.push(mkBlock('b15', 'Chain locker P',        'cylinder', 'g_outfit', null,     79.25, 82.75, 0.45, 3.95, 3.5, 8.0));
    B.push(mkBlock('b16', 'Chain locker S',        'cylinder', 'g_outfit', null,     79.25, 82.75, -3.95, -0.45, 3.5, 8.0));
    B.push(mkBlock('b17', 'Wheelhouse',            'box',      'g_outfit', null,     50, 60, -8.5, 8.5, 15.9, 18.7));
    // Ship systems / Accommodation
    B.push(mkBlock('b18', 'Cabins A-deck',         'box',      'g_acc',    'r_cabin', 52, 74, -8, 8, 7.5, 10.3));
    B.push(mkBlock('b19', 'Cabins B-deck',         'box',      'g_acc',    'r_cabin', 52, 66, -7.5, 7.5, 10.3, 13.1));
    B.push(mkBlock('b20', 'Mess and galley',       'box',      'g_acc',    null,     52, 62, -7, 7, 13.1, 15.9));
    m.blocks = B;
    m.hulls = [addHullTo(m, fitHull(m, 'osv', 7.9, 5.5))];
    tune(m, 'b2', { fill: 100 }); tune(m, 'b3', { fill: 100 });   // liquid cargo tanks full
    tune(m, 'b10', { fill: 95 });
    pruneGroups(m);
    settle(m);
    return m;
  }

  /* The blocks of the larger examples are made to fit the hull: each block that is not a wing (P or S) block is made symmetrical and
     no wider than the hull at its lowest edge, a wing block keeps its inner edge and is cut at the hull. Blocks that end up too thin are kept. */
  function fitWidths(m, frac) {
    var h = m.hulls[0];
    m.blocks.forEach(function (b) {
      var x0 = b.position[0] - b.size[0] / 2, x1 = b.position[0] + b.size[0] / 2, z0 = b.position[2] - b.size[2] / 2;
      var y0 = b.position[1] - b.size[1] / 2, y1 = b.position[1] + b.size[1] / 2, t = Math.min(1, Math.max(0, z0 / h.depth)), r = hullXRange(h, t), half = Infinity, i, x;
      for (i = 0; i <= 12; i++) {
        x = x0 + (x1 - x0) * i / 12;
        half = Math.min(half, x < r[0] || x > r[1] ? 0 : hullHalf(h, (x - r[0]) / (r[1] - r[0]), t));
      }
      half = Math.round(half * frac * 20) / 20;
      var wing = y0 > 0.05 || y1 < -0.05, a = y0, c = y1;
      if (wing) { if (y0 > 0) c = Math.min(y1, half); else a = Math.max(y0, -half); if (c - a < 0.2) { a = y0; c = y1; } }
      else { c = Math.min(y1, half); a = -c; }
      b.position[1] = (a + c) / 2; b.size[1] = c - a;
    });
  }

  /* Illustrative feeder container ship (about 900 TEU). Holds below the main deck, container stacks on the hatches,
     accommodation and engine room aft. Space for containers is counted as volume (about 38 m3 per TEU). */
  function containerShipExample() {
    var m = emptyProject('Container ship (feeder)');
    m.requirements = [
      { id: 'r_hold',  name: 'Container space in the holds', metric: 'volume', sense: 'min', shall: 11500, should: 13000 },
      { id: 'r_stack', name: 'Container space on deck',      metric: 'volume', sense: 'min', shall: 13000, should: 15500 },
      { id: 'r_acc',   name: 'Accommodation area',           metric: 'area',   sense: 'min', shall: 800,   should: 1150 },
      { id: 'r_fuel',  name: 'Fuel oil volume',              metric: 'volume', sense: 'min', shall: 450,   should: 600 },
      { id: 'r_loa',   name: 'Overall length',               metric: 'length', sense: 'max', shall: 140,   should: 128 },
      { id: 'r_beam',  name: 'Overall beam',                 metric: 'beam',   sense: 'max', shall: 24,    should: 19 }
    ];
    m.hulls = [addHullTo(m, { type: 'cargo', x: 0, y: 0, loa: 138, beam: 23, depth: 10.2, draught: 7.4, shape: { par: 0.42, c: 2.0, ua: 0.18, ps: 0.6, fb: 0.85 } })];
    var B = [];
    B.push(mkBlock('b1',  'Container hold 1',        'box', 'g_cargo',  'r_hold',  28, 52,  -9.4, 9.4, 1.8, 10.2));
    B.push(mkBlock('b2',  'Container hold 2',        'box', 'g_cargo',  'r_hold',  52, 76,  -9.4, 9.4, 1.8, 10.2));
    B.push(mkBlock('b3',  'Container hold 3',        'box', 'g_cargo',  'r_hold',  76, 100, -9.2, 9.2, 1.8, 10.2));
    B.push(mkBlock('b4',  'Container hold 4',        'box', 'g_cargo',  'r_hold',  100, 118, -8.2, 8.2, 1.8, 10.2));
    B.push(mkBlock('b5',  'Deck stack 1',            'box', 'g_cargo',  'r_stack', 28, 52,  -9.6, 9.6, 10.2, 18.9));
    B.push(mkBlock('b6',  'Deck stack 2',            'box', 'g_cargo',  'r_stack', 52, 76,  -9.6, 9.6, 10.2, 18.9));
    B.push(mkBlock('b7',  'Deck stack 3',            'box', 'g_cargo',  'r_stack', 76, 100, -9.6, 9.6, 10.2, 18.9));
    B.push(mkBlock('b8',  'Deck stack 4',            'box', 'g_cargo',  'r_stack', 100, 118, -8.0, 8.0, 10.2, 18.9));
    B.push(mkBlock('b9',  'Engine room',             'box', 'g_mach',   null,      6, 26,   -7.5, 7.5, 1.8, 10.2));
    B.push(mkBlock('b10', 'Double bottom fuel tanks','box', 'g_tanks',  'r_fuel',  6, 26,   -7.5, 7.5, 0, 1.8));
    B.push(mkBlock('b11', 'Double bottom ballast',   'box', 'g_tanks',  null,      28, 118, -8.5, 8.5, 0, 1.8));
    B.push(mkBlock('b12', 'Forepeak tank',           'box', 'g_tanks',  null,      120, 130, -4.5, 4.5, 0, 8));
    B.push(mkBlock('b13', 'Bow thruster room',       'box', 'g_outfit', null,      118, 124, -4.5, 4.5, 1.8, 7));
    B.push(mkBlock('b14', 'Steering gear room',      'box', 'g_outfit', null,      0, 6,    -5, 5, 1.8, 8));
    ['A', 'B', 'C', 'D'].forEach(function (d, i) { B.push(mkBlock('b' + (15 + i), 'Accommodation deck ' + d, 'box', 'g_acc', 'r_acc', 8, 24, -9, 9, 10.2 + 2.8 * i, 13 + 2.8 * i)); });
    B.push(mkBlock('b19', 'Wheelhouse',              'box', 'g_outfit', null,      12, 20,  -9.5, 9.5, 21.4, 24));
    m.blocks = B; fitWidths(m, 0.97);
    gdens(m, 'g_cargo', 0.36); gdens(m, 'g_mach', 0.22); gdens(m, 'g_acc', 0.07); gdens(m, 'g_outfit', 0.1);
    m.structPct = 22;
    tune(m, 'b11', { fill: 30 }); tune(m, 'b12', { fill: 0 }); tune(m, 'b10', { fill: 90 });   // light ballast, forepeak empty
    [100, 100, 80, 85].forEach(function (f, i) { tune(m, 'b' + (i + 1), { fill: f }); });   // holds
    [100, 100, 60, 55].forEach(function (f, i) { tune(m, 'b' + (i + 5), { fill: f }); });   // deck stacks, lighter forward
    pruneGroups(m);
    settle(m);
    return m;
  }

  /* Illustrative product tanker (about 14,000 dwt), double hull. Three rows of cargo tanks, centre and wing, ballast
     in the double bottom and side tanks. Tanks that are part full are marked Free surface. */
  function tankerExample() {
    var m = emptyProject('Tanker (product, double hull)');
    m.requirements = [
      { id: 'r_cargo', name: 'Cargo oil volume',   metric: 'volume', sense: 'min', shall: 8500,  should: 10000 },
      { id: 'r_acc',   name: 'Accommodation area', metric: 'area',   sense: 'min', shall: 700,   should: 950 },
      { id: 'r_fuel',  name: 'Fuel oil volume',    metric: 'volume', sense: 'min', shall: 350,   should: 450 },
      { id: 'r_loa',   name: 'Overall length',     metric: 'length', sense: 'max', shall: 135,   should: 115 },
      { id: 'r_beam',  name: 'Overall beam',       metric: 'beam',   sense: 'max', shall: 22,    should: 19 }
    ];
    m.hulls = [addHullTo(m, { type: 'cargo', x: 0, y: 0, loa: 128, beam: 21, depth: 9.2, draught: 7.5, shape: { par: 0.6, c: 2.8, ua: 0.12, ps: 0.85, fb: 0.95 } })];
    var B = [], rows = [[26, 52], [52, 78], [78, 104]], n = 1;
    rows.forEach(function (r, i) {
      B.push(mkBlock('b' + (n++), 'Cargo tank ' + (i + 1) + ' centre', 'box', 'g_cargo', 'r_cargo', r[0], r[1], -3.6, 3.6, 1.8, 9.2));
      B.push(mkBlock('b' + (n++), 'Cargo tank ' + (i + 1) + ' P',      'box', 'g_cargo', 'r_cargo', r[0], r[1], 3.6, 8.2, 1.8, 9.2));
      B.push(mkBlock('b' + (n++), 'Cargo tank ' + (i + 1) + ' S',      'box', 'g_cargo', 'r_cargo', r[0], r[1], -8.2, -3.6, 1.8, 9.2));
    });
    B.push(mkBlock('b10', 'Ballast side tank P',     'box', 'g_tanks',  null,     26, 104, 8.2, 9.8, 1.8, 9.2));
    B.push(mkBlock('b11', 'Ballast side tank S',     'box', 'g_tanks',  null,     26, 104, -9.8, -8.2, 1.8, 9.2));
    B.push(mkBlock('b12', 'Double bottom ballast',   'box', 'g_tanks',  null,     26, 104, -9.6, 9.6, 0, 1.8));
    B.push(mkBlock('b13', 'Forepeak tank',           'box', 'g_tanks',  null,     106, 116, -4.5, 4.5, 0, 8));
    B.push(mkBlock('b14', 'Cargo pump room',         'box', 'g_cargo',  null,     22, 26,  -8, 8, 0, 9.2));
    B.push(mkBlock('b15', 'Engine room',             'box', 'g_mach',   null,     6, 22,   -7, 7, 1.8, 9.2));
    B.push(mkBlock('b16', 'Fuel oil tanks',          'box', 'g_tanks',  'r_fuel', 6, 22,   -7, 7, 0, 1.8));
    B.push(mkBlock('b17', 'Steering gear room',      'box', 'g_outfit', null,     0, 6,    -4.5, 4.5, 1.8, 8));
    ['A', 'B', 'C', 'D'].forEach(function (d, i) { B.push(mkBlock('b' + (18 + i), 'Accommodation deck ' + d, 'box', 'g_acc', 'r_acc', 6, 20, -8, 8, 9.2 + 2.8 * i, 12 + 2.8 * i)); });
    B.push(mkBlock('b22', 'Wheelhouse',              'box', 'g_outfit', null,     10, 17,  -8.5, 8.5, 20.4, 23));
    m.blocks = B; fitWidths(m, 0.97);
    gdens(m, 'g_cargo', 0.85); gdens(m, 'g_mach', 0.22); gdens(m, 'g_acc', 0.07); gdens(m, 'g_outfit', 0.1);
    m.structPct = 20;
    tune(m, 'b10', { fill: 0 }); tune(m, 'b11', { fill: 0 }); tune(m, 'b12', { fill: 0 }); tune(m, 'b13', { fill: 0 }); tune(m, 'b16', { fill: 90 });   // loaded: ballast tanks empty
    tune(m, 'b1', { fill: 50 }); tune(m, 'b2', { fill: 90 }); tune(m, 'b3', { fill: 90 });   // row 1 part full
    tune(m, 'b7', { fill: 50, freeSurface: true });     // a slack centre tank
    ['b1', 'b2', 'b3'].forEach(function (id) { tune(m, id, { freeSurface: true }); });   // the part-full tanks of row 1 also have a free surface: free surface
    pruneGroups(m);
    settle(m);
    return m;
  }


  /* Illustrative anchor handling tug supply vessel (AHTS), about 88 m and 200 t bollard pull. Open working deck aft with the stern
     roller, shark jaws, towing pins and the A-frame, liquid tanks below it, rig chain lockers, winches and hydraulic power forward of
     the deck, machinery amidships, accommodation and wheelhouse forward. The weights of the handling equipment are typed (tonnes). */
  function ahtsExample() {
    var m = emptyProject('AHTS (anchor handling tug supply)');
    m.requirements = [
      { id: 'r_deck',  name: 'Working deck area',           metric: 'area',   sense: 'min', shall: 650,  should: 750 },
      { id: 'r_liq',   name: 'Liquid cargo volume',         metric: 'volume', sense: 'min', shall: 2500, should: 3200 },
      { id: 'r_chain', name: 'Rig chain locker volume',     metric: 'volume', sense: 'min', shall: 1000, should: 1200 },
      { id: 'r_fuel',  name: 'Fuel oil volume',             metric: 'volume', sense: 'min', shall: 800,  should: 1100 },
      { id: 'r_cabin', name: 'Cabin area',                  metric: 'area',   sense: 'min', shall: 500,  should: 650 },
      { id: 'r_loa',   name: 'Overall length',              metric: 'length', sense: 'max', shall: 95,   should: 90 },
      { id: 'r_beam',  name: 'Overall beam',                metric: 'beam',   sense: 'max', shall: 24,   should: 22 }
    ];
    var B = [], n = 1;
    function add(name, shape, grp, req, x0, x1, y0, y1, z0, z1) { B.push(mkBlock('b' + (n++), name, shape, grp, req, x0, x1, y0, y1, z0, z1)); return 'b' + (n - 1); }
    var typed = [];                                   // [id, tonnes]
    function eq(name, shape, grp, x0, x1, y0, y1, z0, z1, t) { typed.push([add(name, shape, grp, null, x0, x1, y0, y1, z0, z1), t]); }
    // Task related systems / Cargo spaces
    add('Open working deck',        'box', 'g_cargo', 'r_deck', 3, 40, -10.5, 10.5, 9.1, 9.5);
    add('Drill water tanks P',      'box', 'g_cargo', 'r_liq',  6, 32, 3.5, 9.5, 1.5, 7.5);
    add('Drill water tanks S',      'box', 'g_cargo', 'r_liq',  6, 32, -9.5, -3.5, 1.5, 7.5);
    add('Brine tank',               'box', 'g_cargo', 'r_liq',  6, 19, -3.5, 3.5, 1.5, 7.5);
    add('Base oil tank',            'box', 'g_cargo', 'r_liq',  19, 32, -3.5, 3.5, 1.5, 7.5);
    add('Cargo pump room',          'box', 'g_cargo', null,     32, 38, -8, 8, 1.5, 7.5);
    // Task related systems / Anchor handling and towing
    eq('Stern roller',              'box', 'g_ah', 0, 3, -2, 2, 7.5, 11.5, 110);
    eq('Shark jaws P',              'box', 'g_ah', 10, 11, 0.8, 2.8, 9.5, 12.5, 10);
    eq('Shark jaws S',              'box', 'g_ah', 10, 11, -2.8, -0.8, 9.5, 12.5, 10);
    eq('Towing pins P',             'box', 'g_ah', 15, 17, 4, 8, 9.5, 12.5, 20);
    eq('Towing pins S',             'box', 'g_ah', 15, 17, -8, -4, 9.5, 12.5, 20);
    eq('Stern A-frame',             'box', 'g_ah', 3.6, 4.8, -5.5, 5.5, 9.5, 22.7, 40);
    eq('Torpedo pile handler',      'box', 'g_ah', 22, 30, 8, 10, 9.5, 11.5, 60);
    eq('Deck crane',                'box', 'g_ah', 36, 38, -10.5, -8.5, 9.5, 15, 55);
    eq('Main anchor handling winch', 'box', 'g_ah', 40, 48, -8, 8, 9.5, 16, 250);
    eq('Secondary winch P',         'box', 'g_ah', 48, 56, 0.4, 5.4, 9.5, 15.5, 80);
    eq('Secondary winch S',         'box', 'g_ah', 48, 56, -5.4, -0.4, 9.5, 15.5, 80);
    eq('Rope storage reel P',       'cylinder', 'g_ah', 48, 56, 5.6, 9.6, 9.5, 13.5, 34);
    eq('Rope storage reel S',       'cylinder', 'g_ah', 48, 56, -9.6, -5.6, 9.5, 13.5, 34);
    add('Rig chain locker 1',       'box', 'g_ah', 'r_chain', 38, 44, 0.5, 6.5, 1.5, 9.1);
    add('Rig chain locker 2',       'box', 'g_ah', 'r_chain', 38, 44, -6.5, -0.5, 1.5, 9.1);
    add('Rig chain locker 3',       'box', 'g_ah', 'r_chain', 44, 50, 0.5, 6.5, 1.5, 9.1);
    add('Rig chain locker 4',       'box', 'g_ah', 'r_chain', 44, 50, -6.5, -0.5, 1.5, 9.1);
    eq('Hydraulic power units',     'box', 'g_ah', 50, 56, -7.5, 7.5, 1.5, 7.5, 30);
    // Ship systems / Machinery
    add('Main engine room',         'box', 'g_mach', null, 56, 68, -9, 9, 1.5, 9.5);
    add('Gearbox and shaft room',   'box', 'g_mach', null, 68, 74, -8, 8, 1.5, 9.5);
    add('Generator and switchboard room', 'box', 'g_mach', null, 74, 78, -7, 7, 1.5, 9.5);
    add('Engine casing and funnel', 'box', 'g_mach', null, 58, 64, -3, 3, 9.5, 17);
    // Ship systems / Tanks and voids
    add('Fuel oil tanks',           'box', 'g_tanks', 'r_fuel', 6, 56, -9.5, 9.5, 0, 1.5);
    add('Ballast tanks',            'box', 'g_tanks', null,     56, 78, -9.5, 9.5, 0, 1.5);
    add('Forepeak tank',            'box', 'g_tanks', null,     83, 86, -3, 3, 0.5, 4);
    // Ship systems / Ship outfitting
    add('Steering gear room',       'box', 'g_outfit', null, 0, 6, -7, 7, 1.5, 7.5);
    add('Bow thruster room',        'box', 'g_outfit', null, 78, 82, -5, 5, 1.5, 4);
    add('Anchor chain locker P',    'cylinder', 'g_outfit', null, 80, 83.5, 0.5, 4, 4, 9.5);
    add('Anchor chain locker S',    'cylinder', 'g_outfit', null, 80, 83.5, -4, -0.5, 4, 9.5);
    add('Forward mooring deck',     'box', 'g_outfit', null, 82, 87, -5, 5, 9.5, 11.5);
    add('Deck stores',              'box', 'g_outfit', null, 28, 34, -10, -8, 9.5, 12.5);
    add('Wheelhouse',               'box', 'g_outfit', null, 70, 80, -10, 10, 18.2, 21);
    // Ship systems / Accommodation
    add('Cabins A-deck',            'box', 'g_acc', 'r_cabin', 64, 82, -9.5, 9.5, 9.5, 12.4);
    add('Cabins B-deck',            'box', 'g_acc', 'r_cabin', 66, 82, -9.5, 9.5, 12.4, 15.3);
    add('Mess, galley and stores',  'box', 'g_acc', null,      66, 80, -9, 9, 15.3, 18.2);
    add('Offices, conference room and hospital', 'box', 'g_acc', null, 80, 84, -8, 8, 15.3, 18.2);
    m.blocks = B;
    m.hulls = [addHullTo(m, fitHull(m, 'osv', 9.5, 6.2))];
    gdens(m, 'g_cargo', 1.0); gdens(m, 'g_ah', 0.35); gdens(m, 'g_mach', 0.3); gdens(m, 'g_acc', 0.1); gdens(m, 'g_outfit', 0.1);
    m.structPct = 26;
    typed.forEach(function (q) { tune(m, q[0], { massOverride: q[1] }); });
    tune(m, 'b1', { density: 0.8 });                                                                                   // deck cargo on the working deck
    ['Drill water tanks P', 'Drill water tanks S', 'Brine tank', 'Base oil tank'].forEach(function (nm, i) {
      m.blocks.forEach(function (b) { if (b.name === nm) b.fill = [55, 55, 40, 40][i]; });
    });
    m.blocks.forEach(function (b) {
      if (b.name === 'Fuel oil tanks') b.fill = 63;
      if (b.name === 'Ballast tanks') b.fill = 100;
      if (b.name === 'Forepeak tank') b.fill = 100;
      if (/^Rig chain locker/.test(b.name)) { b.density = 0.5; }
      if (/^Anchor chain locker/.test(b.name)) { b.density = 0.6; }          // chain stowed in the lockers
    });
    pruneGroups(m);
    settle(m);
    return m;
  }

  /* Illustrative small cruise ship (about 180 m). Passenger cabins on four decks, public spaces above, a theatre and stores
     inside the hull, engine room and tanks aft, and the funnel and wheelhouse on top. */
  function cruiseShipExample() {
    var m = emptyProject('Cruise ship (small)');
    m.requirements = [
      { id: 'r_cab',  name: 'Passenger cabin area',  metric: 'area',   sense: 'min', shall: 9500, should: 11000 },
      { id: 'r_pub',  name: 'Public space area',     metric: 'area',   sense: 'min', shall: 3500, should: 4500 },
      { id: 'r_fuel', name: 'Fuel oil volume',       metric: 'volume', sense: 'min', shall: 800,  should: 1000 },
      { id: 'r_loa',  name: 'Overall length',        metric: 'length', sense: 'max', shall: 185,  should: 170 },
      { id: 'r_beam', name: 'Overall beam',          metric: 'beam',   sense: 'max', shall: 25.5, should: 24.5 },
      { id: 'r_air',  name: 'Height above baseline (air draft)', metric: 'height', sense: 'max', shall: 36, should: 35 }
    ];
    m.hulls = [addHullTo(m, { type: 'cargo', x: 0, y: 0, loa: 180, beam: 25.6, depth: 9, draught: 6.2, shape: { par: 0.5, c: 2.2, ua: 0.2, ps: 0.6, fb: 0.7 } })];
    var B = [], n = 1;
    B.push(mkBlock('b' + (n++), 'Engine room',            'box', 'g_mach',   null,     20, 56,   -10, 10, 1.8, 9));
    B.push(mkBlock('b' + (n++), 'Fuel oil tanks',         'box', 'g_tanks',  'r_fuel', 20, 56,   -10, 10, 0, 1.8));
    B.push(mkBlock('b' + (n++), 'Double bottom ballast',  'box', 'g_tanks',  null,     56, 150,  -10, 10, 0, 1.8));
    B.push(mkBlock('b' + (n++), 'Fresh water tanks',      'box', 'g_tanks',  null,     56, 80,   -8, 8, 1.8, 4.5));
    B.push(mkBlock('b' + (n++), 'Stores and provisions',  'box', 'g_outfit', null,     80, 100,  -9, 9, 1.8, 9));
    B.push(mkBlock('b' + (n++), 'Theatre',                'box', 'g_acc',    'r_pub',  100, 135, -9.5, 9.5, 1.8, 9));
    B.push(mkBlock('b' + (n++), 'Bow thruster room',      'box', 'g_outfit', null,     150, 158, -5, 5, 1.8, 7));
    B.push(mkBlock('b' + (n++), 'Forepeak tank',          'box', 'g_tanks',  null,     158, 170, -4.5, 4.5, 0, 8));
    B.push(mkBlock('b' + (n++), 'Steering gear room',     'box', 'g_outfit', null,     0, 20,    -6, 6, 1.8, 8));
    for (var i = 0; i < 4; i++) B.push(mkBlock('b' + (n++), 'Cabin deck ' + (i + 1), 'box', 'g_acc', 'r_cab', 24, 150, -12.4, 12.4, 9 + 3 * i, 12 + 3 * i));
    B.push(mkBlock('b' + (n++), 'Restaurant and lounges', 'box', 'g_acc',    'r_pub',  40, 130,  -12.4, 12.4, 21, 24));
    B.push(mkBlock('b' + (n++), 'Pool and sun deck',      'box', 'g_acc',    'r_pub',  60, 115,  -9, 9, 24, 27));
    B.push(mkBlock('b' + (n++), 'Wheelhouse',             'box', 'g_outfit', null,     135, 148, -11, 11, 24, 27.5));
    B.push(mkBlock('b' + (n++), 'Funnel',                 'cylinder', 'g_outfit', null, 38, 50,   -4, 4, 27, 35));
    m.hulls[0].x = -3;
    m.blocks = B; fitWidths(m, 0.97);
    gdens(m, 'g_acc', 0.17); gdens(m, 'g_mach', 0.45); gdens(m, 'g_outfit', 0.25);
    m.structPct = 32;
    tune(m, 'b2', { fill: 50 }); tune(m, 'b3', { fill: 30 }); tune(m, 'b4', { fill: 90 }); tune(m, 'b8', { fill: 100 });
    pruneGroups(m);
    settle(m);
    return m;
  }

  /* Illustrative cruising sailing yacht (about 15 m). Cabins and tanks below deck, a deckhouse, a tall mast, and lead ballast
     low in the hull (the hull model has no separate keel fin, so the ballast is a dense block in the bottom). The mast sets the
     height requirement. */
  function sailingYachtExample() {
    var m = emptyProject('Sailing yacht (15 m cruiser)');
    m.requirements = [
      { id: 'r_acc',  name: 'Accommodation area',  metric: 'area',   sense: 'min', shall: 20,   should: 26 },
      { id: 'r_tank', name: 'Fuel and water volume', metric: 'volume', sense: 'min', shall: 0.9, should: 1.8 },
      { id: 'r_loa',  name: 'Overall length',      metric: 'length', sense: 'max', shall: 15,   should: 13.5 },
      { id: 'r_beam', name: 'Overall beam',        metric: 'beam',   sense: 'max', shall: 4.6,  should: 3.2 },
      { id: 'r_air',  name: 'Height above baseline (air draft)', metric: 'height', sense: 'max', shall: 22, should: 20 }
    ];
    m.hulls = [addHullTo(m, { type: 'demihull', x: 0, y: 0, loa: 15.2, beam: 4.4, depth: 1.9, draught: 0.9, shape: { fb: 0.35, par: 0.5, m: 5, flare: 0.1, c: 2 } })];
    var B = [];
    B.push(mkBlock('b1',  'Lead ballast',            'box',      'g_struct', null,     4.2, 7.2, -0.25, 0.25, 0, 0.3));
    B.push(mkBlock('b2',  'Engine room',             'box',      'g_mach',   null,     4.6, 6.4, -0.6, 0.6, 0.4, 1.9));
    B.push(mkBlock('b3',  'Aft cabin P',             'box',      'g_acc',    'r_acc',  1.4, 4.4, 0.15, 1.7, 0.4, 1.9));
    B.push(mkBlock('b4',  'Aft cabin S',             'box',      'g_acc',    'r_acc',  1.4, 4.4, -1.7, -0.15, 0.4, 1.9));
    B.push(mkBlock('b5',  'Saloon and galley',       'box',      'g_acc',    'r_acc',  6.4, 10.4, -1.7, 1.7, 0.4, 1.9));
    B.push(mkBlock('b6',  'Forward cabin',           'box',      'g_acc',    'r_acc',  10.8, 13.0, -1.3, 1.3, 0.4, 1.9));
    B.push(mkBlock('b7',  'Water tank P',            'box',      'g_tanks',  'r_tank', 6.8, 8.8, 0.4, 1.2, 0.3, 0.7));
    B.push(mkBlock('b8',  'Water tank S',            'box',      'g_tanks',  'r_tank', 6.8, 8.8, -1.2, -0.4, 0.3, 0.7));
    B.push(mkBlock('b9',  'Fuel tank',               'box',      'g_tanks',  'r_tank', 3.2, 4.4, -0.5, 0.5, 0.3, 0.7));
    B.push(mkBlock('b10', 'Sail and anchor locker',  'box',      'g_outfit', null,     13.1, 14.1, -0.8, 0.8, 0.9, 1.9));
    B.push(mkBlock('b11', 'Steering and lazarette',  'box',      'g_outfit', null,     0.2, 1.4, -1.2, 1.2, 0.3, 1.9));
    B.push(mkBlock('b12', 'Deckhouse',               'box',      'g_outfit', null,     5.8, 10.0, -1.1, 1.1, 1.9, 2.6));
    B.push(mkBlock('b13', 'Mast and rigging',        'cylinder', 'g_outfit', null,     8.0, 8.3, -0.15, 0.15, 1.9, 20.4));
    m.hulls[0].name = 'Monohull';
    m.blocks = B; fitWidths(m, 0.97);
    gdens(m, 'g_acc', 0.08); gdens(m, 'g_mach', 0.12); gdens(m, 'g_outfit', 0.1); gdens(m, 'g_tanks', 0.85);
    tune(m, 'b1', { density: 11.3 }); tune(m, 'b13', { density: 0.3 });
    tune(m, 'b7', { fill: 100 }); tune(m, 'b8', { fill: 100 }); tune(m, 'b9', { fill: 80 });
    m.structPct = 27;
    pruneGroups(m);
    settle(m);
    return m;
  }

  /* Illustrative handysize bulk carrier (about 28,000 dwt). Five holds, hopper and topside ballast tanks, accommodation
     and engine room aft. Heavy bulk cargo, so the holds are not full. */
  function bulkCarrierExample() {
    var m = emptyProject('Bulk carrier (handysize)');
    m.requirements = [
      { id: 'r_hold', name: 'Cargo hold volume',   metric: 'volume', sense: 'min', shall: 16000, should: 20000 },
      { id: 'r_acc',  name: 'Accommodation area',  metric: 'area',   sense: 'min', shall: 900,   should: 1200 },
      { id: 'r_fuel', name: 'Fuel oil volume',     metric: 'volume', sense: 'min', shall: 600,   should: 750 },
      { id: 'r_loa',  name: 'Overall length',      metric: 'length', sense: 'max', shall: 160,   should: 150 },
      { id: 'r_beam', name: 'Overall beam',        metric: 'beam',   sense: 'max', shall: 27,    should: 24 }
    ];
    m.hulls = [addHullTo(m, { type: 'cargo', x: 0, y: 0, loa: 152, beam: 25, depth: 12.5, draught: 9.8, shape: { par: 0.6, c: 2.8, ua: 0.12, ps: 0.85, fb: 0.95 } })];
    var B = [], k;
    for (k = 0; k < 5; k++) B.push(mkBlock('b' + (k + 1), 'Cargo hold ' + (k + 1), 'box', 'g_cargo', 'r_hold', 28 + k * 22, 50 + k * 22, k === 4 ? -6.5 : -8.8, k === 4 ? 6.5 : 8.8, 2.4, 12.5));
    B.push(mkBlock('b6',  'Hopper tanks P',          'box', 'g_tanks',  null,     28, 138, 8.8, 12.4, 2.4, 6.5));
    B.push(mkBlock('b7',  'Hopper tanks S',          'box', 'g_tanks',  null,     28, 138, -12.4, -8.8, 2.4, 6.5));
    B.push(mkBlock('b8',  'Topside tanks P',         'box', 'g_tanks',  null,     28, 138, 8.8, 12.4, 9, 12.5));
    B.push(mkBlock('b9',  'Topside tanks S',         'box', 'g_tanks',  null,     28, 138, -12.4, -8.8, 9, 12.5));
    B.push(mkBlock('b10', 'Double bottom ballast',   'box', 'g_tanks',  null,     28, 138, -12, 12, 0, 2.4));
    B.push(mkBlock('b11', 'Forepeak tank',           'box', 'g_tanks',  null,     140, 150, -5, 5, 0, 9));
    B.push(mkBlock('b12', 'Engine room',             'box', 'g_mach',   null,     6, 26,   -7.5, 7.5, 2.4, 12.5));
    B.push(mkBlock('b13', 'Fuel oil tanks',          'box', 'g_tanks',  'r_fuel', 6, 26,   -7.5, 7.5, 0, 2.4));
    B.push(mkBlock('b14', 'Steering gear room',      'box', 'g_outfit', null,     0, 6,    -5, 5, 2.4, 9));
    ['A', 'B', 'C', 'D'].forEach(function (d, i) { B.push(mkBlock('b' + (15 + i), 'Accommodation deck ' + d, 'box', 'g_acc', 'r_acc', 8, 24, -9, 9, 12.5 + 2.8 * i, 15.3 + 2.8 * i)); });
    B.push(mkBlock('b19', 'Wheelhouse',              'box', 'g_outfit', null,     12, 20,  -9.5, 9.5, 23.7, 26.3));
    m.blocks = B; fitWidths(m, 0.97);
    gdens(m, 'g_cargo', 1.1); gdens(m, 'g_mach', 0.22); gdens(m, 'g_acc', 0.07); gdens(m, 'g_outfit', 0.1);
    m.structPct = 19;
    [6, 7, 8, 9, 10].forEach(function (i) { tune(m, 'b' + i, { fill: 15 }); }); tune(m, 'b11', { fill: 0 }); tune(m, 'b13', { fill: 100 });   // ballast tanks nearly empty
    [100, 100, 90, 55, 55].forEach(function (f, i) { tune(m, 'b' + (i + 1), { fill: f }); });   // holds: alternate loading, the forward ones lighter
    pruneGroups(m);
    settle(m);
    return m;
  }

  function isHex(c) { return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c); }

  function sanitizeProject(raw) {
    var warnings = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('This file is not a DBB project (expected a JSON object).');
    if (raw.app && raw.app !== FORMAT) throw new Error('This file was not made by the DBB Block Editor.');
    if (!Array.isArray(raw.blocks) && !Array.isArray(raw.groups)) throw new Error('No groups or blocks found in this file.');
    if (raw.version && raw.version > VERSION) warnings.push('File version ' + raw.version + ' is newer than this editor. Some data may be ignored.');

    var model = { app: FORMAT, version: VERSION, name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Untitled design', groups: [], requirements: [], blocks: [], hulls: [], customShapes: [] };

    // groups
    var seen = {};
    (Array.isArray(raw.groups) ? raw.groups : []).forEach(function (g, i) {
      if (!g || typeof g !== 'object') return;
      var id = typeof g.id === 'string' && g.id && !seen[g.id] ? g.id : uid('g', seen);
      seen[id] = true;
      model.groups.push({
        id: id,
        name: typeof g.name === 'string' && g.name.trim() ? g.name : 'Group ' + (i + 1),
        color: isHex(g.color) ? g.color : '#8c97a8',
        parent: typeof g.parent === 'string' ? g.parent : null,
        visible: g.visible !== false,
        density: typeof g.density === 'number' && isFinite(g.density) ? Math.max(0, g.density) : null
      });
    });
    if (!model.groups.length) { model.groups = defaultGroups(); warnings.push('No groups in file. Levander groups were added.'); }
    var gm = groupMap(model);
    model.groups.forEach(function (g) {
      if (g.parent && (!gm[g.parent] || g.parent === g.id)) g.parent = null;
    });
    model.groups.forEach(function (g) {          // break cycles
      var cur = g, guard = 0;
      while (cur && cur.parent && guard++ < model.groups.length + 2) cur = gm[cur.parent];
      if (guard > model.groups.length) g.parent = null;
    });

    // requirements
    var rseen = {};
    (Array.isArray(raw.requirements) ? raw.requirements : []).forEach(function (r, i) {
      if (!r || typeof r !== 'object') return;
      var id = typeof r.id === 'string' && r.id && !rseen[r.id] ? r.id : uid('r', rseen);
      rseen[id] = true;
      var shall = r.shall === null || r.shall === '' || r.shall === undefined ? null : num(r.shall, null);
      var should = r.should === null || r.should === '' || r.should === undefined ? null : num(r.should, null);
      model.requirements.push({
        id: id,
        name: typeof r.name === 'string' && r.name.trim() ? r.name : 'Requirement ' + (i + 1),
        metric: METRICS[r.metric] ? r.metric : 'volume',
        sense: r.sense === 'max' ? 'max' : 'min',
        shall: shall, should: should
      });
    });

    // imported (STL) shapes
    (Array.isArray(raw.customShapes) ? raw.customShapes : []).slice(0, MAX_CUSTOM_SHAPES).forEach(function (d) {
      if (d && registerShape(d)) { if (model.customShapes.indexOf(d.id) < 0) model.customShapes.push(d.id); }
      else warnings.push('An imported shape could not be read and was skipped.');
    });

    // blocks
    var bseen = {}, fallbackGroup = leafFallback(model), dropped = 0;
    (Array.isArray(raw.blocks) ? raw.blocks : []).forEach(function (b, i) {
      if (!b || typeof b !== 'object') { dropped++; return; }
      var id = typeof b.id === 'string' && b.id && !bseen[b.id] ? b.id : uid('b', bseen);
      bseen[id] = true;
      var shape = SHAPES[b.shape] && (!SHAPES[b.shape].custom || model.customShapes.indexOf(b.shape) >= 0) ? b.shape : 'box';
      if (b.shape && shape !== b.shape) warnings.push('Block "' + (b.name || id) + '" has an unknown shape and became a box.');
      var group = gm[b.group] ? b.group : fallbackGroup;
      if (b.group && group !== b.group) warnings.push('Block "' + (b.name || id) + '" had no valid group and was moved to ' + gm[group].name + '.');
      var pos = vec3(b.position, 0), size = vec3(b.size, 1), rot = vec3(b.rotation, 0);
      size = size.map(function (s) { return Math.max(0.01, Math.abs(s)); });
      model.blocks.push({
        id: id,
        name: typeof b.name === 'string' && b.name.trim() ? b.name : 'Block ' + (i + 1),
        shape: shape, group: group,
        reqs: (function () {
          var src = Array.isArray(b.reqs) ? b.reqs : (typeof b.req === 'string' ? [b.req] : []), out = [];
          src.forEach(function (x) { if (typeof x === 'string' && rseen[x] && out.indexOf(x) < 0) out.push(x); });
          return out;
        })(),
        position: pos, size: size, rotation: rot,
        areaOverride: b.areaOverride === null || b.areaOverride === undefined ? null : Math.max(0, num(b.areaOverride, 0)),
        hidden: b.hidden === true,
        density: typeof b.density === 'number' && isFinite(b.density) ? Math.max(0, b.density) : null,
        fill: typeof b.fill === 'number' && isFinite(b.fill) ? Math.min(100, Math.max(0, b.fill)) : 100,
        massOverride: typeof b.massOverride === 'number' && isFinite(b.massOverride) ? Math.max(0, b.massOverride) : null,
        freeSurface: b.freeSurface === true,
        deck: b.deck === true, gt: b.gt !== false
      });
    });
    if (dropped) warnings.push(dropped + ' unreadable block entries were skipped.');
    var rr = typeof raw.waterDensity === 'number' ? raw.waterDensity : raw.rho;
    model.rho = typeof rr === 'number' && isFinite(rr) ? Math.min(1.3, Math.max(0.9, rr)) : 1.025;
    var rawHulls = Array.isArray(raw.hulls) ? raw.hulls : (raw.hull && typeof raw.hull === 'object' ? [raw.hull] : []);
    var hseen = {};
    rawHulls.slice(0, 8).forEach(function (H) {
      if (!H || typeof H !== 'object') return;
      if (!HULL_TYPES[H.type]) { warnings.push('A hull of unknown type was ignored.'); return; }
      var id = typeof H.id === 'string' && H.id && !hseen[H.id] ? H.id : uid('h', hseen);
      hseen[id] = true;
      var depth = Math.max(0.5, num(H.depth, 4)), offs = H.type === 'offsets' && H.offsets ? cleanOffsets({ zs: H.offsets.zs, xs: H.offsets.xs, half: H.offsets.halfBreadth || H.offsets.half }) : null;
      if (H.type === 'offsets' && !offs) { warnings.push('A hull from a table of offsets was ignored: the table is not readable.'); return; }
      model.hulls.push({ id: id, name: typeof H.name === 'string' && H.name.trim() ? H.name : HULL_TYPES[H.type].label, type: H.type,
        x: num(H.x, 0), y: num(H.y, 0), loa: Math.max(1, num(H.loa, 30)), beam: Math.max(0.5, num(H.beam, 8)), depth: depth,
        draught: Math.min(depth, Math.max(0.1, num(H.draught, depth * 0.6))), visible: H.visible !== false });
      var shp = cleanShape(H.shape); if (shp && !offs) model.hulls[model.hulls.length - 1].shape = shp;
      if (offs && H.hullGen && HG()) { try { model.hulls[model.hulls.length - 1].gen = HG().sanitizeHull({ app: HG().FORMAT, hull: H.hullGen }).hull; } catch (e) { warnings.push('The curves of a hull could not be read. It stays a table hull.'); } }
      if (offs && H.hullGenParams) { var gp = cleanGenParams(H.hullGenParams); if (gp) model.hulls[model.hulls.length - 1].genp = gp; }
      if (offs) { model.hulls[model.hulls.length - 1].offsets = offs; if (HULL_LIBRARY[H.library]) model.hulls[model.hulls.length - 1].lib = H.library; }
    });
    model.draught = typeof raw.draught === 'number' && isFinite(raw.draught) ? raw.draught : (model.hulls[0] ? model.hulls[0].draught : null);
    model.waterline = raw.waterline !== false;
    model.float = raw.float === true;
    if (raw.resistance && typeof raw.resistance === 'object') {
      var rr = raw.resistance;
      model.res = { vs: typeof rr.serviceSpeed === 'number' && rr.serviceSpeed > 0 && rr.serviceSpeed <= 80 ? rr.serviceSpeed : null, aft: [1, 2, 3, 4].indexOf(rr.afterbody) >= 0 ? rr.afterbody : 3, tr: rr.transom !== false, bulb: rr.bulb === true };
    }
    if (raw.seakeeping && typeof raw.seakeeping === 'object') {
      var sq = raw.seakeeping, nf = function (v, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : null; };
      model.sk = { head: nf(sq.heading, 0, 360), amp: nf(sq.waveAmplitude, 0.05, 20), pos: nf(sq.position, -100, 100), damp: nf(sq.damping, 0, 100), delta: nf(sq.prismaticLengthRatio, 0.1, 0.99), tn: nf(sq.rollPeriod, 1, 50), gm: nf(sq.gm, 0.05, 50),
        hs: nf(sq.hs, 0.1, 30), per: nf(sq.period, 1, 40), ptype: sq.periodType === 'Tp' ? 'Tp' : 'Tz', gam: nf(sq.gamma, 1, 6), hrs: nf(sq.hours, 0.1, 24),
        cacc: nf(sq.limitAcceleration, 0.001, 2), croll: nf(sq.limitRoll, 0.1, 45), cpitch: nf(sq.limitPitch, 0.1, 45), cmsdv: nf(sq.limitMsdv, 1, 500), cset: typeof sq.limitSet === 'string' ? sq.limitSet.slice(0, 20) : null };
    }
    if (raw.structure && typeof raw.structure === 'object') model.st = stClean(raw.structure);
    model.variants = wiCleanVariants(raw.variants);
    model.structPct = typeof raw.structurePercent === 'number' && isFinite(raw.structurePercent) ? Math.min(100, Math.max(0, raw.structurePercent)) : DEFAULT_STRUCT_PCT;
    syncDraught(model);
    keepOneDeck(model);
    return { model: model, warnings: warnings };
  }

  function vec3(a, d) {
    var out = [d, d, d];
    if (Array.isArray(a)) for (var i = 0; i < 3; i++) out[i] = num(a[i], d);
    return out;
  }

  function leafFallback(model) {
    var ord = groupOrder(model);
    for (var i = 0; i < ord.length; i++) {
      var id = ord[i].group.id;
      if (!model.groups.some(function (g) { return g.parent === id; })) return id;
    }
    return model.groups[0].id;
  }

  function uid(prefix, taken) {
    var n = 1;
    while (taken[prefix + n]) n++;
    return prefix + n;
  }

  function r4(v) { return Math.round(v * 1e4) / 1e4; }

  function serializeProject(model) {
    var out = {
      app: FORMAT,
      version: VERSION,
      name: model.name,
      units: 'm',
      axes: 'x forward from the aft end, y to port from the centreline, z up from the baseline; positions are block centres; rotation is Euler XYZ in degrees',
      taxonomy: 'Levander system based design (editable)',
      shapes: SHAPE_ORDER.map(function (k) { return { id: k, label: SHAPES[k].label, volumeFactor: r4(SHAPES[k].vf), planFactor: r4(SHAPES[k].plan) }; }),
      customShapes: (model.customShapes || []).filter(function (id) { return model.blocks.some(function (b) { return b.shape === id; }); }).map(function (id) { return CUSTOM[id]; }).filter(Boolean),
      groups: model.groups.map(function (g) { return { id: g.id, name: g.name, color: g.color, parent: g.parent, visible: g.visible !== false, density: typeof g.density === 'number' ? r4(g.density) : null }; }),
      requirements: model.requirements.map(function (r) { return { id: r.id, name: r.name, metric: r.metric, sense: r.sense, shall: r.shall, should: r.should }; }),
      waterDensity: model.rho || 1.025,
      draught: model.draught == null ? null : r4(model.draught),
      waterline: model.waterline !== false,
      float: model.float === true,
      resistance: { serviceSpeed: model.res && model.res.vs > 0 ? r4(model.res.vs) : null, afterbody: model.res && model.res.aft || 3, transom: !model.res || model.res.tr !== false, bulb: !!(model.res && model.res.bulb) },
      seakeeping: (function () { var s = model.sk || {}, q = function (v) { return typeof v === 'number' ? r4(v) : null; }; return { heading: q(s.head), waveAmplitude: q(s.amp), position: q(s.pos), damping: q(s.damp), prismaticLengthRatio: q(s.delta), rollPeriod: q(s.tn), gm: q(s.gm),
        hs: q(s.hs), period: q(s.per), periodType: s.ptype === 'Tp' ? 'Tp' : 'Tz', gamma: q(s.gam), hours: q(s.hrs), limitAcceleration: q(s.cacc), limitRoll: q(s.croll), limitPitch: q(s.cpitch), limitMsdv: q(s.cmsdv), limitSet: typeof s.cset === 'string' ? s.cset : null }; })(),
      structure: model.st ? stClean(model.st) : null,
      variants: Array.isArray(model.variants) && model.variants.length ? model.variants : undefined,
      structurePercent: typeof model.structPct === 'number' ? r4(model.structPct) : DEFAULT_STRUCT_PCT,
      weight: (function () { var w = weightSummary(model); return { unit: 't', blocks: r4(w.blocks.mass), structureAndOutfitting: r4(w.struct.mass), total: r4(w.total.mass), lcg: w.total.lcg == null ? null : r4(w.total.lcg), tcg: w.total.tcg == null ? null : r4(w.total.tcg), vcg: w.total.vcg == null ? null : r4(w.total.vcg), displacement: w.disp == null ? null : r4(w.disp), margin: w.margin == null ? null : r4(w.margin) }; })(),
      hulls: model.hulls.map(function (h) {
        var hy = hullHydro(h, h.draught, model.rho);
        return { id: h.id, name: h.name, type: h.type, x: r4(h.x), y: r4(h.y), loa: r4(h.loa), beam: r4(h.beam), depth: r4(h.depth), draught: r4(h.draught), visible: h.visible !== false, shape: cleanShape(h.shape) || undefined, library: h.lib || undefined, offsets: h.offsets ? { zs: h.offsets.zs.map(r4), xs: h.offsets.xs.map(r4), halfBreadth: h.offsets.half.map(function (r) { return r.map(function (v) { return v === null ? null : r4(v); }); }) } : undefined, hullGen: h.offsets && h.gen ? h.gen : undefined, hullGenParams: h.offsets && h.gen && h.genp ? h.genp : undefined,
          computed: { volumeToDeck: r4(hullVolumeTo(h, h.depth)), displacedVolume: r4(hullVolumeTo(h, h.draught)),
            hydrostatics: { lwl: r4(hy.LWL), bwl: r4(hy.BWL), cb: r4(hy.Cb), cp: r4(hy.Cp), cm: r4(hy.Cm), cwp: r4(hy.Cwp), waterplaneArea: r4(hy.Awp), lcb: r4(hy.LCB), kb: r4(hy.KB), lcf: r4(hy.LCF), tpc: r4(hy.TPC) } } };
      }),
      blocks: model.blocks.map(function (b) {
        return {
          id: b.id, name: b.name, shape: b.shape, group: b.group, reqs: blockReqs(b).slice(),
          position: b.position.map(r4), size: b.size.map(r4), rotation: b.rotation.map(r4),
          areaOverride: b.areaOverride == null ? null : r4(b.areaOverride), hidden: !!b.hidden,
          density: typeof b.density === 'number' ? r4(b.density) : null, fill: typeof b.fill === 'number' ? r4(b.fill) : 100, massOverride: typeof b.massOverride === 'number' ? r4(b.massOverride) : null, freeSurface: !!b.freeSurface, deck: !!b.deck, gt: b.gt !== false,
          computed: (function () { var q = blockMass(model, b), c = blockCentroid(b); return { volume: r4(blockVolume(b)), area: r4(blockArea(b)), density: r4(q.density), mass: r4(q.mass), cg: c.map(r4) }; })()
        };
      })
    };
    var text = JSON.stringify(out, null, 2);
    return text.replace(/\[([^\[\]{}"]*?)\]/g, function (m, inner) {
      return '[' + inner.replace(/\s*\n\s*/g, ' ').trim() + ']';
    });
  }

  /* ---------- CSV ---------- */
  function csvCell(v, delim) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    if (s.indexOf(delim) >= 0 || /["\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toCSV(rows, delim) {
    return rows.map(function (r) { return r.map(function (c) { return csvCell(c, delim); }).join(delim); }).join('\r\n') + '\r\n';
  }

  function summaryCSV(model, delim) {
    var s = summarize(model);
    var ws = weightSummary(model), wn = function (v) { return v == null ? '' : r4(v); };
    var rows = [['System', 'Level', 'Blocks', 'Area (m2)', 'Volume (m3)', 'Volume share (%)', 'Density (t/m3)', 'Block mass (t)', 'LCG x (m)', 'TCG y (m)', 'VCG z (m)']];
    s.rows.forEach(function (r, i) {
      var w = ws.rows[i];
      rows.push([r.group.name, r.depth + 1, r.total.n, r4(r.total.area), r4(r.total.vol), s.total.vol > 0 ? r4(100 * r.total.vol / s.total.vol) : 0,
        r4(w.density.value), r4(w.total.mass), wn(w.total.lcg), wn(w.total.tcg), wn(w.total.vcg)]);
    });
    rows.push(['Gross total', '', s.total.n, r4(s.total.area), r4(s.total.vol), s.total.vol > 0 ? 100 : 0, '', r4(ws.blocks.mass), wn(ws.blocks.lcg), wn(ws.blocks.tcg), wn(ws.blocks.vcg)]);
    rows.push([]);
    rows.push(['Weight', 'Share', '', '', '', '', '', 'Mass (t)', 'LCG x (m)', 'TCG y (m)', 'VCG z (m)']);
    rows.push(['Blocks', '', '', '', '', '', '', r4(ws.blocks.mass), wn(ws.blocks.lcg), wn(ws.blocks.tcg), wn(ws.blocks.vcg)]);
    rows.push(['Structure and outfitting (share of displacement)', r4(ws.pct) + '%', '', '', '', '', '', r4(ws.struct.mass), wn(ws.struct.lcg), wn(ws.struct.tcg), wn(ws.struct.vcg)]);
    rows.push(['Total weight', '', '', '', '', '', '', r4(ws.total.mass), wn(ws.total.lcg), wn(ws.total.tcg), wn(ws.total.vcg)]);
    if (ws.hasHull) {
      rows.push(['Displacement at the draught (t)', '', '', '', '', '', '', wn(ws.disp), wn(ws.lcb), wn(ws.tcb), wn(ws.kb)]);
      rows.push(['Margin: displacement minus weight (t)', ws.marginPct == null ? '' : r4(ws.marginPct) + '%', '', '', '', '', '', wn(ws.margin)]);
      rows.push(['LCG minus LCB (m, positive = weight forward of the buoyancy)', '', '', '', '', '', '', '', wn(ws.lcgMinusLcb)]);
    }
    rows.push([]);
    rows.push(['Overall dimensions', '', '', '', '', '']);
    var e = s.envelope;
    rows.push(['Length (X)', 'm', '', '', e ? r4(e.length) : 0, '']);
    rows.push(['Beam (Y)', 'm', '', '', e ? r4(e.beam) : 0, '']);
    rows.push(['Height (Z)', 'm', '', '', e ? r4(e.height) : 0, '']);
    var hc = hullCheck(model);
    if (hc) {
      rows.push([]);
      rows.push(['Hulls (illustrative)', 'Type', 'Length (m)', 'Beam (m)', 'Depth to main deck (m)', 'Draught (m)', 'Y offset (m)', 'Volume to main deck (m3)', 'Displaced volume (m3)']);
      hc.hulls.forEach(function (e) {
        var h = e.hull;
        rows.push([h.name, HULL_TYPES[h.type].label, r4(h.loa), r4(h.beam), r4(h.depth), r4(h.draught), r4(h.y), r4(e.volDeck), r4(e.volDraught)]);
      });
      rows.push(['All hulls', '', '', '', '', '', '', r4(hc.volDeck), r4(hc.volDraught)]);
      var hd = modelHydro(model);
      rows.push([]);
      rows.push(['Hydrostatics (illustrative hulls, upright, water density t/m3 = ' + r4(hd.total.rho) + ')', 'LWL (m)', 'BWL (m)', 'Draught (m)', 'Volume (m3)', 'Displacement (t)', 'Cb', 'Cp', 'Cm', 'Cwp', 'Waterplane area (m2)', 'LCB x (m)', 'KB (m)', 'LCF x (m)', 'TPC (t/cm)']);
      hd.hulls.forEach(function (e) {
        var q = e.h;
        rows.push([e.hull.name, r4(q.LWL), r4(q.BWL), r4(q.T), r4(q.V), r4(q.disp), r4(q.Cb), r4(q.Cp), r4(q.Cm), r4(q.Cwp), r4(q.Awp), r4(q.LCB), r4(q.KB), r4(q.LCF), r4(q.TPC)]);
      });
      var tq = hd.total;
      rows.push(['All hulls', '', '', '', r4(tq.V), r4(tq.disp), '', '', '', '', r4(tq.Awp), r4(tq.LCB), r4(tq.KB), r4(tq.LCF), r4(tq.TPC)]);
      rows.push(['Transverse centre of buoyancy y (m, to port)', '', '', '', '', '', '', '', '', '', '', r4(tq.TCB)]);
      rows.push(['Block volume below main deck (m3)', '', '', '', '', '', '', r4(hc.blocksBelow), '']);
      rows.push(['Block volume outside hulls, estimate (m3)', '', '', '', '', '', '', r4(hc.outside), '']);
    }
    return toCSV(rows, delim);
  }

  function requirementsCSV(model, delim) {
    var rows = [['Requirement', 'Metric', 'Unit', 'Sense', 'Shall', 'Should', 'Achieved', 'Linked blocks', 'Status', 'Margin vs shall (%)', 'Margin vs should (%)', 'Inside hulls, estimate', 'Status inside hulls', 'Block names']];
    evaluateRequirements(model).forEach(function (e) {
      var r = e.req;
      rows.push([r.name, METRICS[r.metric].label, METRICS[r.metric].unit, r.sense === 'max' ? 'at most' : 'at least',
        r.shall == null ? '' : r.shall, r.should == null ? '' : r.should, r4(e.achieved), e.n, statusText(e.status, r), mpc(e.marginShall), mpc(e.marginShould),
        e.inside == null ? '' : r4(e.inside), e.statusInside ? statusText(e.statusInside, r) : '', e.blocks.join('; ')]);
    });
    return toCSV(rows, delim);
  }

  function blocksCSV(model, delim) {
    var rmap = {};
    model.requirements.forEach(function (r) { rmap[r.id] = r.name; });
    var rows = [['Id', 'Name', 'Group path', 'Group', 'Requirement', 'Shape', 'X (m)', 'Y (m)', 'Z (m)', 'Length (m)', 'Beam (m)', 'Height (m)', 'Rot X (deg)', 'Rot Y (deg)', 'Rot Z (deg)', 'Volume (m3)', 'Area (m2)', 'Area overridden', 'Volume below main deck (m3)', 'Volume outside hulls, estimate (m3)', 'Outside share of block (%)', 'Density (t/m3)', 'Fill (%)', 'Mass (t)', 'Mass typed', 'CG x (m)', 'CG y (m)', 'CG z (m)', 'Counts for GT']];
    var gm = groupMap(model), hc = hullCheck(model);
    model.blocks.forEach(function (b) {
      var q = blockMass(model, b), cg = blockCentroid(b);
      rows.push([b.id, b.name, groupPath(model, b.group), gm[b.group] ? gm[b.group].name : '', blockReqs(b).map(function (x) { return rmap[x]; }).join('; '), SHAPES[b.shape].label,
        r4(b.position[0]), r4(b.position[1]), r4(b.position[2]), r4(b.size[0]), r4(b.size[1]), r4(b.size[2]),
        r4(b.rotation[0]), r4(b.rotation[1]), r4(b.rotation[2]), r4(blockVolume(b)), r4(blockArea(b)), b.areaOverride != null ? 'yes' : 'no',
        hc ? r4(hc.byId[b.id].below) : '', hc ? r4(hc.byId[b.id].out) : '', hc ? r4(100 * hc.byId[b.id].shareBlock) : '',
        r4(q.density), r4(q.fill), r4(q.mass), q.typed ? 'yes' : 'no', r4(cg[0]), r4(cg[1]), r4(cg[2]), b.gt === false ? 'no' : 'yes']);
    });
    return toCSV(rows, delim);
  }


  /* ---------- Excel workbook (.xlsx) ----------
     Written by hand: a few XML parts in a zip with no compression, so no library is needed. Numbers stay numbers, the block
     masses and the totals are live formulas (with their values stored), and every sheet has a frozen header row. */
  /* Cell styles: a name such as 'n2' (number, 2 decimals) or 'b' (bold), optionally with a fill colour: 'n2|DCE6F1'. The registry hands out
     the style numbers and writes the styles part at the end. */
  var XBASE = [['n', 0, 0, 0], ['h', 0, 1, 2], ['n2', 2, 0, 0], ['n1', 164, 0, 0], ['b', 0, 1, 0], ['bn2', 2, 1, 0], ['title', 0, 2, 0], ['note', 0, 3, 0], ['n3', 165, 0, 0], ['pct', 166, 0, 0], ['bn1', 164, 1, 0], ['bpct', 166, 1, 0]];
  function xreg() {
    var xfs = [], idx = {}, fills = [], fillIdx = {};
    function add(name, rgb) {
      var key = rgb ? name + '|' + rgb : name;
      if (idx[key] != null) return idx[key];
      var base = null; XBASE.forEach(function (x) { if (x[0] === name) base = x; });
      if (!base) base = XBASE[0];
      var fill = base[3];
      if (rgb) { if (fillIdx[rgb] == null) { fillIdx[rgb] = 3 + fills.length; fills.push(rgb); } fill = fillIdx[rgb]; }
      xfs.push('<xf numFmtId="' + base[1] + '" fontId="' + base[2] + '" fillId="' + fill + '" borderId="0" xfId="0"' + (base[1] ? ' applyNumberFormat="1"' : '') + (base[2] ? ' applyFont="1"' : '') + (fill ? ' applyFill="1"' : '') +
        (name === 'h' ? ' applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>' : '/>'));
      idx[key] = xfs.length - 1;
      return idx[key];
    }
    XBASE.forEach(function (x) { add(x[0]); });
    return {
      id: function (st) { if (!st) return 0; var a = String(st).split('|'); return add(a[0], a[1] || null); },
      xml: function () {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
          '<numFmts count="3"><numFmt numFmtId="164" formatCode="0.0"/><numFmt numFmtId="165" formatCode="0.000"/><numFmt numFmtId="166" formatCode="0.0&quot;%&quot;"/></numFmts>' +
          '<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font></fonts>' +
          '<fills count="' + (3 + fills.length) + '"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F1"/><bgColor indexed="64"/></patternFill></fill>' +
          fills.map(function (c) { return '<fill><patternFill patternType="solid"><fgColor rgb="FF' + c + '"/><bgColor indexed="64"/></patternFill></fill>'; }).join('') + '</fills>' +
          '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
          '<cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
      }
    };
  }
  function hex6(c) { var m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); return m ? m[1].toUpperCase() : '9AA5B1'; }
  function tint(c, t) {            // mix with white; t = share of white
    var h = hex6(c), out = '';
    for (var i = 0; i < 3; i++) { var v = parseInt(h.substr(i * 2, 2), 16); v = Math.round(v + (255 - v) * t); out += (v < 16 ? '0' : '') + v.toString(16); }
    return out.toUpperCase();
  }
  function xcol(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function xesc(t) { return String(t).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function xsheetXml(sh, reg) {
    var out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"'];
    out.push(sh.tab ? ' tabSelected="1"' : '', '>');
    if (sh.freeze) out.push('<pane ySplit="' + sh.freeze + '" topLeftCell="A' + (sh.freeze + 1) + '" activePane="bottomLeft" state="frozen"/>');
    out.push('</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>');
    if (sh.widths) out.push('<cols>' + sh.widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>');
    out.push('<sheetData>');
    sh.rows.forEach(function (row, ri) {
      if (!row || !row.length) return;
      var cells = [];
      row.forEach(function (c, ci) {
        if (c === null || c === undefined || c === '') return;
        if (typeof c !== 'object') c = { v: c };
        var ref = xcol(ci) + (ri + 1), sid = reg.id(c.s);
        if (c.f != null) {
          cells.push('<c r="' + ref + '" s="' + sid + '"><f>' + xesc(c.f) + '</f>' + (typeof c.v === 'number' && isFinite(c.v) ? '<v>' + c.v + '</v>' : '') + '</c>');
        } else if (typeof c.v === 'number') {
          if (isFinite(c.v)) cells.push('<c r="' + ref + '" s="' + sid + '"><v>' + c.v + '</v></c>');
        } else {
          cells.push('<c r="' + ref + '" s="' + sid + '" t="inlineStr"><is><t xml:space="preserve">' + xesc(c.v) + '</t></is></c>');
        }
      });
      if (cells.length) out.push('<row r="' + (ri + 1) + '">' + cells.join('') + '</row>');
    });
    out.push('</sheetData></worksheet>');
    return out.join('');
  }
  var crcTable = null;
  function crc32(u8) {
    if (!crcTable) { crcTable = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; } }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) crc = crcTable[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    var e = unescape(encodeURIComponent(s)), a = new Uint8Array(e.length);
    for (var i = 0; i < e.length; i++) a[i] = e.charCodeAt(i);
    return a;
  }
  /* files: [[name, string]] -> Uint8Array of a zip with the files stored */
  function zipStore(files) {
    var parts = [], central = [], offset = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = utf8(f[0]), data = utf8(f[1]), crc = crc32(data);
      var head = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(head), name, data);
      central.push([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)), name);
      offset += head.length + name.length + data.length;
    });
    var cstart = offset, csize = 0;
    central.forEach(function (c) { var a = c instanceof Uint8Array ? c : new Uint8Array(c); parts.push(a); csize += a.length; });
    parts.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(csize), u32(cstart), u16(0))));
    var total = 0; parts.forEach(function (p) { total += p.length; });
    var out = new Uint8Array(total), pos = 0;
    parts.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  /* ---------- PDF report ----------
     A small PDF writer (standard Helvetica, WinAnsi text, JPEG images, lines and rectangles) and the report layout. Units are points,
     the origin is the top left of the page, y grows downwards. */
  var HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  var HELVB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  var WIN1252 = { 0x20AC: 0x80, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97 };
  var LATIN_W = { 0xE6: 889, 0xF8: 611, 0xE5: 556, 0xC6: 1000, 0xD8: 778, 0xC5: 667, 0xB2: 333, 0xB3: 333, 0xB0: 400, 0xB1: 584, 0xD7: 584, 0xB7: 278, 0x96: 556, 0x97: 1000, 0x95: 350, 0x85: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333 };
  function pdfText(s) {      // unicode -> WinAnsi code points, as a JS string of 8-bit chars
    var out = '';
    s = String(s).replace(/→/g, ' to ').replace(/−/g, '-').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/[   ]/g, ' ');
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 32 && c < 127) out += s.charAt(i);
      else if (c === 0xB2) out += '\u0001';      // superscript 2 and 3 are drawn as small raised digits (not every viewer has the glyphs)
      else if (c === 0xB3) out += '\u0002';
      else if (c >= 160 && c <= 255) out += String.fromCharCode(c);
      else if (WIN1252[c]) out += String.fromCharCode(WIN1252[c]);
      else if (c === 9 || c === 10) out += ' ';
      else out += '?';
    }
    return out;
  }
  function pdfWidth(t, size, bold) {          // t from pdfText
    var tab = bold ? HELVB : HELV, w = 0;
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i);
      w += c >= 32 && c < 127 ? tab[c - 32] : c < 3 ? 556 * 0.62 : (LATIN_W[c] || 556);
    }
    return w * size / 1000;
  }
  function pdfColor(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '#000000') || ['', '000000'], n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(function (x) { return (Math.round(x * 1000) / 1000).toString(); }).join(' ');
  }
  function bin2u8(s) { var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; }
  function u82bin(u) { var s = '', k = 0x8000; for (var i = 0; i < u.length; i += k) s += String.fromCharCode.apply(null, u.subarray(i, i + k)); return s; }
  var PW = 595.28, PH = 841.89;
  var APP_VERSION = '1.2.0', APP_URL = 'https://shiplab.github.io/dbb/';
  /* the stamp on exports: date and time (computer clock, with its UTC offset), the tool, its version and its address */
  function stampText(d) {
    d = d || new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; }, off = -d.getTimezoneOffset(), a = Math.abs(off);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ' (UTC' + (off < 0 ? '-' : '+') + p(Math.floor(a / 60)) + ':' + p(a % 60) + ') \u00b7 Made with the Ship Design Building Block Editor v' + APP_VERSION + '.  ' + APP_URL;
  }

  function pdfWriter(title) {
    var pages = [], cur = null, imgs = [];
    function n2(v) { return (Math.round(v * 100) / 100).toString(); }
    var d = {
      addPage: function (landscape, cw, ch) { cur = { ops: [], imgs: {}, w: cw || (landscape ? PH : PW), h: ch || (landscape ? PW : PH) }; pages.push(cur); return pages.length - 1; },
      goto: function (i) { cur = pages[i]; },
      pageCount: function () { return pages.length; },
      pageW: function () { return cur.w; },
      pageH: function () { return cur.h; },
      textWidth: function (s, size, bold) { return pdfWidth(pdfText(s), size, bold); },
      text: function (x, y, s, o) {
        o = o || {};
        var t = pdfText(s), size = o.size || 9, w = pdfWidth(t, size, o.bold);
        if (o.align === 'right') x -= w; else if (o.align === 'center') x -= w / 2;
        var font = '/' + (o.bold ? 'F2' : 'F1'), col = pdfColor(o.color || '#1c2430'), cx = x;
        t.split(/([\u0001\u0002])/).forEach(function (seg) {
          if (!seg) return;
          var sup = seg === '\u0001' || seg === '\u0002', str = sup ? (seg === '\u0001' ? '2' : '3') : seg, sz = sup ? size * 0.62 : size, yy = sup ? y - size * 0.36 : y;
          cur.ops.push('BT ' + font + ' ' + n2(sz) + ' Tf ' + col + ' rg ' + n2(cx) + ' ' + n2(cur.h - yy) + ' Td (' + str.replace(/([\\()])/g, '\\$1') + ') Tj ET');
          cx += pdfWidth(seg, size, o.bold);
        });
        return w;
      },
      line: function (x1, y1, x2, y2, o) {
        o = o || {};
        cur.ops.push(n2(o.w || 0.5) + ' w ' + pdfColor(o.color || '#cfd6df') + ' RG ' + n2(x1) + ' ' + n2(cur.h - y1) + ' m ' + n2(x2) + ' ' + n2(cur.h - y2) + ' l S');
      },
      poly: function (pts, o) {
        o = o || {};
        if (pts.length < 2) return;
        var t = n2(o.w || 0.5) + ' w ' + pdfColor(o.color || '#33506b') + ' RG ' + (o.dash ? '[' + o.dash.join(' ') + '] 0 d ' : '');
        pts.forEach(function (q, i) { t += n2(q[0]) + ' ' + n2(cur.h - q[1]) + (i ? ' l ' : ' m '); });
        if (o.fill) t += pdfColor(o.fill) + ' rg ';
        cur.ops.push(t + (o.close || o.fill ? 'h ' : '') + (o.fill ? 'B' : 'S') + (o.dash ? ' [] 0 d' : ''));
      },
      rect: function (x, y, w, h, o) {
        o = o || {};
        var s = '';
        if (o.fill) s += pdfColor(o.fill) + ' rg ';
        if (o.stroke) s += pdfColor(o.stroke) + ' RG ' + n2(o.lw || 0.5) + ' w ';
        cur.ops.push(s + n2(x) + ' ' + n2(cur.h - y - h) + ' ' + n2(w) + ' ' + n2(h) + ' re ' + (o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'));
      },
      addImage: function (jpeg, w, h) { imgs.push({ data: jpeg, w: w, h: h }); return imgs.length - 1; },
      image: function (idx, x, y, w, h) {
        cur.imgs['Im' + idx] = idx;
        cur.ops.push('q ' + n2(w) + ' 0 0 ' + n2(h) + ' ' + n2(x) + ' ' + n2(cur.h - y - h) + ' cm /Im' + idx + ' Do Q');
      },
      build: function () {
        var objs = [], offs = [], out = '';
        function add(body) { objs.push(body); return objs.length; }
        add('<< /Type /Catalog /Pages 2 0 R >>');
        add('');
        add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        var imgObj = imgs.map(function (im) {
          var s = u82bin(im.data);
          return add('<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + s.length + ' >>\nstream\n' + s + '\nendstream');
        });
        var kids = [];
        pages.forEach(function (p) {
          var content = p.ops.join('\n'), cid = add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
          var xo = Object.keys(p.imgs).map(function (k) { return '/' + k + ' ' + imgObj[p.imgs[k]] + ' 0 R'; }).join(' ');
          kids.push(add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n2(p.w) + ' ' + n2(p.h) + ']' + (p.w > p.h ? ' /Rotate 90' : '') + ' /Resources << /Font << /F1 3 0 R /F2 4 0 R >>' + (xo ? ' /XObject << ' + xo + ' >>' : '') + ' >> /Contents ' + cid + ' 0 R >>'));
        });
        objs[1] = '<< /Type /Pages /Kids [' + kids.map(function (k) { return k + ' 0 R'; }).join(' ') + '] /Count ' + kids.length + ' >>';
        var info = add('<< /Title (' + pdfText(title || 'Report').replace(/[\u0001\u0002]/g, '').replace(/([\\()])/g, '\\$1') + ') /Producer (Ship Design Building Block Editor) >>');
        out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
        objs.forEach(function (b, i) { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + b + '\nendobj\n'; });
        var xr = out.length;
        out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
        offs.forEach(function (o) { out += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
        out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xr + '\n%%EOF\n';
        return bin2u8(out);
      }
    };
    return d;
  }

  /* the report. o: { when, images: {iso, side, top, front} each {jpeg, w, h}, logo: {jpeg, w, h}, floatRes, stability, assumptions: [text] } */
  function buildReport(model, o) {
    o = o || {};
    var doc = pdfWriter((model.name || 'Design') + ' - design report'), M = 40, CW = PW - 2 * M, y = 0;
    var INK = '#1c2430', DIM = '#5b6675', LINE = '#cfd6df', HEAD = '#eef1f5', BLUE = '#00509e';
    var SEV = { bad: '#b3261e', warn: '#b26a00', note: '#5b6675', good: '#2e7d32', ok: '#2e7d32', excess: '#b26a00', fail: '#b3261e', none: '#5b6675', pass: '#2e7d32' };
    function f(n, dd) { return Number(n).toLocaleString('en-GB', { minimumFractionDigits: dd == null ? 1 : dd, maximumFractionDigits: dd == null ? 1 : dd }); }
    function f2(v) { return v == null || !isFinite(v) ? '-' : f(v, 2); }
    function heel(h) { return Math.abs(h) < 0.005 ? '0°' : f(Math.abs(h), 2) + '° to ' + (h > 0 ? 'port' : 'starboard'); }
    var imgIdx = {};
    function img(k) { var im = o.images && o.images[k]; if (!im) return null; if (imgIdx[k] == null) imgIdx[k] = doc.addImage(im.jpeg, im.w, im.h); return im; }
    var logo = o.logo ? { im: o.logo, idx: doc.addImage(o.logo.jpeg, o.logo.w, o.logo.h) } : null;

    function newPage(land) { doc.addPage(land); y = M; CW = doc.pageW() - 2 * M; }
    function ensure(h) { if (y + h > doc.pageH() - M - 14) newPage(doc.pageW() > doc.pageH()); }
    function heading(t, note) {
      ensure(80); y += 8; doc.text(M, y + 10, t, { size: 12, bold: true, color: BLUE }); y += 16; doc.line(M, y, M + CW, y, { color: BLUE, w: 0.8 }); y += 6;
      if (note) { var nl = wrap(note, CW, 8, false); nl.forEach(function (ln) { doc.text(M, y + 8, ln, { size: 8, color: DIM }); y += 11; }); }
      y += 4;
    }
    function sub(t) { ensure(50); y += 4; doc.text(M, y + 8, t, { size: 9, bold: true }); y += 14; }
    function para(t, size, color) {
      var sz = size || 9, wl = wrap(t, CW, sz, false);
      wl.forEach(function (ln) { ensure(sz + 4); doc.text(M, y + sz, ln, { size: sz, color: color || INK }); y += sz + 3.5; });
      y += 2;
    }
    function wrap(t, w, size, bold) {
      var words = String(t).split(/\s+/), lines = [], cur = '';
      words.forEach(function (wd) {
        var tr = cur ? cur + ' ' + wd : wd;
        if (doc.textWidth(tr, size, bold) <= w || !cur) cur = tr; else { lines.push(cur); cur = wd; }
      });
      if (cur) lines.push(cur);
      return lines.length ? lines : [''];
    }
    /* cols: [{t, w (relative), a: 'r' for right}]; rows: [{cells, bold, fill, color, colors, indent, swatch, boldCols}] */
    function table(cols, rows, opt) {
      opt = opt || {};
      var tw = cols.reduce(function (a, c) { return a + c.w; }, 0), W = cols.map(function (c) { return c.w / tw * CW; }), size = opt.size || 8, lead = size + 3.5;
      function head() {
        var hl = cols.map(function (c, i) { return wrap(c.t, W[i] - 6, size, true); }), nh = hl.reduce(function (a, c) { return Math.max(a, c.length); }, 1);
        ensure(nh * lead + 3 + lead * 2);
        doc.rect(M, y, CW, nh * lead + 3, { fill: HEAD });
        var x = M;
        cols.forEach(function (c, i) { hl[i].forEach(function (ln, li) { doc.text(c.a === 'r' ? x + W[i] - 3 : x + 3, y + lead * (li + 1) - 0.5, ln, { size: size, bold: true, color: DIM, align: c.a === 'r' ? 'right' : 'left' }); }); x += W[i]; });
        y += nh * lead + 3;
      }
      if (opt.keep) {
        var tot = 0;
        rows.forEach(function (r) { tot += cols.reduce(function (a, c, i) { return Math.max(a, wrap(String(r.cells[i] == null ? '' : r.cells[i]), W[i] - 6, size, r.bold).length); }, 1) * lead + 2; });
        if (y + tot + lead * 3 > doc.pageH() - M - 14 && tot < doc.pageH() * 0.7) newPage(doc.pageW() > doc.pageH());
      }
      head();
      rows.forEach(function (r) {
        var cells = cols.map(function (c, i) { return wrap(String(r.cells[i] == null ? '' : r.cells[i]), W[i] - 6 - (i === 0 ? (r.indent || 0) + (r.swatch ? 8 : 0) : 0), size, r.bold); });
        var nl = cells.reduce(function (a, c) { return Math.max(a, c.length); }, 1), h = nl * lead + 2;
        if (y + h > doc.pageH() - M - 14) { newPage(doc.pageW() > doc.pageH()); head(); }
        if (r.fill) doc.rect(M, y, CW, h, { fill: r.fill });
        var x = M;
        cols.forEach(function (c, i) {
          var col = (r.colors && r.colors[i]) || r.color || INK;
          if (i === 0 && r.swatch) doc.rect(x + 3 + (r.indent || 0), y + 2.5, 5, 5, { fill: r.swatch });
          cells[i].forEach(function (ln, li) {
            var tx = c.a === 'r' ? x + W[i] - 3 : x + 3 + (i === 0 ? (r.indent || 0) + (r.swatch ? 8 : 0) : 0);
            doc.text(tx, y + lead * (li + 1) - 1.2, ln, { size: size, bold: r.bold || (r.boldCols && r.boldCols[i]), color: col, align: c.a === 'r' ? 'right' : 'left' });
          });
          x += W[i];
        });
        y += h;
        doc.line(M, y, M + CW, y, { color: '#e3e8ee', w: 0.4 });
      });
      y += 4;
    }
    function tiles(items) {
      var per = Math.min(5, items.length), tw = CW / per;
      for (var i = 0; i < items.length; i += per) {
        ensure(34);
        items.slice(i, i + per).forEach(function (it, j) {
          var x = M + j * tw;
          doc.rect(x, y, tw - 6, 30, { fill: HEAD });
          doc.text(x + 6, y + 10, it[0], { size: 6.5, color: DIM });
          doc.text(x + 6, y + 23, it[1], { size: 10, bold: true, color: it[2] || INK });
        });
        y += 36;
      }
    }
    function kv(rows) {          // two-column list: [label, value, colour]
      table([{ t: 'Item', w: 70 }, { t: 'Value', w: 30, a: 'r' }], rows.map(function (r) {
        return r[3] === 'sub' ? { cells: [r[0], ''], bold: true, fill: '#f6f8fa' } : { cells: [r[0], r[1]], colors: [null, r[2] || null], bold: r[3] === 'tot', fill: r[3] === 'tot' ? HEAD : null };
      }), { keep: true });
    }

    var s = summarize(model), e = s.envelope, ws = weightSummary(model), hc = hullCheck(model), fr = o.floatRes, st = o.stability, hd = modelHydro(model);
    var gm = groupMap(model), rmap = {};
    model.requirements.forEach(function (r) { rmap[r.id] = r.name; });

    // ----- page 1: title, perspective view, key figures, assessment
    newPage();
    var tx = M;
    if (logo) { doc.image(logo.idx, M, y, 30, 30); tx = M + 40; }
    doc.text(tx, y + 8, 'SHIP DESIGN BUILDING BLOCK EDITOR', { size: 8, bold: true, color: DIM });
    doc.text(tx, y + 27, model.name || 'Untitled design', { size: 20, bold: true });
    doc.text(PW - M, y + 8, 'Design report', { size: 8, bold: true, color: DIM, align: 'right' });
    doc.text(PW - M, y + 21, o.when || '', { size: 8, color: DIM, align: 'right' });
    y += 44;
    doc.line(M, y, M + CW, y, { color: BLUE, w: 1.2 }); y += 10;
    var iso = img('iso');
    if (iso) { var ih = CW * iso.h / iso.w; doc.image(imgIdx.iso, M, y, CW, ih); doc.rect(M, y, CW, ih, { stroke: LINE }); y += ih + 6; }
    var items = [['Length (X)', e ? f(e.length, 2) + ' m' : '-'], ['Beam (Y)', e ? f(e.beam, 2) + ' m' : '-'], ['Height (Z)', e ? f(e.height, 2) + ' m' : '-'], ['Gross volume', f(s.total.vol, 0) + ' m³'], ['Gross area', f(s.total.area, 0) + ' m²'],
      ['Gross tonnage (est.)', f(grossTonnage(model).GT, 0) + ' GT'], ['Block weight', f(ws.blocks.mass, 0) + ' t'], ['Total weight', f(ws.total.mass, 0) + ' t']];
    if (ws.hasHull) items.push(['Displacement', f(ws.disp, 0) + ' t'], ['Margin', f(ws.margin, 0) + ' t (' + f(ws.marginPct, 1) + '%)', ws.margin < 0 ? SEV.bad : INK], ['Draught', model.draught != null ? f(model.draught, 2) + ' m' : '-']);
    tiles(items);
    var a = assessment(model, fr, st), tag = { bad: 'Problem', warn: 'Check', note: 'Note', good: 'OK' };
    heading('Assessment');
    var lines = a.issues.map(function (i) { return { sev: i.sev, text: i.text }; }).concat(a.good.map(function (g) { return { sev: 'good', text: g }; }));
    if (!lines.length) { doc.text(M, y + 8, 'Nothing to report.', { size: 9, color: DIM }); y += 14; }
    lines.forEach(function (l) {
      var wl = wrap(l.text, CW - 62, 9, false);
      ensure(wl.length * 12 + 4);
      doc.text(M, y + 9, tag[l.sev].toUpperCase(), { size: 7, bold: true, color: SEV[l.sev] });
      wl.forEach(function (ln, i) { doc.text(M + 56, y + 9 + i * 12, ln, { size: 9 }); });
      y += wl.length * 12 + 3;
    });

    // ----- page 2: other views
    var vs = ['side', 'top', 'front'].filter(function (k) { return img(k); });
    if (vs.length) {
      newPage();
      doc.text(M, y + 10, 'Views', { size: 12, bold: true, color: BLUE }); y += 16; doc.line(M, y, M + CW, y, { color: BLUE, w: 0.8 }); y += 10;
      var show = function (k, x, w, label) { var im = img(k), h = w * im.h / im.w; doc.image(imgIdx[k], x, y, w, h); doc.rect(x, y, w, h, { stroke: LINE }); doc.text(x + 5, y + 11, label, { size: 7.5, bold: true, color: DIM }); return h; };
      if (img('side')) y += show('side', M, CW, 'Side') + 8;
      var hw = (CW - 8) / 2, hh = 0;
      if (img('top')) hh = Math.max(hh, show('top', M, hw, 'Top'));
      if (img('front')) hh = Math.max(hh, show('front', M + hw + 8, hw, 'Front'));
      y += hh + 8;
    }

    // ----- requirements
    var ev = evaluateRequirements(model, s);
    heading('Requirements', 'Status: Meets shall means the shall is met within the should. Margin is the distance to the shall (to the should when over it). A block counts in full for each requirement it serves.');
    if (!ev.length) { doc.text(M, y + 8, 'No requirements defined.', { size: 9, color: DIM }); y += 14; }
    else {
      table([{ t: 'Requirement', w: 24 }, { t: 'Metric', w: 19 }, { t: 'Shall', w: 12, a: 'r' }, { t: 'Should', w: 12, a: 'r' }, { t: 'Achieved', w: 13, a: 'r' }, { t: 'Blocks', w: 7, a: 'r' }, { t: 'Status', w: 19 }, { t: 'Margin', w: 9, a: 'r' }],
        ev.map(function (x) {
          var r = x.req, un = METRICS[r.metric].unit, sn = r.sense === 'max' ? 'at most' : 'at least';
          return { cells: [r.name, METRICS[r.metric].label + ', ' + sn, r.shall == null ? '-' : f(r.shall, 1) + ' ' + un, r.should == null ? '-' : f(r.should, 1) + ' ' + un, f(x.achieved, 1) + ' ' + un, x.n, statusText(x.status, r), x.margin == null ? '-' : fmtMargin(x.margin)], colors: [null, null, null, null, null, null, SEV[x.status]], boldCols: { 6: true } };
        }));
      var linked = ev.filter(function (x) { return x.blocks.length && (x.req.metric === 'volume' || x.req.metric === 'area' || x.req.metric === 'mass'); });
      if (linked.length) {
        sub('Blocks that serve each requirement');
        table([{ t: 'Requirement', w: 30 }, { t: 'Blocks', w: 70 }], linked.map(function (x) { return { cells: [x.req.name, x.blocks.join(', ')] }; }));
      }
    }

    // ----- systems
    heading('Systems: area and volume');
    table([{ t: 'System', w: 38 }, { t: 'Blocks', w: 9, a: 'r' }, { t: 'Area m²', w: 14, a: 'r' }, { t: 'Volume m³', w: 15, a: 'r' }, { t: 'Share', w: 12, a: 'r' }],
      s.rows.map(function (r) {
        var pct = s.total.vol > 0 ? 100 * r.total.vol / s.total.vol : 0;
        return { cells: [r.group.name, r.total.n, f(r.total.area, 1), f(r.total.vol, 1), f(pct, 1) + '%'], indent: r.depth * 10, swatch: r.group.color, bold: r.depth === 0, fill: r.depth === 0 ? '#f6f8fa' : null, color: r.total.n === 0 ? '#8a94a3' : INK };
      }).concat([{ cells: ['Gross total', s.total.n, f(s.total.area, 1), f(s.total.vol, 1), ''], bold: true, fill: HEAD }]));

    // ----- gross tonnage
    var gtv = grossTonnage(model);
    heading('Gross tonnage (estimate)', 'GT = K1 × V with K1 = 0.2 + 0.02 log10(V), after the 1969 Tonnage Convention. V is the volume of the enclosed spaces: the blocks that are not marked as open. Overlapping blocks count twice. An estimate for design, not a tonnage certificate.');
    kv([['Enclosed volume V (' + gtv.n + ' of ' + model.blocks.length + ' blocks)', f(gtv.V, 1) + ' m³'], ['K1', f(gtv.K1, 4)], ['Gross tonnage', f(gtv.GT, 0) + ' GT', null, 'tot']]);
    var openB = model.blocks.filter(function (b) { return b.gt === false; });
    if (openB.length) para('Open spaces, not counted: ' + openB.map(function (b) { return b.name; }).join(', ') + '.', 8.5, DIM);

    // ----- hulls
    if (hc) {
      heading('Hulls (illustrative)', 'The hull shapes are illustrative, not real lines. Blocks below the main deck: ' + f(hc.blocksBelow, 1) + ' m³, of which ' + f(hc.outside, 1) + ' m³ lie outside the hulls (estimate).');
      table([{ t: 'Hull', w: 20 }, { t: 'Type', w: 16 }, { t: 'Length m', w: 9, a: 'r' }, { t: 'Beam m', w: 8, a: 'r' }, { t: 'Depth m', w: 8, a: 'r' }, { t: 'Draught m', w: 9, a: 'r' }, { t: 'Y offset m', w: 9, a: 'r' }, { t: 'Volume m³', w: 11, a: 'r' }, { t: 'Displaced m³', w: 12, a: 'r' }],
        hc.hulls.map(function (q) { var h = q.hull; return { cells: [h.name, HULL_TYPES[h.type].label, f(h.loa, 2), f(h.beam, 2), f(h.depth, 2), f(h.draught, 2), f(h.y, 2), f(q.volDeck, 1), f(q.volDraught, 1)] }; }), { keep: true });
    }

    // ----- weight and centres
    heading('Weight and centres of gravity', 'Mass = density × volume × fill, or a typed mass. x from the aft end, y to port of the centreline, z above the baseline. Structure and outfitting are ' + f(ws.pct, 0) + '% of the displacement' + (ws.hasHull ? '.' : ' (needs a hull).') + ' Water density ' + f(model.rho || 1.025, 3) + ' t/m³.');
    table([{ t: 'Item', w: 44 }, { t: 'Mass t', w: 14, a: 'r' }, { t: 'LCG m', w: 14, a: 'r' }, { t: 'TCG m', w: 14, a: 'r' }, { t: 'VCG m', w: 14, a: 'r' }],
      [{ cells: ['Blocks (' + ws.blocks.n + ')', f(ws.blocks.mass, 1), f2(ws.blocks.lcg), f2(ws.blocks.tcg), f2(ws.blocks.vcg)] },
       { cells: ['Structure and outfitting', f(ws.struct.mass, 1), f2(ws.struct.lcg), f2(ws.struct.tcg), f2(ws.struct.vcg)] },
       { cells: ['Total weight', f(ws.total.mass, 1), f2(ws.total.lcg), f2(ws.total.tcg), f2(ws.total.vcg)], bold: true, fill: HEAD }].concat(ws.hasHull ? [
       { cells: ['Displacement at the draught, with the centre of buoyancy', f(ws.disp, 1), f2(ws.lcb), f2(ws.tcb), f2(ws.kb)] },
       { cells: ['Margin: displacement minus weight (' + f(ws.marginPct, 1) + '%)', f(ws.margin, 1), '', '', ''], colors: [null, ws.margin < 0 ? SEV.bad : null] },
       { cells: ['LCG minus LCB (positive: weight forward of the buoyancy)', '', ws.lcgMinusLcb == null ? '-' : f(ws.lcgMinusLcb, 2), '', ''] }] : []));
    sub('Weight by group');
    table([{ t: 'System', w: 34 }, { t: 'Blocks', w: 8, a: 'r' }, { t: 'Density t/m³', w: 12, a: 'r' }, { t: 'Mass t', w: 12, a: 'r' }, { t: 'LCG m', w: 11, a: 'r' }, { t: 'TCG m', w: 11, a: 'r' }, { t: 'VCG m', w: 11, a: 'r' }],
      s.rows.map(function (r, i) {
        var wr = ws.rows[i];
        return { cells: [r.group.name, r.total.n, f(wr.density.value, 2) + (wr.density.own ? '' : ' *'), f(wr.total.mass, 1), f2(wr.total.lcg), f2(wr.total.tcg), f2(wr.total.vcg)], indent: r.depth * 10, swatch: r.group.color, bold: r.depth === 0, fill: r.depth === 0 ? '#f6f8fa' : null, color: r.total.n === 0 ? '#8a94a3' : INK };
      }));
    para('* the density is inherited from a parent group or is the default. A block can override it.', 7.5, DIM);

    // ----- floating condition
    if (ws.hasHull) {
      heading('Floating condition', fr && !fr.overloaded ? (model.float ? 'Float is on: the draught and trim follow the weight.' : 'Float is off: the draught is the one chosen. This is where the weight would float.') : '');
      if (!fr) para('Needs blocks with mass.', 9, DIM);
      else if (fr.overloaded) para('The weight is more than the hulls displace at full depth.', 9, SEV.bad);
      else {
        var maxD = (model.hulls || []).reduce(function (m, h) { return Math.max(m, h.depth); }, 0), fl = [['Draught', '', null, 'sub'], ['Total weight', f(fr.weight, 1) + ' t'], ['Level draught that carries it (no trim)', f(fr.T, 2) + ' m'], ['Chosen draught', f(model.draught, 2) + ' m', Math.abs(model.draught - fr.T) > 0.05 ? SEV.bad : null]];
        fl.push(['Trim, longitudinal', '', null, 'sub']);
        if (fr.trimOk) {
          fl.push(['Trim (aft draught minus forward draught)', f(fr.trim, 2) + ' m', Math.abs(fr.angle) > 3 ? SEV.bad : null], ['Trim angle (positive by the stern)', f(fr.angle, 2) + '°'], ['Draught aft', f(fr.draftAft, 2) + ' m', fr.draftAft > maxD ? SEV.bad : null], ['Draught forward', f(fr.draftFwd, 2) + ' m', fr.draftFwd < 0 ? SEV.bad : null]);
          fl.push(['Heel, transverse', '', null, 'sub']);
          if (fr.heelOk) fl.push(['Heel', heel(fr.heel), Math.abs(fr.heel) > 5 ? SEV.bad : null], ['Draught at the port side', f(fr.draftPort, 2) + ' m'], ['Draught at the starboard side', f(fr.draftStbd, 2) + ' m'], ['TCG minus TCB', f(fr.tcg - fr.tcb, 3) + ' m']);
          else fl.push(['Heel', 'no equilibrium found', SEV.bad]);
        } else fl.push(['Trim', 'out of range', SEV.bad]);
        kv(fl);
      }
    }

    // ----- hull geometry: drawings, principal data and offsets
    if (model.hulls && model.hulls.length) {
      heading('Hull geometry', 'Illustrative parametric hulls, not real lines. x from the stern of the hull towards the bow, z above the baseline, half-breadths to either side of the hull centreline. Stations are 0 to 10 along the length. Hulls with the same shape are drawn once.');
      var HC = '#33506b', HL = '#9db0c2', WL = '#1f6fd0', groups = {}, gorder = [];
      model.hulls.forEach(function (h) {
        var key = JSON.stringify([h.type, h.shape || null, Math.round(h.loa * 1e3), Math.round(h.beam * 1e3), Math.round(h.depth * 1e3), Math.round(h.draught * 1e3)]);
        if (!groups[key]) { groups[key] = { h: h, hulls: [] }; gorder.push(key); }
        groups[key].hulls.push(h);
      });
      gorder.forEach(function (key) {
        var G = groups[key], h = G.h, P = hullParams(h), NS = 10, sx = CW / h.loa, pH = h.depth * sx, pB = h.beam * sx;
        var tn = G.hulls.map(function (q) { return q.name; }).join(', '), title = tn + (tn === HULL_TYPES[h.type].label && G.hulls.length === 1 ? '' : ' (' + HULL_TYPES[h.type].label + (G.hulls.length > 1 ? ', ' + G.hulls.length + ' identical hulls' : '') + ')');
        ensure(38 + pH + 20 + pB + 20 + 150);
        sub(title);
        // profile
        var oy = y + 4, X = function (x) { return M + (x - h.x) * sx; }, i, k, t;
        doc.text(M, oy + 6, 'Profile', { size: 7.5, bold: true, color: DIM });
        oy += 10;
        var outline = [[X(hullXRange(h, 0)[0]), oy + pH], [X(hullXRange(h, 0)[1]), oy + pH]];
        for (k = 1; k <= 12; k++) { t = k / 12; outline.push([X(hullXRange(h, t)[1]), oy + pH - t * pH]); }
        for (k = 12; k >= 0; k--) { t = k / 12; outline.push([X(hullXRange(h, t)[0]), oy + pH - t * pH]); }
        doc.poly(outline, { color: HC, w: 1, close: true });
        doc.line(M, oy + pH - h.draught * sx, M + CW, oy + pH - h.draught * sx, { color: WL, w: 0.6 });
        doc.text(M + 3, oy + pH - h.draught * sx - 2, 'T = ' + f(h.draught, 2) + ' m', { size: 6.5, color: WL });
        doc.text(M + CW, oy - 2, 'depth ' + f(h.depth, 2) + ' m', { size: 6.5, color: DIM, align: 'right' });
        for (i = 0; i <= NS; i++) {
          var sxp = M + CW * i / NS;
          doc.line(sxp, oy + pH, sxp, oy + pH + 3, { color: HC, w: 0.5 });
          doc.text(sxp, oy + pH + 10, String(i), { size: 6.5, color: DIM, align: 'center' });
        }
        y = oy + pH + 16;
        // half-breadth plan, with the waterlines
        doc.text(M, y + 6, 'Half-breadth plan, waterlines every 20% of the depth', { size: 7.5, bold: true, color: DIM });
        y += 10;
        var cy = y + pB / 2, zs = [0, 0.2, 0.4, 0.6, 0.8, 1];
        doc.line(M, cy, M + CW, cy, { color: HL, w: 0.4 });
        for (i = 0; i <= NS; i++) doc.line(M + CW * i / NS, y, M + CW * i / NS, y + pB, { color: '#e3e8ee', w: 0.4 });
        var lines = zs.map(function (z) { return { t: z, dash: false, c: z === 1 ? HC : HL, w: z === 1 ? 1 : 0.5 }; }).concat([{ t: Math.min(1, h.draught / h.depth), c: WL, w: 0.8, dash: true }]);
        lines.forEach(function (L) {
          var r = hullXRange(h, L.t), up = [], dn = [], N = 60;
          for (k = 0; k <= N; k++) {
            var u = k / N, xx = X(r[0] + u * (r[1] - r[0])), yy = hullHalf(h, u, L.t) * sx;
            up.push([xx, cy - yy]); dn.push([xx, cy + yy]);
          }
          doc.poly(up, { color: L.c, w: L.w, dash: L.dash ? [3, 2] : null }); doc.poly(dn, { color: L.c, w: L.w, dash: L.dash ? [3, 2] : null });
          doc.line(up[0][0], up[0][1], dn[0][0], dn[0][1], { color: L.c, w: L.w });
          doc.line(up[N][0], up[N][1], dn[N][0], dn[N][1], { color: L.c, w: L.w });
        });
        y += pB + 12;
        // body plan and principal data
        var sb = Math.min(230 / h.beam, 120 / h.depth), bw = h.beam * sb, bh = h.depth * sb, bx = M + bw / 2 + 6, bby = y + 26 + bh;
        doc.text(M, y + 6, 'Body plan: aft stations to the left, forward stations to the right', { size: 7.5, bold: true, color: DIM });
        doc.line(bx, y + 22, bx, bby, { color: HL, w: 0.4 }); doc.line(bx - bw / 2 - 4, bby, bx + bw / 2 + 4, bby, { color: HL, w: 0.4 });
        for (i = 0; i <= NS; i++) {
          var xs = h.x + h.loa * i / NS, side = i < 5 ? -1 : 1, pts = [];
          for (k = 0; k <= 24; k++) {
            t = k / 24;
            var rr = hullXRange(h, t);
            if (xs < rr[0] - 1e-9 || xs > rr[1] + 1e-9) continue;
            pts.push([bx + side * hullHalf(h, (xs - rr[0]) / (rr[1] - rr[0]), t) * sb, bby - t * bh]);
          }
          doc.poly(pts, { color: i === 5 ? '#c0392b' : HC, w: 0.6 });
          if (pts.length && (i === 0 || i === 5 || i === NS)) doc.text(pts[pts.length - 1][0] + side * 3, pts[pts.length - 1][1] - 2, String(i), { size: 6, color: DIM, align: side < 0 ? 'right' : 'left' });
        }
        doc.line(bx - bw / 2 - 4, bby - h.draught * sb, bx + bw / 2 + 4, bby - h.draught * sb, { color: WL, w: 0.6, dash: [3, 2] });
        var dx = M + 290, dy = y + 26, rows2 = [['Length', f(h.loa, 2) + ' m'], ['Beam', f(h.beam, 2) + ' m'], ['Depth (main deck)', f(h.depth, 2) + ' m'], ['Draught', f(h.draught, 2) + ' m'],
          ['Position x, y', G.hulls.map(function (q) { return f(q.x, 2) + ', ' + f(q.y || 0, 2); }).join('  |  ') + ' m'],
          ['Flat bottom', f(100 * P.fb, 0) + '%'], ['Bilge hardness', f(P.m, 1)], ['Bow flare', f(100 * P.flare, 0) + '%'], ['Parallel body', f(100 * (P.ub - P.ua), 0) + '%'], ['Bow fullness', f(P.c, 1)],
          ['Stem width', f(100 * P.pb, 0) + '%'], ['Stem rake', f(100 * P.rake, 1) + '%'], ['Transom width', f(100 * P.ps, 0) + '%'], ['Stern run', f(100 * P.ua, 0) + '%'], ['Stern rake', f(100 * P.sternRake, 1) + '%']];
        rows2.forEach(function (r, ri) {
          doc.text(dx, dy + ri * 10.5, r[0], { size: 7.5, color: DIM });
          doc.text(M + CW, dy + ri * 10.5, r[1], { size: 7.5, bold: true, align: 'right' });
        });
        y = Math.max(bby + 12, dy + rows2.length * 10.5 + 4);
        // table of offsets: half-breadths at the stations and waterlines
        var OF = hullOffsets(h, NS, 5), oc = [{ t: 'Station', w: 8 }, { t: 'x m', w: 10, a: 'r' }].concat(OF.zs.map(function (z) { return { t: 'z ' + f(z, 2), w: 11, a: 'r' }; })), orows = [];
        OF.rows.forEach(function (r) { orows.push({ cells: [String(r.station), f(r.x, 2)].concat(r.half.map(function (v) { return v == null ? '-' : f(v, 2); })) }); });
        ensure(24 + 13 * 11.5 + 14);
        sub('Table of offsets: half-breadths in metres at heights z above the baseline');
        table(oc, orows, { size: 7, keep: true });
      });
    }

    // ----- hull hydrostatics
    if (hd) {
      heading('Hull hydrostatics', 'Upright, at the draught. x from the aft end, KB above the baseline. Cb block, Cp prismatic, Cm midship and Cwp waterplane coefficient.');
      var hr = hd.hulls.map(function (q) { var h = q.h; return { cells: [q.hull.name, f(h.LWL, 2), f(h.BWL, 2), f(h.T, 2), f(h.V, 1), f(h.disp, 1), f(h.Cb, 3), f(h.Cp, 3), f(h.Cm, 3), f(h.Cwp, 3), f(h.Awp, 1), f(h.LCB, 2), f(h.KB, 2), f(h.LCF, 2), f(h.TPC, 2)] }; });
      var t = hd.total;
      hr.push({ cells: ['All hulls' + (Math.abs(t.TCB) > 0.005 ? ' (TCB y ' + f(t.TCB, 2) + ' m)' : ''), '', '', '', f(t.V, 1), f(t.disp, 1), '', '', '', '', f(t.Awp, 1), f(t.LCB, 2), f(t.KB, 2), f(t.LCF, 2), f(t.TPC, 2)], bold: true, fill: HEAD });
      table([{ t: 'Hull', w: 13 }, { t: 'LWL m', w: 6, a: 'r' }, { t: 'BWL m', w: 6, a: 'r' }, { t: 'T m', w: 5, a: 'r' }, { t: 'Vol. m³', w: 7, a: 'r' }, { t: 'Displ. t', w: 7, a: 'r' }, { t: 'Cb', w: 5, a: 'r' }, { t: 'Cp', w: 5, a: 'r' }, { t: 'Cm', w: 5, a: 'r' }, { t: 'Cwp', w: 5, a: 'r' }, { t: 'Awp m²', w: 7, a: 'r' }, { t: 'LCB m', w: 6, a: 'r' }, { t: 'KB m', w: 5, a: 'r' }, { t: 'LCF m', w: 6, a: 'r' }, { t: 'TPC t/cm', w: 6, a: 'r' }], hr, { size: 6.8 });
    }

    // ----- initial stability
    if (ws.hasHull) {
      heading('Initial stability', 'Upright, without trim, at the level draught that carries the weight. Small angles only.');
      if (!st) para('Needs blocks with mass.', 9, DIM);
      else if (st.overloaded) para('The weight is more than the hulls displace at full depth.', 9, SEV.bad);
      else {
        var sr = [['Transverse', '', null, 'sub'], ['Level draught', f(st.T, 2) + ' m'], ['KB (centre of buoyancy above the baseline)', f(st.KB, 2) + ' m'], ['BM (waterplane inertia / volume)', f(st.BMt, 2) + ' m'], ['KM (KB + BM)', f(st.KMt, 2) + ' m'], ['KG (centre of gravity of the weights)', f(st.KG, 2) + ' m'],
          ['GM without free surface (KM - KG)', f(st.GMsolid, 2) + ' m'], ['Free surface correction (' + st.tanks.length + ' of ' + st.marked + ' marked ' + (st.marked === 1 ? 'tank' : 'tanks') + ' partly filled)', f(st.fsT, 3) + ' m'],
          ['GM, corrected', f(st.GM, 2) + ' m', st.GM < 0.15 ? SEV.bad : null, 'tot'], ['Highest KG for GM = 0.15 m', f(st.KGmax, 2) + ' m', st.KG > st.KGmax ? SEV.bad : null],
          ['Longitudinal', '', null, 'sub'], ['BM', f(st.BMl, 1) + ' m'], ['KM', f(st.KMl, 1) + ' m'], ['GM (with free surface)', f(st.GMl, 1) + ' m']];
        if (st.tanks.length) { sr.push(['Free surface by tank (rise of G)', '', null, 'sub']); st.tanks.forEach(function (tk) { sr.push([tk.block.name, f(tk.riseT, 3) + ' m']); }); }
        kv(sr);
        sub('Checks');
        table([{ t: 'Check', w: 40 }, { t: 'Value', w: 14, a: 'r' }, { t: 'Guide', w: 30 }, { t: 'Result', w: 16 }], st.checks.map(function (c) {
          var val = c.value == null ? '-' : (c.name.indexOf('heel') >= 0 || c.name.indexOf('Static') === 0 ? f(Math.abs(c.value) < 0.005 ? 0 : c.value, 2) + '°' : f(c.value, 2) + ' m');
          return { cells: [c.name, val, c.limit, c.status === 'pass' ? 'Met' : c.status === 'fail' ? 'Not met' : 'n/a'], colors: [null, null, null, c.status === 'fail' ? SEV.bad : c.status === 'pass' ? SEV.good : null] };
        }));
      }
    }

    // ----- righting lever
    var gzr = ws.hasHull && st && !st.overloaded ? gzCurve(model, st) : null;
    if (gzr) {
      ensure(230);
      heading('Righting lever (GZ)', 'Heel to one side, trim free, G on the centre line' + (gzr.fsT > 0 ? ', free surface included' : '') + '. The hulls are counted up to the main deck, so the curve ends where the deck edge enters the water.');
      var pwid = CW * 0.58, phgt = 150, px0 = M + 34, py0 = y + 14, pw2 = pwid - 40, xmax = Math.max(40, Math.ceil(gzr.limit / 10) * 10), ymx = 0, ymn = 0, v;
      gzr.pts.forEach(function (p) { ymx = Math.max(ymx, p.gz); ymn = Math.min(ymn, p.gz); });
      var stp = ymx > 4 ? 1 : ymx > 2 ? 0.5 : ymx > 1 ? 0.25 : 0.1, yt = Math.ceil(ymx / stp + 0.2) * stp, yb = Math.floor(ymn / stp) * stp, ph2 = phgt - 30;
      var GX = function (a) { return px0 + a / xmax * pw2; }, GY = function (g) { return py0 + (yt - g) / (yt - yb) * ph2; };
      for (v = yb; v <= yt + 1e-9; v += stp) { doc.line(px0, GY(v), px0 + pw2, GY(v), { color: '#e3e8ee', w: 0.4 }); doc.text(px0 - 4, GY(v) + 2.5, String(Math.round(v * 100) / 100), { size: 7, align: 'right', color: DIM }); }
      for (v = 0; v <= xmax; v += 10) { doc.line(GX(v), py0, GX(v), py0 + ph2, { color: '#e3e8ee', w: 0.4 }); doc.text(GX(v), py0 + ph2 + 10, String(v), { size: 7, align: 'center', color: DIM }); }
      doc.line(px0, GY(0), px0 + pw2, GY(0), { color: DIM, w: 0.8 });
      doc.text(px0 + pw2 / 2, py0 + ph2 + 21, 'Heel angle, degrees', { size: 7.5, align: 'center', color: DIM });
      doc.text(px0 - 4, py0 - 4, 'GZ, m', { size: 7.5, align: 'right', color: DIM });
      doc.poly(gzr.pts.map(function (p) { return [GX(p.phi), GY(p.gz)]; }), { color: BLUE, w: 1.6 });
      gzr.pts.forEach(function (p) { doc.rect(GX(p.phi) - 1.5, GY(p.gz) - 1.5, 3, 3, { fill: BLUE }); });
      if (gzr.reason === 'edge') { doc.line(GX(gzr.limit), py0, GX(gzr.limit), py0 + ph2, { color: DIM, w: 0.8 }); doc.text(GX(gzr.limit) - 3, py0 + 8, 'deck edge in the water', { size: 7, align: 'right', color: DIM }); }
      var kx = M + CW * 0.62, ky = py0 + 6, krows = [['Maximum GZ', (gzr.open ? 'at least ' : '') + f(gzr.maxGZ, 2) + ' m'], ['Angle of maximum GZ', (gzr.open ? 'at least ' : '') + f(gzr.phiMax, 1) + '°'],
        ['Range of positive stability', gzr.phiVan != null ? '0° to ' + f(gzr.phiVan, 1) + '°' : 'beyond ' + f(gzr.limit, 1) + '°'], ['Deck edge in the water', gzr.reason === 'edge' ? f(gzr.limit, 1) + '°' : 'not reached'], ['GM, corrected', f(gzr.GM, 2) + ' m']];
      krows.forEach(function (r, ri) { doc.text(kx, ky + ri * 14, r[0], { size: 8, color: DIM }); doc.text(M + CW, ky + ri * 14, r[1], { size: 8, bold: true, align: 'right' }); });
      y = py0 + phgt + 4;
      sub('GZ criteria (for guidance only: hull counted to the main deck, no openings)');
      table([{ t: 'Criterion', w: 42 }, { t: 'Needed', w: 16, a: 'r' }, { t: 'Value', w: 16, a: 'r' }, { t: 'Result', w: 26 }], gzr.criteria.map(function (c) {
        var d = c.unit === 'm·rad' ? 3 : c.unit === '°' ? 1 : 2;
        return { cells: [c.name, f(c.req, d) + ' ' + c.unit.replace('·rad', ' rad').replace('m rad', 'm.rad'), c.value == null ? '-' : f(c.value, d), (c.ok ? 'Met' : 'Not met') + (c.note ? ' (' + c.note + ')' : '')], colors: [null, null, null, c.ok ? SEV.good : SEV.bad] };
      }), { keep: true });
      sub('GZ by heel angle');
      table([{ t: 'Heel (deg)', w: 14, a: 'r' }, { t: 'Draught m', w: 18, a: 'r' }, { t: 'Trim m', w: 16, a: 'r' }, { t: 'KN m', w: 16, a: 'r' }, { t: 'KG with FS m', w: 18, a: 'r' }, { t: 'GZ m', w: 18, a: 'r' }], gzr.pts.map(function (p) {
        return { cells: [f(p.phi, 1), f(p.T, 2), f(p.trim, 2), f(p.KN, 3), f(p.KGfs, 3), f(p.gz, 3)] };
      }), { size: 7.5, keep: true });
    }

    // ----- resistance (Holtrop), one block per hull
    var rhs = (model.hulls || []).map(function (h) { return modelResistance(model, h); }).filter(function (r) { return r; });
    if (rhs.length) {
      heading('Resistance (Holtrop)', 'Towing resistance by the Holtrop method for displacement ships, at the draught of the hull, without appendages, with the same draught forward and aft, and with a bulbous bow only when it is assumed (not drawn). A first estimate for comparing designs, less accurate for extreme shapes. No propulsion. Sea water 1025 kg/m³.');
      rhs.forEach(function (r) {
        ensure(220);
        sub((rhs.length > 1 ? r.hull.name + ': ' : '') + 'draught ' + f(r.T, 2) + ' m, LWL ' + f(r.hy.LWL, 1) + ' m, BWL ' + f(r.hy.BWL, 1) + ' m, Cb ' + f(r.hy.Cb, 3) + ', service speed ' + f(r.vs, 1) + ' kn (Fn ' + f(r.fn, 3) + '), ' + (AFT_FORMS.filter(function (a) { return a[0] === r.aft; })[0] || [0, 'normal'])[1].toLowerCase() + (r.tr ? ', transom stern' : ', no transom') + (r.bulbDrawn ? ', drawn bulb' : r.bulb ? ', bulb assumed' : ''));
        if (!r.ok) { para('No curve can be drawn for this hull: ' + (r.warnings.length ? r.warnings.join('; ') + '. ' : '') + 'the method does not cover its shape.', 8.5, DIM); return; }
        var pwid = CW * 0.58, phgt = 150, px0 = M + 40, py0 = y + 18, pw2 = pwid - 46, ph2 = phgt - 34, ymx = 0, v, k;
        r.curve.forEach(function (p) { ymx = Math.max(ymx, p.rt / 1000); });
        var raw = ymx / 5, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), stp = [1, 2, 5, 10].map(function (q) { return q * mag; }).filter(function (q) { return q >= raw; })[0], yt = Math.ceil(ymx / stp) * stp, xmax = r.vmax, xs = xmax > 40 ? 10 : xmax > 20 ? 5 : 2;
        var RX = function (a) { return px0 + a / xmax * pw2; }, RY = function (g) { return py0 + (yt - g) / yt * ph2; };
        for (v = 0; v <= yt + 1e-9; v += stp) { doc.line(px0, RY(v), px0 + pw2, RY(v), { color: '#e3e8ee', w: 0.4 }); doc.text(px0 - 4, RY(v) + 2.5, f(v, stp < 1 ? 1 : 0), { size: 7, align: 'right', color: DIM }); }
        for (v = 0; v <= xmax + 1e-9; v += xs) { doc.line(RX(v), py0, RX(v), py0 + ph2, { color: '#e3e8ee', w: 0.4 }); doc.text(RX(v), py0 + ph2 + 10, String(v), { size: 7, align: 'center', color: DIM }); }
        var fmx = r.curve[r.curve.length - 1].fn;
        for (k = 0.1; k <= fmx + 1e-9; k += 0.1) doc.text(RX(k / fmx * xmax), py0 - 5, k.toFixed(1), { size: 7, align: 'center', color: DIM });
        doc.text(px0 - 4, py0 - 5, 'Fn', { size: 7, align: 'right', color: DIM });
        doc.line(px0, RY(0), px0 + pw2, RY(0), { color: DIM, w: 0.8 });
        doc.text(px0 + pw2 / 2, py0 + ph2 + 21, 'Speed, knots', { size: 7.5, align: 'center', color: DIM });
        doc.text(px0 - 4, py0 + ph2 / 2, 'kN', { size: 7.5, align: 'right', color: DIM });
        doc.poly(r.curve.map(function (p) { return [RX(p.v), RY(p.rt / 1000)]; }), { color: BLUE, w: 1.6 });
        doc.line(RX(r.vs), py0, RX(r.vs), py0 + ph2, { color: DIM, w: 0.8, dash: [3, 2] });
        doc.rect(RX(r.vs) - 2, RY(r.at.rt / 1000) - 2, 4, 4, { fill: BLUE });
        var kx = M + CW * 0.62, ky = py0 + 6, a = r.at, kr = [['Total', a.rt], ['Frictional', a.rf], ['Form', a.form], ['Appendage', a.rapp], ['Wave', a.rw], ['Bulbous', a.rb], ['Transom', a.rtr], ['Correlation', a.ra]];
        doc.text(kx, ky - 2, 'At ' + f(r.vs, 1) + ' kn', { size: 8, bold: true });
        kr.forEach(function (q, qi) { doc.text(kx, ky + 12 + qi * 13, q[0], { size: 8, color: DIM, bold: qi === 0 }); doc.text(M + CW, ky + 12 + qi * 13, f(q[1] / 1000, 1) + ' kN', { size: 8, bold: qi === 0, align: 'right' }); });
        y = py0 + phgt + 4;
        if (r.warnings.length) para('Warning: ' + r.warnings.join('; ') + '. The method is less accurate outside its range.', 8, '#8a5a00');
      });
    }

    // ----- seakeeping (Jensen, Mansour and Olsen), one block per hull
    var sks = (model.hulls || []).length ? (function () { var stb = stabilityState(model); return model.hulls.map(function (h) { return modelSeakeeping(model, h, stb); }).filter(function (r) { return r; }); })() : [];
    if (sks.length) {
      heading('Seakeeping', 'Closed-form estimate of the ship motions in regular waves at the draught of the hull, then in one sea state. A first estimate for comparing designs. Sea water 1025 kg/m³.' + (sks.length > 1 ? ' Seakeeping of multihulls is not possible: each hull is taken alone.' : ''));
      sks.forEach(function (r) {
        ensure(150);
        if (!r.ok) { sub((sks.length > 1 ? r.hull.name + ': ' : '') + r.reason); return; }
        var p = r.p, c = r.c, bt = p.B0 / p.T;
        sub((sks.length > 1 ? r.hull.name + ': ' : '') + 'draught ' + f(p.T, 2) + ' m, speed ' + f(p.vkn, 1) + ' kn (Fn ' + f(c.fn, 3) + '), waves ' + f(p.amp, 2) + ' m from ' + f(p.head, 0) + ' deg, position ' + f(p.pos, 0) + '%');
        para('L ' + f(p.L, 1) + ' m, B ' + f(p.B0, 1) + ' m, Cb ' + f(p.Cb, 3) + ', Cwp ' + f(p.Cwp, 3) + ', GM ' + f(p.GM, 2) + ' m, roll period ' + f(p.Tn, 1) + ' s, damping ' + f(p.damp, 0) + '% of critical, length ratio ' + f(p.delta, 2) + '. Position: % of half the length from the centre of gravity, plus forward.', 8, DIM);
        var charts = [['Vertical motion, m/m', 'vert'], ['Vertical acceleration, m/s2', 'acc'], ['Pitch motion, m/m', 'pitch'], ['Heave motion, m/m', 'heave'], ['Wave bending moment, 1e6 N.m', 'bm'], ['Roll motion, deg', 'roll']];
        var cw2 = (CW - 16) / 2, ch2 = 112, ci;
        for (ci = 0; ci < charts.length; ci++) {
          if (ci % 2 === 0) ensure(ch2 + 8);
          var cx = M + (ci % 2) * (cw2 + 16), cy = y, ys = c[charts[ci][1]], ym = 0, qi, v;
          var yn = 0;
          ys.forEach(function (q) { if (q !== null && q > ym) ym = q; if (q !== null && q < yn) yn = q; });
          if (!(ym > 0)) ym = yn < 0 ? 0 : 1;
          var rw = (ym - yn) / 3, mg = Math.pow(10, Math.floor(Math.log(rw) / Math.LN10)), sp = [1, 2, 2.5, 5, 10].map(function (q) { return q * mg; }).filter(function (q) { return q >= rw; })[0], yt2 = Math.ceil(ym / sp - 1e-9) * sp, yb2 = Math.floor(yn / sp + 1e-9) * sp, yr2 = yt2 - yb2;
          var gx0 = cx + 34, gy0 = cy + 12, gw = cw2 - 40, gh = ch2 - 34, x0 = c.freq[0], x1 = c.freq[c.freq.length - 1];
          var QX = function (w) { return gx0 + (w - x0) / (x1 - x0) * gw; }, QY = function (q) { return gy0 + (yt2 - q) / yr2 * gh; };
          if (seakeepingOff(p, c)[charts[ci][1]]) doc.rect(gx0, gy0, gw, gh, { fill: '#f6dada' });
          ((c.bands && c.bands[charts[ci][1]]) || []).forEach(function (bd) { doc.rect(QX(bd[0]), gy0, Math.max(1, QX(bd[1]) - QX(bd[0])), gh, { fill: '#f6dada' }); });
          doc.text(cx, cy + 6, charts[ci][0], { size: 7.5, bold: true });
          for (v = yb2; v <= yt2 + sp * 1e-6; v += sp) { doc.line(gx0, QY(v), gx0 + gw, QY(v), { color: '#e3e8ee', w: 0.4 }); doc.text(gx0 - 3, QY(v) + 2.5, f(v, sp < 0.01 ? 3 : sp < 0.1 ? 2 : sp < 1 ? 1 : 0), { size: 6.5, align: 'right', color: DIM }); }
          for (v = 0.5; v <= x1 + 1e-9; v += 0.5) { doc.line(QX(v), gy0, QX(v), gy0 + gh, { color: '#e3e8ee', w: 0.4 }); doc.text(QX(v), gy0 + gh + 8, v.toFixed(1), { size: 6.5, align: 'center', color: DIM }); }
          doc.line(gx0, QY(0), gx0 + gw, QY(0), { color: DIM, w: 0.8 });
          doc.text(gx0 + gw / 2, gy0 + gh + 17, 'Wave frequency, rad/s', { size: 6.5, align: 'center', color: DIM });
          var runp = [];
          for (qi = 0; qi < ys.length; qi += 4) { if (ys[qi] === null) { if (runp.length > 1) doc.poly(runp, { color: BLUE, w: 1.2 }); runp = []; } else runp.push([QX(c.freq[qi]), QY(Math.max(yb2, Math.min(ys[qi], yt2)))]); }
          if (runp.length > 1) doc.poly(runp, { color: BLUE, w: 1.2 });
          if (ci % 2 === 1 || ci === charts.length - 1) y += ch2 + 4;
        }
        if (r.warnings.length) para('Warning: ' + r.warnings.join('; ') + '. The method is less accurate outside its limits.', 8, '#8a5a00');
        var sa = modelSeaState(model, r.hull, stabilityState(model));
        if (sa && sa.ok) {
          ensure(120);
          sub('Sea state' + (sks.length > 1 ? ' of ' + r.hull.name : '') + ': Hs ' + f(sa.ss.hs, 2) + ' m, ' + (sa.ss.gam <= 1.0001 ? 'Pierson-Moskowitz' : 'JONSWAP, gamma ' + f(sa.ss.gam, 1)) + ', Tz ' + f(sa.sp.tz, 2) + ' s, Tp ' + f(sa.sp.tp, 2) + ' s, ' + f(sa.ss.hrs, 1) + ' h');
          para('Amplitudes. Significant is twice the RMS. The maximum is the most probable one for the duration.', 8, DIM);
          table([{ t: 'Response', w: 34 }, { t: 'RMS', w: 14, a: 'r' }, { t: 'Significant', w: 14, a: 'r' }, { t: 'Max. probable', w: 15, a: 'r' }, { t: 'Period s', w: 11, a: 'r' }, { t: 'Cycles', w: 12, a: 'r' }],
            sa.rows.map(function (q) { var d = q.unit === 'm/s²' ? 3 : 2, u = q.unit === 'm/s²' ? ' m/s2' : q.unit === '°' ? ' deg' : ' ' + q.unit; return { cells: [q.label + (q.off ? ' (outside limits)' : ''), f(q.rms, d) + u, f(q.sig, d) + u, f(q.max, d) + u, q.tr ? f(q.tr, 1) : '-', q.n ? f(q.n, 0) : '-'] }; }), { keep: true });
          para('Motion sickness (ISO 2631-1, Wf weighting, vertical acceleration at the position): MSDV ' + f(sa.msdv.msdv, 1) + ' m/s^1.5 over ' + f(sa.ss.hrs, 1) + ' h, vomiting incidence VI = MSDV/3 = ' + f(sa.msdv.vi, 1) + '%.', 8);
          if (sa.crit.length) table([{ t: 'Limit (RMS)', w: 34 }, { t: 'Limit', w: 18, a: 'r' }, { t: 'Response', w: 18, a: 'r' }, { t: 'Ratio', w: 14, a: 'r' }, { t: 'Limiting Hs m', w: 16, a: 'r' }],
            sa.crit.map(function (q) { var d = q.key === 'acc' ? 3 : 2, u = q.unit === '°' ? ' deg' : ' ' + q.unit; return { cells: [q.label, f(q.limit, d) + u, f(q.value, d) + u, f(q.value / q.limit, 2) + (q.ok ? '' : ' exceeded'), q.hsLimit ? f(q.hsLimit, 2) : '-'], colors: [null, null, null, q.ok ? null : '#b3261e', null] }; }), { keep: true });
          if (sa.warnings.length) para('Warning: ' + sa.warnings.join('; ') + '.', 8, '#8a5a00');
        }
      });
    }

    // ----- structure (DNV Pt.3 Ch.2 first check), single hull
    var stp = (model.hulls || []).length === 1 ? modelStructure(model, o.floatRes && o.floatRes.ok ? { fl: o.floatRes } : {}) : null;
    if (stp && stp.ok) {
      ensure(220); heading('Structure', 'First check to the DNV Rules for Ships, Pt.3 Ch.2 (2015, ships under 100 m). Educational, not a class check: single hull, no buckling, shear strength, fatigue, bulkheads or girders.');
      var sd = stp.dm, sq = stp.req, ss2 = stp.section, st2 = stp.st;
      para('L ' + f(sd.L, 1) + ' m, B ' + f(sd.B, 2) + ' m, D ' + f(sd.D, 2) + ' m, T ' + f(sd.T, 2) + ' m, Cb ' + f(sd.Cb, 3) + '. Steel ' + st2.grade + ', service area ' + st2.area + ', corrosion addition ' + f(st2.tk, 1) + ' mm, web spacing ' + f(st2.span, 2) + ' m.', 8.5);
      if (stp.loads) {
        ensure(150);
        var lo2 = stp.loads, cx2 = M, cy2 = y, cwid = CW, chgt = 120, gx2 = cx2 + 40, gy2 = cy2 + 12, gw2 = cwid - 46, gh2 = chgt - 34, i2, mn = 0, mx2 = 0;
        var sagC = stp.rule.map(function (q) { return (q.soSag + q.wSag) / 1000; }), hogC = stp.rule.map(function (q) { return -(q.soSag + q.wHog) / 1000; }), calc = lo2.M.map(function (v) { return v / 1000; });
        sagC.concat(hogC, calc).forEach(function (v) { if (v > mx2) mx2 = v; if (v < mn) mn = v; });
        var rng = (mx2 - mn) / 4, mg2 = Math.pow(10, Math.floor(Math.log(rng) / Math.LN10)), sp2 = [1, 2, 2.5, 5, 10].map(function (q) { return q * mg2; }).filter(function (q) { return q >= rng; })[0];
        var yt3 = Math.ceil(mx2 / sp2 - 1e-9) * sp2, yb3 = Math.floor(mn / sp2 + 1e-9) * sp2, xs2 = lo2.xe.map(function (v) { return v - sd.xAP; }), xr0 = xs2[0], xr1 = xs2[xs2.length - 1], v2;
        var PX = function (v) { return gx2 + (v - xr0) / (xr1 - xr0) * gw2; }, PY = function (v) { return gy2 + (yt3 - v) / (yt3 - yb3) * gh2; };
        doc.text(cx2, cy2 + 6, 'Bending moment, MN.m (sagging +): calculated stillwater (solid), rule limits in sagging and hogging (grey)', { size: 7.5, bold: true });
        for (v2 = yb3; v2 <= yt3 + sp2 * 1e-6; v2 += sp2) { doc.line(gx2, PY(v2), gx2 + gw2, PY(v2), { color: '#e3e8ee', w: 0.4 }); doc.text(gx2 - 3, PY(v2) + 2.5, f(v2, 0), { size: 6.5, align: 'right', color: DIM }); }
        for (v2 = 0; v2 <= xr1; v2 += Math.max(10, Math.round(sd.L / 6 / 10) * 10)) { doc.text(PX(v2), gy2 + gh2 + 8, f(v2, 0), { size: 6.5, align: 'center', color: DIM }); }
        doc.text(gx2 + gw2 / 2, gy2 + gh2 + 17, 'Distance from AP, m', { size: 6.5, align: 'center', color: DIM });
        doc.line(gx2, PY(0), gx2 + gw2, PY(0), { color: DIM, w: 0.8 });
        doc.poly(sagC.map(function (v, i3) { return [PX(xs2[i3]), PY(v)]; }), { color: DIM, w: 1 }); doc.poly(hogC.map(function (v, i3) { return [PX(xs2[i3]), PY(v)]; }), { color: DIM, w: 1 });
        doc.poly(calc.map(function (v, i3) { return [PX(xs2[i3]), PY(v)]; }), { color: BLUE, w: 1.4 });
        y = cy2 + chgt + 4;
      }
      table([{ t: 'Longitudinal strength (Sec.4)', w: 52 }, { t: 'Sagging', w: 24, a: 'r' }, { t: 'Hogging', w: 24, a: 'r' }],
        [{ cells: ['Stillwater moment used, MN.m', f(sq.MsSag / 1000, 1), f(sq.MsHog / 1000, 1)] }, { cells: ['Calculated stillwater, MN.m', stp.Ms ? f(stp.Ms.sag / 1000, 1) : '-', stp.Ms ? f(stp.Ms.hog / 1000, 1) : '-'] },
          { cells: ['Wave moment, MN.m', f(sq.MwoSag / 1000, 1), f(sq.MwoHog / 1000, 1)] }, { cells: ['Required modulus, cm3', f(sq.ZSag, 0), f(sq.ZHog, 0)] },
          { cells: ['Minimum modulus Z0, cm3', f(sq.Z0, 0), ''] }, { cells: ['Section modulus at deck / bottom, cm3', f(ss2.zDeck, 0), f(ss2.zBot, 0)] }, { cells: ['Required (' + sq.governs + '), cm3', f(sq.Zreq, 0), (stp.zok ? 'met' : 'NOT MET')] }]);
      table([{ t: 'Local scantlings', w: 34 }, { t: 'p kN/m2', w: 14, a: 'r' }, { t: 'Required', w: 18, a: 'r' }, { t: 'Chosen', w: 18, a: 'r' }, { t: 'Check', w: 16, a: 'r' }],
        stp.local.map(function (q) { var u = q.unit === 'mm' ? ' mm' : ' cm3', d = q.unit === 'mm' ? 1 : 0; return { cells: [q.item, q.p == null ? '-' : f(q.p, 1), f(q.required, d) + u, f(q.chosen, d) + u, q.ok ? 'OK' : 'NOT OK'] }; }));
      para('Estimated steel ' + f(stp.steel.mass, 0) + ' t (section ' + f(stp.steel.perLength, 2) + ' t/m, hull length ' + f(stp.h.loa, 1) + ' m, allowance ' + f(st2.wf, 2) + '); ' + (st2.steelOn ? 'in use for the weights.' : 'the structure share is in use for the weights.'), 8.5);
      if (stp.warnings.length) para('Warning: ' + stp.warnings.join(' '), 8, '#8a5a00');
    }

    // ----- what if: the original with the saved variants, or with the options of the What if tab
    var wsh = o.whatIfShow || null, wit = wsh ? wsh.items : ((model.variants || []).length && (model.hulls || []).length ? wiCols(model).map(function (q) { return { label: q.label, sub: q.rec ? wiRecipe(q.rec) : '', snap: q.snap, img: null }; }) : []);
    if (wit.length > 1) {
      var wsaved = wsh ? wsh.saved : true, nwc = wit.length;
      ensure(250);
      heading(wsaved ? 'What if: saved variants' : 'What if: options', wsaved ? 'The original and the variants saved in the What if window: the blocks linked to one requirement are scaled to a target. Each design is at the level draught that carries its weight.' : 'No variant is saved in this project. These are the options the What if tab offers for ' + wsh.reqName + ': the blocks linked to it are scaled in length to the shall, midway and the should (a target equal to the original is left out). Save variants in the What if tab to have your own here.');
      if (wit.some(function (q) { return q.img; })) {
        var per = Math.min(nwc, 3), cw = (CW - (per - 1) * 8) / per, k, ih0 = 0;
        wit.forEach(function (q) { if (q.img) ih0 = Math.max(ih0, cw * q.img.h / q.img.w); });
        for (k = 0; k < nwc; k += per) {
          ensure(ih0 + 62);
          wit.slice(k, k + per).forEach(function (q, j) {
            var x = M + j * (cw + 8), s = q.snap, yy = y;
            if (q.img) { var ii = doc.addImage(q.img.jpeg, q.img.w, q.img.h), hh = cw * q.img.h / q.img.w; doc.image(ii, x, yy, cw, hh); doc.rect(x, yy, cw, hh, { stroke: LINE }); }
            yy += ih0 + 9;
            doc.text(x, yy, q.label, { size: 8, bold: true }); yy += 9;
            wrap(q.sub || ' ', cw, 6.5, false).slice(0, 2).forEach(function (ln) { doc.text(x, yy, ln, { size: 6.5, color: DIM }); yy += 8; });
            doc.text(x, yy, 'L x B x D  ' + f(s.loa, 1) + ' x ' + f(s.beam, 1) + ' x ' + f(s.depth, 1) + ' m', { size: 6.5 }); yy += 8;
            doc.text(x, yy, 'L/B ' + f(s.LB, 2) + '   B/T ' + f(s.BT, 2) + '   L/D ' + f(s.LD, 1), { size: 6.5 }); yy += 8;
            doc.text(x, yy, f(s.weight, 0) + ' t   T ' + f(s.draught, 2) + ' m   GM ' + f(s.GM, 2) + ' m', { size: 6.5 });
          });
          y += ih0 + 56;
        }
      }
      var wcol = [{ t: 'Item', w: 30 }].concat(wit.map(function (q) { return { t: q.label, w: 70 / nwc, a: 'r' }; }));
      var wrw = [{ cells: ['What was changed', 'None'].concat(wit.slice(1).map(function (q) { return q.sub; })) }];
      WI_ROWS.forEach(function (rw) {
        if (rw[0] === 's') { wrw.push({ cells: [rw[1]], bold: true }); return; }
        if (['weight', 'draught', 'trim', 'GM', 'loa', 'beam', 'depth', 'disp', 'Cb'].indexOf(rw[1]) < 0) return;
        wrw.push({ cells: [rw[0] + (rw[3] ? ' (' + rw[3] + ')' : '')].concat(wit.map(function (q) { return q.snap[rw[1]] == null ? '-' : f(q.snap[rw[1]], rw[2]); })) });
      });
      wrw.push({ cells: ['Requirements'], bold: true });
      model.requirements.forEach(function (rq) {
        wrw.push({ cells: [rq.name].concat(wit.map(function (q) { var x = (q.snap.reqs || []).filter(function (z) { return z.id === rq.id; })[0]; return x ? f(x.achieved, 1) + ' ' + (x.status === 'ok' ? 'met' : x.status === 'excess' ? 'excess' : x.status === 'fail' ? 'NOT MET' : '') : '-'; })) });
      });
      table(wcol, wrw, { size: 7.5, keep: true });
    }

    // ----- what if: what each requirement would ask (computed by the app, optional)
    if (o.whatIfAuto && o.whatIfAuto.rows && o.whatIfAuto.rows.length) {
      var wa = o.whatIfAuto, b0 = wa.base;
      ensure(Math.min(560, 70 + wa.rows.length * 14));
      heading('What if: what the requirements ask', 'For each requirement, the ship with the blocks linked to it scaled in length (or in its own direction, for length, beam and height) to the shall and to the should. Each ship is at its level draught. One requirement is changed at a time.');
      var wrows = [], lastReq = '';
      wa.rows.forEach(function (r) {
        var un = METRICS[r.metric] ? METRICS[r.metric].unit : '';
        if (r.reqId !== lastReq) { lastReq = r.reqId; wrows.push({ cells: [r.reqName + ' (now ' + f(r.current, 1) + ' ' + un + ')', '', '', '', '', '', ''], bold: true }); }
        var lab = (r.kind === 'shall' ? 'To the shall ' : 'To the should ') + f(r.target, 1) + ' ' + un;
        if (r.same) { wrows.push({ cells: [lab, 'already', '', '', '', '', ''], indent: 1 }); return; }
        if (r.skipped) { wrows.push({ cells: [lab, 'not computed', '', '', '', '', ''], indent: 1 }); return; }
        if (!r.after) { wrows.push({ cells: [lab, r.reason || 'not possible', '', '', '', '', ''], indent: 1 }); return; }
        var nm = (r.after.reqs || []).filter(function (x) { return x.id !== r.reqId && x.status === 'fail'; }).map(function (x) { var q = model.requirements.filter(function (z) { return z.id === x.id; })[0]; return q ? q.name : x.id; });
        var dw = r.after.weight - b0.weight;
        wrows.push({ cells: [lab, (dw >= 0 ? '+' : '') + f(dw, 0) + ' t', f(r.after.loa, 1), f(r.after.beam, 2), f(r.after.draught, 2), f(r.after.GM, 2), nm.length ? nm.join(', ') : 'none'], indent: 1 });
      });
      table([{ t: 'Target', w: 29 }, { t: 'Weight', w: 10, a: 'r' }, { t: 'LOA (m)', w: 9, a: 'r' }, { t: 'Beam (m)', w: 9, a: 'r' }, { t: 'Draught (m)', w: 10, a: 'r' }, { t: 'GM (m)', w: 8, a: 'r' }, { t: 'Other requirements not met', w: 25 }], wrows, { size: 7.5, keep: true });
      para('Original: weight ' + f(b0.weight, 0) + ' t, LOA ' + f(b0.loa, 1) + ' m, beam ' + f(b0.beam, 2) + ' m, draught ' + f(b0.draught, 2) + ' m, GM ' + f(b0.GM, 2) + ' m.' + (wa.skipped ? ' ' + wa.skipped + ' more requirement' + (wa.skipped > 1 ? 's were' : ' was') + ' not computed (limit of the report).' : ''), 8);
    }

    // ----- assumptions
    heading('Assumptions and limits');
    (o.assumptions || []).forEach(function (t) {
      var wl = wrap(t, CW - 12, 8.5, false);
      ensure(wl.length * 11.5 + 3);
      doc.text(M + 2, y + 8.5, '-', { size: 8.5, color: DIM });
      wl.forEach(function (ln, i) { doc.text(M + 12, y + 8.5 + i * 11.5, ln, { size: 8.5 }); });
      y += wl.length * 11.5 + 3;
    });
    para('For educational use only. The hulls are illustrative parametric shapes, not real lines, and the weights, hydrostatics, trim, heel and stability are simplified estimates. Not for design approval, class or flag-state documentation, or any safety-critical decision.', 8.5, DIM);

    // ----- appendix: all blocks, on landscape pages
    if (model.blocks.length) {
      newPage(true);
      heading('Appendix: blocks', 'Size L × B × H and centre x, y, z in metres, rotation in degrees. CG is the centroid of the shape. "Outside" is the share of the block that lies outside the hulls, below the main deck (estimate).');
      var br = model.blocks.map(function (b) {
        var q = blockMass(model, b), cg = blockCentroid(b), rot = b.rotation[0] || b.rotation[1] || b.rotation[2] ? b.rotation.map(function (v) { return f(v, 0); }).join(', ') : '-';
        return { cells: [b.name + (b.deck ? ' (main deck)' : ''), gm[b.group] ? gm[b.group].name : '', blockReqs(b).map(function (x) { return rmap[x]; }).join(', ') || '-', SHAPES[b.shape].label, b.size.map(function (v) { return f(v, 2); }).join(' × '), b.position.map(function (v) { return f(v, 2); }).join(', '), rot, b.gt === false ? 'open' : 'yes',
          f(blockVolume(b), 1), f(blockArea(b), 1) + (b.areaOverride != null ? ' *' : ''), f(q.density, 2), f(q.fill, 0), f(q.mass, 1) + (q.typed ? ' *' : ''), cg.map(function (v) { return f(v, 1); }).join(', '), hc && hc.byId[b.id] ? f(100 * hc.byId[b.id].shareBlock, 0) + '%' : '-'], swatch: gm[b.group] ? gm[b.group].color : null };
      });
      table([{ t: 'Block', w: 15 }, { t: 'Group', w: 10 }, { t: 'Requirements', w: 13 }, { t: 'Shape', w: 7 }, { t: 'Size m', w: 12, a: 'r' }, { t: 'Centre m', w: 12, a: 'r' }, { t: 'Rot.', w: 6, a: 'r' }, { t: 'GT', w: 3 }, { t: 'Vol. m³', w: 6, a: 'r' }, { t: 'Area m²', w: 6, a: 'r' }, { t: 'Dens.', w: 5, a: 'r' }, { t: 'Fill %', w: 4, a: 'r' }, { t: 'Mass t', w: 6, a: 'r' }, { t: 'CG m', w: 11, a: 'r' }, { t: 'Outside', w: 5, a: 'r' }], br, { size: 6.6 });
      para('* the area or mass was typed by hand.', 7.5, DIM);
    }

    // ----- footer on every page
    var n = doc.pageCount();
    for (var p = 0; p < n; p++) {
      doc.goto(p);
      var pw = doc.pageW(), ph = doc.pageH();
      doc.line(M, ph - M + 6, pw - M, ph - M + 6, { color: LINE, w: 0.4 });
      doc.text(M, ph - M + 17, model.name || 'Design', { size: 7, color: DIM });
      doc.text(pw - M, ph - M + 17, 'Page ' + (p + 1) + ' of ' + n, { size: 7, color: DIM, align: 'right' });
      doc.text(pw / 2, ph - M + 17, 'For educational use only', { size: 7, color: DIM, align: 'center' });
      var st = o.stamp || stampText(new Date()), k = st.indexOf(APP_URL);
      doc.text(M, ph - M + 26, (k > 0 ? st.slice(0, k) : st).trim(), { size: 5.5, color: '#8a94a3' });
      if (k > 0) doc.text(pw * 0.72, ph - M + 26, APP_URL, { size: 5.5, color: '#8a94a3' });
    }
    if (o.appendPages) o.appendPages(doc);          // e.g. the GA drawing sheets, after the report pages
    return doc.build();
  }

  // table of offsets: half-breadths (m) at ns+1 stations and nl+1 heights above the baseline; null outside the hull
  function hullOffsets(h, ns, nl) {
    var zs = [], rows = [], i, j;
    for (j = 0; j <= nl; j++) zs.push(h.depth * j / nl);
    for (i = 0; i <= ns; i++) {
      var xs = h.loa * i / ns, vals = [];
      for (j = 0; j <= nl; j++) {
        var t = j / nl, r = hullXRange(h, t), xa = h.x + xs;
        vals.push(xa < r[0] - 1e-9 || xa > r[1] + 1e-9 ? null : hullHalf(h, (xa - r[0]) / (r[1] - r[0]), t));
      }
      rows.push({ station: i, x: xs, half: vals });
    }
    return { zs: zs, rows: rows };
  }

  function xlsxBuild(sheets) {
    var reg = xreg(), files = [], ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>';
    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    sheets.forEach(function (sh, i) {
      var n = i + 1, nm = xesc(sh.name.replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31));
      sh.tab = i === 0;
      ct += '<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      wb += '<sheet name="' + nm + '" sheetId="' + n + '" r:id="rId' + n + '"/>';
      rels += '<Relationship Id="rId' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/>';
      files.push(['xl/worksheets/sheet' + n + '.xml', xsheetXml(sh, reg)]);
    });
    rels += '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    files.unshift(['[Content_Types].xml', ct + '</Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', wb + '</sheets></workbook>'], ['xl/_rels/workbook.xml.rels', rels], ['xl/styles.xml', reg.xml()]);
    return zipStore(files);
  }

  /* The sheets of the workbook: the same tables as the screen, with units in the headers. */
  function workbookSheets(model, when) {
    var s = summarize(model), ws = weightSummary(model), gm = groupMap(model), hc = hullCheck(model), hd = modelHydro(model);
    var H = function (arr) { return arr.map(function (t) { return { v: t, s: 'h' }; }); };
    var nv = function (v, st) { return v == null ? '' : { v: r4(v), s: st || 'n2' }; };
    var sheets = [];

    // 0 summary: the same numbers as the app shows, gathered on one page (no new calculation)
    var e0 = s.envelope, fl = hd ? floatState(model) : null, ev0 = evaluateRequirements(model);
    var sm = [[{ v: model.name + ': summary', s: 'title' }], [{ v: 'Generated with the DBB Block Editor, NTNU, https://shiplab.github.io/dbb/ . Exported ' + (when || '') + '. Values as in the app; the other sheets give the detail.', s: 'note' }], []];
    var line = function (label, val, unit) { sm.push([label, val, unit || '']); };
    var as0 = assessment(model, fl, hd ? undefined : null), sevFill = { bad: 'F8CBAD', warn: 'FFEB9C', ok: 'C6EFCE', note: 'EDEDED', none: 'EDEDED' }, sevWord = { bad: 'Problem', warn: 'Check', ok: 'OK', note: 'Note', none: '-' };
    sm.push(H(['Assessment', 'Result', 'Status']));
    as0.chips.forEach(function (c) { sm.push([{ v: c.label, s: 'b' }, c.value, { v: sevWord[c.sev], s: 'n|' + sevFill[c.sev] }]); });
    if (as0.issues.length || as0.good.length) {
      sm.push([]); sm.push(H(['Issues and checks', '', '', '', '', '', '', '']));
      as0.issues.forEach(function (i) { var st = 'n|' + sevFill[i.sev], row = [{ v: sevWord[i.sev] + ': ' + i.text, s: st }]; for (var q = 0; q < 7; q++) row.push({ v: '', s: st }); sm.push(row); });
      as0.good.forEach(function (g) { var st = 'n|' + sevFill.ok, row = [{ v: 'OK: ' + g, s: st }]; for (var q = 0; q < 7; q++) row.push({ v: '', s: st }); sm.push(row); });
    }
    sm.push([]);
    sm.push(H(['Geometry', 'Value', 'Unit']));
    line('Blocks', model.blocks.length); line('Overall length (X)', e0 ? nv(e0.length) : 0, 'm'); line('Overall beam (Y)', e0 ? nv(e0.beam) : 0, 'm'); line('Overall height (Z)', e0 ? nv(e0.height) : 0, 'm');
    line('Gross volume of blocks', nv(s.total.vol), 'm3'); line('Gross area of blocks', nv(s.total.area), 'm2');
    var gt0 = grossTonnage(model), lastB = model.blocks.length + 1;
    line('Enclosed volume for GT', model.blocks.length ? { v: r4(gt0.V), s: 'n2', f: 'SUMIF(Blocks!AD2:AD' + lastB + ',"yes",Blocks!P2:P' + lastB + ')' } : nv(gt0.V), 'm3');
    line('Gross tonnage, GT (estimate)', model.blocks.length ? { v: r4(gt0.GT), s: 'bn2', f: '(0.2+0.02*LOG10(B' + (sm.length + 0) + '))*B' + (sm.length + 0) } : nv(gt0.GT), 'GT');
    sm.push([]); sm.push(H(['Weight and centres', 'Value', 'Unit']));
    line('Blocks', nv(ws.blocks.mass), 't'); line('Structure and outfitting (' + r4(ws.pct) + '% of displacement)', nv(ws.struct.mass), 't'); line('Total weight', nv(ws.total.mass, 'bn2'), 't');
    line('LCG x (from the aft end)', nv(ws.total.lcg), 'm'); line('TCG y (to port)', nv(ws.total.tcg), 'm'); line('VCG z (above the baseline)', nv(ws.total.vcg), 'm');
    if (ws.hasHull) {
      sm.push([]); sm.push(H(['Hull and buoyancy', 'Value', 'Unit']));
      line('Water density', { v: model.rho || 1.025, s: 'n3' }, 't/m3'); line('Draught set', nv(model.draught), 'm'); line('Displacement at that draught', nv(ws.disp), 't');
      line('Margin: displacement minus weight', nv(ws.margin), 't'); line('LCB x', nv(ws.lcb), 'm'); line('KB', nv(ws.kb), 'm'); line('LCG minus LCB', nv(ws.lcgMinusLcb), 'm');
      if (fl && !fl.overloaded && fl.trimOk) {
        line('Floating at the weight: level draught', nv(fl.T), 'm'); line('Draught aft', nv(fl.draftAft), 'm'); line('Draught forward', nv(fl.draftFwd), 'm');
        line('Trim (aft minus forward)', nv(fl.trim), 'm'); line('Trim angle (positive by the stern)', nv(fl.angle), 'deg');
        line('Heel (positive to port)', fl.heelOk ? nv(fl.heel) : 'no equilibrium found', fl.heelOk ? 'deg' : '');
      } else if (fl && fl.overloaded) line('Floating at the weight', 'more than the hulls displace at full depth');
    }
    var sb0 = ws.hasHull ? stabilityState(model, fl) : null;
    if (sb0 && !sb0.overloaded) {
      sm.push([]); sm.push(H(['Initial stability (small angles)', 'Value', 'Unit']));
      line('KB', nv(sb0.KB), 'm'); line('BM transverse', nv(sb0.BMt), 'm'); line('KM transverse', nv(sb0.KMt), 'm'); line('KG', nv(sb0.KG), 'm');
      line('Free surface correction', nv(sb0.fsT, 'n3'), 'm'); line('GM transverse, corrected', nv(sb0.GM, 'bn2'), 'm'); line('GM longitudinal', nv(sb0.GMl, 'n1'), 'm');
      var gz0 = gzCurve(model, sb0);
      if (gz0) {
        line('Maximum GZ' + (gz0.open ? ' (at least)' : ''), nv(gz0.maxGZ), 'm'); line('Angle of maximum GZ' + (gz0.open ? ' (at least)' : ''), nv(gz0.phiMax, 'n1'), 'deg');
        line('Deck edge in the water', gz0.reason === 'edge' ? nv(gz0.limit, 'n1') : 'not reached', gz0.reason === 'edge' ? 'deg' : '');
      }
      sb0.checks.forEach(function (c) { line(c.name + ' (' + c.limit + ')', { v: c.status === 'pass' ? 'Met' : c.status === 'fail' ? 'Not met' : 'n/a', s: 'n|' + (c.status === 'pass' ? 'C6EFCE' : c.status === 'fail' ? 'F8CBAD' : 'EDEDED') }); });
    }
    if (ev0.length) {
      sm.push([]); sm.push(H(['Requirements', 'Count', '']));
      var stN = { ok: 0, excess: 0, fail: 0, none: 0 }; ev0.forEach(function (x) { stN[x.status] = (stN[x.status] || 0) + 1; });
      var stF = { ok: 'C6EFCE', excess: 'FFEB9C', fail: 'F8CBAD', none: 'EDEDED' };
      ['ok', 'excess', 'fail', 'none'].forEach(function (k) { sm.push([{ v: STATUS_LABEL[k], s: 'n|' + stF[k] }, stN[k] || 0, '']); });
    }
    sm.push([]); sm.push(H(['Main systems', 'Blocks', 'Area (m2)', 'Volume (m3)', 'Mass (t)', 'LCG x (m)', 'TCG y (m)', 'VCG z (m)']));
    s.rows.forEach(function (r, i) {
      if (r.depth !== 0) return;
      var w = ws.rows[i], tn = tint(r.group.color, 0.55), lt = tint(r.group.color, 0.82);
      sm.push([{ v: r.group.name, s: 'b|' + tn }, { v: r.total.n, s: 'n|' + lt }, nv(r.total.area, 'n2|' + lt), nv(r.total.vol, 'n2|' + lt), nv(w.total.mass, 'n2|' + lt), nv(w.total.lcg, 'n2|' + lt), nv(w.total.tcg, 'n2|' + lt), nv(w.total.vcg, 'n2|' + lt)]);
    });
    sheets.push({ name: 'Summary', rows: sm, widths: [52, 16, 14, 14, 12, 12, 12, 12] });

    // 1 project
    var pr = [[{ v: model.name, s: 'title' }], [{ v: 'Generated with the DBB Block Editor (Design Building Block approach), NTNU, https://shiplab.github.io/dbb/ . Exported ' + (when || ''), s: 'note' }], [],
      [{ v: 'Blocks', s: 'b' }, model.blocks.length], [{ v: 'Groups', s: 'b' }, model.groups.length], [{ v: 'Requirements', s: 'b' }, model.requirements.length], [{ v: 'Hulls', s: 'b' }, (model.hulls || []).length],
      [{ v: 'Water density (t/m3)', s: 'b' }, { v: model.rho || 1.025, s: 'n3' }], [{ v: 'Structure and outfitting (% of displacement)', s: 'b' }, ws.pct],
      [{ v: 'Float (draught and trim follow the weight)', s: 'b' }, model.float ? 'on' : 'off'], [],
      [{ v: 'Notes', s: 'b' }],
      [{ v: 'x is measured forward from the aft end, y to port, z up from the baseline. Lengths in m, volumes in m3, masses in t.', s: 'note' }],
      [{ v: 'For educational use only. Hulls are illustrative parametric shapes, not real lines. Hydrostatics, trim, heel, initial stability (GM) and the righting lever (GZ) are indicative: buoyancy comes from the hulls only up to the main deck, the GZ curve ends where the deck edge enters the water, and there is no wind, wave, opening or damage case. Not for design approval, class or safety decisions.', s: 'note' }],
      [{ v: 'The Mass column in the Output and Blocks sheets is a formula (density x volume x fill) unless the mass was typed. Edit a density or fill there and the totals follow.', s: 'note' }]];
    sheets.push({ name: 'Project', rows: pr, widths: [46, 26] });

    // 2 output: the groups in taxonomy order, each with its blocks, coloured as in the app; group rows add up their blocks
    var gcol = function (id) { return gm[id] ? gm[id].color : '#9aa5b1'; };
    var items = [], ri;
    s.rows.forEach(function (r, i) {
      items.push({ kind: 'group', r: r, i: i });
      model.blocks.forEach(function (b) { if (b.group === r.group.id) items.push({ kind: 'block', b: b }); });
    });
    var OH = 4;                                                            // rows above the first item (title, note, blank, header)
    var out = [[{ v: model.name + ': block output', s: 'title' }], [{ v: 'Groups in the system breakdown. A group row adds up the blocks below it, so a parent group includes its subgroups. Colours as in the app.', s: 'note' }], [],
      H(['', 'System / block', 'Requirement', 'Shape', 'Blocks', 'Area (m2)', 'Volume (m3)', 'Density (t/m3)', 'Fill (%)', 'Mass (t)', 'LCG x (m)', 'TCG y (m)', 'VCG z (m)'])];
    items.forEach(function (it, k) { it.row = OH + 1 + k; });               // Excel row of each item
    items.forEach(function (it, k) {
      if (it.kind === 'group') {
        var r = it.r, w = ws.rows[it.i], col = gcol(r.group.id), tn = tint(col, r.depth === 0 ? 0.45 : 0.72), end = k;
        for (var q = k + 1; q < items.length; q++) { if (items[q].kind === 'group' && items[q].r.depth <= r.depth) break; end = q; }
        var f = function (c) { return end > k ? 'SUBTOTAL(9,' + c + (it.row + 1) + ':' + c + items[end].row + ')' : null; };
        var tot = function (v, c, st) { return v == null ? { v: '', s: st + '|' + tn } : { v: r4(v), s: st + '|' + tn, f: f(c) }; };
        out.push([{ v: '', s: 'n|' + hex6(col) }, { v: new Array(r.depth * 2 + 1).join(' ') + r.group.name, s: 'b|' + tn }, { v: '', s: 'n|' + tn }, { v: '', s: 'n|' + tn }, { v: r.total.n, s: 'b|' + tn },
          tot(r.total.area, 'F', 'bn2'), tot(r.total.vol, 'G', 'bn2'), { v: r4(w.density.value), s: 'n3|' + tn }, { v: '', s: 'n|' + tn }, tot(w.total.mass, 'J', 'bn2'),
          nv(w.total.lcg, 'bn2|' + tn), nv(w.total.tcg, 'bn2|' + tn), nv(w.total.vcg, 'bn2|' + tn)]);
      } else {
        var b = it.b, q2 = blockMass(model, b), cg = blockCentroid(b), n = it.row, tb = tint(gcol(b.group), 0.88);
        out.push([{ v: '', s: 'n|' + hex6(gcol(b.group)) }, { v: '   ' + b.name, s: 'n|' + tb }, blockReqs(b).map(rmap2).join('; '), SHAPES[b.shape].label, 1, nv(blockArea(b)), nv(blockVolume(b)), nv(q2.density, 'n3'), nv(q2.fill, 'n1'),
          q2.typed ? { v: r4(q2.mass), s: 'n2' } : { v: r4(q2.mass), s: 'n2', f: 'G' + n + '*H' + n + '*I' + n + '/100' }, nv(cg[0]), nv(cg[1]), nv(cg[2])]);
      }
    });
    function rmap2(id) { var r = model.requirements.filter(function (x) { return x.id === id; })[0]; return r ? r.name : ''; }
    if (items.length) {
      var lastRow = OH + items.length, top = OH + 1;
      out.push([{ v: '', s: 'n' }, { v: 'Gross total', s: 'b' }, '', '', { v: s.total.n, s: 'b' },
        { v: r4(s.total.area), s: 'bn2', f: 'SUBTOTAL(9,F' + top + ':F' + lastRow + ')' }, { v: r4(s.total.vol), s: 'bn2', f: 'SUBTOTAL(9,G' + top + ':G' + lastRow + ')' }, '', '',
        { v: r4(ws.blocks.mass), s: 'bn2', f: 'SUBTOTAL(9,J' + top + ':J' + lastRow + ')' }, nv(ws.blocks.lcg, 'bn2'), nv(ws.blocks.tcg, 'bn2'), nv(ws.blocks.vcg, 'bn2')]);
    }
    out.push([]);
    var e = s.envelope;
    out.push([{ v: '', s: 'n' }, { v: 'Overall dimensions', s: 'b' }]);
    out.push(['', 'Length (X, m)', '', '', '', e ? nv(e.length) : 0]); out.push(['', 'Beam (Y, m)', '', '', '', e ? nv(e.beam) : 0]); out.push(['', 'Height (Z, m)', '', '', '', e ? nv(e.height) : 0]);
    out.push([]);
    out.push(H(['', 'Requirement', 'Metric (unit)', 'Sense', 'Blocks', 'Shall', 'Should', 'Achieved', '', 'Status', 'Inside hulls, estimate', 'Status inside hulls']));
    var stFill = { ok: 'C6EFCE', excess: 'FFEB9C', fail: 'F8CBAD', none: 'EDEDED' };
    evaluateRequirements(model).forEach(function (ev) {
      var r = ev.req, st = 'n|' + stFill[ev.status];
      out.push(['', r.name, METRICS[r.metric].label + ' (' + METRICS[r.metric].unit + ')', r.sense === 'max' ? 'at most' : 'at least', ev.n, nv(r.shall), nv(r.should), nv(ev.achieved), '', { v: statusText(ev.status, r) + (ev.margin == null ? '' : ' ' + fmtMargin(ev.margin)), s: st },
        nv(ev.inside), ev.statusInside ? { v: statusText(ev.statusInside, r), s: 'n|' + stFill[ev.statusInside] } : '']);
    });
    sheets.push({ name: 'Output', rows: out, widths: [3, 46, 24, 14, 8, 12, 13, 14, 9, 12, 12, 12, 12], freeze: OH });

    // 3 blocks, with formulas
    var rmap = {}; model.requirements.forEach(function (r) { rmap[r.id] = r.name; });
    var br = [H(['Id', 'Name', 'Group path', 'Group', 'Requirement', 'Shape', 'X (m)', 'Y (m)', 'Z (m)', 'Length (m)', 'Beam (m)', 'Height (m)', 'Rot X (deg)', 'Rot Y (deg)', 'Rot Z (deg)',
      'Volume (m3)', 'Area (m2)', 'Volume below main deck (m3)', 'Volume outside hulls, estimate (m3)', 'Outside share (%)', 'Density (t/m3)', 'Fill (%)', 'Mass (t)', 'Mass typed', 'CG x (m)', 'CG y (m)', 'CG z (m)', 'Free surface', 'Main deck', 'Counts for GT'])];
    model.blocks.forEach(function (b, i) {
      var q = blockMass(model, b), cg = blockCentroid(b), n = i + 2, vol = blockVolume(b);
      var gc = gm[b.group] ? gm[b.group].color : '#9aa5b1', tb2 = 'n|' + tint(gc, 0.8);
      br.push([{ v: b.id, s: 'n|' + hex6(gc) }, { v: b.name, s: tb2 }, groupPath(model, b.group), { v: gm[b.group] ? gm[b.group].name : '', s: tb2 }, blockReqs(b).map(function (x) { return rmap[x]; }).join('; '), SHAPES[b.shape].label,
        nv(b.position[0]), nv(b.position[1]), nv(b.position[2]), nv(b.size[0]), nv(b.size[1]), nv(b.size[2]), nv(b.rotation[0], 'n1'), nv(b.rotation[1], 'n1'), nv(b.rotation[2], 'n1'),
        nv(vol), nv(blockArea(b)), hc ? nv(hc.byId[b.id].below) : '', hc ? nv(hc.byId[b.id].out) : '', hc ? nv(100 * hc.byId[b.id].shareBlock, 'n1') : '',
        nv(q.density, 'n3'), nv(q.fill, 'n1'),
        q.typed ? nv(q.mass) : { v: r4(q.mass), s: 'n2', f: 'P' + n + '*U' + n + '*V' + n + '/100' }, q.typed ? 'yes' : 'no', nv(cg[0]), nv(cg[1]), nv(cg[2]), b.freeSurface ? 'yes' : 'no', b.deck ? 'yes' : 'no', b.gt === false ? 'no' : 'yes']);
    });
    var last = model.blocks.length + 1, tr = last + 1;
    if (model.blocks.length) {
      var sp = function (col) { return 'SUMPRODUCT(W2:W' + last + ',' + col + '2:' + col + last + ')/SUM(W2:W' + last + ')'; };
      var tot = [{ v: 'Total', s: 'b' }]; for (var z = 1; z < 29; z++) tot.push('');
      tot[15] = { v: r4(s.total.vol), s: 'bn2', f: 'SUM(P2:P' + last + ')' };
      tot[16] = { v: r4(s.total.area), s: 'bn2', f: 'SUM(Q2:Q' + last + ')' };
      tot[22] = { v: r4(ws.blocks.mass), s: 'bn2', f: 'SUM(W2:W' + last + ')' };
      if (ws.blocks.lcg != null) { tot[24] = { v: r4(ws.blocks.lcg), s: 'bn2', f: sp('Y') }; tot[25] = { v: r4(ws.blocks.tcg), s: 'bn2', f: sp('Z') }; tot[26] = { v: r4(ws.blocks.vcg), s: 'bn2', f: sp('AA') }; }
      br.push(tot);
    }
    sheets.push({ name: 'Blocks', rows: br, widths: [7, 28, 34, 22, 22, 14].concat(new Array(22).fill(13)), freeze: 1 });

    // 4 weight
    var wr = [H(['System', 'Blocks', 'Density (t/m3)', 'Mass (t)', 'LCG x (m)', 'TCG y (m)', 'VCG z (m)'])];
    s.rows.forEach(function (r, i) {
      var w = ws.rows[i];
      var gc = r.group.color, strong = tint(gc, r.depth === 0 ? 0.3 : 0.55), light = tint(gc, r.depth === 0 ? 0.6 : 0.82);
      wr.push([{ v: new Array(r.depth * 2 + 1).join(' ') + r.group.name, s: (r.depth === 0 ? 'b|' : 'n|') + strong }, { v: r.total.n, s: 'n|' + light }, nv(w.density.value, 'n3|' + light), nv(w.total.mass, 'n2|' + light),
        nv(w.total.lcg, 'n2|' + light), nv(w.total.tcg, 'n2|' + light), nv(w.total.vcg, 'n2|' + light)]);
    });
    wr.push([]);
    wr.push(H(['Weight balance', '', '', 'Mass (t)', 'LCG x (m)', 'TCG y (m)', 'VCG z (m)']));
    var r0 = wr.length;                                                   // row index of the next row = r0 + 1 in Excel
    wr.push(['Blocks', '', '', nv(ws.blocks.mass), nv(ws.blocks.lcg), nv(ws.blocks.tcg), nv(ws.blocks.vcg)]);
    wr.push(['Structure and outfitting (' + r4(ws.pct) + '% of displacement)', '', '', nv(ws.struct.mass), nv(ws.struct.lcg), nv(ws.struct.tcg), nv(ws.struct.vcg)]);
    wr.push([{ v: 'Total weight', s: 'b' }, '', '', { v: r4(ws.total.mass), s: 'bn2', f: 'D' + (r0 + 1) + '+D' + (r0 + 2) },
      ws.total.lcg == null ? '' : { v: r4(ws.total.lcg), s: 'bn2', f: '(D' + (r0 + 1) + '*E' + (r0 + 1) + '+D' + (r0 + 2) + '*E' + (r0 + 2) + ')/D' + (r0 + 3) },
      ws.total.tcg == null ? '' : { v: r4(ws.total.tcg), s: 'bn2', f: '(D' + (r0 + 1) + '*F' + (r0 + 1) + '+D' + (r0 + 2) + '*F' + (r0 + 2) + ')/D' + (r0 + 3) },
      ws.total.vcg == null ? '' : { v: r4(ws.total.vcg), s: 'bn2', f: '(D' + (r0 + 1) + '*G' + (r0 + 1) + '+D' + (r0 + 2) + '*G' + (r0 + 2) + ')/D' + (r0 + 3) }]);
    if (ws.hasHull) {
      wr.push(['Displacement at the draught, with the centre of buoyancy (LCB, TCB, KB)', '', '', nv(ws.disp), nv(ws.lcb), nv(ws.tcb), nv(ws.kb)]);
      wr.push(['Margin: displacement minus weight (t)', '', '', { v: r4(ws.margin), s: 'n2', f: 'D' + (r0 + 4) + '-D' + (r0 + 3) }]);
      wr.push(['LCG minus LCB (m, positive = weight forward of the buoyancy)', '', '', '', { v: r4(ws.lcgMinusLcb), s: 'n2', f: 'E' + (r0 + 3) + '-E' + (r0 + 4) }]);
    }
    sheets.push({ name: 'Weight', rows: wr, widths: [58, 10, 14, 12, 12, 12, 12], freeze: 1 });

    // 5 hydrostatics
    if (hd) {
      var hr = [H(['Hull', 'LWL (m)', 'BWL (m)', 'Draught (m)', 'Volume (m3)', 'Displacement (t)', 'Cb', 'Cp', 'Cm', 'Cwp', 'Waterplane area (m2)', 'LCB x (m)', 'KB (m)', 'LCF x (m)', 'TPC (t/cm)'])];
      hd.hulls.forEach(function (q) {
        var x = q.h; hr.push([q.hull.name, nv(x.LWL), nv(x.BWL), nv(x.T), nv(x.V), nv(x.disp), nv(x.Cb, 'n3'), nv(x.Cp, 'n3'), nv(x.Cm, 'n3'), nv(x.Cwp, 'n3'), nv(x.Awp), nv(x.LCB), nv(x.KB), nv(x.LCF), nv(x.TPC)]);
      });
      var t = hd.total;
      hr.push([{ v: 'All hulls', s: 'b' }, '', '', '', nv(t.V, 'bn2'), nv(t.disp, 'bn2'), '', '', '', '', nv(t.Awp, 'bn2'), nv(t.LCB, 'bn2'), nv(t.KB, 'bn2'), nv(t.LCF, 'bn2'), nv(t.TPC, 'bn2')]);
      hr.push([{ v: 'Transverse centre of buoyancy y (m, to port)', s: 'b' }, '', '', '', '', '', '', '', '', '', '', '', nv(t.TCB)]);
      var f = floatState(model);
      hr.push([]);
      hr.push(H(['Floating at the weight', 'Value']));
      if (f && !f.overloaded) {
        hr.push(['Total weight (t)', nv(f.weight)]); hr.push(['Level draught that carries it (m)', nv(f.T)]); hr.push(['Chosen draught (m)', nv(model.draught)]);
        if (f.trimOk) {
          hr.push(['Trim (m, aft draught minus forward draught)', nv(f.trim)]); hr.push(['Trim angle (deg, positive by the stern)', nv(f.angle)]);
          hr.push(['Draught aft (m)', nv(f.draftAft)]); hr.push(['Draught forward (m)', nv(f.draftFwd)]);
          if (f.heelOk) {
            hr.push(['Heel (deg, positive to port)', nv(f.heel)]); hr.push(['Draught at the port side, midships (m)', nv(f.draftPort)]); hr.push(['Draught at the starboard side, midships (m)', nv(f.draftStbd)]);
          } else hr.push(['Heel', 'no equilibrium found']);
        } else hr.push(['Trim', 'out of range']);
      } else hr.push([f && f.overloaded ? 'The weight is more than the hulls displace at full depth.' : 'Needs blocks with mass.']);
      var sb = stabilityState(model, f);
      if (sb && !sb.overloaded) {
        hr.push([]); hr.push(H(['Initial stability (upright, level draught, small angles)', 'Value']));
        hr.push(['Level draught (m)', nv(sb.T)]); hr.push(['KB (m)', nv(sb.KB)]); hr.push(['BM transverse (m)', nv(sb.BMt)]); hr.push(['KM transverse (m)', nv(sb.KMt)]); hr.push(['KG (m)', nv(sb.KG)]);
        hr.push(['GM without free surface (m)', nv(sb.GMsolid)]); hr.push(['Free surface correction (m)', nv(sb.fsT, 'n3')]); hr.push([{ v: 'GM transverse, corrected (m)', s: 'b' }, nv(sb.GM, 'bn2')]);
        hr.push(['Highest KG for GM = 0.15 m (m)', nv(sb.KGmax)]);
        hr.push(['BM longitudinal (m)', nv(sb.BMl, 'n1')]); hr.push(['KM longitudinal (m)', nv(sb.KMl, 'n1')]); hr.push(['GM longitudinal (m)', nv(sb.GMl, 'n1')]);
        sb.tanks.forEach(function (t) { hr.push(['Free surface: ' + t.block.name + ', rise of G (m)', nv(t.riseT, 'n3')]); });
      }
      if (hc) {
        hr.push([]);
        hr.push(H(['Hulls (illustrative)', 'Type', 'Length (m)', 'Beam (m)', 'Depth to main deck (m)', 'Draught (m)', 'Y offset (m)', 'Volume to main deck (m3)', 'Displaced volume (m3)']));
        hc.hulls.forEach(function (q) { var h = q.hull; hr.push([h.name, HULL_TYPES[h.type].label, nv(h.loa), nv(h.beam), nv(h.depth), nv(h.draught), nv(h.y), nv(q.volDeck), nv(q.volDraught)]); });
        hr.push([{ v: 'Block volume below main deck (m3)', s: 'b' }, '', '', '', '', '', '', nv(hc.blocksBelow)]);
        hr.push([{ v: 'Block volume outside hulls, estimate (m3)', s: 'b' }, '', '', '', '', '', '', nv(hc.outside)]);
      }
      sheets.push({ name: 'Hydrostatics', rows: hr, widths: [46, 12, 12, 12, 14, 16, 9, 9, 9, 9, 18, 12, 10, 12, 12], freeze: 1 });
    }

    // righting lever GZ
    var gsb = model.hulls && model.hulls.length ? stabilityState(model, null) : null, gzc = gsb && !gsb.overloaded ? gzCurve(model, gsb) : null;
    if (gzc) {
      var gr = [[{ v: 'Righting lever GZ', s: 'b' }],
        ['Heel to one side, trim free, G on the centre line. Hulls counted up to the main deck: the curve ends where the deck edge enters the water. For guidance only, no openings.'],
        ['GZ = KN - KG x sin(angle). KG includes the free surface correction.'], [],
        H(['Heel angle (deg)', 'Draught at midship (m)', 'Trim (m)', 'KN (m)', 'KG with free surface (m)', 'GZ (m)'])];
      var g0 = gr.length;
      gzc.pts.forEach(function (p, i) {
        var rr = g0 + i + 1;
        gr.push([nv(p.phi, 'n1'), nv(p.T), nv(p.trim), nv(p.KN, 'n3'), nv(p.KGfs, 'n3'), { v: r4(p.gz), s: 'bn2', f: 'D' + rr + '-E' + rr + '*SIN(RADIANS(A' + rr + '))' }]);
      });
      gr.push([]); gr.push(H(['Result', 'Value', 'Unit']));
      gr.push(['Maximum GZ' + (gzc.open ? ' (at least)' : ''), nv(gzc.maxGZ), 'm']);
      gr.push(['Angle of maximum GZ' + (gzc.open ? ' (at least)' : ''), nv(gzc.phiMax, 'n1'), 'deg']);
      gr.push(['Range of positive stability', gzc.phiVan != null ? nv(gzc.phiVan, 'n1') : 'beyond ' + r4(gzc.limit), 'deg']);
      gr.push(['Deck edge in the water', gzc.reason === 'edge' ? nv(gzc.limit, 'n1') : 'not reached', 'deg']);
      gr.push([]); gr.push(H(['Criterion (guidance only)', 'Needed', 'Value', 'Result']));
      gzc.criteria.forEach(function (c) {
        gr.push([c.name + ' (' + c.unit + ')', nv(c.req, 'n3'), c.value == null ? '' : nv(c.value, 'n3'), { v: (c.ok ? 'Met' : 'Not met') + (c.note ? ' (' + c.note + ')' : ''), s: 'n|' + (c.ok ? 'C6EFCE' : 'F8CBAD') }]);
      });
      sheets.push({ name: 'GZ', rows: gr, widths: [44, 22, 12, 12, 24, 12], freeze: 0 });
    }

    // resistance (Holtrop), one block per hull
    var rsh = (model.hulls || []).map(function (h) { return modelResistance(model, h); }).filter(function (r) { return r; });
    if (rsh.length) {
      var rr = [[{ v: 'Resistance (Holtrop)', s: 'b' }],
        ['Towing resistance by the Holtrop method for displacement ships, at the draught of each hull, without bulb or appendages and with the same draught forward and aft. A first estimate for comparing designs; less accurate for extreme shapes. No propulsion. Sea water 1025 kg/m3.']];
      rsh.forEach(function (r) {
        rr.push([]); rr.push(H([r.hull.name, 'Value', 'Unit']));
        var b0 = rr.length;                                     // the row number of the next line is b0 + 1
        rr.push(['Draught', nv(r.T), 'm']); rr.push(['LWL', nv(r.hy.LWL), 'm']); rr.push(['BWL', nv(r.hy.BWL), 'm']);
        rr.push(['Cb', nv(r.hy.Cb, 'n3'), '']); rr.push(['Cm', nv(r.hy.Cm, 'n3'), '']); rr.push(['Cp', { v: r4(r.hy.Cb / r.hy.Cm), s: 'n3', f: 'B' + (b0 + 4) + '/B' + (b0 + 5) }, 'Cb / Cm']);
        rr.push(['Cwp', nv(r.hy.Cwp, 'n3'), '']);
        rr.push(['LCB, forward of the middle of the waterline', nv(r.model.lr === undefined ? 0 : (r.hy.LCB - r.hy.xa - r.hy.LWL / 2) / r.hy.LWL * 100, 'n2'), '% of LWL']);
        rr.push(['Afterbody form', (AFT_FORMS.filter(function (a) { return a[0] === r.aft; })[0] || [0, 'Normal sections'])[1], '']);
        rr.push(['Transom stern', r.tr ? 'yes' : 'no', '']); rr.push([r.bulbDrawn ? 'Bulbous bow (drawn)' : 'Bulbous bow (assumed for the resistance, not drawn)', r.bulb ? 'yes' : 'no', '']);
        rr.push(['Service speed', nv(r.vs, 'n1'), 'knots']);
        rr.push(['Froude number', { v: r4(r.fn), s: 'n3', f: 'B' + (b0 + 12) + '*0.514444/SQRT(9.81*B' + (b0 + 2) + ')' }, '']);
        if (!r.ok) { rr.push([{ v: 'No curve can be drawn for this hull: the method does not cover its shape.', s: 'b' }]); return; }
        rr.push([]); rr.push(H(['At the service speed', 'kN']));
        var a = r.at, p0 = rr.length;
        rr.push(['Frictional', nv(a.rf / 1000, 'n1')]); rr.push(['Form', nv(a.form / 1000, 'n1')]); rr.push(['Appendage', nv(a.rapp / 1000, 'n1')]); rr.push(['Wave', nv(a.rw / 1000, 'n1')]);
        rr.push(['Bulbous', nv(a.rb / 1000, 'n1')]); rr.push(['Transom', nv(a.rtr / 1000, 'n1')]); rr.push(['Correlation', nv(a.ra / 1000, 'n1')]);
        rr.push([{ v: 'Total', s: 'b' }, { v: r4(a.rt / 1000), s: 'bn1', f: 'SUM(B' + (p0 + 1) + ':B' + (p0 + 7) + ')' }]);
        if (r.warnings.length) rr.push([{ v: 'Warning: ' + r.warnings.join('; ') + '. The method is less accurate outside its range.', s: 'b' }]);
        rr.push([]); rr.push(H(['Speed (knots)', 'Froude number', 'Total resistance (kN)']));
        var cr0 = rr.length;
        r.curve.forEach(function (q, qi) { if (qi % 3 === 0 || qi === r.curve.length - 1) { var rw = rr.length + 1; rr.push([nv(q.v, 'n1'), { v: r4(q.fn), s: 'n3', f: 'A' + rw + '*0.514444/SQRT(9.81*B' + (b0 + 2) + ')' }, nv(q.rt / 1000, 'n1')]); } });
      });
      sheets.push({ name: 'Resistance', rows: rr, widths: [46, 16, 22], freeze: 0 });
    }

    // seakeeping, one block per hull: the inputs, and the responses at every fifth frequency
    var skx = (model.hulls || []).length ? (function () { var stb = stabilityState(model); return model.hulls.map(function (h) { return modelSeakeeping(model, h, stb); }).filter(function (r) { return r && r.ok; }); })() : [];
    if (skx.length) {
      var sr = [[{ v: 'Seakeeping (Jensen, Mansour and Olsen)', s: 'b' }],
        ['Closed-form estimate of the ship motions in regular waves, at the draught of each hull, with the ship as a box of waterline length and draught and breadth of waterline breadth times Cb. Response per wave frequency for the wave amplitude given. A first estimate for comparing designs. A sea state with short-term statistics follows the inputs of each hull. Sea water 1025 kg/m3.']];
      skx.forEach(function (r) {
        var p = r.p, c = r.c;
        sr.push([]); sr.push(H([r.hull.name, 'Value', 'Unit']));
        sr.push(['Length (LWL)', nv(p.L), 'm']); sr.push(['Waterline breadth', nv(p.B0), 'm']); sr.push(['Draught', nv(p.T), 'm']); sr.push(['Cb', nv(p.Cb, 'n3'), '']); sr.push(['Cwp', nv(p.Cwp, 'n3'), '']);
        sr.push(['GM', nv(p.GM), 'm']); sr.push(['Roll natural period', nv(p.Tn, 'n1'), 's']); sr.push(['Roll damping', nv(p.damp, 'n'), '% of critical']); sr.push(['Prismatic length ratio', nv(p.delta), '']);
        sr.push(['Speed', nv(p.vkn, 'n1'), 'knots']); sr.push(['Froude number', nv(c.fn, 'n3'), '']); sr.push(['Wave heading (180 = head waves)', nv(p.head, 'n'), 'degrees']);
        sr.push(['Wave amplitude', nv(p.amp), 'm']); sr.push(['Position from the CG (+ forward)', nv(p.pos, 'n'), '% of half length']);
        if (r.warnings.length) sr.push([{ v: 'Warning: ' + r.warnings.join('; ') + '. The method is less accurate outside its limits.', s: 'b' }]);
        var sa = modelSeaState(model, r.hull, stabilityState(model));
        if (sa && sa.ok) {
          sr.push([]); sr.push(H(['Sea state: ' + r.hull.name, 'Value', 'Unit']));
          sr.push(['Significant wave height Hs', nv(sa.ss.hs), 'm']); sr.push(['Spectrum', sa.ss.gam <= 1.0001 ? 'Pierson-Moskowitz' : 'JONSWAP', '']); sr.push(['Peak factor gamma', nv(sa.ss.gam, 'n1'), '']);
          sr.push(['Zero-crossing period Tz', nv(sa.sp.tz, 'n2'), 's']); sr.push(['Peak period Tp', nv(sa.sp.tp, 'n2'), 's']); sr.push(['Duration', nv(sa.ss.hrs, 'n1'), 'h']);
          sr.push([]); sr.push(H(['Response (amplitude)', 'RMS', 'Significant', 'Most probable maximum', 'Response period (s)', 'Cycles', 'Unit']));
          sa.rows.forEach(function (q) { sr.push([q.label + (q.off ? ' (outside the limits)' : ''), nv(q.rms, 'n3'), nv(q.sig, 'n3'), nv(q.max, 'n3'), q.tr ? nv(q.tr, 'n1') : '', q.n ? nv(q.n, 'n') : '', q.unit]); });
          sr.push(['Motion sickness dose value, MSDV', nv(sa.msdv.msdv, 'n1'), 'm/s^1.5']); sr.push(['Vomiting incidence VI = MSDV/3', nv(sa.msdv.vi, 'n1'), '%']);
          if (sa.crit.length) { sr.push([]); sr.push(H(['Limit (RMS, MSDV)', 'Limit', 'Response', 'Ratio', 'Limiting Hs (m)', '', 'Unit'])); sa.crit.forEach(function (q) { sr.push([q.label, nv(q.limit, 'n3'), nv(q.value, 'n3'), nv(q.value / q.limit, 'n2'), q.hsLimit ? nv(q.hsLimit, 'n2') : '', '', q.unit]); }); }
          if (sa.warnings.length) sr.push([{ v: 'Warning: ' + sa.warnings.join('; ') + '.', s: 'b' }]);
        }
        sr.push([]); sr.push(H(['Wave frequency (rad/s)', 'Wave period (s)', 'Vertical motion (m/m)', 'Vertical acceleration (m/s2)', 'Pitch (m/m)', 'Heave (m/m)', 'Bending moment (1e6 N.m)', 'Roll (deg)']));
        c.freq.forEach(function (w, qi) { if (qi % 20 === 0 || qi === c.freq.length - 1) sr.push([nv(w, 'n3'), nv(c.period[qi], 'n2'), nv(c.vert[qi], 'n3'), nv(c.acc[qi], 'n3'), nv(c.pitch[qi], 'n3'), nv(c.heave[qi], 'n3'), nv(c.bm[qi], 'n3'), nv(c.roll[qi], 'n3')]); });
      });
      sheets.push({ name: 'Seakeeping', rows: sr, widths: [46, 16, 22, 26, 14, 14, 24, 12], freeze: 0 });
    }

    // structure (DNV Pt.3 Ch.2 first check), single hull
    var stx = (model.hulls || []).length === 1 ? modelStructure(model) : null;
    if (stx && stx.ok) {
      var sr2 = [[{ v: 'Structure: first check to the DNV Rules for Ships Pt.3 Ch.2 (January 2015, ships under 100 m)', s: 'b' }],
        ['Educational, not a class check. Single hull; no buckling, shear strength, fatigue, bulkheads or girders. Moment positive in sagging.'], [], H(['Input', 'Value', 'Unit'])];
      var dd = stx.dm, qq = stx.req, ss3 = stx.section, s3 = stx.st;
      sr2.push(['Rule length L (96% of LWL)', nv(dd.L), 'm']); sr2.push(['Breadth B', nv(dd.B), 'm']); sr2.push(['Depth D', nv(dd.D), 'm']); sr2.push(['Draught T', nv(dd.T), 'm']); sr2.push(['Cb', nv(dd.Cb, 'n3'), '']);
      sr2.push(['Speed', nv(dd.vs, 'n1'), 'knots']); sr2.push(['Steel grade', s3.grade, '']); sr2.push(['Material factor f1', nv(qq.f1, 'n2'), '']); sr2.push(['Service area', s3.area, '']); sr2.push(['Corrosion addition', nv(s3.tk, 'n1'), 'mm']); sr2.push(['Web spacing', nv(s3.span), 'm']);
      sr2.push([]); sr2.push(H(['Longitudinal strength (Sec.4)', 'Sagging', 'Hogging', 'Unit']));
      sr2.push(['Rule stillwater moment MSO', nv(qq.Mso / 1000, 'n1'), nv(qq.Mso / 1000, 'n1'), 'MN.m']);
      sr2.push(['Calculated stillwater moment, 0.4 L amidships', stx.Ms ? nv(stx.Ms.sag / 1000, 'n1') : '', stx.Ms ? nv(stx.Ms.hog / 1000, 'n1') : '', 'MN.m']);
      sr2.push(['Stillwater moment used MS', nv(qq.MsSag / 1000, 'n1'), nv(qq.MsHog / 1000, 'n1'), 'MN.m']); sr2.push(['Wave moment MWO', nv(qq.MwoSag / 1000, 'n1'), nv(qq.MwoHog / 1000, 'n1'), 'MN.m']);
      sr2.push(['Required modulus Z = (MS + MW)/175', nv(qq.ZSag, 'n'), nv(qq.ZHog, 'n'), 'cm3']); sr2.push(['Minimum modulus Z0', nv(qq.Z0, 'n'), '', 'cm3']); sr2.push(['Required modulus', nv(qq.Zreq, 'n'), '', 'cm3']);
      sr2.push(['Section modulus at deck', nv(ss3.zDeck, 'n'), '', 'cm3']); sr2.push(['Section modulus at bottom', nv(ss3.zBot, 'n'), '', 'cm3']); sr2.push(['Approximate deck area (C105), required / chosen', nv(qq.deckArea, 'n'), nv(ss3.deckArea, 'n'), 'cm2']);
      sr2.push([]); sr2.push(H(['Midship section', 'Plate (mm)', 'Spacing (m)', 'Profile', 'Web h (mm)', 'Web t (mm)', 'Flange b (mm)', 'Flange t (mm)']));
      [['Deck', 'td', 'sd', 'pd'], ['Side', 'ts', 'ss', 'ps'], ['Bottom', 'tb', 'sb', 'pb'], ['Inner bottom', 'ti', 'si', 'pi']].forEach(function (a) { var p = s3[a[3]]; sr2.push([a[0], nv(s3[a[1]], 'n1'), nv(s3[a[2]], 'n2'), p.type === 'T' ? 'T' : 'Flat bar', nv(p.hw, 'n'), nv(p.tw, 'n1'), p.type === 'T' ? nv(p.bf, 'n') : '', p.type === 'T' ? nv(p.tf, 'n1') : '']); });
      sr2.push(['Keel plate', nv(s3.tkeel, 'n1')]);
      sr2.push(['Neutral axis above the baseline (m)', nv(ss3.zna, 'n2')]); sr2.push(['Moment of inertia (m4)', nv(ss3.I, 'n3')]); sr2.push(['Section area (cm2)', nv(ss3.A, 'n')]);
      sr2.push([]); sr2.push(H(['Local scantlings', 'Pressure (kN/m2)', 'Stress (N/mm2)', 'Required', 'Chosen', 'Unit', 'Check', 'Note']));
      stx.local.forEach(function (q) { sr2.push([q.item, q.p == null ? '' : nv(q.p, 'n1'), q.sigma == null ? '' : nv(q.sigma, 'n'), nv(q.required, q.unit === 'mm' ? 'n1' : 'n'), nv(q.chosen, q.unit === 'mm' ? 'n1' : 'n'), q.unit, q.ok ? 'OK' : 'NOT OK', q.note]); });
      sr2.push([]); sr2.push(['Estimated steel mass', nv(stx.steel.mass, 'n'), 't']); sr2.push(['Section mass per metre', nv(stx.steel.perLength, 'n2'), 't/m']); sr2.push(['Allowance factor', nv(s3.wf, 'n2'), '']); sr2.push(['Used for the weights', s3.steelOn ? 'yes' : 'no (structure share)', '']);
      if (stx.warnings.length) sr2.push([{ v: 'Warning: ' + stx.warnings.join(' '), s: 'b' }]);
      if (stx.loads) {
        sr2.push([]); sr2.push(H(['Distance from AP (m)', 'Weight (t/m)', 'Buoyancy (t/m)', 'Load (t/m)', 'Shear force (MN)', 'Bending moment (MN.m)']));
        stx.loads.x.forEach(function (xv, i) { if (i % 4 === 0) sr2.push([nv(stx.loads.xe[i] - dd.xAP, 'n1'), nv(stx.loads.w[i], 'n2'), nv(stx.loads.b[i], 'n2'), nv(stx.loads.q[i], 'n2'), nv(stx.loads.F[i] / 1000, 'n2'), nv(stx.loads.M[i] / 1000, 'n1')]); });
      }
      sheets.push({ name: 'Structure', rows: sr2, widths: [46, 16, 16, 14, 14, 14, 14, 30], freeze: 0 });
    }

    // what if: the original and the saved variants
    if (model.variants && model.variants.length && hd) {
      var wcs = wiCols(model), wr = [[{ v: model.name + ': saved variants (What if)', s: 'title' }], [{ v: 'Each variant is the original with the blocks linked to a requirement scaled to a target; every design is at the level draught that carries its weight. The numbers of a variant are those worked out when it was saved.', s: 'b' }], []];
      wr.push(H(['Item'].concat(wcs.map(function (q) { return q.label; })).concat(['Unit'])));
      wr.push(['What was changed', 'None'].concat(wcs.slice(1).map(function (q) { return wiRecipe(q.rec); })));
      WI_ROWS.forEach(function (rw) {
        if (rw[0] === 's') { wr.push([]); wr.push([{ v: rw[1], s: 'b' }]); return; }
        wr.push([rw[0]].concat(wcs.map(function (q) { return nv(q.snap[rw[1]], rw[2] ? 'n' + rw[2] : 'n'); })).concat([rw[3]]));
      });
      wr.push([]); wr.push([{ v: 'Requirements', s: 'b' }]);
      model.requirements.forEach(function (rq) {
        wr.push([rq.name].concat(wcs.map(function (q) { var x = (q.snap.reqs || []).filter(function (z) { return z.id === rq.id; })[0]; return x ? { v: r4(x.achieved) + ' (' + (x.status === 'ok' ? 'met' : x.status === 'excess' ? 'in excess' : x.status === 'fail' ? 'not met' : 'no target') + ')', s: 'n1' } : ''; })).concat([METRICS[rq.metric] ? METRICS[rq.metric].unit : '']));
      });
      sheets.push({ name: 'Variants', rows: wr, widths: [40].concat(wcs.map(function () { return 22; })).concat([8]), freeze: 0 });
    }

    // offsets, one block per hull
    if (model.hulls && model.hulls.length) {
      var orw = [];
      model.hulls.forEach(function (h, hi) {
        var OF = hullOffsets(h, 20, 10);
        if (hi) orw.push([]);
        orw.push([{ v: 'Table of offsets: ' + (h.name || 'Hull'), s: 'b' }]);
        orw.push(['Length (m)', nv(h.loa), 'Beam (m)', nv(h.beam), 'Depth (m)', nv(h.depth), 'Draught (m)', nv(h.draught)]);
        orw.push(['Half-breadths in metres. x is measured from the aft end, z from the baseline. "-" is outside the hull.']);
        orw.push(H(['Station', 'x (m)'].concat(OF.zs.map(function (z) { return 'z = ' + r4(z) + ' m'; }))));
        OF.rows.forEach(function (r) { orw.push([{ v: r.station, s: 'n' }, nv(r.x)].concat(r.half.map(function (v) { return v == null ? '-' : nv(v); }))); });
      });
      sheets.push({ name: 'Offsets', rows: orw, widths: [10, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11], freeze: 0 });
    }

    // 6 requirements
    var rq = [H(['Requirement', 'Metric', 'Unit', 'Sense', 'Shall', 'Should', 'Achieved', 'Linked blocks', 'Status', 'Margin vs shall (%)', 'Margin vs should (%)', 'Inside hulls, estimate', 'Status inside hulls', 'Block names'])];
    evaluateRequirements(model).forEach(function (ev) {
      var r = ev.req;
      rq.push([r.name, METRICS[r.metric].label, METRICS[r.metric].unit, r.sense === 'max' ? 'at most' : 'at least', nv(r.shall), nv(r.should), nv(ev.achieved), ev.n, statusText(ev.status, r), nv(mpc(ev.marginShall), 'n1'), nv(mpc(ev.marginShould), 'n1'),
        nv(ev.inside), ev.statusInside ? statusText(ev.statusInside, r) : '', ev.blocks.join('; ')]);
    });
    sheets.push({ name: 'Requirements', rows: rq, widths: [34, 18, 8, 10, 10, 10, 12, 13, 20, 12, 12, 20, 20, 50], freeze: 1 });
    return sheets;
  }
  function projectXlsx(model, when) { return xlsxBuild(workbookSheets(model, when)); }

  /* ---------- hull (illustrative parametric hulls; not real lines) ----------
     A hull is {id, name, type, x, y, loa, beam, depth, draught, visible}: x is the aft end, y the centreline offset (a catamaran has two),
     depth is the main deck (m above the baseline). A model has a list of hulls: model.hulls.
     Shape comes from the preset table: plan form (stern and bow taper), section fullness, stem rake and flare. */
  var HULL_TYPES = {
    osv:      { label: 'Offshore vessel',   ps: 0.94, ua: 0.08, a: 0.7, ub: 0.86, pb: 0.00, c: 2.6, rake: 0.03,  flare: 0.14, fb: 0.85, m: 5.0, sternRake: 0.000, dr: 0.70 },
    research: { label: 'Research vessel',   ps: 0.88, ua: 0.12, a: 0.8, ub: 0.82, pb: 0.00, c: 2.0, rake: 0.045, flare: 0.16, fb: 0.60, m: 3.4, sternRake: 0.015, dr: 0.55 },
    cargo:    { label: 'Cargo ship',        ps: 0.92, ua: 0.08, a: 0.8, ub: 0.88, pb: 0.00, c: 2.4, rake: 0.02,  flare: 0.08, fb: 0.85, m: 5.0, sternRake: 0.000, dr: 0.70 },
    demihull: { label: 'Slender demihull',  ps: 0.70, ua: 0.10, a: 0.8, ub: 0.80, pb: 0.00, c: 1.8, rake: 0.06,  flare: 0.05, fb: 0.30, m: 2.2, sternRake: 0.010, dr: 0.60 },
    offsets:  { label: 'Table of offsets', ps: 0.9, ua: 0.1, a: 0.8, ub: 0.85, pb: 0.00, c: 2.0, rake: 0.02, flare: 0.1, fb: 0.5, m: 3.0, sternRake: 0.000, dr: 0.55 },
    barge:    { label: 'Barge',             ps: 1.00, ua: 0.02, a: 1.0, ub: 0.94, pb: 0.60, c: 3.0, rake: 0.03,  flare: 0.00, fb: 0.90, m: 6.0, sternRake: 0.000, dr: 0.50 }
  };
  var MAX_HULLS = 5;
  var MAX_CUSTOM_SHAPES = 500;
  /* imported shapes that no block uses any more are dropped (they are not kept in the project file) */
  function pruneCustomShapes(model) {
    var used = {};
    model.blocks.forEach(function (b) { used[b.shape] = true; });
    model.customShapes = (model.customShapes || []).filter(function (id) { return used[id]; });
  }
  var HULL_ORDER = ['osv', 'research', 'cargo', 'demihull', 'barge'];

  /* Shape sliders. A hull may carry h.shape = { key: value }, overrides of its type's parameters. 'par' is the length of the
     parallel body (fraction of the length): the bow entrance starts at ua + par. Edit h.shape by replacing the object. */
  var SHAPE_SPEC = [
    { key: 'fb',        group: 'Section', label: 'Flat bottom',    min: 0,    max: 1,    step: 0.01,  pct: true, hint: '0 = V section, 100 = flat bottom' },
    { key: 'm',         group: 'Section', label: 'Bilge hardness', min: 1,    max: 10,   step: 0.1,   hint: 'low = soft, high = square bilge' },
    { key: 'flare',     group: 'Section', label: 'Bow flare',      min: 0,    max: 0.4,  step: 0.01,  pct: true },
    { key: 'par',       group: 'Plan',    label: 'Parallel body',  min: 0.05, max: 0.9,  step: 0.01,  pct: true, hint: 'share of the length with constant section' },
    { key: 'c',         group: 'Plan',    label: 'Bow fullness',   min: 1,    max: 6,    step: 0.1,   hint: '1 = sharp, high = full bow' },
    { key: 'pb',        group: 'Plan',    label: 'Stem width',     min: 0,    max: 1,    step: 0.01,  pct: true, hint: 'beam at the stem, 0 = pointed' },
    { key: 'rake',      group: 'Plan',    label: 'Stem rake',      min: 0,    max: 0.15, step: 0.005, pct: true },
    { key: 'ps',        group: 'Stern',   label: 'Transom width',  min: 0,    max: 1,    step: 0.01,  pct: true, hint: '0 = pointed stern' },
    { key: 'ua',        group: 'Stern',   label: 'Stern run',      min: 0.02, max: 0.4,  step: 0.01,  pct: true, hint: 'length of the taper towards the stern' },
    { key: 'sternRake', group: 'Stern',   label: 'Stern rake',     min: 0,    max: 0.1,  step: 0.005, pct: true, hint: 'cut-up of the keel aft (cruiser stern)' }
  ];
  var STERN_PRESETS = {
    transom: { ps: 0.9,  ua: 0.08, sternRake: 0 },
    rounded: { ps: 0.35, ua: 0.14, sternRake: 0.01 },
    cruiser: { ps: 0,    ua: 0.18, sternRake: 0.04 }
  };
  var PCACHE = typeof WeakMap === 'function' ? new WeakMap() : null;

  /* effective parameters of a hull: its type's values with the shape overrides on top */
  function hullP(h) {
    var base = HULL_TYPES[h.type] || HULL_TYPES.osv, sh = h.shape;
    if (!sh) return base;
    var e = PCACHE && PCACHE.get(sh);
    if (e && e.base === base) return e.P;
    var P = {}, k;
    for (k in base) P[k] = base[k];
    P.par = base.ub - base.ua;
    SHAPE_SPEC.forEach(function (s) {
      if (typeof sh[s.key] === 'number' && isFinite(sh[s.key])) P[s.key] = Math.min(s.max, Math.max(s.min, sh[s.key]));
    });
    P.ub = Math.min(0.97, P.ua + P.par);
    if (PCACHE) PCACHE.set(sh, { base: base, P: P });
    return P;
  }

  function hullParams(h) {
    var P = hullP(h), q = {};
    for (var k in P) q[k] = P[k];
    if (q.par === undefined) q.par = P.ub - P.ua;
    return q;
  }

  /* keep only known, numeric, in-range shape values; null when nothing is overridden */
  function cleanShape(sh) {
    if (!sh || typeof sh !== 'object') return null;
    var out = {}, n = 0;
    SHAPE_SPEC.forEach(function (s) {
      if (typeof sh[s.key] === 'number' && isFinite(sh[s.key])) { out[s.key] = Math.min(s.max, Math.max(s.min, sh[s.key])); n++; }
    });
    return n ? out : null;
  }

  /* ---------- hull from a table of offsets ----------
     h.offsets = { L, B, D, zs[], xs[], half[][] }: heights zs (m above the baseline, first 0, last = D), stations xs (m from the
     aft end, L = last), half[j][i] = half-breadth (m) at height j and station i, null where there is no hull. The hull's own
     loa, beam and depth scale the table (loa/L, beam/B, depth/D), so the usual size fields keep working. */
  function cleanOffsets(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.zs) || !Array.isArray(o.xs) || !Array.isArray(o.half)) return null;
    var zs = o.zs.map(Number), xs = o.xs.map(Number), nz = zs.length, nx = xs.length, j, i;
    if (nz < 2 || nx < 2 || nz > 200 || nx > 400 || o.half.length !== nz) return null;
    for (j = 0; j < nz; j++) if (!isFinite(zs[j]) || (j && zs[j] <= zs[j - 1])) return null;
    for (i = 0; i < nx; i++) if (!isFinite(xs[i]) || (i && xs[i] <= xs[i - 1])) return null;
    var half = [], mx = 0, x0 = Infinity, x1 = -Infinity;
    for (j = 0; j < nz; j++) {
      var row = o.half[j];
      if (!Array.isArray(row) || row.length !== nx) return null;
      var r = row.map(function (v) { return v === null || v === undefined || v === '' || !isFinite(Number(v)) ? null : Math.max(0, Number(v)); });
      for (i = 0; i < nx; i++) if (r[i] !== null) { mx = Math.max(mx, r[i]); x0 = Math.min(x0, xs[i]); x1 = Math.max(x1, xs[i]); }
      half.push(r);
    }
    if (!(mx > 0) || !(x1 > x0)) return null;
    for (j = 0; j < nz; j++) if (half[j].every(function (v) { return v === null; })) return null;
    xs = xs.map(function (x) { return x - x0; });
    return { L: x1 - x0, B: 2 * mx, D: zs[nz - 1], zs: zs, xs: xs, half: half };
  }
  var OFFC = typeof WeakMap === 'function' ? new WeakMap() : null;
  function offsetsPrep(o) {
    var e = OFFC && OFFC.get(o);
    if (e) return e;
    var a = [], b = [], j, i;
    for (j = 0; j < o.zs.length; j++) {
      var f = -1, l = -1;
      for (i = 0; i < o.xs.length; i++) if (o.half[j][i] !== null) { if (f < 0) f = i; l = i; }
      a.push(o.xs[f]); b.push(o.xs[l]);
    }
    var sum = 0;
    o.half.forEach(function (r) { r.forEach(function (v) { if (v !== null) sum += v; }); });
    e = { a: a, b: b, key: [o.L, o.B, o.D, o.zs.length, o.xs.length, Math.round(sum * 1000)].join('/') };
    if (OFFC) OFFC.set(o, e);
    return e;
  }
  function offLevel(o, z) {
    var zs = o.zs, n = zs.length, j = 0;
    if (z <= zs[0]) return [0, 0, 0];
    if (z >= zs[n - 1]) return [n - 2, n - 1, 1];
    while (j < n - 2 && z > zs[j + 1]) j++;
    return [j, j + 1, (z - zs[j]) / (zs[j + 1] - zs[j])];
  }
  function offsetsXRange(h, t) {
    var o = h.offsets, e = offsetsPrep(o), q = offLevel(o, Math.min(1, Math.max(0, t)) * o.D), s = h.loa / o.L;
    var a = e.a[q[0]] + (e.a[q[1]] - e.a[q[0]]) * q[2], b = e.b[q[0]] + (e.b[q[1]] - e.b[q[0]]) * q[2];
    return [h.x + a * s, h.x + b * s];
  }
  function offsetsHalf(h, u, t) {
    var o = h.offsets, e = offsetsPrep(o), q = offLevel(o, Math.min(1, Math.max(0, t)) * o.D);
    var a = e.a[q[0]] + (e.a[q[1]] - e.a[q[0]]) * q[2], b = e.b[q[0]] + (e.b[q[1]] - e.b[q[0]]) * q[2];
    var x = a + Math.min(1, Math.max(0, u)) * (b - a), xs = o.xs, n = xs.length, i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    var fx = Math.min(1, Math.max(0, (x - xs[i]) / (xs[i + 1] - xs[i])));
    function row(j) {
      var r = o.half[j], v0 = r[i] === null ? 0 : r[i], v1 = r[i + 1] === null ? 0 : r[i + 1];
      return v0 + (v1 - v0) * fx;
    }
    var y = row(q[0]) + (row(q[1]) - row(q[0])) * q[2];
    return Math.min(y * h.beam / o.B, 0.5 * h.beam);
  }

  /* Parse a table of offsets from CSV text: first row = station positions (m), first column = heights (m), cells = half-breadths
     (blank = no hull). Comma, semicolon or tab. Returns { zs, xs, half } or { error }. */
  function parseOffsetsText(text) {
    var lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (lines.length < 3) return { error: 'The table needs a header row of stations and at least two heights.' };
    var delim = ',';
    [';', '\t', ','].some(function (d) { if (lines[0].split(d).length > 2) { delim = d; return true; } return false; });
    var grid = lines.map(function (l) { return l.split(delim).map(function (c) { c = c.trim().replace(/^"|"$/g, ''); return c === '-' ? '' : c; }); });
    var xs = [], i, j;
    if (/^station/i.test(grid[0][0])) {      // the layout of our own Offsets table: stations down, heights across (header "z 0.50")
      var zs2 = [], x2 = [], c;
      for (c = 2; c < grid[0].length; c++) {
        var zz = Number(String(grid[0][c]).replace(/^z\s*/i, '').replace(',', '.'));
        if (grid[0][c] === '' || !isFinite(zz)) return { error: 'A height in the first row is not a number.' };
        zs2.push(zz);
      }
      var cols = zs2.map(function () { return []; });
      for (j = 1; j < grid.length; j++) {
        var xx = Number(String(grid[j][1]).replace(',', '.'));
        if (grid[j][1] === '' || !isFinite(xx)) return { error: 'A station position is not a number (row ' + (j + 1) + ').' };
        x2.push(xx);
        for (c = 0; c < zs2.length; c++) {
          var cv = grid[j][c + 2];
          if (cv === undefined || cv === '') { cols[c].push(null); continue; }
          var nv2 = Number(cv.replace(',', '.'));
          if (!isFinite(nv2)) return { error: 'A half-breadth is not a number (row ' + (j + 1) + ').' };
          cols[c].push(nv2);
        }
      }
      var o2 = zs2.map(function (z, k) { return k; }).sort(function (p, q) { return zs2[p] - zs2[q]; });
      return { zs: o2.map(function (k) { return zs2[k]; }), xs: x2, half: o2.map(function (k) { return cols[k]; }) };
    }
    for (i = 1; i < grid[0].length; i++) {
      if (grid[0][i] === '') { if (xs.length) break; continue; }
      var xv = Number(grid[0][i].replace(',', '.'));
      if (!isFinite(xv)) return { error: 'A station position in the first row is not a number.' };
      xs.push(xv);
    }
    var zs = [], half = [];
    for (j = 1; j < grid.length; j++) {
      var zv = Number(grid[j][0].replace(',', '.'));
      if (grid[j][0] === '' || !isFinite(zv)) return { error: 'A height in the first column is not a number (row ' + (j + 1) + ').' };
      var row = [];
      for (i = 0; i < xs.length; i++) {
        var c = grid[j][i + 1];
        if (c === undefined || c === '') { row.push(null); continue; }
        var v = Number(c.replace(',', '.'));
        if (!isFinite(v)) return { error: 'A half-breadth is not a number (row ' + (j + 1) + ').' };
        row.push(v);
      }
      zs.push(zv); half.push(row);
    }
    var ord = zs.map(function (z, k) { return k; }).sort(function (a, b) { return zs[a] - zs[b]; });
    return { zs: ord.map(function (k) { return zs[k]; }), xs: xs, half: ord.map(function (k) { return half[k]; }) };
  }

  /* Highest height whose row is complete: at least 90% of the largest number of stations. */
  function offsetsFullDepth(tab) {
    var cnt = tab.half.map(function (r) { return r.filter(function (v) { return v !== null; }).length; }), mx = Math.max.apply(null, cnt), d = tab.zs[0];
    tab.zs.forEach(function (z, k) { if (cnt[k] >= 0.9 * mx) d = z; });
    return d;
  }

  /* A hull from a parsed table: rows above the depth are cut; if the depth lies above the last row, that row is repeated up to it.
     Returns a hull {type:'offsets', ...} (no id or name yet) or null. */
  function offsetsToHull(tab, depth, draught) {
    if (!tab || !tab.zs) return null;
    var zs = [], half = [], k;
    for (k = 0; k < tab.zs.length; k++) {
      if (tab.zs[k] < -1e-9 || tab.zs[k] > depth + 1e-9) continue;
      zs.push(tab.zs[k]); half.push(tab.half[k].slice());
    }
    if (!zs.length) return null;
    if (zs[0] > 1e-9) { zs.unshift(0); half.unshift(half[0].slice()); }
    if (zs[zs.length - 1] < depth - 1e-9) { zs.push(depth); half.push(half[half.length - 1].slice()); }
    var o = cleanOffsets({ zs: zs, xs: tab.xs, half: half });
    if (!o) return null;
    return { type: 'offsets', offsets: o, x: 0, y: 0, loa: r2(o.L), beam: r2(o.B), depth: r2(o.D),
      draught: Math.min(o.D, Math.max(0.1, draught == null ? o.D * 0.55 : draught)) };
  }

  /* Hull library: ready-made hulls from a table of offsets. A library hull has h.lib = key. */
  var HULL_LIBRARY = { gunnerus: { label: 'Gunnerus-like', depth: 4.287, draught: 2.7 } };
  var HULL_LIB_ORDER = ['gunnerus'];
  function libraryHull(key) {
    var L = HULL_LIBRARY[key];
    if (!L) return null;
    var h = offsetsToHull({ zs: GUN_OFFS.zs, xs: GUN_OFFS.xs, half: GUN_OFFS.half }, L.depth, L.draught);
    if (h) h.lib = key;
    return h;
  }

  function hullXRange(h, t) {
    if (h.offsets) return offsetsXRange(h, t);
    var P = hullP(h);
    return [h.x + P.sternRake * h.loa * (1 - t), h.x + h.loa - P.rake * h.loa * (1 - t)];
  }

  /* half-breadth (m) at plan fraction u (0 aft, 1 forward) and height fraction t (0 keel, 1 deck) */
  function hullHalf(h, u, t) {
    if (h.offsets) return offsetsHalf(h, u, t);
    var P = hullP(h), p, sb = 0;
    if (u < P.ua && P.ua > 0) p = P.ps + (1 - P.ps) * Math.pow(u / P.ua, P.a);
    else if (u > P.ub) { sb = (u - P.ub) / (1 - P.ub); p = 1 - (1 - P.pb) * Math.pow(sb, P.c); }
    else p = 1;
    var fb = P.fb * (1 - sb);
    var f = fb + (1 - fb) * (1 - Math.pow(1 - t, P.m));
    var y = 0.5 * h.beam * p * f * (1 + P.flare * Math.pow(sb, 1.2) * t);
    return Math.min(y, 0.5 * h.beam);
  }

  function hullContains(h, x, y, z) {
    if (z < 0 || z > h.depth) return false;
    var t = z / h.depth, r = hullXRange(h, t);
    if (x < r[0] || x > r[1]) return false;
    return Math.abs(y - (h.y || 0)) <= hullHalf(h, (x - r[0]) / (r[1] - r[0]), t);
  }

  function hullVolumeTo(h, zcut) {
    zcut = Math.max(0, Math.min(zcut, h.depth));
    var nz = 64, nu = 240, dz = zcut / nz, sum = 0;
    for (var j = 0; j < nz; j++) {
      var t = (j + 0.5) * dz / h.depth, r = hullXRange(h, t), len = r[1] - r[0];
      for (var i = 0; i < nu; i++) sum += 2 * hullHalf(h, (i + 0.5) / nu, t) * len / nu * dz;
    }
    return sum;
  }

  /* Hydrostatics of one hull at draught T (clamped to the depth), upright, in the hull's own coordinates.
     Midpoint integration over 48 layers x 240 plan strips. LWL and BWL are taken at the waterline; Am is the largest
     immersed section area (stations at fixed x). x is measured from the aft end of the model (x = 0). */
  function hullHydro(h, T, rho) {
    rho = rho || 1.025;
    T = Math.max(0, Math.min(T == null ? h.draught : T, h.depth));
    var out = { T: T, xa: 0, V: 0, LWL: 0, BWL: 0, Am: 0, Awp: 0, LCB: 0, KB: 0, LCF: 0, Cb: 0, Cp: 0, Cm: 0, Cwp: 0, disp: 0, TPC: 0 };
    if (T <= 1e-9) return out;
    var nz = 64, nu = 240, dz = T / nz, V = 0, Mx = 0, Mz = 0, j, i;
    for (j = 0; j < nz; j++) {
      var z = (j + 0.5) * dz, t = z / h.depth, r = hullXRange(h, t), len = r[1] - r[0];
      for (i = 0; i < nu; i++) {
        var dv = 2 * hullHalf(h, (i + 0.5) / nu, t) * len / nu * dz;
        V += dv; Mx += dv * (r[0] + (i + 0.5) / nu * len); Mz += dv * z;
      }
    }
    var tw = T / h.depth, rw = hullXRange(h, tw), lw = rw[1] - rw[0], awp = 0, mf = 0, bw = 0;
    for (i = 0; i < nu; i++) {
      var yw = 2 * hullHalf(h, (i + 0.5) / nu, tw), da = yw * lw / nu;
      awp += da; mf += da * (rw[0] + (i + 0.5) / nu * lw); if (yw > bw) bw = yw;
    }
    // largest section: stations at fixed x across the whole length
    var x0 = h.x, x1 = h.x + h.loa, nx = 160, am = 0, k;
    for (k = 0; k < nx; k++) {
      var x = x0 + (k + 0.5) / nx * (x1 - x0), a = 0;
      for (j = 0; j < nz; j++) {
        var zz = (j + 0.5) * dz, tt = zz / h.depth, rr = hullXRange(h, tt);
        if (x < rr[0] || x > rr[1]) continue;
        a += 2 * hullHalf(h, (x - rr[0]) / (rr[1] - rr[0]), tt) * dz;
      }
      if (a > am) am = a;
    }
    out.V = V; out.xa = rw[0]; out.LWL = lw; out.BWL = bw; out.Am = am; out.Awp = awp;
    out.LCB = Mx / V; out.KB = Mz / V; out.LCF = awp > 0 ? mf / awp : 0;
    out.disp = rho * V; out.TPC = rho * awp / 100;
    var box = lw * bw * T;
    out.Cb = box > 0 ? V / box : 0;
    out.Cp = am * lw > 0 ? V / (am * lw) : 0;
    out.Cm = bw * T > 0 ? am / (bw * T) : 0;
    out.Cwp = lw * bw > 0 ? awp / (lw * bw) : 0;
    return out;
  }

  /* ---------- Holtrop resistance ----------
     Same code as the Hull Generator (shiplab.github.io/hull), kept apart in dev/holtrop-hull.js and checked equal by dev/test-core.js. */
  var HOLTROP = (function () {
    var G = 9.81, RHO_W = 1025, MU = 0.00122, KN = 0.514444;
    function holtropModel(p) {
      var pw = Math.pow, L = p.lwl, B = p.breadth, tf = p.tf, ta = p.ta, lcb = p.lcb, cb = p.cb, csm = p.csm, cwl = p.cwl, bulb = p.b ? 1 : 0, tr = p.tr ? 1 : 0, cstern = p.cstern || 3;
      var m = { lwl: L, breadth: B, warnings: [] }, i, mult = 0, sapp = 0;
      (p.app || []).forEach(function (a) { mult += a[0] * a[1]; sapp += a[1]; });
      m.k2 = sapp !== 0 ? mult / sapp : 0; m.sapp = sapp;
      var t = (ta + tf) / 2, V = L * B * t * cb, cp = cb / csm;
      var lr = L * (1 - cp + (0.06 * cp * (lcb / 100) / (4 * cp - 1)));
      var hb = p.hb !== undefined ? p.hb : tf / 2, at = 0.95 * (ta - ta * 0.9225) * B * 0.89 * tr, abt = p.abt !== undefined ? p.abt : Math.PI * pw(tf / 2, 2) * bulb / 7.7;   // abt, hb: measured from a drawn bulb
      var c7 = B / L < 0.11 ? 0.229577 * pw(B / L, 0.33333) : B / L < 0.25 ? B / L : 0.5 - 0.0625 * L / B;
      var ie = 1 + 89 * Math.exp(-pw(L / B, 0.80856) * pw(1 - cwl, 0.30484) * pw(1 - cp - 0.0225 * (lcb / 100), 0.6367) * pw(lr / B, 0.34574) * pw(100 * (V / pw(L, 3)), 0.16302));
      var c1 = 2223105 * pw(c7, 3.78613) * pw(t / B, 1.07961) * pw(90 - ie, -1.37565);
      var c3 = 0.56 * pw(abt, 1.5) / (B * t * (0.31 * pw(abt, 0.5) + tf - hb));
      var c2 = Math.exp(-1.89 * pw(c3, 0.5));
      var c4 = tf / L > 0.04 ? 0.04 : tf / L;
      var c5 = 1 - (0.8 * at) / (B * t * csm);
      var c14 = cstern === 1 ? 1 + 0.011 * -25 : cstern === 2 ? 1 + 0.011 * -10 : cstern === 3 ? 1 : 1 + 0.011 * 10;
      var c15 = pw(L, 3) / V < 512 ? -1.69385 : pw(L, 3) / V < 1726.91 ? -1.69385 + (L / pw(V, 1 / 3) - 8) / 2.36 : 0;
      var c16 = cp < 0.8 ? 8.07981 * cp - 13.8673 * pw(cp, 2) + 6.984388 * pw(cp, 3) : 1.73014 - 0.7067 * cp;
      var c17 = 6919.3 * pw(csm, -1.3346) * pw(V / pw(L, 3), 2.00977) * pw(L / B - 2, 1.40692);
      var ca = 0.006 * pw(L + 100, -0.16) - 0.00205 + 0.003 * pw(L / 7.5, 0.5) * pw(cb, 4) * c2 * (0.04 - c4);
      var wa = L * (2 * t + B) * pw(csm, 0.5) * (0.453 + 0.4425 * cb - 0.2862 * csm - 0.003467 * (B / t) + 0.3696 * cwl) + (2.38 * abt) / cb;
      var m1 = 0.0140407 * (L / t) - 1.75254 * (pw(V, 1 / 3) / L) - 4.79323 * (B / L) - c16;
      var m3 = -7.2035 * pw(B / L, 0.326869) * pw(t / B, 0.605375);
      var lambda = L / B > 12 ? 1.446 * cp - 0.36 : 1.446 * cp - 0.03 * (L / B);
      var pb = (0.56 * pw(abt, 0.5)) / (tf - 1.5 * hb);
      function m4(fn) { return c15 * 0.4 * Math.exp(-0.034 * pw(fn, -3.29)); }
      function rwa(fn) { return c1 * c2 * c5 * V * RHO_W * G * Math.exp(m1 * pw(fn, -0.9) + m4(fn) * Math.cos(lambda * pw(fn, -2))); }
      function rwb(fn) { return c17 * c2 * c5 * V * RHO_W * G * Math.exp(m3 * pw(fn, -0.9) + m4(fn) * Math.cos(lambda * pw(fn, -2))); }
      var rwa04 = rwa(0.4), rwa055 = c17 * c2 * c5 * V * RHO_W * G * Math.exp(m3 * pw(0.55, -0.9) + m4(0.55) * Math.cos(lambda * pw(0.55, -2)));
      var k = 0.93 + (0.487118 * c14 * pw(B / L, 1.06806) * pw(t / L, 0.46106) * pw(L / lr, 0.121563) * pw(pw(L, 3) / V, 0.36486) * pw(1 - cp, -0.604247));
      m.t = t; m.V = V; m.cp = cp; m.k = k; m.wa = wa; m.at = at; m.abt = abt; m.ca = ca; m.lr = lr; m.ie = ie;
      m.ok = [k, wa, ca, c1, c2, c5, c17, m1, m3, lambda, rwa04, rwa055].every(isFinite) && V > 0 && L > 0 && B > 0;
      if (L / B < 3.9 || L / B > 15) m.warnings.push('L/B ' + (Math.round(L / B * 10) / 10) + ' is outside 3.9 to 15');
      if (B / t < 2.1 || B / t > 4) m.warnings.push('B/T ' + (Math.round(B / t * 10) / 10) + ' is outside 2.1 to 4');
      if (cp < 0.55 || cp > 0.85) m.warnings.push('Cp ' + (Math.round(cp * 100) / 100) + ' is outside 0.55 to 0.85');
      /* resistance at one speed in knots; every part in N */
      m.at_speed = function (vKn) {
        var v = KN * vKn, r = { v: vKn, fn: v / pw(G * L, 0.5), rf: 0, form: 0, rapp: 0, rw: 0, rb: 0, rtr: 0, ra: 0, rt: 0 };
        if (v <= 0 || !m.ok) return r;
        var re = RHO_W * L * v / MU, cf = 0.075 / pw(Math.log(re) / Math.log(10) - 2, 2), q = 0.5 * RHO_W * v * v, fn = r.fn;
        var fnt = at === 0 ? 0 : v / pw((2 * G * at) / (B + B * cwl), 0.5), c6 = fnt < 5 ? 0.2 * (1 - 0.2 * fnt) : 0;
        var fni = v / Math.sqrt(G * (tf - hb - 0.25 * pw(abt, 0.5)) + 0.15 * v * v);
        r.rf = q * wa * cf; r.form = r.rf * (k - 1); r.rtr = q * at * c6; r.rapp = q * sapp * m.k2 * cf;
        r.rw = fn < 0.4 ? rwa(fn) : fn < 0.55 ? rwa04 + (10 * fn - 4) * (rwa055 - rwa04) / 1.5 : rwb(fn);
        r.rb = abt === 0 ? 0 : (0.11 * Math.exp(-3 * pw(pb, -2)) * pw(fni, 3) * pw(abt, 1.5) * RHO_W * G) / (1 + pw(fni, 2));
        r.ra = 0.91 * q * wa * ca;
        r.rt = k * r.rf + r.rapp + r.rw + r.rb + r.rtr + r.ra;
        return r;
      };
      return m;
    }
    /* Holtrop inputs from the hydrostatics of the table (tableHydro) at draught T. LCB is in % of LWL, forward of midship of the waterline. */
    function holtropInputs(hy, T, o) {
      o = o || {};
      return { lwl: hy.LWL, breadth: hy.BWL, tf: T, ta: T, lcb: hy.LWL > 0 ? (hy.LCB - hy.xa - hy.LWL / 2) / hy.LWL * 100 : 0, cb: hy.Cb, csm: hy.Cm, cwl: hy.Cwp, b: o.b ? 1 : 0, abt: o.abt, hb: o.hb, tr: o.tr === undefined ? 1 : (o.tr ? 1 : 0), cstern: o.cstern || 3 };
    }
    function holtropCurve(p, vmax, n) {
      var m = holtropModel(p), pts = [], i;
      for (i = 0; i <= n; i++) pts.push(m.at_speed(vmax * i / n));
      return { model: m, pts: pts };
    }

    return { holtropModel: holtropModel, holtropInputs: holtropInputs, holtropCurve: holtropCurve };
  })();

  /* Resistance of one hull at its draught (Holtrop). Inputs read from hullHydro. model.res = { vs (kn or null for Fn 0.2), aft (1..4), tr (bool) }.
     Returns { ok, hull, hy, T, vs, vmax, fn, curve[{v,fn,rt}], at (parts at vs, N), model } or { ok: false, reason }. */
  var AFT_FORMS = [[1, 'Pram with gondola'], [2, 'V-shaped sections'], [3, 'Normal sections'], [4, 'U-shaped, Hogner stern']];
  function modelResistance(model, hull) {
    hull = hull || (model.hulls || [])[0];
    if (!hull) return null;
    var res = model.res || {}, hy = hullHydro(hull, hull.draught, model.rho);
    if (!(hy.V > 0) || !(hy.LWL > 0)) return { ok: false, reason: 'The hull has no volume at this draught.', hull: hull, hy: hy };
    var drawn = hullBulb(hull);
    var p = HOLTROP.holtropInputs(hy, hy.T, drawn ? { b: true, abt: drawn.abt, hb: drawn.hb, tr: res.tr !== false, cstern: res.aft || 3 } : { b: res.bulb === true, tr: res.tr !== false, cstern: res.aft || 3 });
    var m = HOLTROP.holtropModel(p), vkn = function (fn) { return fn * Math.sqrt(9.81 * hy.LWL) / 0.514444; };
    var vs = typeof res.vs === 'number' && res.vs > 0 ? res.vs : Math.max(1, Math.round(vkn(0.2)));
    var vmax = Math.max(vkn(0.45), 1.2 * vs), curve = [], i;
    if (m.ok) for (i = 0; i <= 45; i++) { var q = m.at_speed(vmax * i / 45); curve.push({ v: q.v, fn: q.fn, rt: q.rt }); }
    return { ok: m.ok, reason: m.ok ? '' : 'The method gives no result for this shape.', hull: hull, hy: hy, T: hy.T, vs: vs, vmax: vmax, fn: vs * 0.514444 / Math.sqrt(9.81 * hy.LWL),
      curve: curve, at: m.ok ? m.at_speed(vs) : null, model: m, warnings: m.warnings, aft: res.aft || 3, tr: res.tr !== false, bulb: res.bulb === true || !!drawn, bulbDrawn: !!drawn };
  }

  /* ---------- Seakeeping: closed-form motion estimates ----------
     Jensen, Mansour and Olsen (2004), Estimation of ship motions using closed-form expressions, Ocean Engineering 31.
     The formulas follow the ShipLab ship motion web app (Andrade and Gaspar 2015; update by Porée and Albouy 2024), kept equal to it:
     the hull is a box of length L, draught T and breadth B = B0 Cb. Responses are per wave frequency, for the wave amplitude given.
     p = { L, B0 (waterline breadth), Cb, T, vkn (knots), head (deg, 180 = head waves), amp (m), pos (% of half length from the CG, + forward),
           Cwp, GM, Tn (s, roll natural period), damp (% of critical), delta (prismatic length ratio) }. */
  var SK_N = 1000;
  function seakeepingCurves(p) {
    var g = 9.81, L = p.L, B0 = p.B0, Cbk = p.Cb, T = p.T, amp = p.amp, Cwp = p.Cwp, GM = p.GM, Tn = p.Tn, delta = p.delta;
    var betha = p.head * Math.PI / 180, Breadth = B0 * Cbk, vms = p.vkn * 0.5144444, Fn = vms / Math.sqrt(g * L), position = L * p.pos / 200;
    var out = { fn: Fn, freq: [], enc: [], period: [], heave: [], pitch: [], pitchA: [], vert: [], acc: [], bm: [], roll: [], warnings: [], tnGuess: GM > 0 ? Math.round(0.85 * B0 * 10 / Math.sqrt(GM)) / 10 : null };
    var BT = B0 / T;
    if (BT < 1 || BT > 6) out.warnings.push('B/T is ' + (BT < 1 ? 'too low' : 'too high') + ' (' + BT.toFixed(2) + '; the method covers 1 to 6)');
    if (p.head === 90 || p.head === 270) out.warnings.push('in beam sea (90 and 270 degrees) the formulas give zero pitch and a heave peak that is too high');
    if (Cbk < 0.6) out.warnings.push('for the bending moment the smallest Cb is 0.6');
    if (Fn >= 0.3) out.warnings.push('the bending moment is validated for Froude number below 0.3 only');
    if (Cwp < delta) out.warnings.push('the prismatic length ratio cannot be greater than the waterplane area coefficient');
    if (Fn < 0.13 || Fn > 0.84) out.warnings.push('the Froude number ' + Fn.toFixed(2) + ' is outside 0.13 to 0.84, the range of the ships the paper compares with model tests');
    var damp = p.damp / 100, restoring = g * 1025 * Cbk * L * B0 * T * GM, i;
    var ratio = function (bt) {
      return bt > 3 ? { a: 0.256 * bt - 0.286, b: -0.11 * bt - 2.55, d: 0.033 * bt - 1.419 } : { a: -3.94 * bt + 13.69, b: -2.12 * bt - 1.89, d: 1.16 * bt - 7.97 };
    };
    for (i = 0; i <= SK_N; i++) {
      var w = 0.05 + 1.95 * i / SK_N, k = w * w / g, ek = Math.abs(k * Math.cos(betha)), smith = Math.exp(-k * T);
      var alpha = 1 - Fn * Math.sqrt(k * L) * Math.cos(betha);
      var sdamp = 2 * Math.sin(0.5 * k * Breadth * alpha * alpha) * Math.exp(-k * T * alpha * alpha);
      var a = Math.pow(1 - k * T, 2), b = Math.pow(sdamp * sdamp / (k * Breadth * Math.pow(alpha, 3)), 2), f = Math.sqrt(a + b);
      var F = smith * f * (2 / (ek * L)) * Math.sin(ek * L / 2);
      var G = smith * f * (24 / (Math.pow(ek * L, 2) * L)) * (Math.sin(ek * L / 2) - (ek * L / 2) * Math.cos(ek * L / 2));
      var eta = 1 / Math.sqrt(Math.pow(1 - 2 * k * T * alpha * alpha, 2) + Math.pow(sdamp * sdamp / (k * Breadth * alpha * alpha), 2));
      var frfH = amp * eta * F, frfP = amp * eta * G;
      var vert = Math.sqrt(frfH * frfH + frfP * frfP * position * position);
      out.freq.push(w); out.period.push(2 * 3.14159 / w); out.enc.push(w * alpha);
      out.vert.push(vert); out.acc.push(alpha * alpha * k * g * vert);
      out.pitch.push(Math.sqrt(frfP * frfP * position * position)); out.heave.push(Math.abs(frfH)); out.pitchA.push(Math.abs(frfP) * 180 / Math.PI);
      var Cb6 = Math.max(0.6, Cbk), phi = 2.5 * (1 - Cb6), FCb = Math.pow(1 - phi, 2) + 0.6 * alpha * (2 - phi), Fv = 1 + 3 * Fn * Fn;
      out.bm.push(amp * (smith * ((1 - k * T) / Math.pow(L * ek, 2)) * (1 - Math.cos(ek * L / 2) - (ek * L / 4) * Math.sin(ek * L / 2)) * Fv * FCb * Math.pow(Math.abs(Math.cos(betha)), 1 / 3)) * 1025 * g * B0 * L * L / 1000000);
      // roll: two prismatic bodies, breadths B0 and B1
      var we = w * alpha, br = (Cwp - delta) / (1 - delta), B1 = br * B0, A0 = Cbk * B0 * T / (delta + br * (1 - delta)), A1 = br * A0;
      var c0 = ratio(B0 / T), c1 = ratio(B1 / T);
      var b440 = 1025 * A0 * B0 * B0 * c0.a * Math.exp(c0.b * Math.pow(we, -1.3)) * Math.pow(we, c0.d) / Math.sqrt(B0 / (2 * g));
      var b441 = 1025 * A1 * B1 * B1 * c1.a * Math.exp(c1.b * Math.pow(we, -1.3)) * Math.pow(we, c1.d) / Math.sqrt(B1 / (2 * g));
      var dr = Math.sqrt(b441 / b440), b44 = L * b440 * (delta + b441 * (1 - delta) / b440);
      var rhd = b44 + restoring * Tn / Math.PI * damp, exc;
      if (p.head === 90 || p.head === 270) exc = Math.sqrt(1025 * g * g * b440 / we) * (delta + dr * (1 - delta)) * L;
      else {
        var sA = Math.abs(Math.sin(betha)) * Math.sqrt(1025 * g * g / we) * Math.sqrt(b440) * 2 / ek;
        var sB = Math.pow(Math.sin(0.5 * delta * L * ek), 2), sC = Math.pow(dr * Math.sin(0.5 * (1 - delta) * L * ek), 2);
        var sD = 2 * dr * Math.sin(0.5 * delta * L * ek) * Math.sin(0.5 * (1 - delta) * L * ek) * Math.cos(0.5 * L * ek);
        exc = sA * Math.sqrt(sB + sC + sD);
      }
      var rA = Math.pow(1 - Math.pow(we * Tn / (2 * 3.14159), 2), 2), rB = restoring * restoring, rC = Math.pow(we * rhd, 2);
      out.roll.push(amp * exc / Math.sqrt(rA * rB + rC) * 180 / Math.PI);
    }
    // frequency bands where the paper says the formulas are less good (Jensen, Mansour and Olsen 2004, conclusion C)
    var x0 = out.freq[0], x1 = out.freq[out.freq.length - 1], bands = { heave: [], pitch: [], vert: [], acc: [], bm: [], roll: [] };
    var wLong = Math.sqrt(2 * Math.PI * g / L), wA = Math.sqrt(2 * Math.PI * g / (1.25 * L)), wB = Math.sqrt(2 * Math.PI * g / (0.75 * L));
    if (wLong > x0) {
      var lb = [x0, Math.min(wLong, x1), 'wave longer than the ship: heave too small'];
      bands.heave.push(lb); bands.vert.push(lb); bands.acc.push(lb);
      out.warnings.push('heave is too small for waves longer than the ship, below ' + wLong.toFixed(2) + ' rad/s (pink band)');
    }
    if (Fn > 0.2 && wB > x0 && wA < x1) {
      var pb = [Math.max(x0, wA), Math.min(x1, wB), 'wave length near the ship length: pitch too large'];
      bands.pitch.push(pb); bands.vert.push(pb); bands.acc.push(pb);
      out.warnings.push('pitch is too large for wave lengths near the ship length above Froude number 0.2, ' + pb[0].toFixed(2) + ' to ' + pb[1].toFixed(2) + ' rad/s (pink band)');
    }
    var wn = 2 * Math.PI / Tn, rb = null;
    for (i = 0; i <= SK_N; i++) {
      var inb = Math.abs(out.enc[i] - wn) <= 0.2 * wn;
      if (inb && !rb) rb = [out.freq[i], out.freq[i], 'around the roll resonance: roll too large'];
      if (inb && rb) rb[1] = out.freq[i];
      if (!inb && rb) { bands.roll.push(rb); rb = null; }
    }
    if (rb) bands.roll.push(rb);
    if (bands.roll.length) out.warnings.push('roll is too large around the resonance, where the encounter period is within 20% of the roll period of ' + Tn.toFixed(1) + ' s (pink band); the paper adds 20% to 40% of the critical damping in its comparisons');
    out.bands = bands;
    ['heave', 'pitch', 'pitchA', 'vert', 'acc', 'bm', 'roll'].forEach(function (key) {
      var bad = 0;
      out[key] = out[key].map(function (v) { if (isFinite(v)) return Math.abs(v) < 1e-9 ? 0 : v; bad++; return null; });
      if (bad) out.warnings.push(key === 'roll' ? 'roll has no value for ' + bad + ' of ' + (SK_N + 1) + ' frequencies: the formulas need a positive encounter frequency, so they do not cover waves that overtake the ship (following and quartering seas)' : 'no value for ' + bad + ' of ' + (SK_N + 1) + ' frequencies in ' + { heave: 'heave', pitch: 'pitch', pitchA: 'pitch angle', vert: 'vertical motion', acc: 'vertical acceleration', bm: 'bending moment' }[key]);
    });
    return out;
  }
  /* which charts are outside the limits of the method as a whole, for the case in p and c */
  function seakeepingOff(p, c) {
    var beam = p.head === 90 || p.head === 270, bt = p.B0 / p.T, bm = p.Cb < 0.6 || c.fn >= 0.3, roll = bt < 1 || bt > 6 || p.Cwp < p.delta;
    return { vert: beam, acc: beam, pitch: beam, heave: beam, bm: bm, roll: roll };
  }
  /* Seakeeping of one hull at its draught. model.sk = { head, amp, pos, damp, delta, tn (null = suggested), gm (null = from stability) }; speed is the service speed of the resistance tab. */
  function modelSeakeeping(model, hull, stab) {
    hull = hull || (model.hulls || [])[0];
    if (!hull) return null;
    var sk = model.sk || {}, hy = hullHydro(hull, hull.draught, model.rho), res = model.res || {};
    if (!(hy.V > 0) || !(hy.LWL > 0) || !(hy.BWL > 0)) return { ok: false, reason: 'The hull has no volume at this draught.', hull: hull, hy: hy };
    var vkn = typeof res.vs === 'number' && res.vs > 0 ? res.vs : Math.max(1, Math.round(0.2 * Math.sqrt(9.81 * hy.LWL) / 0.514444));
    var gmAuto = stab && !stab.overloaded && isFinite(stab.GM) ? stab.GM : null;
    var GM = typeof sk.gm === 'number' && sk.gm > 0 ? sk.gm : gmAuto;
    var delta = typeof sk.delta === 'number' ? sk.delta : 0.6;
    if (!(GM > 0)) return { ok: false, needGM: true, reason: 'Needs a positive GM: add blocks with mass, or type a GM.', hull: hull, hy: hy, vkn: vkn };
    var tnGuess = Math.round(0.85 * hy.BWL * 10 / Math.sqrt(GM)) / 10, tn = typeof sk.tn === 'number' && sk.tn > 0 ? sk.tn : tnGuess;
    var p = { L: hy.LWL, B0: hy.BWL, Cb: hy.Cb, T: hy.T, vkn: vkn, head: typeof sk.head === 'number' ? sk.head : 150, amp: typeof sk.amp === 'number' ? sk.amp : 1,
      pos: typeof sk.pos === 'number' ? sk.pos : 100, Cwp: hy.Cwp, GM: GM, Tn: tn, damp: typeof sk.damp === 'number' ? sk.damp : 20, delta: delta };
    var c = seakeepingCurves(p);
    return { ok: true, hull: hull, hy: hy, p: p, c: c, gmAuto: gmAuto, gmGiven: GM !== gmAuto, tnGuess: tnGuess, tnGiven: tn !== tnGuess, warnings: c.warnings };
  }


  /* ---------- Sea state: short-term statistics (Jensen, Mansour and Olsen 2004, section 7) ----------
     The wave spectrum is the JONSWAP form of their Eqs. 7.2 to 7.6 (gamma 1 is Pierson-Moskowitz, 3.3 the standard JONSWAP), scaled so that
     it holds exactly the significant wave height. A response R has the variance s2 = integral of Phi_R^2 S d(omega) (Eq. 7.1), and its peaks follow
     the Rayleigh law, P(peak > r) = exp(-r^2 / (2 s2)) (Eq. 8.1). Phi_R is the response of the Seakeeping tab for a wave of 1 m amplitude. */
  var SS_RESP = [
    { key: 'heave', label: 'Heave', unit: 'm', f: 1 },
    { key: 'pitchA', label: 'Pitch angle', unit: '°', f: 1 },
    { key: 'vert', label: 'Vertical motion at the position', unit: 'm', f: 1 },
    { key: 'acc', label: 'Vertical acceleration at the position', unit: 'm/s²', f: 1 },
    { key: 'roll', label: 'Roll angle', unit: '°', f: 1 }
  ];
  /* limits as RMS, vertical acceleration in g, roll and pitch in degrees. Sources: NORDFORSK 1987, Tables 7 and 8, and NATO STANAG 4154, as quoted
     by Stevens and Parsons (2002), Marine Technology 39(1), 29-47. The lateral acceleration limits are not used, the method has no sway. */
  var SS_CRITERIA = [
    { id: 'own', name: 'Own limits', group: '', acc: null, roll: null, pitch: null },
    { id: 'nf-light', name: 'Light manual work', group: 'NORDFORSK 1987, by work', acc: 0.20, roll: 6.0, pitch: null },
    { id: 'nf-heavy', name: 'Heavy manual work', group: 'NORDFORSK 1987, by work', acc: 0.15, roll: 4.0, pitch: null },
    { id: 'nf-intel', name: 'Intellectual work', group: 'NORDFORSK 1987, by work', acc: 0.10, roll: 3.0, pitch: null },
    { id: 'nf-transit', name: 'Transit passengers', group: 'NORDFORSK 1987, by work', acc: 0.05, roll: 2.5, pitch: null },
    { id: 'nf-cruise', name: 'Cruise liner', group: 'NORDFORSK 1987, by work', acc: 0.02, roll: 2.0, pitch: null },
    { id: 'nf-mb', name: 'Merchant ship, at the bridge', group: 'NORDFORSK 1987, by ship type', acc: 0.15, roll: 6.0, pitch: null },
    { id: 'nf-nb', name: 'Naval vessel, at the bridge', group: 'NORDFORSK 1987, by ship type', acc: 0.20, roll: 4.0, pitch: null },
    { id: 'nf-fb', name: 'Fast small craft, at the bridge', group: 'NORDFORSK 1987, by ship type', acc: 0.275, roll: 4.0, pitch: null },
    { id: 'nf-mfs', name: 'Merchant ship, at the forward perpendicular, L < 100 m', group: 'NORDFORSK 1987, by ship type', acc: 0.275, roll: 6.0, pitch: null },
    { id: 'nf-mfl', name: 'Merchant ship, at the forward perpendicular, L > 330 m', group: 'NORDFORSK 1987, by ship type', acc: 0.05, roll: 6.0, pitch: null },
    { id: 'nf-nf', name: 'Naval vessel, at the forward perpendicular', group: 'NORDFORSK 1987, by ship type', acc: 0.275, roll: 4.0, pitch: null },
    { id: 'nf-ff', name: 'Fast small craft, at the forward perpendicular', group: 'NORDFORSK 1987, by ship type', acc: 0.65, roll: 4.0, pitch: null },
    { id: 'abs', name: 'ABS COMF+, MSDV 30 m/s^1.5 (10% of passengers sick)', group: 'Motion sickness (MSDV)', acc: null, roll: null, pitch: null, msdv: 30 },
    { id: 'taylor6', name: 'Taylor (2023), 6 h on the SA Agulhas II, MSDV 45 m/s^1.5', group: 'Motion sickness (MSDV)', acc: null, roll: null, pitch: null, msdv: 45 },
    { id: 'nato', name: 'NATO STANAG 4154 (US Navy); the US Coast Guard limits are the same in significant amplitude', group: 'Navy', acc: 0.2, roll: 4.0, pitch: 1.5 }
  ];
  function jonswapF(g) {
    if (g <= 2) return { F1: 0.24 * g + 0.76, F2: -0.05 * g + 1.05 };
    if (g <= 3) return { F1: 0.22 * g + 0.80, F2: -0.02 * g + 0.99 };
    if (g <= 4) return { F1: 0.20 * g + 0.86, F2: -0.02 * g + 0.99 };
    if (g <= 5) return { F1: 0.20 * g + 0.86, F2: -0.01 * g + 0.95 };
    return { F1: 0.18 * g + 0.96, F2: -0.01 * g + 0.95 };
  }
  function jonswapRaw(w, hs, ts, g) {            // Eqs. 7.2 to 7.5, w in rad/s, ts the mean period
    var q = jonswapF(g), T = q.F2 * ts, x = 0.206 * T * w, sg = x <= 1 ? 0.07 : 0.09;
    if (!(w > 0)) return 0;
    return 173 * hs * hs * Math.pow(T, -4) * Math.pow(w, -5) * Math.exp(-692 * Math.pow(T * w, -4)) / q.F1 * Math.pow(g, Math.exp(-0.5 * Math.pow((x - 1) / sg, 2)));
  }
  function tsFromTz(tz, g) { return tz * Math.sqrt((10.89 + g) * (5 + g)) / (6.774 + g); }   // Eq. 7.6
  /* period of the spectral peak per unit Tz, found numerically: the shape depends on Tz only through w Tz */
  function peakRatio(g) {
    var best = 0, bw = 0, w;
    for (w = 0.02; w < 6; w += 0.0005) { var s = jonswapRaw(w, 1, tsFromTz(10, g), g); if (s > best) { best = s; bw = w; } }
    return 2 * Math.PI / bw / 10;
  }
  /* the spectrum at the frequencies w. ss = { hs, per, ptype ('Tz' or 'Tp'), gam }. Returns { S, tz, tp, ts, scale, cover } */
  function waveSpectrum(ss, w) {
    var g = Math.min(6, Math.max(1, ss.gam || 3.3)), hs = ss.hs, tz = ss.ptype === 'Tp' ? ss.per / peakRatio(g) : ss.per, ts = tsFromTz(tz, g), i, m0 = 0, m0g = 0, dw = 0.002;
    for (var q = 0.02; q < 8; q += dw) m0 += jonswapRaw(q + dw / 2, hs, ts, g) * dw;
    var scale = m0 > 0 ? hs * hs / 16 / m0 : 1, S = [];
    for (i = 0; i < w.length; i++) S.push(scale * jonswapRaw(w[i], hs, ts, g));
    var step = w.length > 1 ? w[1] - w[0] : 0;
    S.forEach(function (v) { m0g += v * step; });
    return { S: S, tz: tz, tp: tz * peakRatio(g), ts: ts, gam: g, scale: scale, cover: hs > 0 ? m0g / (hs * hs / 16) : 1 };
  }
  /* statistics of one response from its amplitude per metre of wave */
  /* ISO 2631-1 (1997) motion-sickness weighting Wf, magnitude at f Hz: band-limiting 0.08 and 0.63 Hz, acceleration-velocity transition 0.25 Hz (Q 0.86),
     upward step 0.0605 and 0.10 Hz (Q 0.8). Checked against Table G.3 of Taylor (2023), Appendix G, from Rimell and Mansfield (2007). */
  function wfMag(f) {
    var s = { re: 0, im: 2 * Math.PI * f }, w = function (x) { return 2 * Math.PI * x; }, q = Math.SQRT1_2;
    function mul(a, b) { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }
    function div(a, b) { var d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; }
    var s2 = mul(s, s);
    function quad(fc, Q) { return { re: s2.re + w(fc) * w(fc), im: s.im * w(fc) / Q }; }
    var Hh = div(s2, quad(0.08, q)), Hl = div({ re: w(0.63) * w(0.63), im: 0 }, quad(0.63, q)), Ht = div({ re: w(0.25) * w(0.25), im: 0 }, quad(0.25, 0.86)), Hs = div(quad(0.0605, 0.8), quad(0.10, 0.8));
    var z = mul(mul(Hh, Hl), mul(Ht, Hs));
    return Math.sqrt(z.re * z.re + z.im * z.im);
  }
  /* MSDV = sqrt(T) times the RMS of the Wf-weighted vertical acceleration (ISO 2631-1; Taylor 2023, Appendix O). The variance of each wave frequency
     is placed at its encounter frequency. VI = K MSDV with K = 1/3 (ISO 2631-1), in %. */
  function msdvOf(c, S, hours) {
    var n = c.freq.length, dw = c.freq[1] - c.freq[0], m = 0, i;
    for (i = 0; i < n; i++) { var v = c.acc[i]; if (v === null || !(c.enc[i] > 0)) continue; var wf = wfMag(c.enc[i] / (2 * Math.PI)); m += wf * wf * v * v * S[i] * dw; }
    var rms = Math.sqrt(m), T = hours * 3600;
    return { rms: rms, msdv: rms * Math.sqrt(T), vi: rms * Math.sqrt(T) / 3, minutes: hours * 60 };
  }
  function responseStats(c, phi, S, bands, hours) {
    var n = c.freq.length, dw = c.freq[1] - c.freq[0], m0 = 0, m2 = 0, inb = 0, und = 0, i, k;
    for (i = 0; i < n; i++) {
      var v = phi[i];
      if (v === null) { und++; continue; }
      var e = v * v * S[i] * dw; m0 += e; m2 += c.enc[i] * c.enc[i] * e;
      for (k = 0; k < bands.length; k++) if (c.freq[i] >= bands[k][0] && c.freq[i] <= bands[k][1]) { inb += e; break; }
    }
    var rms = Math.sqrt(m0), tr = m2 > 0 ? 2 * Math.PI * Math.sqrt(m0 / m2) : null, np = tr ? hours * 3600 / tr : null;
    return { rms: rms, sig: 2 * rms, max: np ? rms * Math.sqrt(2 * Math.log(Math.max(np, 3))) : 0, tr: tr, n: np, share: m0 > 0 ? inb / m0 : 0, undef: und };
  }
  /* The short-term response of one hull in a sea state. sk holds the sea state (hs, per, ptype, gam, hrs) and the limits (cacc, croll, cpitch). */
  function modelSeaState(model, hull, stab) {
    var r = modelSeakeeping(model, hull, stab);
    if (!r || !r.ok) return r;
    var sk = model.sk || {}, ss = { hs: typeof sk.hs === 'number' ? sk.hs : 3, per: typeof sk.per === 'number' ? sk.per : 8, ptype: sk.ptype === 'Tp' ? 'Tp' : 'Tz', gam: typeof sk.gam === 'number' ? sk.gam : 3.3, hrs: typeof sk.hrs === 'number' ? sk.hrs : 3 };
    var c = seakeepingCurves(Object.assign({}, r.p, { amp: 1 })), sp = waveSpectrum(ss, c.freq), off = seakeepingOff(r.p, c), warnings = [], rows = [];
    SS_RESP.forEach(function (d) {
      var bk = d.key === 'pitchA' ? 'pitch' : d.key, st = responseStats(c, c[d.key], sp.S, c.bands[bk] || [], ss.hrs);
      st.key = d.key; st.label = d.label; st.unit = d.unit; st.off = !!off[bk]; rows.push(st);
    });
    if (sp.cover < 0.99) warnings.push('the wave spectrum has ' + Math.round((1 - sp.cover) * 100) + '% of its energy outside 0.05 to 2.0 rad/s, the range of the calculation, so the results are too small');
    var offs2 = [], shr = [], und2 = [];
    rows.forEach(function (q) {
      if (q.off) offs2.push(q.label.toLowerCase());
      else if (q.share > 0.2) shr.push(q.label.toLowerCase() + ' ' + Math.round(q.share * 100) + '%');
      if (q.undef) und2.push(q.label.toLowerCase());
    });
    if (offs2.length) warnings.push('outside the limits of the method for this heading: ' + offs2.join(', '));
    if (shr.length) warnings.push('share of the variance in the pink bands of the Seakeeping charts, where the formulas are less good: ' + shr.join(', '));
    if (und2.length) warnings.push('no value at some frequencies, counted as zero: ' + und2.join(', '));
    var mv = msdvOf(c, sp.S, ss.hrs);
    if (ss.hrs < 1 / 3 || ss.hrs > 6) warnings.push('the MSDV is defined by ISO 2631-1 for 20 minutes to 6 hours of exposure');
    var crit = [];
    [['acc', 'Vertical acceleration', 'g', 'acc', 9.81], ['roll', 'Roll angle', '°', 'roll', 1], ['pitch', 'Pitch angle', '°', 'pitchA', 1]].forEach(function (d) {
      var lim = sk['c' + d[0]]; if (typeof lim !== 'number' || !(lim > 0)) return;
      var row = rows.filter(function (q) { return q.key === d[3]; })[0], v = row.rms / d[4];
      crit.push({ key: d[0], label: d[1], unit: d[2], limit: lim, value: v, ok: v <= lim, hsLimit: v > 1e-9 ? ss.hs * lim / v : null, off: row.off });
    });
    var lm = sk.cmsdv;
    if (typeof lm === 'number' && lm > 0) crit.push({ key: 'msdv', label: 'Motion sickness dose value, MSDV', unit: 'm/s^1.5', limit: lm, value: mv.msdv, ok: mv.msdv <= lm, hsLimit: mv.msdv > 1e-9 ? ss.hs * lm / mv.msdv : null, off: false });
    return { ok: true, base: r, ss: ss, sp: sp, c: c, rows: rows, crit: crit, warnings: warnings, msdv: mv };
  }
  /* The largest Hs that meets each limit at each heading, the period and the speed staying as they are. The response grows in proportion to Hs. */
  function seaLimitSweep(model, hull, stab) {
    var r = modelSeakeeping(model, hull, stab);
    if (!r || !r.ok) return null;
    var sk = model.sk || {}, ss = { hs: 1, per: typeof sk.per === 'number' ? sk.per : 8, ptype: sk.ptype === 'Tp' ? 'Tp' : 'Tz', gam: typeof sk.gam === 'number' ? sk.gam : 3.3, hrs: typeof sk.hrs === 'number' ? sk.hrs : 3 };
    var heads = [], out = { acc: [], roll: [], pitch: [], msdv: [] }, h;
    for (h = 0; h <= 180; h += 10) {
      heads.push(h);
      var c = seakeepingCurves(Object.assign({}, r.p, { amp: 1, head: h })), sp = waveSpectrum(ss, c.freq);
      [['acc', 'acc', 9.81], ['roll', 'roll', 1], ['pitch', 'pitchA', 1]].forEach(function (d) {
        var lim = sk['c' + d[0]];
        if (typeof lim !== 'number' || !(lim > 0)) { out[d[0]].push(null); return; }
        var st = responseStats(c, c[d[1]], sp.S, [], 1), v = st.rms / d[2];
        out[d[0]].push(st.undef || v < 1e-9 ? null : lim / v);
      });
      var lmv = sk.cmsdv, mm = msdvOf(c, sp.S, typeof sk.hrs === 'number' ? sk.hrs : 3);
      out.msdv.push(typeof lmv === 'number' && lmv > 0 && mm.msdv > 1e-9 ? lmv / mm.msdv : null);
    }
    return { heads: heads, lim: out, period: ss.per, ptype: ss.ptype };
  }

  /* Hydrostatics of all hulls together, each at its own draught: volumes and areas add, centres are weighted
     (LCB, KB, TCB by volume; LCF by waterplane area). TCB is the transverse centre of buoyancy (y, to port). */
  function modelHydro(model) {
    var rho = model.rho || 1.025, hulls = model.hulls || [];
    if (!hulls.length) return null;
    var list = hulls.map(function (h) { return { hull: h, h: hullHydro(h, h.draught, rho) }; });
    var tot = { V: 0, disp: 0, Awp: 0, TPC: 0, LCB: 0, KB: 0, LCF: 0, TCB: 0, rho: rho };
    list.forEach(function (e) {
      var q = e.h, y = e.hull.y || 0;
      tot.V += q.V; tot.Awp += q.Awp; tot.TPC += q.TPC;
      tot.LCB += q.V * q.LCB; tot.KB += q.V * q.KB; tot.TCB += q.V * y; tot.LCF += q.Awp * q.LCF;
    });
    tot.disp = rho * tot.V;
    if (tot.V > 0) { tot.LCB /= tot.V; tot.KB /= tot.V; tot.TCB /= tot.V; }
    if (tot.Awp > 0) tot.LCF /= tot.Awp;
    return { hulls: list, total: tot };
  }


  /* Floating at the weight. The total weight (blocks plus structure) is put on the water and two things are solved:
     the level draught where the displacement equals the weight, and the trim where the centre of buoyancy comes under
     the centre of gravity. Trim is an exact tilted-plane solve: the water plane is z = Tm - k (x - xm), k = tan(trim),
     positive when the stern sits deeper. All hulls share the plane. Heel is not solved here. */
  function floatState(model, opt) {
    opt = opt || {};
    var hs = model.hulls || [];
    if (!hs.length) return null;
    var w = weightSummary(model), W = w.total.mass, lcg = w.total.lcg, rho = model.rho || 1.025;
    if (!(W > 0) || lcg == null) return null;
    var nz = opt.coarse ? 20 : 40, nu = opt.coarse ? 60 : 120, X = [], A = [], Z0 = [], DZ = [], maxDepth = 0, xa = Infinity, xf = -Infinity;
    hs.forEach(function (h) {
      maxDepth = Math.max(maxDepth, h.depth); xa = Math.min(xa, h.x); xf = Math.max(xf, h.x + h.loa);
      var dz = h.depth / nz;
      for (var j = 0; j < nz; j++) {
        var t = (j + 0.5) / nz, r = hullXRange(h, t), len = r[1] - r[0];
        for (var i = 0; i < nu; i++) {
          X.push(r[0] + (i + 0.5) / nu * len); A.push(2 * hullHalf(h, (i + 0.5) / nu, t) * len / nu * dz);
          Z0.push(j * dz); DZ.push(dz);
        }
      }
    });
    var xm = 0.5 * (xa + xf), L = xf - xa, n = X.length, ev = { V: 0, Mx: 0 };
    function evalAt(Tm, k) {
      var V = 0, Mx = 0;
      for (var c = 0; c < n; c++) {
        var f = (Tm - k * (X[c] - xm) - Z0[c]) / DZ[c];
        if (f <= 0) continue;
        if (f > 1) f = 1;
        var dv = A[c] * f; V += dv; Mx += dv * X[c];
      }
      ev.V = V; ev.Mx = Mx;
    }
    var Vt = W / rho;
    function solveTm(k) {                                   // draught at the middle that gives the volume
      var lo = -L * Math.abs(k), hi = maxDepth + L * Math.abs(k), it;
      evalAt(hi, k);
      if (ev.V < Vt) return null;
      for (it = 0; it < (opt.coarse ? 20 : 28); it++) {
        var mid = 0.5 * (lo + hi); evalAt(mid, k);
        if (ev.V < Vt) lo = mid; else hi = mid;
      }
      return 0.5 * (lo + hi);
    }
    var out = { weight: W, lcg: lcg, rho: rho, ok: true, overloaded: false, T: null, lcbLevel: null, trimOk: false, Tm: null, trim: null, angle: null, draftAft: null, draftFwd: null, lcb: null, xAft: xa, xFwd: xf };
    var T0 = solveTm(0);
    if (T0 == null) { out.ok = false; out.overloaded = true; return out; }
    out.T = T0; evalAt(T0, 0); out.lcbLevel = ev.Mx / ev.V;
    if (opt.levelOnly) return out;
    function lcbOf(k) { var tm = solveTm(k); if (tm == null) return null; evalAt(tm, k); return ev.Mx / ev.V; }
    var kLo = -0.2, kHi = 0.2, lLo = lcbOf(kLo), lHi = lcbOf(kHi);       // LCB falls as k rises
    if (lLo == null || lHi == null || lcg > lLo || lcg < lHi) return out;
    for (var it = 0; it < (opt.coarse ? 18 : 30); it++) {
      var km = 0.5 * (kLo + kHi), lm = lcbOf(km);
      if (lm == null) return out;
      if (lm > lcg) kLo = km; else kHi = km;
    }
    var k = 0.5 * (kLo + kHi), tm = solveTm(k);
    if (tm == null) return out;
    evalAt(tm, k);
    out.trimOk = true; out.k = k; out.xm = xm; out.Tm = tm; out.lcb = ev.Mx / ev.V;
    out.draftAft = tm - k * (xa - xm); out.draftFwd = tm - k * (xf - xm);
    out.trim = out.draftAft - out.draftFwd; out.angle = Math.atan(k) * 180 / Math.PI;
    out.tcg = w.total.tcg; out.tcb = null; out.kp = 0; out.heel = 0; out.heelOk = false; out.ym = 0;
    if (w.total.tcg == null || w.total.vcg == null) return out;
    heelSolve(out, hs, w.total.tcg, w.total.vcg, Vt, xm, opt);
    return out;
  }

  /* Equilibrium with trim and heel. The plane is z = Tm - k (x - xm) + kp (y - ym), kp = tan(heel), positive when the port
     side is deeper. Newton on (Tm, k, kp) so that the volume equals the weight and the centre of buoyancy B lies on the
     vertical through the centre of gravity G, which in the hull axes is tilted with the plane:
     xB - xG = k (zB - zG) and yB - yG = -kp (zB - zG). Each hull strip is cut into transverse cells, so the immersion
     changes across the beam. Without convergence heelOk stays false and the simpler trim result is kept. */
  function heelSolve(out, hs, tcg, vcg, Vt, xm, opt) {
    var nz = opt.coarse ? 16 : 32, nu = opt.coarse ? 48 : 90, ny = opt.coarse ? 8 : 14;
    var X = [], Y = [], A = [], Z0 = [], DZ = [], ymin = Infinity, ymax = -Infinity, ys = [];
    hs.forEach(function (h) {
      var dz = h.depth / nz; ys.push(h.y || 0);
      ymin = Math.min(ymin, (h.y || 0) - h.beam / 2); ymax = Math.max(ymax, (h.y || 0) + h.beam / 2);
      for (var j = 0; j < nz; j++) {
        var t = (j + 0.5) / nz, r = hullXRange(h, t), len = r[1] - r[0];
        for (var i = 0; i < nu; i++) {
          var half = hullHalf(h, (i + 0.5) / nu, t), x = r[0] + (i + 0.5) / nu * len;
          for (var q = 0; q < ny; q++) {
            X.push(x); Y.push((h.y || 0) - half + (q + 0.5) * 2 * half / ny);
            A.push(2 * half / ny * len / nu * dz); Z0.push(j * dz); DZ.push(dz);
          }
        }
      }
    });
    var ym = 0.5 * (Math.min.apply(null, ys) + Math.max.apply(null, ys)), n = X.length, r3 = [0, 0, 0];
    function res(u) {
      var V = 0, Mx = 0, My = 0, Mz = 0;
      for (var c = 0; c < n; c++) {
        var f = (u[0] - u[1] * (X[c] - xm) + u[2] * (Y[c] - ym) - Z0[c]) / DZ[c];
        if (f <= 0) continue;
        if (f > 1) f = 1;
        var dv = A[c] * f; V += dv; Mx += dv * X[c]; My += dv * Y[c]; Mz += dv * (Z0[c] + 0.5 * f * DZ[c]);
      }
      if (V <= 0) return null;
      var xb = Mx / V, yb = My / V, zb = Mz / V;
      return [V / Vt - 1, (xb - out.lcg) - u[1] * (zb - vcg), (yb - tcg) + u[2] * (zb - vcg), xb, yb, zb];
    }
    var u = [out.Tm, out.k, 0], steps = [0.004, 0.0004, 0.0004], lim = [0.5, 0.05, 0.1], it, c, d;
    for (it = 0; it < 30; it++) {
      var r0 = res(u);
      if (!r0) return;
      if (Math.abs(r0[0]) < 2e-5 && Math.abs(r0[1]) < 2e-4 && Math.abs(r0[2]) < 2e-4) {
        out.heelOk = true; out.Tm = u[0]; out.k = u[1]; out.kp = u[2]; out.ym = ym; out.tcb = r0[4]; out.lcb = r0[3]; out.kb = r0[5];
        break;
      }
      var J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (c = 0; c < 3; c++) {
        var up = u.slice(); up[c] += steps[c];
        var rp = res(up);
        if (!rp) return;
        for (d = 0; d < 3; d++) J[d][c] = (rp[d] - r0[d]) / steps[c];
      }
      var dx = solve3(J, [-r0[0], -r0[1], -r0[2]]);
      if (!dx) return;
      for (c = 0; c < 3; c++) u[c] += Math.max(-lim[c], Math.min(lim[c], dx[c]));
    }
    if (!out.heelOk) return;
    var xa = out.xAft, xf = out.xFwd;
    out.draftAft = out.Tm - out.k * (xa - xm); out.draftFwd = out.Tm - out.k * (xf - xm);
    out.trim = out.draftAft - out.draftFwd; out.angle = Math.atan(out.k) * 180 / Math.PI;
    out.heel = Math.atan(out.kp) * 180 / Math.PI;
    out.draftPort = out.Tm + out.kp * (ymax - ym); out.draftStbd = out.Tm + out.kp * (ymin - ym);
    out.yPort = ymax; out.yStbd = ymin;
  }
  function solve3(M, b) {
    var a = [M[0].concat([b[0]]), M[1].concat([b[1]]), M[2].concat([b[2]])], i, j, k;
    for (i = 0; i < 3; i++) {
      var p = i;
      for (j = i + 1; j < 3; j++) if (Math.abs(a[j][i]) > Math.abs(a[p][i])) p = j;
      if (Math.abs(a[p][i]) < 1e-12) return null;
      var t = a[i]; a[i] = a[p]; a[p] = t;
      for (j = i + 1; j < 3; j++) { var f = a[j][i] / a[i][i]; for (k = i; k < 4; k++) a[j][k] -= f * a[i][k]; }
    }
    var x = [0, 0, 0];
    for (i = 2; i >= 0; i--) { var sum = a[i][3]; for (j = i + 1; j < 3; j++) sum -= a[i][j] * x[j]; x[i] = sum / a[i][i]; }
    return x;
  }


  /* Initial stability (small angles) at the level draught that carries the weight, upright and without trim.
     KM = KB + BM, BM = I / V with I the second moment of the waterplane about its own centroid (the parallel-axis term of
     each hull is included, which is why multihulls have a large BM). GM = KM - KG, KG from the weights. A block marked
     free surface, partly filled (0 < fill < 100), is taken as a rectangular tank by its bounding box and lifts G by
     rho_liquid x i / weight (virtual rise). Returns null without hulls or weight; {overloaded:true} when too heavy. */
  function stabilityState(model, fres) {
    var hs = model.hulls || [];
    if (!hs.length) return null;
    var w = weightSummary(model), W = w.total.mass;
    if (!(W > 0) || w.total.vcg == null) return null;
    var f = fres && fres.T ? fres : floatState(model, { levelOnly: true });
    if (!f) return null;
    if (f.overloaded) return { overloaded: true };
    var rho = model.rho || 1.025, T = f.T, nu = 240, V = 0, Mz = 0, A = 0, mx = 0, my = 0, i, hh = [];
    hs.forEach(function (h) {
      var q = hullHydro(h, T, rho), t = Math.min(T, h.depth) / h.depth, r = hullXRange(h, t), len = r[1] - r[0];
      V += q.V; Mz += q.V * q.KB;
      for (i = 0; i < nu; i++) {
        var b2 = 2 * hullHalf(h, (i + 0.5) / nu, t), dA = b2 * len / nu, x = r[0] + (i + 0.5) / nu * len;
        hh.push([x, h.y || 0, dA, b2, len / nu]); A += dA; mx += dA * x; my += dA * (h.y || 0);
      }
    });
    if (!(V > 0) || !(A > 0)) return null;
    var xf = mx / A, yc = my / A, IT = 0, IL = 0;
    hh.forEach(function (c) {
      IT += c[4] * Math.pow(c[3], 3) / 12 + c[2] * (c[1] - yc) * (c[1] - yc);
      IL += c[3] * Math.pow(c[4], 3) / 12 + c[2] * (c[0] - xf) * (c[0] - xf);
    });
    var KB = Mz / V, BMt = IT / V, BMl = IL / V, KG = w.total.vcg;
    var fsT = 0, fsL = 0, tanks = [], marked = 0;
    model.blocks.forEach(function (b) {
      if (!b.freeSurface) return;
      marked++;
      var q = blockMass(model, b), bx = blockWorldBox(b), lx = bx.max[0] - bx.min[0], by = bx.max[1] - bx.min[1];
      if (!(q.fill > 0 && q.fill < 100) || !(q.density > 0)) return;
      var iT = lx * Math.pow(by, 3) / 12, iL = by * Math.pow(lx, 3) / 12;
      fsT += q.density * iT / W; fsL += q.density * iL / W;
      tanks.push({ block: b, iT: iT, iL: iL, riseT: q.density * iT / W });
    });
    var GMs = KB + BMt - KG, GM = GMs - fsT, GMl = KB + BMl - KG - fsL;
    var ymin = Infinity, ymax = -Infinity;
    hs.forEach(function (h) { ymin = Math.min(ymin, (h.y || 0) - h.beam / 2); ymax = Math.max(ymax, (h.y || 0) + h.beam / 2); });
    var B = ymax - ymin;
    var heel = null, trim = null, L = f.xFwd - f.xAft;
    if (f.trimOk) { trim = f.trim; if (f.heelOk) heel = f.heel; }
    return {
      overloaded: false, T: T, weight: W, V: V, Awp: A, LCF: xf, IT: IT, IL: IL, KB: KB, BMt: BMt, BMl: BMl, KMt: KB + BMt, KMl: KB + BMl, KG: KG,
      GMsolid: GMs, marked: marked, fsT: fsT, fsL: fsL, GM: GM, GMl: GMl, tanks: tanks, B: B, L: L,
      KGmax: KB + BMt - fsT - 0.15, heel: heel, trim: trim,
      checks: stabilityChecks({ GM: GM, GMl: GMl, heel: heel, trim: trim, L: L })
    };
  }

  /* Righting lever GZ for heel to one side, in steps of 5 degrees, with the trim free. For every angle the water plane is tilted,
     the draught and trim are found that keep the displacement and put B under G, and GZ is the sideways distance between them.
     The hulls are counted up to the main deck only, so the curve stops where the deck edge enters the water (or at 70 degrees).
     G is taken on the centre line, with the free surface correction as a rise of G. */
  function gzCurve(model, st) {
    var hs = model.hulls || [];
    if (!hs.length || !st || st.overloaded) return null;
    var w = weightSummary(model), W = w.total.mass, rho = model.rho || 1.025;
    if (!(W > 0) || w.total.lcg == null || w.total.vcg == null) return null;
    var Vt = W / rho, lcg = w.total.lcg, vcg = w.total.vcg;
    var nz = 24, nu = 70, ny = 12, X = [], Y = [], A = [], Z0 = [], DZ = [], xa = Infinity, xf = -Infinity, ymin = Infinity, ymax = -Infinity, ys = [], maxD = 0, edge = [];
    hs.forEach(function (h) {
      var dz = h.depth / nz, hy = h.y || 0, i, j, q;
      ys.push(hy); xa = Math.min(xa, h.x); xf = Math.max(xf, h.x + h.loa); maxD = Math.max(maxD, h.depth);
      ymin = Math.min(ymin, hy - h.beam / 2); ymax = Math.max(ymax, hy + h.beam / 2);
      for (j = 0; j < nz; j++) {
        var t = (j + 0.5) / nz, r = hullXRange(h, t), len = r[1] - r[0];
        for (i = 0; i < nu; i++) {
          var half = hullHalf(h, (i + 0.5) / nu, t), x = r[0] + (i + 0.5) / nu * len;
          for (q = 0; q < ny; q++) { X.push(x); Y.push(hy - half + (q + 0.5) * 2 * half / ny); A.push(2 * half / ny * len / nu * dz); Z0.push(j * dz); DZ.push(dz); }
        }
      }
      var r1 = hullXRange(h, 1);
      for (i = 0; i <= 40; i++) { var hf = hullHalf(h, i / 40, 1), xe = r1[0] + (r1[1] - r1[0]) * i / 40; edge.push([xe, hy + hf, h.depth], [xe, hy - hf, h.depth]); }
    });
    var xm = 0.5 * (xa + xf), ym = 0.5 * (Math.min.apply(null, ys) + Math.max.apply(null, ys)), n = X.length;
    var KGfs = vcg + (st.fsT || 0);
    function res(u0, u1, u2) {
      var V = 0, Mx = 0, My = 0, Mz = 0, c;
      for (c = 0; c < n; c++) {
        var f = (u0 - u1 * (X[c] - xm) + u2 * (Y[c] - ym) - Z0[c]) / DZ[c];
        if (f <= 0) continue;
        if (f > 1) f = 1;
        var dv = A[c] * f; V += dv; Mx += dv * X[c]; My += dv * Y[c]; Mz += dv * (Z0[c] + 0.5 * f * DZ[c]);
      }
      if (V <= 0) return null;
      var dx = Mx / V - lcg, dy = My / V - ym, dzz = Mz / V - vcg;
      var nn = Math.sqrt(u1 * u1 + u2 * u2 + 1), nx = u1 / nn, ny_ = -u2 / nn, nzz = 1 / nn, dn = dx * nx + dy * ny_ + dzz * nzz;
      var px = dx - dn * nx, py = dy - dn * ny_, pz = dzz - dn * nzz;
      var tl = Math.sqrt(1 + u1 * u1), ex = 1 / tl, ez = -u1 / tl;           // along the water plane in x
      var tn = Math.sqrt(1 + u2 * u2), gy = 1 / tn, gz = u2 / tn;           // along the water plane in y
      return { r0: V / Vt - 1, r1: px * ex + pz * ez, gz: py * gy + pz * gz, kb: Mz / V };
    }
    function solve(phi, u0, u1) {
      var u2 = Math.tan(phi * Math.PI / 180), it;
      for (it = 0; it < 40; it++) {
        var r = res(u0, u1, u2);
        if (!r) return null;
        if (Math.abs(r.r0) < 2e-5 && Math.abs(r.r1) < 2e-4) return { u0: u0, u1: u1, gz: r.gz, T: u0 };
        var a = res(u0 + 0.004, u1, u2), b = res(u0, u1 + 0.0004, u2);
        if (!a || !b) return null;
        var J = [[(a.r0 - r.r0) / 0.004, (b.r0 - r.r0) / 0.0004], [(a.r1 - r.r1) / 0.004, (b.r1 - r.r1) / 0.0004]], det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
        if (Math.abs(det) < 1e-12) return null;
        var d0 = (-r.r0 * J[1][1] + r.r1 * J[0][1]) / det, d1 = (-r.r1 * J[0][0] + r.r0 * J[1][0]) / det;
        d0 = Math.max(-0.5, Math.min(0.5, d0)); d1 = Math.max(-0.05, Math.min(0.05, d1));
        u0 += d0; u1 += d1;
      }
      return null;
    }
    function immersed(sol, phi) {                                            // is the deck edge in the water?
      var u2 = Math.tan(phi * Math.PI / 180);
      for (var i = 0; i < edge.length; i++) if (sol.u0 - sol.u1 * (edge[i][0] - xm) + u2 * (edge[i][1] - ym) >= edge[i][2] - 1e-6) return true;
      return false;
    }
    function point(phi, sol) {
      var sn = Math.sin(phi * Math.PI / 180);
      var z0 = function (v) { return Math.abs(v) < 5e-4 ? 0 : v; };
      return { phi: phi, T: sol.u0, trim: -sol.u1 * (xf - xa), KN: z0(sol.gz + vcg * sn), KGfs: KGfs, gz: z0(sol.gz - (st.fsT || 0) * sn) };
    }
    var s0 = solve(0, st.T, 0);
    if (!s0) return null;
    var pts = [point(0, s0)], prev = s0, phiPrev = 0, limit = null, reason = 'max', phi;
    for (phi = 5; phi <= 70; phi += 5) {
      var sol = solve(phi, prev.u0, prev.u1);
      if (!sol) { limit = phiPrev; reason = 'solve'; break; }
      if (immersed(sol, phi)) {                                              // refine the angle where the deck edge enters
        var lo = phiPrev, hi = phi, solLo = prev, k;
        for (k = 0; k < 7; k++) {
          var mid = 0.5 * (lo + hi), sm = solve(mid, solLo.u0, solLo.u1);
          if (sm && !immersed(sm, mid)) { lo = mid; solLo = sm; } else hi = mid;
        }
        if (lo > phiPrev + 0.05) pts.push(point(Math.round(lo * 10) / 10, solLo));
        limit = Math.round(lo * 10) / 10; reason = 'edge'; break;
      }
      pts.push(point(phi, sol)); prev = sol; phiPrev = phi;
    }
    if (limit == null) limit = phiPrev;
    // numbers
    var rad = Math.PI / 180, i;
    function area(a, b) {                                                    // trapezoids between the points, from angle a to b (degrees)
      var sum = 0;
      function g(p) { for (var q = 0; q < pts.length - 1; q++) if (p >= pts[q].phi - 1e-9 && p <= pts[q + 1].phi + 1e-9) { var f = pts[q + 1].phi === pts[q].phi ? 0 : (p - pts[q].phi) / (pts[q + 1].phi - pts[q].phi); return pts[q].gz + f * (pts[q + 1].gz - pts[q].gz); } return pts[pts.length - 1].gz; }
      var hi = Math.min(b, limit);
      if (hi <= a) return 0;
      var grid = [a]; pts.forEach(function (p) { if (p.phi > a && p.phi < hi) grid.push(p.phi); }); grid.push(hi);
      for (var q = 0; q < grid.length - 1; q++) sum += 0.5 * (g(grid[q]) + g(grid[q + 1])) * (grid[q + 1] - grid[q]) * rad;
      return sum;
    }
    var mx = pts[0];
    pts.forEach(function (p) { if (p.gz > mx.gz) mx = p; });
    var van = null;
    for (i = 1; i < pts.length; i++) if (pts[i - 1].gz > 0 && pts[i].gz <= 0) { van = pts[i - 1].phi + pts[i - 1].gz / (pts[i - 1].gz - pts[i].gz) * (pts[i].phi - pts[i - 1].phi); break; }
    var a30 = area(0, 30), a40 = area(0, 40), a3040 = area(30, 40), g30 = limit >= 30 ? pts.filter(function (p) { return Math.abs(p.phi - 30) < 1e-9; })[0].gz : null;
    function cr(name, req, val, ok, unit) { return { name: name, req: req, value: val, ok: ok, unit: unit }; }
    var upTo = reason === 'edge' && limit < 40 ? limit : 40;
    var criteria = [
      cr('Area under GZ, 0° to 30°', 0.055, a30, a30 >= 0.055, 'm·rad'),
      cr('Area under GZ, 0° to ' + (upTo < 40 ? fmtA(upTo) : '40') + '°', 0.09, a40, a40 >= 0.09, 'm·rad'),
      cr('Area under GZ, 30° to 40°', 0.03, a3040, a3040 >= 0.03, 'm·rad'),
      cr('GZ at 30° or more', 0.2, g30 != null ? Math.max.apply(null, pts.filter(function (p) { return p.phi >= 30; }).map(function (p) { return p.gz; })) : null, null, 'm'),
      cr('Angle of maximum GZ', 25, mx.phi, mx.phi >= 25, '°'),
      cr('Initial GM, corrected', 0.15, st.GM, st.GM >= 0.15, 'm')
    ];
    criteria[3].ok = criteria[3].value != null && criteria[3].value >= 0.2;
    if (limit < 30) { criteria[0].note = 'to deck edge at ' + fmtA(limit) + '°'; criteria[3].note = 'deck edge at ' + fmtA(limit) + '°'; criteria[3].value = null; }
    if (reason === 'edge' && mx.phi === limit && limit < 25) criteria[4].note = 'deck edge at ' + fmtA(limit) + '°';
    if (reason === 'edge' && limit < 40) criteria[2].note = 'deck edge at ' + fmtA(limit) + '°';
    return { pts: pts, limit: limit, reason: reason, open: reason === 'edge' && mx.phi === limit, maxGZ: mx.gz, phiMax: mx.phi, phiVan: van, a30: a30, a40: a40, a3040: a3040, gz30: g30, criteria: criteria, KG: vcg, fsT: st.fsT || 0, GM: st.GM };
    function fmtA(v) { return String(Math.round(v * 10) / 10); }
  }

  /* A few basic, simple checks. Indicative only, not a class or flag-state assessment. */
  function stabilityChecks(s) {
    function c(name, ok, value, limit) { return { name: name, status: ok == null ? 'none' : (ok ? 'pass' : 'fail'), value: value, limit: limit }; }
    return [
      c('Initial metacentric height GM (corrected)', s.GM >= 0.15, s.GM, 'at least 0.15 m (IMO IS Code, general intact criterion)'),
      c('Static heel', s.heel == null ? null : Math.abs(s.heel) <= 5, s.heel, 'at most 5° (design guide)'),
      c('Trim', s.trim == null ? null : Math.abs(s.trim) <= 0.01 * s.L, s.trim, 'at most 1% of the hull length (design guide)')
    ];
  }


  /* The assessment shown on the Summary tab and in the workbook: nothing new is calculated here, the results of the
     requirements, weight, hull check, floating and stability are read together into chips (ok / warn / bad / none),
     an issues list with where to look, and a list of what passes. The thresholds are simple guides:
     weight margin within 1% of the displacement, blocks outside the hulls up to 2% (amber) and 10% (red) of the block
     volume below the main deck, and the three basic stability checks. */
  function assessment(model, fres, sbIn) {
    var ws = weightSummary(model), hc = hullCheck(model), ev = evaluateRequirements(model), chips = [], issues = [], good = [];
    var f1 = function (v) { return String(Math.round(v * 100) / 100); };
    var rank = { none: 0, ok: 1, note: 2, warn: 3, bad: 4 };
    function add(sev, text, tab, ref) { issues.push({ sev: sev, text: text, tab: tab, ref: ref || null }); }
    function worse(a, b) { return rank[b] > rank[a] ? b : a; }

    if (!model.blocks.length) add('note', 'No blocks yet. Drag a shape from the library onto the workplane, or click one to add it.', null);
    // requirements
    var n = { ok: 0, excess: 0, fail: 0, none: 0 }, sevR = 'ok', met = 0, over = 0;
    ev.forEach(function (x) {
      var r = x.req, un = METRICS[r.metric].unit, hi = r.sense === 'max', tgt = r.shall != null ? 'shall' : 'should', tv = r.shall != null ? r.shall : r.should;
      n[x.status]++;
      if (x.status === 'fail') { sevR = 'bad'; add('bad', r.name + ': ' + f1(x.achieved) + ' ' + un + ', ' + (hi ? 'above' : 'below') + ' the ' + tgt + ' of ' + f1(tv) + ' ' + un + (x.margin != null ? ' (' + fmtMargin(x.margin) + ')' : ''), 'reqs', { req: r.id }); }
      else if (x.status === 'excess') { over++; met++; add('note', r.name + ': ' + f1(x.achieved) + ' ' + un + ' is ' + fmtMargin(Math.abs(x.marginShould)).slice(1) + ' ' + (hi ? 'below' : 'above') + ' the should of ' + f1(r.should) + ' ' + un + ', an excess that may cost more than needed', 'reqs', { req: r.id }); }
      else if (x.status !== 'none') {
        met++;
        if (x.statusInside === 'fail') { sevR = worse(sevR, 'warn'); add('warn', r.name + ': only ' + f1(x.inside) + ' ' + un + ' lies inside the hulls (estimate), which does not meet the target', 'reqs', { req: r.id }); }
      }
    });
    var withTarget = ev.length - n.none;
    if (!ev.length) chips.push({ key: 'reqs', label: 'Requirements', value: 'none defined', sev: 'none', tab: 'reqs' });
    else if (!withTarget) chips.push({ key: 'reqs', label: 'Requirements', value: 'no targets set', sev: 'none', tab: 'reqs' });
    else { chips.push({ key: 'reqs', label: 'Requirements', value: met + ' of ' + withTarget + ' met' + (over ? ', ' + over + ' in excess' : ''), sev: sevR, tab: 'reqs' }); if (sevR === 'ok') good.push('All ' + withTarget + ' requirements with a target meet their shall.'); }

    // weight and hull
    var f = fres && (fres.T || fres.overloaded) ? fres : (ws.hasHull ? floatState(model, { levelOnly: true }) : null), sevW = 'ok', valW = '';
    if (!ws.hasHull) chips.push({ key: 'weight', label: 'Weight and hull', value: 'no hull', sev: 'none', tab: 'hydro' });
    else if (!f) chips.push({ key: 'weight', label: 'Weight and hull', value: 'no weight yet', sev: 'none', tab: 'hydro' });
    else {
      if (f.overloaded) { sevW = 'bad'; valW = 'overloaded'; add('bad', 'The weight is more than the hulls displace at full depth.', 'hydro'); }
      else if (model.float) valW = 'floats at ' + f1(model.draught) + ' m';
      else {
        var mp = ws.marginPct;
        valW = 'margin ' + f1(mp) + '%';
        if (mp < -1) { sevW = 'bad'; add('bad', 'The weight exceeds the displacement at the draught by ' + f1(-ws.margin) + ' t (' + f1(-mp) + '%). Use Float, or raise the draught.', 'hydro'); }
        else if (mp > 1 && model.blocks.length) { sevW = 'warn'; add('warn', 'The displacement exceeds the weight by ' + f1(ws.margin) + ' t (' + f1(mp) + '%): the vessel would float higher than the draught set. Float sets it.', 'hydro'); }
        else good.push('Weight and displacement agree within 1% at the draught set.');
      }
      if (hc && hc.blocksBelow > 0) {
        var share = hc.outside / hc.blocksBelow;
        if (share > 0.02) {
          var sevO = share > 0.10 ? 'bad' : 'warn'; sevW = worse(sevW, sevO);
          add(sevO, f1(100 * share) + '% of the block volume below the main deck lies outside the hulls (estimate).', 'summary');
          hc.per.slice(0, 3).forEach(function (q) { if (q.block && hc.byId[q.block.id].shareBlock >= 0.05) add('warn', q.block.name + ': ' + f1(100 * hc.byId[q.block.id].shareBlock) + '% of the block lies outside the hulls.', 'blocks', { block: q.block.id }); });
        } else good.push('Blocks below the main deck lie inside the hulls.');
      }
      chips.push({ key: 'weight', label: 'Weight and hull', value: valW + (hc && hc.blocksBelow > 0 && hc.outside / hc.blocksBelow > 0.02 ? ', blocks outside' : ''), sev: sevW, tab: 'hydro' });
    }

    // floating and stability
    var sb = ws.hasHull && f && !f.overloaded ? (sbIn !== undefined ? sbIn : stabilityState(model, f)) : null;
    if (sb && sb.overloaded) sb = null;
    if (ws.hasHull && f && !f.overloaded) {
      var sevF = 'ok', valF = '';
      if (!f.trimOk) { sevF = 'bad'; valF = 'trim out of range'; add('bad', 'The trim is out of range: the weight centre is too far from the buoyancy.', 'hydro'); }
      else {
        valF = 'trim ' + f1(f.trim) + ' m' + (f.heelOk ? ', heel ' + f1(Math.abs(f.heel)) + '°' : '');
        var maxD = 0; (model.hulls || []).forEach(function (h) { maxD = Math.max(maxD, h.depth); });
        if (!f.heelOk) { sevF = 'bad'; valF += ', no heel found'; add('bad', 'No heel equilibrium was found: a heavy off-centre load on one hull can do that.', 'hydro'); }
        if (sb && sb.checks[1].status === 'fail') { sevF = 'bad'; add('bad', 'Static heel ' + f1(Math.abs(f.heel)) + '° is more than 5° (design guide).', 'hydro'); }
        if (sb && sb.checks[2].status === 'fail') { sevF = worse(sevF, 'warn'); add('warn', 'Trim ' + f1(Math.abs(f.trim)) + ' m is more than 1% of the hull length (design guide).', 'hydro'); }
        if (f.draftAft > maxD + 1e-9 || f.draftFwd > maxD + 1e-9) { sevF = 'bad'; add('bad', 'The draught at one end is deeper than the hull depth.', 'hydro'); }
        if (sevF === 'ok') good.push('Trim and heel are within the guides.');
      }
      chips.push({ key: 'float', label: 'Floating', value: valF, sev: sevF, tab: 'hydro' });
      if (sb) {
        var sevS = 'ok', gm = sb.GM;
        if (gm < 0) { sevS = 'bad'; add('bad', 'GM is negative (' + f1(gm) + ' m): the vessel is unstable upright.', 'hydro'); }
        else if (gm < 0.15) { sevS = 'bad'; add('bad', 'GM ' + f1(gm) + ' m is below the 0.15 m guide (IMO intact criterion). KG would have to come down to ' + f1(sb.KGmax) + ' m or less.', 'hydro'); }
        else good.push('GM ' + f1(gm) + ' m meets the 0.15 m guide.');
        if (sb.fsT > 0) good.push('Free surface of ' + sb.tanks.length + (sb.tanks.length === 1 ? ' tank' : ' tanks') + ' is included: it lowers GM by ' + f1(sb.fsT) + ' m.');
        chips.push({ key: 'stab', label: 'Stability', value: 'GM ' + f1(gm) + ' m', sev: sevS, tab: 'hydro' });
      }
    }
    issues.sort(function (a, b) { return rank[b.sev] - rank[a.sev]; });
    return { chips: chips, issues: issues, good: good, stability: sb, float: f, ws: ws };
  }


  /* Float on: the draught follows the weight. The structure weight is a share of the displacement, so the level draught
     and the weight are iterated until they agree, then the trim is solved at that weight. Returns the floating state
     (or null) and leaves model.draught at the level draught. A model that is too heavy keeps its draught. */
  function autoFloat(model, opt) {
    opt = opt || {};
    var hs = model.hulls || [];
    if (!model.float || !hs.length) return null;
    var it, f;
    for (it = 0; it < 8; it++) {
      f = floatState(model, { levelOnly: true, coarse: true });
      if (!f || !f.T) return f;
      var d = Math.round(f.T * 1000) / 1000;
      if (Math.abs(d - model.draught) < 0.002) break;
      model.draught = d; syncDraught(model);
    }
    return floatState(model, { coarse: !!opt.coarse });
  }

  /* How much of each block (below the deck line) lies outside every hull: estimate from a 5x5x5 sample grid.
     A sample counts as inside when any hull contains it. Returns null when the model has no hulls. */
  var hcMemo = { key: '', val: null }, hcQuick = false;
  /* while something is being dragged the check runs at a coarse resolution, to stay smooth */
  function setQuickCheck(on) { hcQuick = !!on; }
  function hullCheck(model, N) {
    var hulls = model.hulls || [];
    if (!hulls.length) return null;
    var memo = !N;                       // the default resolution is cached; the quick fit searches are not
    N = N || (hcQuick ? 8 : 24);
    var key = '';
    if (memo) {
      key = JSON.stringify([N, hulls.map(function (h) { return [h.type, h.shape || 0, h.offsets ? offsetsPrep(h.offsets).key : 0, h.x, h.y, h.loa, h.beam, h.depth, h.draught]; }),
        model.blocks.map(function (b) { return [b.id, b.shape, b.position, b.size, b.rotation]; })]);
      if (hcMemo.key === key && hcMemo.val.model === model.blocks) return hcMemo.val.res;
    }
    var maxDepth = 0;
    hulls.forEach(function (h) { maxDepth = Math.max(maxDepth, h.depth); });
    var v = new T.Vector3(), below = 0, out = 0, per = [], byId = {};
    model.blocks.forEach(function (b) {
      var m = blockMatrix(b), tot = 0, bd = 0, od = 0;
      if (blockWorldBox(b).min[2] > maxDepth) { byId[b.id] = { vol: blockVolume(b), below: 0, out: 0, shareBelow: 0, shareBlock: 0, aboveDeck: true }; return; }
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) for (var k = 0; k < N; k++) {
        var lu = (i + 0.5) / N - 0.5, lv = (j + 0.5) / N - 0.5, lw = (k + 0.5) / N - 0.5;
        if (b.shape !== 'box' && !shapeContains(b.shape, lu, lv, lw)) continue;      // only the points that are inside the shape
        v.set(lu, lv, lw).applyMatrix4(m);
        tot++;
        if (v.z <= maxDepth) {
          bd++;
          var inside = false;
          for (var q = 0; q < hulls.length && !inside; q++) inside = hullContains(hulls[q], v.x, v.y, v.z);
          if (!inside) od++;
        }
      }
      if (!tot) tot = 1;
      var vol = blockVolume(b), vb = vol * bd / tot, vo = vol * od / tot;
      below += vb; out += vo;
      byId[b.id] = { vol: vol, below: vb, out: vo, shareBelow: vb > 0 ? vo / vb : 0, shareBlock: vol > 0 ? vo / vol : 0, aboveDeck: bd === 0 };
      if (vo > 1e-9) per.push({ block: b, out: vo, share: vb > 0 ? vo / vb : 0 });
    });
    per.sort(function (a, b) { return b.out - a.out; });
    var list = hulls.map(function (h) { return { hull: h, volDeck: hullVolumeTo(h, h.depth), volDraught: hullVolumeTo(h, h.draught) }; });
    var volDeck = 0, volDraught = 0;
    list.forEach(function (e) { volDeck += e.volDeck; volDraught += e.volDraught; });
    var res = {
      hulls: list, volDeck: volDeck, volDraught: volDraught,
      blocksBelow: below, outside: out, inside: below - out,
      fill: volDeck > 0 ? (below - out) / volDeck : 0,
      per: per, byId: byId
    };
    if (memo) hcMemo = { key: key, val: { model: model.blocks, res: res } };
    return res;
  }

  /* hulls get an id and a name when they are added to a model */
  function addHullTo(model, h) {
    if (!h) return null;
    var taken = {};
    (model.hulls || []).forEach(function (x) { taken[x.id] = true; });
    h.id = uid('h', taken);
    h.name = HULL_TYPES[h.type].label + ((model.hulls || []).some(function (x) { return x.type === h.type; }) ? ' ' + (model.hulls.length + 1) : '');
    h.visible = true;
    delete h.waterline;
    // one waterline for the whole vessel: the first hull sets the draught, later hulls take it
    if (!(model.hulls || []).length || model.draught == null) model.draught = h.draught; else h.draught = model.draught;
    return h;
  }

  /* The sea is flat, so all hulls float at one draught (model.draught). It cannot exceed the deepest hull. */
  function syncDraught(model) {
    var hs = model.hulls || [];
    if (!hs.length) return;
    var maxDepth = 0;
    hs.forEach(function (h) { maxDepth = Math.max(maxDepth, h.depth); });
    if (model.draught == null || !isFinite(model.draught)) model.draught = hs[0].draught;
    model.draught = Math.min(maxDepth, Math.max(0.1, model.draught));
    hs.forEach(function (h) { h.draught = model.draught; });
  }

  /* Copy of a hull for the other side of the centreline (catamaran). A hull sitting on the centreline is moved out to
     +gap and the copy goes to -gap; otherwise the copy is the mirror image. Mutates src.y when needed; returns the copy. */
  function mirrorHull(model, src) {
    var c = JSON.parse(JSON.stringify(src));
    var gap = Math.max(src.beam * 1.6, 2);
    if (Math.abs(src.y) < 1e-6) { src.y = gap; c.y = -gap; }
    else {
      c.y = -src.y;
      if (model.hulls.some(function (h) { return h !== src && Math.abs(h.y - c.y) < 0.05 && Math.abs(h.x - c.x) < 0.05; })) {
        var far = 0; model.hulls.forEach(function (h) { far = Math.max(far, Math.abs(h.y)); });
        c.y = far + src.beam * 3.2;
      }
    }
    c.y = r2(c.y); src.y = r2(src.y);
    delete c.id; delete c.name;
    c.name = src.name + ' (copy)';
    var taken = {};
    model.hulls.forEach(function (x) { taken[x.id] = true; });
    c.id = uid('h', taken);
    c.visible = true;
    return c;
  }

  /* deck line guess: top of the highest level whose plan footprint is at least half of the largest */
  /* the main deck set by the designer: the highest top among the blocks marked "defines main deck"; null when none is marked */
  /* only one block defines the deck: keep the one with the highest top */
  function keepOneDeck(model) {
    var best = null;
    model.blocks.forEach(function (b) { if (b.deck && (!best || blockWorldBox(b).max[2] > blockWorldBox(best).max[2])) best = b; });
    model.blocks.forEach(function (b) { b.deck = b === best; });
  }
  function markedDeck(model) {
    var z = null;
    model.blocks.forEach(function (b) { if (b.deck) { var t = blockWorldBox(b).max[2]; if (z === null || t > z) z = t; } });
    return z === null ? null : r2(z);
  }
  function autoDeckLine(model) {
    var set = markedDeck(model);
    if (set !== null) return set;
    var bx = model.blocks.map(function (b) { var w = blockWorldBox(b); return { lo: w.min[2], hi: w.max[2], a: blockPlanArea(b) }; });
    if (!bx.length) return 0;
    var lv = [];
    bx.forEach(function (b) { lv.push(b.lo, b.hi); });
    lv.sort(function (a, b) { return a - b; });
    lv = lv.filter(function (v, i) { return i === 0 || v - lv[i - 1] > 1e-6; });
    var foot = [], mx = 0;
    for (var i = 0; i < lv.length - 1; i++) {
      var mid = 0.5 * (lv[i] + lv[i + 1]), f = 0;
      bx.forEach(function (b) { if (b.lo <= mid && b.hi > mid) f += b.a; });
      foot.push(f); if (f > mx) mx = f;
    }
    var deck = lv[lv.length - 1];
    var kk = -1;
    for (var k = foot.length - 1; k >= 0; k--) if (foot[k] >= 0.5 * mx) { deck = lv[k + 1]; kk = k + 1; break; }
    while (kk >= 0 && kk + 1 < lv.length && lv[kk + 1] - deck <= 0.15 * deck) { kk++; deck = lv[kk]; }   // snap to a block top just above
    return deck;
  }

  function r2(v) { return Math.round(v * 100) / 100; }

  /* examples: tick the blocks whose top is the hull depth, so that Auto gives the depth the example was built with */
  /* examples: spaces that are open (not enclosed) do not count for GT */
  function withGT(f, re) {
    return function () { var m = f(); m.blocks.forEach(function (b) { if (re.test(b.name)) b.gt = false; }); return m; };
  }
  function withDeck(f) {
    return function () {
      var m = f(), h = m.hulls && m.hulls[0];
      var best = null;
      if (h) m.blocks.forEach(function (b) {
        var w = blockWorldBox(b);
        if (Math.abs(w.max[2] - h.depth) < 0.05 && w.min[2] < h.depth - 0.05 && (!best || blockVolume(b) > blockVolume(best))) best = b;
      });
      if (best) best.deck = true;
      return m;
    };
  }

  /* Hull around the blocks below the deck line; null when there are none to fit.
     Without `target`, all blocks are used and the hull is centred on them. With target {y, beam} (a model with several
     hulls), only blocks whose centre lies within that hull's side-to-side span are used and y and beam are kept.
     The hull is then lengthened at the bow (up to 30%) until the bow taper clears the blocks. */
  /* ---------- curves hull ----------
     A table hull that also keeps the curves it was made from (h.gen, the Hull Generator definition, at the size of its table). The table is
     derived from the curves. The size fields scale the table, which is the same as scaling the curves, so h.gen is kept at the table's size
     and is scaled to the size fields only when it is edited (hullGenNow) and then stored again with the new table (applyHullGen). */
  function curvesHull(gen) {
    var g = HG();
    if (!g || !gen) return null;
    var tab = g.buildOffsets(gen, 60, 24);
    if (g.checkOffsets(tab)) return null;
    var offs = cleanOffsets({ zs: tab.zs, xs: tab.xs, half: tab.half });
    if (!offs) return null;
    return { type: 'offsets', offsets: offs, gen: JSON.parse(JSON.stringify(gen)), x: 0, y: 0, loa: r2(offs.L), beam: r2(offs.B), depth: r2(offs.D),
      draught: Math.min(offs.D, Math.max(0.1, gen.T || offs.D * 0.55)) };
  }
  /* A close copy of any hull as curves, for the hull view: the hull is sampled as a table (80 stations, 30 heights) and fitted by the Hull
     Generator. Returns { gen, diff } (diff: volume difference in % at draught T) or { error }. A one-way step: the curves are not the original. */
  function hullGenFromHull(h, T) {
    var g = HG();
    if (!g || !h) return { error: 'No hull.' };
    var t = hullOffsets(h, 80, 30), xs = t.rows.map(function (r) { return r.x; }), half = t.zs.map(function (z, j) { return t.rows.map(function (r) { return r.half[j]; }); });
    var r = g.hullFromOffsets({ xs: xs, zs: t.zs.slice(), half: half });
    if (r.error) return { error: r.error };
    var hull = r.hull, Tc = Math.min(Math.max(0.05, T || h.depth * 0.55), h.depth), diff = null;
    hull.T = Tc;
    try {
      var a = g.tableHydro(r.source, Tc, 1.025), tab = g.buildOffsets(hull, 60, 24);
      if (!g.checkOffsets(tab)) { var b = g.tableHydro(tab, Tc, 1.025); if (a && b && a.V > 0) diff = (b.V / a.V - 1) * 100; }
    } catch (e) { diff = null; }
    return { gen: hull, diff: diff };
  }
  /* the curves at the current size of the hull (its size fields), ready to edit; null for a hull without curves */
  function hullGenNow(h) {
    var g = HG();
    if (!g || !h || !h.gen || !h.offsets) return null;
    var o = h.offsets, c = JSON.parse(JSON.stringify(h.gen)), fL = h.loa / o.L, fB = h.beam / o.B, fD = h.depth / o.D;
    g.setLength(c, c.L * fL);
    g.setBeam(c, g.principal(c).B * fB);
    g.setDepth(c, g.principal(c).D * fD);
    c.T = Math.round(c.T * fD * 1e4) / 1e4;
    return c;
  }
  /* Put edited curves into the hull: the table is built again and the size fields follow it. Returns an error text or null. */
  /* the slider values of the hull view, kept with a curves hull so they come back when it is opened again */
  function cleanGenParams(g) {
    if (!g || typeof g !== 'object') return null;
    var o = { stern: ['transom', 'rounded', 'cruiser'].indexOf(g.stern) >= 0 ? g.stern : 'transom' };
    var ok = ['fb', 'm', 'par', 'c', 'rake'].every(function (k) { o[k] = Number(g[k]); return isFinite(o[k]) && o[k] >= 0 && o[k] <= 20; });
    return ok ? o : null;
  }
  function applyHullGen(model, h, gen, params) {
    var g = HG();
    if (!g || !h || !gen) return 'No curves.';
    var tab = g.buildOffsets(gen, 60, 24), bad = g.checkOffsets(tab);
    if (bad) return bad;
    var offs = cleanOffsets({ zs: tab.zs, xs: tab.xs, half: tab.half });
    if (!offs) return 'The table could not be built.';
    h.gen = JSON.parse(JSON.stringify(gen)); h.offsets = offs; h.type = 'offsets';
    var gp = cleanGenParams(params); if (gp) h.genp = gp; else delete h.genp;
    h.loa = r2(offs.L); h.beam = r2(offs.B); h.depth = r2(offs.D);
    h.draught = Math.min(h.depth, h.draught);
    if (model) syncDraught(model);
    return null;
  }
  /* the drawn bulb of a curves hull as Holtrop reads it: { abt, hb } or null */
  function hullBulb(h) {
    var g = HG(), c = h && h.gen && g ? hullGenNow(h) : null;
    if (!c || !g.bulbOf(c).on) return null;
    var bi = g.bulbInfo(c);
    return bi ? { abt: bi.abt, hb: bi.hb } : null;
  }

  /* Fit a table hull around the blocks below the deck: length and beam are scaled (independently) and the hull is moved so it covers the
     blocks with the same margins as the presets (0.3 m at each end, 0.4 m on the beam). Depth and draught stay. null when no block lies below the deck. */
  function fitTableHull(model, h, deck) {
    if (!h || !h.offsets) return null;
    var xmin = Infinity, xmax = -Infinity, ylo = Infinity, yhi = -Infinity;
    model.blocks.forEach(function (b) {
      var w = blockWorldBox(b);
      if (w.min[2] >= deck - 1e-6) return;
      xmin = Math.min(xmin, w.min[0]); xmax = Math.max(xmax, w.max[0]);
      ylo = Math.min(ylo, w.min[1]); yhi = Math.max(yhi, w.max[1]);
    });
    if (!isFinite(xmin)) return null;
    var o = h.offsets, r = hullXRange({ offsets: o, x: 0, loa: o.L, depth: h.depth }, 1);
    var span = xmax - xmin + 0.6, s = span / Math.max(1e-6, r[1] - r[0]);
    return { x: r2(xmin - 0.3 - s * r[0]), y: r2((ylo + yhi) / 2), loa: r2(o.L * s), beam: r2(yhi - ylo + 0.4) };
  }

  function fitHull(model, type, deck, draught, target, shape) {
    if (!HULL_TYPES[type]) type = 'osv';
    shape = cleanShape(shape);
    var P = hullP({ type: type, shape: shape }), xmin = Infinity, xmax = -Infinity, ylo = Infinity, yhi = -Infinity, subset = [];
    model.blocks.forEach(function (b) {
      var w = blockWorldBox(b);
      if (w.min[2] >= deck - 1e-6) return;
      if (target && Math.abs(b.position[1] - target.y) > target.beam / 2 + 0.3) return;
      subset.push(b);
      xmin = Math.min(xmin, w.min[0]); xmax = Math.max(xmax, w.max[0]);
      ylo = Math.min(ylo, w.min[1]); yhi = Math.max(yhi, w.max[1]);
    });
    if (!subset.length) return null;
    var depth = r2(deck), best = null, bestOut = Infinity;
    var yc = target ? target.y : r2((ylo + yhi) / 2), beam = target ? target.beam : r2(yhi - ylo + 0.4);
    for (var e = 0; e <= 0.3001; e += 0.02) {
      var keelLen = (xmax - xmin + 0.6) * (1 + e);
      var loa = keelLen / (1 - P.sternRake - P.rake);
      var h = { type: type, x: r2(xmin - 0.3 - P.sternRake * loa), y: yc, loa: r2(loa), beam: beam, depth: depth,
        draught: draught != null ? Math.min(draught, depth) : Math.round(depth * P.dr * 10) / 10 };
      if (shape) h.shape = shape;
      var hc = hullCheck({ hulls: [h], blocks: subset }, 9);
      var frac = hc.blocksBelow > 0 ? hc.outside / hc.blocksBelow : 0;
      if (frac < bestOut - 1e-9) { bestOut = frac; best = h; }
      if (frac <= 0.025) { best = h; break; }
    }
    return best;
  }

  /* Hulls for a catamaran (k = 2), a trimaran (k = 3) or more (pontoons), one per group of blocks. The blocks below the deck are grouped by the gaps
     in their side-to-side extents; each hull is fitted around its own group. Order of the result: k = 2 [port, starboard],
     k = 3 [centre, port, starboard], k >= 4 port to starboard. When the blocks do not fall into k separate groups (a single-hull layout), the hulls are
     placed by proportion of the overall beam and result.fitted is false. null when no block lies below the deck. */
  function fitHullSet(model, k, types, shapes, deck, draught) {
    var iv = [];
    model.blocks.forEach(function (b) { var w = blockWorldBox(b); if (w.min[2] < deck - 1e-6) iv.push([w.min[1], w.max[1]]); });
    if (!iv.length) return null;
    iv.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    iv.forEach(function (i) { var l = merged[merged.length - 1]; if (l && i[0] <= l[1] + 0.3) l[1] = Math.max(l[1], i[1]); else merged.push([i[0], i[1]]); });
    function fit(i, target) { return fitHull(model, types[i], deck, draught, target, shapes[i]); }
    var out = [], ok = false;
    if (merged.length >= k) {
      var gaps = [], i;
      for (i = 1; i < merged.length; i++) gaps.push({ i: i, w: merged[i][0] - merged[i - 1][1] });
      gaps.sort(function (a, b) { return b.w - a.w; });
      var cuts = gaps.slice(0, k - 1).map(function (g) { return g.i; }).sort(function (a, b) { return a - b; }), groups = [], st = 0;
      cuts.concat([merged.length]).forEach(function (c) { groups.push([merged[st][0], merged[c - 1][1]]); st = c; });
      var roles = k === 2 ? [groups[1], groups[0]] : k === 3 ? [groups[1], groups[2], groups[0]] : groups.slice().reverse();   // 4 or more: port to starboard
      ok = true;
      var ycs = roles.map(function (g) { return (g[0] + g[1]) / 2; });
      roles.forEach(function (g, j) {
        var yc = r2(ycs[j]), w0 = g[1] - g[0] + 0.4, h = null, t, cap = Infinity;
        ycs.forEach(function (o, q) { if (q !== j) cap = Math.min(cap, Math.abs(o - ycs[j]) - 0.1); });   // neighbours may touch, not overlap
        if (!ok) return;
        for (t = 0; t < 14; t++) {            // a slender section is narrower than its deck: widen until the blocks are inside
          h = fit(j, { y: yc, beam: r2(Math.max(w0, Math.min(w0 + 0.2 * t, cap))) });
          if (!h) break;
          var sub = model.blocks.filter(function (b) { var w = blockWorldBox(b); return w.min[2] < deck - 1e-6 && Math.abs(b.position[1] - yc) <= h.beam / 2 + 0.3; });
          var hc = hullCheck({ hulls: [h], blocks: sub }, 9);
          if (!(hc.blocksBelow > 0) || hc.outside / hc.blocksBelow <= 0.025) break;
        }
        if (!h) ok = false; else out.push(h);
      });
    }
    if (!ok) {
      out = [];
      var all = fit(0, null);
      if (!all) return null;
      var B = all.beam, spec = k === 2 ? [[0.35 * B, 0.3 * B, 1, 0], [-0.35 * B, 0.3 * B, 1, 0]]
        : k === 3 ? [[0, 0.26 * B, 1, 0], [0.4 * B, 0.12 * B, 0.6, 0.25], [-0.4 * B, 0.12 * B, 0.6, 0.25]]
        : Array.apply(null, Array(k)).map(function (_, j) { var sp = 0.8 * B / (k - 1); return [0.4 * B - j * sp, 0.5 * sp, 1, 0]; });   // evenly spread, port to starboard
      spec.forEach(function (sp, j) {
        var h = fit(j, null);
        h.x = r2(all.x + sp[3] * all.loa); h.loa = r2(all.loa * sp[2]); h.y = r2(sp[0]); h.beam = r2(sp[1]);
        out.push(h);
      });
    }
    out.fitted = ok;
    return out;
  }

  function makeHullGeometry(h, nu, nt) {
    nu = nu || 64; nt = nt || 10;
    var pos = [], idx = [], us = [], i, j;
    for (i = 0; i <= nu; i++) us.push(0.5 * (1 - Math.cos(Math.PI * i / nu)));
    var W = nu + 1;
    for (var side = 1; side >= -1; side -= 2) {
      for (j = 0; j <= nt; j++) {
        var t = Math.pow(j / nt, 1.5), r = hullXRange(h, t);
        for (i = 0; i <= nu; i++) pos.push(r[0] + us[i] * (r[1] - r[0]), (h.y || 0) + side * hullHalf(h, us[i], t), t * h.depth);
      }
    }
    function P(i, j) { return j * W + i; }
    function S(i, j) { return (nt + 1) * W + j * W + i; }
    for (j = 0; j < nt; j++) for (i = 0; i < nu; i++) {
      idx.push(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j), P(i + 1, j + 1), P(i, j + 1));
      idx.push(S(i, j), S(i + 1, j + 1), S(i + 1, j), S(i, j), S(i, j + 1), S(i + 1, j + 1));
    }
    for (i = 0; i < nu; i++) idx.push(P(i, 0), P(i + 1, 0), S(i + 1, 0), P(i, 0), S(i + 1, 0), S(i, 0));
    for (j = 0; j < nt; j++) idx.push(P(0, j), P(0, j + 1), S(0, j + 1), P(0, j), S(0, j + 1), S(0, j));
    for (j = 0; j < nt; j++) idx.push(P(nu, j), P(nu, j + 1), S(nu, j + 1), P(nu, j), S(nu, j + 1), S(nu, j));
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* section lines, sheer/keel lines and the waterline, as line-segment position arrays */
  function makeHullLines(h, plane) {
    var nt = 12, nu = 80, sec = [], wl = [], i, j;
    function pt(u, t, side) { var r = hullXRange(h, t); return [r[0] + u * (r[1] - r[0]), (h.y || 0) + side * hullHalf(h, u, t), t * h.depth]; }
    function poly(arr, pts) { for (var k = 0; k < pts.length - 1; k++) arr.push.apply(arr, pts[k].concat(pts[k + 1])); }
    for (var s = 0; s <= 10; s++) {
      var u = s / 10 * 0.999, pts = [];
      for (j = nt; j >= 0; j--) pts.push(pt(u, Math.pow(j / nt, 1.5), -1));
      for (j = 0; j <= nt; j++) pts.push(pt(u, Math.pow(j / nt, 1.5), 1));
      poly(sec, pts);
    }
    [0, 1].forEach(function (t) {
      [-1, 1].forEach(function (side) {
        var pts = [];
        for (i = 0; i <= nu; i++) pts.push(pt(0.5 * (1 - Math.cos(Math.PI * i / nu)), t, side));
        poly(sec, pts);
      });
    });
    var tw = Math.min(1, Math.max(0, h.draught / h.depth));
    function wpt(u, side) {                       // a point of the waterline: on the tilted plane when there is one
      if (!plane) return pt(u, tw, side);
      var t = Math.min(1, Math.max(0, plane.Tm / h.depth)), q, it;
      for (it = 0; it < 6; it++) {
        q = pt(u, t, side);
        t = Math.min(1, Math.max(0, (plane.Tm - plane.k * (q[0] - plane.xm) + (plane.kp || 0) * (q[1] - (plane.ym || 0))) / h.depth));
      }
      return pt(u, t, side);
    }
    var loop = [];
    for (i = 0; i <= nu; i++) loop.push(wpt(0.5 * (1 - Math.cos(Math.PI * i / nu)), 1));
    for (i = nu; i >= 0; i--) loop.push(wpt(0.5 * (1 - Math.cos(Math.PI * i / nu)), -1));
    loop.push(loop[0]);
    poly(wl, loop);
    return { sections: sec, waterline: wl };
  }

  /* A hull name that follows its type: "Barge", "Barge 2", "Barge (copy)". A name the user typed is left alone. */
  function hullNameFor(name, newType) {
    var labels = HULL_ORDER.map(function (k) { return HULL_TYPES[k].label; }).concat(HULL_LIB_ORDER.map(function (k) { return HULL_LIBRARY[k].label; }), [HULL_TYPES.offsets.label]);
    var m = /^(.*?)((?: \d+)?(?: \(copy\))?)$/.exec(String(name || ''));
    var nl = HULL_LIBRARY[newType] ? HULL_LIBRARY[newType].label : HULL_TYPES[newType].label;
    if (m && labels.indexOf(m[1]) >= 0) return nl + m[2];
    return name;
  }

  /* The water surface: one flat rectangle at the draught for the whole vessel, reaching far beyond the hulls. */
  function waterExtent(model) {
    var hs = model.hulls || [], x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, maxLoa = 0;
    hs.forEach(function (h) {
      x0 = Math.min(x0, h.x - 0.1 * h.loa); x1 = Math.max(x1, h.x + h.loa);
      y0 = Math.min(y0, (h.y || 0) - h.beam / 2); y1 = Math.max(y1, (h.y || 0) + h.beam / 2); maxLoa = Math.max(maxLoa, h.loa);
    });
    if (!hs.length) return null;
    var m = Math.max(25, 1.5 * maxLoa);
    return { x0: x0 - m, x1: x1 + m, y0: y0 - m, y1: y1 + m, z: model.draught };
  }

  function makeWaterGeometry(model, plane) {
    var w = waterExtent(model), g = new T.BufferGeometry();
    if (!w) return g;
    function z(x, y) { return plane ? plane.Tm - plane.k * (x - plane.xm) + (plane.kp || 0) * (y - (plane.ym || 0)) : w.z; }
    g.setAttribute('position', new T.Float32BufferAttribute([w.x0, w.y0, z(w.x0, w.y0), w.x1, w.y0, z(w.x1, w.y0), w.x1, w.y1, z(w.x1, w.y1), w.x0, w.y1, z(w.x0, w.y1)], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  }

  /* ---------- Structure: first check to DNV Rules for Ships Pt.3 Ch.2 (January 2015, L < 100 m) ----------
     Single hull only. Longitudinal strength from the weights and the buoyancy at the floating position (Float state),
     the rule bending moments of Sec.4, a midship section built from plates and longitudinals, local scantlings of
     bottom, side and deck (Sec.3, 5, 6, 7) and a steel weight estimate. Units: m, t, kN, kNm, N/mm2, cm3. */
  var ST_GRADES = [['NV-NS', 1.00], ['NV-27', 1.08], ['NV-32', 1.28], ['NV-36', 1.39], ['NV-40', 1.47]];
  var ST_AREAS = [['R0', 0], ['R1', 5], ['R2', 10], ['R3', 15], ['R4', 20], ['RE', 25]];     // Table C1 (Sec.4) in %
  var STEEL_RHO = 7.85, G0 = 9.80665;

  function stDefaults() {
    var fb = function (hw, tw) { return { type: 'FB', hw: hw, tw: tw, bf: 0, tf: 0 }; };
    return { grade: 'NV-NS', area: 'R0', tk: 0, steelOn: false, wf: 1.5, hatch: 0, span: 2.5, dbh: 0,
      sd: 0.7, ss: 0.7, sb: 0.7, si: 0.7, td: 8, ts: 8, tb: 9, ti: 8, tkeel: 10,
      pd: fb(100, 8), ps: fb(100, 8), pb: fb(100, 8), pi: fb(100, 8) };
  }
  function stClean(raw) {
    var d = stDefaults(), r = raw && typeof raw === 'object' ? raw : {};
    function n(v, lo, hi, dv) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : dv; }
    function prof(p, dp) {
      p = p && typeof p === 'object' ? p : {};
      var t = p.type === 'T' ? 'T' : 'FB';
      return { type: t, hw: n(p.hw, 20, 1500, dp.hw), tw: n(p.tw, 2, 60, dp.tw), bf: t === 'T' ? n(p.bf, 10, 600, 60) : 0, tf: t === 'T' ? n(p.tf, 2, 60, 8) : 0 };
    }
    return { grade: ST_GRADES.some(function (g) { return g[0] === r.grade; }) ? r.grade : d.grade, area: ST_AREAS.some(function (a) { return a[0] === r.area; }) ? r.area : d.area,
      tk: n(r.tk, 0, 5, d.tk), steelOn: r.steelOn === true, wf: n(r.wf, 1, 3, d.wf), hatch: n(r.hatch, 0, 90, d.hatch), span: n(r.span, 0.3, 10, d.span), dbh: n(r.dbh, 0, 5, d.dbh),
      sd: n(r.sd, 0.2, 1.5, d.sd), ss: n(r.ss, 0.2, 1.5, d.ss), sb: n(r.sb, 0.2, 1.5, d.sb), si: n(r.si, 0.2, 1.5, d.si),
      td: n(r.td, 1, 80, d.td), ts: n(r.ts, 1, 80, d.ts), tb: n(r.tb, 1, 80, d.tb), ti: n(r.ti, 1, 80, d.ti), tkeel: n(r.tkeel, 1, 80, d.tkeel),
      pd: prof(r.pd, d.pd), ps: prof(r.ps, d.ps), pb: prof(r.pb, d.pb), pi: prof(r.pi, d.pi) };
  }
  function stGet(model) { return stClean(model.st); }

  /* one stiffener (flat bar or T) as parts {A, z, i0} in mm, z measured from its foot (the plate side) */
  function stProfileParts(p) {
    var parts = [{ A: p.hw * p.tw, z: p.hw / 2, i0: p.tw * Math.pow(p.hw, 3) / 12 }];
    if (p.type === 'T' && p.bf > 0 && p.tf > 0) parts.push({ A: p.bf * p.tf, z: p.hw + p.tf / 2, i0: p.bf * Math.pow(p.tf, 3) / 12 });
    return parts;
  }
  function stSumParts(parts) {
    var A = 0, M = 0, I = 0, i;
    parts.forEach(function (q) { A += q.A; M += q.A * q.z; });
    var zc = A > 0 ? M / A : 0;
    parts.forEach(function (q) { I += q.i0 + q.A * (q.z - zc) * (q.z - zc); });
    return { A: A, zc: zc, I: I };
  }
  /* stiffener with attached plating of width b (mm) and thickness t: modulus in cm3 at the flange and at the plate, the smaller is returned */
  function stStiffenerZ(p, b, t) {
    var parts = [{ A: b * t, z: -t / 2, i0: b * t * t * t / 12 }].concat(stProfileParts(p)), s = stSumParts(parts);
    var top = p.type === 'T' ? p.hw + p.tf : p.hw, zf = top - s.zc, zp = s.zc + t;
    return Math.min(s.I / zf, s.I / zp) / 1000;
  }
  function stMinWeb(p, L, tk) {                                  // Sec.5 C 600 / Sec.6 C 300: larger of 4.5 + 0.01 L and 1.5 + hw/g
    var g = p.type === 'T' ? 75 : 22;
    return Math.max(4.5 + 0.01 * L, 1.5 + p.hw / g) + tk;
  }

  /* midship section as plates and longitudinals; all lengths in mm inside */
  function stSection(st, B, D) {
    var Bm = B * 1000, Dm = D * 1000, parts = [], deckW = Bm * (1 - st.hatch / 100), hasDB = st.dbh > 0.05 && st.dbh < D - 0.1;
    function plate(w, t, z, h) { parts.push({ A: w * t, z: z, i0: h ? w * h * h * h / 12 : w * t * t * t / 12, tag: 'plate' }); }
    function stiff(p, z0, dir) {                                 // dir +1 stiffener grows up from z0, -1 grows down
      stProfileParts(p).forEach(function (q) { parts.push({ A: q.A, z: z0 + dir * q.z, i0: q.i0, tag: 'stiff' }); });
    }
    plate(deckW, st.td, Dm - st.td / 2);
    plate(Bm, st.tb, st.tb / 2);
    plate(st.ts, Dm, Dm / 2, Dm); plate(st.ts, Dm, Dm / 2, Dm);       // width ts, height Dm, own inertia ts Dm^3 / 12
    var nd = Math.max(0, Math.round(deckW / (st.sd * 1000)) - 1), nb = Math.max(0, Math.round(Bm / (st.sb * 1000)) - 1), ns = Math.max(0, Math.round(Dm / (st.ss * 1000)) - 1), k;
    for (k = 0; k < nd; k++) stiff(st.pd, Dm - st.td, -1);
    for (k = 0; k < nb; k++) stiff(st.pb, st.tb, 1);
    if (hasDB) {
      var zi = st.dbh * 1000, wi = Bm - 2 * st.ts, ni = Math.max(0, Math.round(wi / (st.si * 1000)) - 1);
      plate(wi, st.ti, zi + st.ti / 2);
      for (k = 0; k < ni; k++) stiff(st.pi, zi + st.ti, 1);
    }
    for (k = 1; k <= ns; k++) {                                  // side longitudinals on both sides, spread over the depth; the stiffener foot is on the plate
      var zs = k * Dm / (ns + 1);
      stiff(st.ps, zs, 1); stiff(st.ps, zs, 1);
    }
    var A = 0, M = 0, I = 0;
    parts.forEach(function (q) { A += q.A; M += q.A * q.z; });
    var zna = M / A;
    parts.forEach(function (q) { I += q.i0 + q.A * (q.z - zna) * (q.z - zna); });
    var Ad = deckW * st.td + nd * stSumParts(stProfileParts(st.pd)).A;
    return { A: A / 100, I: I * 1e-12, zna: zna / 1000, zDeck: I / (Dm - zna) / 1000, zBot: I / zna / 1000, deckArea: Ad / 100, nd: nd, nb: nb, ns: ns, hasDB: hasDB };
  }

  function stGrade(st) { return ST_GRADES.filter(function (g) { return g[0] === st.grade; })[0][1]; }
  function stAreaRed(st) { return ST_AREAS.filter(function (a) { return a[0] === st.area; })[0][1]; }

  /* Rule length L is 96% of the length on the waterline (Sec.1 B, within 96 to 97%), AP at the aft end of the waterline */
  function stDims(model, h) {
    var hy = hullHydro(h, h.draught, model.rho), T = h.draught, D = h.depth, B = hy.BWL, L = 0.96 * hy.LWL;
    var Cb = L > 0 && B > 0 && T > 0 ? hy.V / (L * B * T) : 0, res = model.res || {};
    var vs = typeof res.vs === 'number' && res.vs > 0 ? res.vs : Math.max(1, Math.round(0.2 * Math.sqrt(9.81 * hy.LWL) / 0.514444));
    return { hy: hy, L: L, B: B, D: D, T: T, Cb: Cb, V: hy.V, vs: vs, CW: 0.0792 * L, xAP: hy.xa, xFP: hy.xa + L, rho: model.rho || 1.025 };
  }

  /* design pressures (kN/m2) at height z above the baseline, half breadth y, at the midship region (ks = 2) */
  function stPdp(dm, st, z, y) {
    var red = [0, 10, 20, 30, 40, 50][ST_AREAS.map(function (a) { return a[0]; }).indexOf(st.area)] / 100;      // Table B2, Sec.3 B1103: dynamic terms
    var CW = dm.CW * (1 - red), f = Math.min(dm.D - dm.T, 0.8 * dm.CW), kf = Math.min(dm.T, f), ks = 2;
    var pl = ks * CW + kf, vf = dm.vs / Math.sqrt(dm.L);
    if (vf > 1.5) pl *= 0.8 + 0.15 * vf;
    return pl + 135 * y / (dm.B + 75) - 1.2 * (dm.T - Math.min(z, dm.T));
  }
  function stSea(dm, st, z, y) {                                 // below the waterline p1 = 10 h0 + pdp, above it p2 = pdp - (4 + 0.2 ks) h0 (min 6.25 + 0.025 L)
    var pdp = stPdp(dm, st, z, y);
    if (z <= dm.T) return { p: 10 * (dm.T - z) + pdp, name: 'p1' };
    return { p: Math.max(pdp - (4 + 0.2 * 2) * (z - dm.T), 6.25 + 0.025 * dm.L), name: 'p2' };
  }
  function stKa(s, l) { return Math.min(1, Math.max(0.72, Math.pow(1.1 - 0.25 * s / l, 2))); }
  function stPlateT(p, s, l, sig, f1, tk) { return 15.8 * stKa(s, l) * s * Math.sqrt(p / (sig * f1)) + tk; }
  function stSigLong(ratio) { return 95 + 65 * Math.min(1, Math.max(0, ratio - 1)); }       // 95 at ZA = ZR, 160 at ZA >= 2 ZR

  /* local scantlings: rows {group, item, required, chosen, unit, ok, note} */
  function stLocal(dm, st, sec, zreq) {
    var f1 = stGrade(st), sf = Math.sqrt(f1), tk = st.tk, L = dm.L, l = st.span, rows = [], D = dm.D, y = dm.B / 2;
    var rD = zreq > 0 ? sec.zDeck / zreq : 1, rB = zreq > 0 ? sec.zBot / zreq : 1;
    function plateRow(name, p, s, sig, tmin, chosen, tminNote) {
      var tl = stPlateT(p, s, l, sig, f1, tk), req = Math.max(tl, tmin);
      rows.push({ group: 'Plating', item: name, p: p, sigma: sig, required: Math.ceil(req * 10) / 10, chosen: chosen, unit: 'mm', ok: chosen + 1e-9 >= req,
        note: 'lateral ' + tl.toFixed(1) + ', minimum ' + tmin.toFixed(1) + (tminNote ? ' ' + tminNote : '') });
    }
    function stiffRow(name, p, s, sigma, prof, platet, wmin, extra) {
      var Zr = Math.max(15, 83 * l * l * s * p / (sigma * f1) * (1 + 0 * tk)), Za = stStiffenerZ(prof, s * 1000, platet), tw = stMinWeb(prof, L, tk);
      var okZ = Za + 1e-9 >= Zr, okW = prof.tw + 1e-9 >= tw && (prof.type !== 'T' || prof.tf + 1e-9 >= tw);
      rows.push({ group: 'Longitudinals', item: name, p: p, sigma: sigma, required: Math.ceil(Zr), chosen: Math.round(Za), unit: 'cm³', ok: okZ && okW,
        note: 'web and flange not less than ' + tw.toFixed(1) + ' mm' + (okW ? '' : ' (not met)') });
    }
    var pB = stSea(dm, st, 0, y).p, pD = Math.max(5.0, 0.8 * (stPdp(dm, st, dm.T, y) - (4 + 0.4) * (D - dm.T)));
    var tminB = 5.0 + 0.04 * L / sf + tk, tminD = 5.5 + 0.02 * L / sf + tk, tminS = 5.0 + 0.04 * L / sf + tk;
    plateRow('Bottom plating', pB, st.sb, 120, tminB, st.tb);
    rows.push({ group: 'Plating', item: 'Keel plate', p: null, sigma: null, required: Math.ceil((7.0 + 0.05 * L + tk) * 10) / 10, chosen: st.tkeel, unit: 'mm', ok: st.tkeel + 1e-9 >= 7.0 + 0.05 * L + tk,
      note: 'breadth not less than ' + Math.round(800 + 5 * L) + ' mm' });
    var zLow = 0, sLow = stSea(dm, st, zLow, y), sUp = stSea(dm, st, D, y);
    plateRow('Side plating, lower', sLow.p, st.ss, 120, tminS, st.ts, '');
    plateRow('Side plating, upper', sUp.p, st.ss, 120, tminS, st.ts, '');
    plateRow('Strength deck plating', pD, st.sd, 120, tminD, st.td);
    if (sec.hasDB) rows.push({ group: 'Plating', item: 'Inner bottom plating', p: null, sigma: null, required: Math.ceil((5.0 + 0.03 * L + tk) * 10) / 10, chosen: st.ti, unit: 'mm', ok: st.ti + 1e-9 >= 5.0 + 0.03 * L + tk, note: 'minimum only, no cargo or tank load' });
    var sB = stSigLong(rB), sD = stSigLong(rD);
    stiffRow('Bottom longitudinals', pB, st.sb, sB, st.pb, st.tb);
    var zl = 0.15 * D, zu = 0.85 * D, zn = sec.zna;
    function sigSide(z, edge) {                                   // 160 within 0.25 D of the neutral axis, the edge value at deck or bottom, linear between
      var d = Math.abs(z - zn), q = 0.25 * D, far = z > zn ? D - zn : zn;
      return d <= q ? 160 : 160 - (160 - edge) * Math.min(1, (d - q) / Math.max(1e-6, far - q));
    }
    stiffRow('Side longitudinals, lower', stSea(dm, st, zl, y).p, st.ss, sigSide(zl, sB), st.ps, st.ts);
    stiffRow('Side longitudinals, upper', stSea(dm, st, zu, y).p, st.ss, sigSide(zu, sD), st.ps, st.ts);
    stiffRow('Deck longitudinals', pD, st.sd, sD, st.pd, st.td);
    return rows;
  }

  /* steel mass of the hull: midship section area x hull length x factor for the ends and the transverse structure (floors, frames, bulkheads) */
  function stSteel(model, h) {
    var st = stGet(model), sec = stSection(st, h.beam, h.depth);
    var m = STEEL_RHO * sec.A * 1e-4 * h.loa * st.wf;
    return { mass: m, perLength: STEEL_RHO * sec.A * 1e-4, section: sec };
  }

  /* weight, buoyancy, load, shear force and bending moment along the hull. t/m and t, t m; kN, kNm via G0. Moment is positive in sagging. */
  function stLoads(model, h, fl, dm) {
    var N = 120, xa = h.x, Lh = h.loa, dx = Lh / N, i, j, x = [], w = [], b = [], wb = new Array(N).fill(0), ws = new Array(N).fill(0), st = stGet(model);
    for (i = 0; i < N; i++) x.push(xa + (i + 0.5) * dx);
    model.blocks.forEach(function (bl) {
      var q = blockMass(model, bl).mass;
      if (!(q > 0)) return;
      var bx = blockWorldBox(bl), x0 = bx.min[0], x1 = bx.max[0], len = Math.max(1e-9, x1 - x0);
      for (i = 0; i < N; i++) {
        var c0 = xa + i * dx, ov = Math.min(x1, c0 + dx) - Math.max(x0, c0);
        if (ov > 0) wb[i] += q * ov / len / dx;
      }
    });
    var pct = typeof model.structPct === 'number' ? model.structPct : DEFAULT_STRUCT_PCT, Wst = st.steelOn ? stSteel(model, h).mass : pct / 100 * hullHydro(h, h.draught, dm.rho).disp;
    // structure follows the hull: proportional to the section area of the hull up to the deck
    var nz = 24, sa = [], sum = 0;
    for (i = 0; i < N; i++) {
      var a = 0;
      for (j = 0; j < nz; j++) {
        var t = (j + 0.5) / nz, r = hullXRange(h, t);
        if (x[i] < r[0] || x[i] > r[1]) continue;
        a += 2 * hullHalf(h, (x[i] - r[0]) / (r[1] - r[0]), t) * h.depth / nz;
      }
      sa.push(a); sum += a;
    }
    for (i = 0; i < N; i++) ws[i] = sum > 0 ? Wst * sa[i] / sum / dx : 0;
    var k = fl.trimOk ? fl.k : 0, Tm = fl.trimOk ? fl.Tm : fl.T, xm = fl.trimOk ? fl.xm : 0.5 * (h.x + h.x + h.loa), nzb = 48, dz = h.depth / nzb;
    for (i = 0; i < N; i++) {
      var ar = 0, wl = Tm - k * (x[i] - xm);
      for (j = 0; j < nzb; j++) {
        var f = (wl - j * dz) / dz;
        if (f <= 0) continue;
        if (f > 1) f = 1;
        var t2 = (j + 0.5) / nzb, r2 = hullXRange(h, t2);
        if (x[i] < r2[0] || x[i] > r2[1]) continue;
        ar += 2 * hullHalf(h, (x[i] - r2[0]) / (r2[1] - r2[0]), t2) * dz * f;
      }
      b.push(dm.rho * ar);
    }
    for (i = 0; i < N; i++) w.push(wb[i] + ws[i]);
    // integrate (load = weight - buoyancy, positive downwards)
    var F = [0], M = [0], q = [];
    for (i = 0; i < N; i++) q.push(w[i] - b[i]);
    var xe = [xa];
    for (i = 0; i < N; i++) { F.push(F[i] + q[i] * dx); xe.push(xa + (i + 1) * dx); }
    for (i = 0; i < N; i++) M.push(M[i] + 0.5 * (F[i] + F[i + 1]) * dx);
    var Wt = 0, Bt = 0;
    for (i = 0; i < N; i++) { Wt += w[i] * dx; Bt += b[i] * dx; }
    var Fe = F[N], Me0 = M[N], maxM0 = 0;
    M.forEach(function (v) { maxM0 = Math.max(maxM0, Math.abs(v)); });
    // remove the end residual linearly so that shear and moment close at the fore end
    var Fc = [], Mc = [];
    for (i = 0; i <= N; i++) Fc.push(F[i] - Fe * i / N);
    Mc.push(0);
    for (i = 0; i < N; i++) Mc.push(Mc[i] + 0.5 * (Fc[i] + Fc[i + 1]) * dx);
    var Me = Mc[N];
    for (i = 0; i <= N; i++) Mc[i] -= Me * i / N;
    return { x: x, xe: xe, w: w, b: b, q: q, F: Fc.map(function (v) { return v * G0; }), M: Mc.map(function (v) { return v * G0; }),
      weight: Wt, buoyancy: Bt, imbalancePct: Wt > 0 ? 100 * (Bt - Wt) / Wt : 0, residualMomentPct: maxM0 > 0 ? 100 * Math.abs(Me0) / maxM0 : 0, residualShear: Fe * G0, structMass: Wst, N: N, dx: dx };
  }

  function stZreq(dm, st, Ms) {
    var f1 = stGrade(st), red = stAreaRed(st) / 100, wred = 1 - 2 * red, L = dm.L, B = dm.B, Cb = dm.Cb;
    var Mso = 0.0052 * L * L * L * B * (Cb + 0.7), CWr = dm.CW * wred, cbw = Math.max(Cb, 0.6);
    var MwoS = 0.11 * CWr * L * L * B * (cbw + 0.7), MwoH = 0.19 * CWr * L * L * B * cbw;
    var MsS = Math.max(Mso, Ms && Ms.sag || 0), MsH = Math.max(Mso, Ms && Ms.hog || 0);
    var ZS = (MsS + MwoS) / 175 * 1e3, ZH = (MsH + MwoH) / 175 * 1e3;
    var Cwo = Math.max(7.0, 5.7 + 0.022 * L) * (1 - red), Z0 = Cwo * L * L * B * (Math.max(Cb, 0.5) + 0.7);
    var A = 0.11 * L * L * B / dm.D;
    return { Mso: Mso, MwoSag: MwoS, MwoHog: MwoH, MsSag: MsS, MsHog: MsH, ZSag: ZS, ZHog: ZH, Z0: Z0, Cwo: Cwo, Zreq: Math.max(ZS, ZH, Z0), deckArea: A, f1: f1,
      governs: Math.max(ZS, ZH, Z0) === Z0 ? 'minimum Z0 (C104)' : (ZS >= ZH ? 'sagging (C101)' : 'hogging (C101)') };
  }

  /* rule curves along the hull for the chart: stillwater design value and wave moment, in kNm, at the load stations */
  function stRuleCurves(dm, zr, xs) {
    var Lr = dm.L, ap = dm.xAP;
    return xs.map(function (x) {
      var u = (x - ap) / Lr, f;
      f = u <= 0 || u >= 1 ? 0 : u < 0.3 ? u / 0.3 : u > 0.7 ? (1 - u) / 0.3 : 1;                        // Mso full within 0.4 L amidships
      var g = u <= 0 || u >= 1 ? 0 : u < 0.4 ? u / 0.4 : u > 0.65 ? (1 - u) / 0.35 : 1;                  // Mw full between 0.4 L and 0.65 L from AP
      return { x: x, soSag: zr.Mso * f, wSag: zr.MwoSag * g, wHog: zr.MwoHog * g };
    });
  }

  function modelStructure(model, opt) {
    opt = opt || {};
    var hs = model.hulls || [];
    if (!hs.length) return { ok: false, reason: 'No hull yet.' };
    if (hs.length > 1) return { ok: false, multihull: true, reason: 'The structure check is for a single hull. Multihulls are not covered.' };
    var h = hs[0], st = stGet(model), dm = stDims(model, h), warnings = [];
    if (!(dm.L > 0) || !(dm.B > 0) || !(dm.Cb > 0)) return { ok: false, reason: 'The hull has no volume at the draught.' };
    if (dm.L >= 100) warnings.push('Rule length ' + dm.L.toFixed(1) + ' m: the rules edition used (2015, ships under 100 m) does not apply above 100 m.');
    if (dm.L < 15) warnings.push('Very small vessel: the rules are intended for ships of some size.');
    var fl = opt.fl !== undefined ? opt.fl : floatState(model, { coarse: true }), loads = null, Ms = opt.Ms || null, sec = stSection(st, h.beam, h.depth), msg = '';
    if (opt.skipLoads) { /* loads kept by the caller */ }
    else if (fl && fl.ok && fl.T != null) {
      loads = stLoads(model, h, fl, dm);
      var lo = dm.xAP + 0.3 * dm.L, hi = dm.xAP + 0.7 * dm.L, mx = 0, mn = 0;
      loads.xe.forEach(function (xv, i) { if (xv >= lo && xv <= hi) { mx = Math.max(mx, loads.M[i]); mn = Math.min(mn, loads.M[i]); } });
      Ms = { sag: mx, hog: -mn };
      if (Math.abs(loads.imbalancePct) > 3) warnings.push('Weight and buoyancy differ by ' + loads.imbalancePct.toFixed(1) + '% in the load integration; the end residuals were removed linearly.');
      if (loads.residualMomentPct > 8) warnings.push('The bending moment does not close at the ends by ' + loads.residualMomentPct.toFixed(0) + '% of its peak: check that the weights and the trim are consistent.');
      if (!fl.trimOk) warnings.push('Trim did not converge: the level draught was used for the buoyancy.');
    } else msg = fl && fl.overloaded ? 'The weight is more than the hull can carry; no load curves.' : 'No floating position (add blocks and a hull); the rule values are shown without a calculated stillwater moment.';
    var zr = stZreq(dm, st, Ms), local = stLocal(dm, st, sec, zr.Zreq);
    var steel = stSteel(model, h), zok = sec.zDeck + 1e-9 >= zr.Zreq && sec.zBot + 1e-9 >= zr.Zreq;
    var ok = zok && local.every(function (r) { return r.ok; });
    if (st.hatch > 0) warnings.push('Hatch openings of ' + st.hatch + '% of the breadth are taken out of the deck plate; the factor 0.6 for strength members between hatches is not applied.');
    return { ok: true, h: h, st: st, dm: dm, fl: fl, loads: loads, Ms: Ms, req: zr, rule: loads ? stRuleCurves(dm, zr, loads.xe) : null, section: sec, local: local, steel: steel, zok: zok, allOk: ok,
      deckAreaOk: sec.deckArea + 1e-9 >= zr.deckArea, warnings: warnings, message: msg };
  }

  /* size plates, longitudinals and the two flanges to the rules: a starting point. Writes into model.st. */
  function stAutoSize(model) {
    var r = modelStructure(model);
    if (!r.ok) return r;
    var keep = { fl: r.fl, Ms: r.Ms, skipLoads: true };
    var st = stGet(model), dm = r.dm, h = r.h, it, up = function (v) { return Math.ceil(v * 2 - 1e-9) / 2; };
    function sizeProf(p, s, pressure, sigma, tplate) {
      var best = null, f1 = stGrade(st), Zr = Math.max(15, 83 * st.span * st.span * s * pressure / (sigma * f1)), hw;
      for (hw = 60; hw <= 600; hw += 10) {
        var tw = up(Math.max(stMinWeb({ type: 'T', hw: hw }, dm.L, st.tk), hw / 55)), cand = { type: 'T', hw: hw, tw: tw, bf: Math.max(50, Math.round(hw * 0.3 / 5) * 5), tf: up(tw + 1) };
        if (stStiffenerZ(cand, s * 1000, tplate) >= Zr) { best = cand; break; }
      }
      return best || { type: 'T', hw: 600, tw: 12, bf: 180, tf: 14 };
    }
    for (it = 0; it < 6; it++) {
      model.st = st;
      var rr = modelStructure(model, keep), zreq = rr.req.Zreq;
      var rows = {}; rr.local.forEach(function (q) { rows[q.item] = q; });
      st.tb = Math.max(st.tb, up(rows['Bottom plating'].required)); st.td = Math.max(st.td, up(rows['Strength deck plating'].required));
      st.ts = Math.max(st.ts, up(Math.max(rows['Side plating, lower'].required, rows['Side plating, upper'].required)));
      st.tkeel = Math.max(st.tkeel, up(rows['Keel plate'].required));
      if (rr.section.hasDB) st.ti = Math.max(st.ti, up(rows['Inner bottom plating'].required));
      var sgB = rows['Bottom longitudinals'].sigma, sgD = rows['Deck longitudinals'].sigma;
      st.pb = sizeProf(st.pb, st.sb, rows['Bottom longitudinals'].p, sgB, st.tb);
      st.pd = sizeProf(st.pd, st.sd, rows['Deck longitudinals'].p, sgD, st.td);
      var sl = rows['Side longitudinals, lower'], su = rows['Side longitudinals, upper'], ps = sl.p > su.p ? sl : su;
      st.ps = sizeProf(st.ps, st.ss, ps.p, ps.sigma, st.ts);
      if (rr.section.hasDB) st.pi = { type: 'T', hw: 100, tw: 6, bf: 50, tf: 7 };
      // raise deck and bottom plate until the modulus is met
      var guard = 0, sec = stSection(st, h.beam, h.depth);
      while ((sec.zDeck < zreq || sec.zBot < zreq) && guard++ < 120) {
        if (sec.zDeck < zreq) st.td += 0.5;
        if (sec.zBot < zreq) st.tb += 0.5;
        sec = stSection(st, h.beam, h.depth);
      }
    }
    model.st = st;
    return modelStructure(model);
  }

  /* ---------- what if ----------
     A variant of the design in which one requirement (an area or a volume) reaches a chosen target. The blocks linked to the requirement are
     stretched along the ticked directions (L along the length, B across, D in height); the blocks beyond them move by the same amount, like a
     parallel body insert, and blocks that span the stretched part stretch with it. Blocks with a typed weight and imported STL shapes keep their size
     and only move. The hulls follow the same stretch. The factor is shared equally among the ticked directions. */
  function wiMergeIv(iv) {
    iv = iv.slice().sort(function (a, b) { return a[0] - b[0]; });
    var out = [];
    iv.forEach(function (v) {
      var l = out[out.length - 1];
      if (l && v[0] <= l[1] + 1e-9) l[1] = Math.max(l[1], v[1]); else out.push([v[0], v[1]]);
    });
    return out;
  }
  function wiMap(iv, s) {
    iv = wiMergeIv(iv);
    return function (x) {
      var d = 0;
      iv.forEach(function (q) { d += (s - 1) * Math.min(Math.max(x - q[0], 0), q[1] - q[0]); });
      return x + d;
    };
  }
  /* world axis of the block turned about the vertical axis only: 0 for a quarter turn count of 0 or 2, 1 for 1 or 3, null when it is tilted or at another angle */
  function wiQuarter(b) {
    if (Math.abs(b.rotation[0]) > 1e-6 || Math.abs(b.rotation[1]) > 1e-6) return null;
    var q = b.rotation[2] / 90;
    if (Math.abs(q - Math.round(q)) > 1e-6) return null;
    return ((Math.round(q) % 2) + 2) % 2;
  }
  function wiScalable(b) {
    var sh = SHAPES[b.shape];
    return !(typeof b.massOverride === 'number' && isFinite(b.massOverride)) && sh && !sh.custom && wiQuarter(b) !== null;
  }

  /* a copy without the saved variants, which would only slow it down */
  function wiClone(model) { return JSON.parse(JSON.stringify(model, function (k, v) { return k === 'variants' && Array.isArray(v) ? undefined : v; })); }
  function wiApply(model, reqId, ticked, F, all) {
    var m = wiClone(model), k = ticked.length, sc = Math.pow(F, 1 / k);
    var s = { x: ticked.indexOf('L') >= 0 ? sc : 1, y: ticked.indexOf('B') >= 0 ? sc : 1, z: ticked.indexOf('D') >= 0 ? sc : 1 };
    var ivx = [], ivy = [], ivz = [], n = 0;
    m.blocks.forEach(function (b) {
      var sca = wiScalable(b);
      if (!all && !(hasReq(b, reqId) && sca)) return;
      if (sca) n++;
      var w = blockWorldBox(b);
      ivx.push([w.min[0], w.max[0]]);
      ivy.push(w.min[1] < 0 && w.max[1] > 0 ? [0, Math.max(-w.min[1], w.max[1])] : [Math.min(Math.abs(w.min[1]), Math.abs(w.max[1])), Math.max(Math.abs(w.min[1]), Math.abs(w.max[1]))]);
      ivz.push([w.min[2], w.max[2]]);
    });
    if (all) {            // the whole ship: one stretch from the first to the last point of the blocks, about the centreline across
      var ex = ivx.reduce(function (a, q) { return [Math.min(a[0], q[0]), Math.max(a[1], q[1])]; }, [Infinity, -Infinity]);
      var ey = ivy.reduce(function (a, q) { return Math.max(a, q[1]); }, 0), ez = ivz.reduce(function (a, q) { return [Math.min(a[0], q[0]), Math.max(a[1], q[1])]; }, [Infinity, -Infinity]);
      ivx = [ex]; ivy = [[0, ey]]; ivz = [ez];
    }
    var gx = wiMap(ivx, s.x), gu = wiMap(ivy, s.y), gz = wiMap(ivz, s.z);
    function gy(v) { return v < 0 ? -gu(-v) : gu(v); }
    m.blocks.forEach(function (b) {
      var w = blockWorldBox(b), c = [(w.min[0] + w.max[0]) / 2, (w.min[1] + w.max[1]) / 2, (w.min[2] + w.max[2]) / 2];
      if (!wiScalable(b)) { b.position = [b.position[0] + gx(c[0]) - c[0], b.position[1] + gy(c[1]) - c[1], b.position[2] + gz(c[2]) - c[2]]; return; }
      var lo = [gx(w.min[0]), gy(w.min[1]), gz(w.min[2])], hi = [gx(w.max[0]), gy(w.max[1]), gz(w.max[2])], ratio = [];
      for (var a = 0; a < 3; a++) { var L0 = w.max[a] - w.min[a]; ratio.push(L0 > 1e-9 ? (hi[a] - lo[a]) / L0 : 1); }
      var q = wiQuarter(b), loc = q === 0 ? [ratio[0], ratio[1]] : [ratio[1], ratio[0]];
      b.size = [b.size[0] * loc[0], b.size[1] * loc[1], b.size[2] * ratio[2]];
      b.position = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
      if (typeof b.areaOverride === 'number') b.areaOverride *= ratio[0] * ratio[1];
    });
    (m.hulls || []).forEach(function (h) {
      var x0 = gx(h.x), x1 = gx(h.x + h.loa), y0 = gy((h.y || 0) - h.beam / 2), y1 = gy((h.y || 0) + h.beam / 2);
      h.x = x0; h.loa = x1 - x0; h.y = (y0 + y1) / 2; h.beam = y1 - y0; h.depth = gz(h.depth);
    });
    return { model: m, s: s, n: n };
  }

  function wiSnapshot(model) {
    var m = wiClone(model), hs = m.hulls || [], out = { hulls: hs.length };
    var w = weightSummary(m);
    out.weight = w.total.mass;
    if (hs.length) {
      settle(m);
      var f = floatState(m), st = f ? stabilityState(m, f) : null, h = hs[0];
      out.draught = m.draught; out.trim = f ? f.trim : null; out.heel = f ? f.heel : null;
      out.GM = st && !st.overloaded ? st.GM : null;
      out.loa = h.loa; out.beam = h.beam; out.depth = h.depth;
      var hy = hullHydro(h, m.draught, m.rho || 1.025);
      out.LWL = hy.LWL; out.BWL = hy.BWL; out.disp = hy.disp; out.Cb = hy.Cb; out.Cm = hy.Cm; out.Cp = hy.Cp; out.Cwp = hy.Cwp; out.KB = hy.KB;
      out.LCBpc = hy.LWL > 0 ? (hy.LCB - hy.xa - hy.LWL / 2) / hy.LWL * 100 : null;
      out.LB = hy.BWL > 0 ? hy.LWL / hy.BWL : null; out.BT = m.draught > 0 ? hy.BWL / m.draught : null; out.LD = h.depth > 0 ? hy.LWL / h.depth : null;
    }
    out.GT = grossTonnage(m).GT;
    out.reqs = evaluateRequirements(m).map(function (e) { return { id: e.req.id, achieved: e.achieved, status: e.status }; });
    return out;
  }

  /* slider range for a requirement: from the shall to the should and a quarter of that span beyond each, or 20% around the current value when they are equal or missing */
  function wiRange(model, reqId) {
    var r = model.requirements.filter(function (q) { return q.id === reqId; })[0];
    if (!r) return null;
    var cur = evaluateRequirements(model).filter(function (e) { return e.req.id === reqId; })[0].achieved;
    var t = [r.shall, r.should].filter(function (v) { return v != null; }), lo = Math.min.apply(null, t.concat([cur])), hi = Math.max.apply(null, t.concat([cur]));
    var span = t.length === 2 ? Math.abs(r.should - r.shall) : 0, pad = span > 0 ? span * 0.25 : cur * 0.2;
    lo = Math.min(lo, t.length ? Math.min.apply(null, t) : lo); hi = Math.max(hi, t.length ? Math.max.apply(null, t) : hi);
    return { current: cur, shall: r.shall, should: r.should, min: Math.max(cur * 0.2, lo - pad), max: hi + pad };
  }

  var WI_FIXED = { length: 'L', beam: 'B', height: 'D' };
  function whatIf(model, reqId, target, axes) {
    var r = model.requirements.filter(function (q) { return q.id === reqId; })[0];
    if (!r) return { ok: false, reason: 'Choose a requirement.' };
    var all = r.metric === 'gt' || r.metric === 'totalmass' || !!WI_FIXED[r.metric];
    if (!all && r.metric !== 'area' && r.metric !== 'volume' && r.metric !== 'mass') return { ok: false, reason: 'This requirement cannot be scaled.' };
    var valid = WI_FIXED[r.metric] ? [WI_FIXED[r.metric]] : r.metric === 'area' ? ['L', 'B'] : ['L', 'B', 'D'], ticked = WI_FIXED[r.metric] ? valid : valid.filter(function (k) { return axes && axes[k]; });
    if (!ticked.length) return { ok: false, reason: r.metric === 'area' ? 'Tick L or B: an area does not change with the height.' : 'Tick at least one of L, B and D.' };
    var cur = evaluateRequirements(model).filter(function (e) { return e.req.id === reqId; })[0], A0 = cur.achieved;
    if (!(A0 > 0)) return { ok: false, reason: 'No block is linked to this requirement.' };
    if (!(target > 0) || !isFinite(target)) return { ok: false, reason: 'Enter a target above zero.' };
    function achieved(res) { return evaluateRequirements(res.model).filter(function (e) { return e.req.id === reqId; })[0].achieved; }
    var F = target / A0, res = wiApply(model, reqId, ticked, F, all);
    if (!res.n) return { ok: false, reason: all ? 'No block can be scaled.' : 'The blocks linked to this requirement have a typed weight or an imported shape, which are not scaled.' };
    var a = achieved(res), Fp = 1, ap = A0, it = 0;
    while (Math.abs(a - target) > 1e-6 * Math.abs(target) && it++ < 12 && a > 0) {
      var Fn = it === 1 || Math.abs(a - ap) < 1e-12 ? F * target / a : F + (target - a) * (F - Fp) / (a - ap);
      if (!(Fn > 0) || !isFinite(Fn)) break;
      Fp = F; ap = a; F = Fn; res = wiApply(model, reqId, ticked, F, all); a = achieved(res);
    }
    var v = res.model, notes = [];
    if (Math.abs(a - target) > 1e-3 * Math.abs(target)) notes.push('Blocks with a typed weight or an imported shape do not scale, so the target is reached only to ' + (a >= target ? '+' : '−') + (Math.abs(a - target) / target * 100).toFixed(1) + '%.');
    var s = settleCopy(v); v.draught = s.draught; syncDraught(v);
    var before = (model.__wiBefore) || wiSnapshot(model), after = wiSnapshot(v);
    return { ok: true, all: all, model: v, req: r, axes: ticked, factor: res.s, target: target, achieved: a, before: before, after: after, notes: notes };
  }
  function settleCopy(m) { var c = wiClone(m); if ((c.hulls || []).length) settle(c); return c; }

  /* saved variants: up to WI_MAX, each a complete project (data) with its numbers, kept in the project file */
  var WI_MAX = 5, WI_BYTES = 6e6;
  function wiSave(model, res, name) {
    var vs = model.variants || [];
    if (!res || !res.ok) return { ok: false, reason: 'There is no variant to save.' };
    if (vs.length >= WI_MAX) return { ok: false, reason: 'Up to ' + WI_MAX + ' variants can be saved. Delete one first.' };
    var taken = {}, n = 1; vs.forEach(function (v) { taken[v.id] = true; }); while (taken['V' + n]) n++;
    var data = JSON.parse(serializeProject(JSON.parse(JSON.stringify(res.model, function (k, v) { return k === 'variants' && Array.isArray(v) ? undefined : v; }))));
    var rec = { id: 'V' + n, name: String(name || '').trim().slice(0, 40), reqId: res.req.id, reqName: res.req.name, metric: res.req.metric, target: res.achieved, axes: res.axes.slice(), snap: res.after, data: data };
    var size = JSON.stringify(vs).length + JSON.stringify(rec).length;
    if (size > WI_BYTES) return { ok: false, reason: 'The saved variants would make the project file too large. Delete one first.' };
    model.variants = vs.concat([rec]);
    return { ok: true, rec: rec };
  }
  function wiOpen(rec) {
    try { var r = sanitizeProject(rec.data); return r && r.model ? r.model : null; } catch (e) { return null; }
  }
  function wiCleanVariants(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [], seen = {};
    raw.forEach(function (v) {
      if (out.length >= WI_MAX || !v || typeof v !== 'object' || typeof v.id !== 'string' || seen[v.id] || !v.data || typeof v.data !== 'object' || v.data.app !== FORMAT || !v.snap || typeof v.snap !== 'object') return;
      seen[v.id] = true;
      out.push({ id: String(v.id).slice(0, 12), name: typeof v.name === 'string' ? v.name.slice(0, 40) : '', reqId: String(v.reqId || '').slice(0, 60), reqName: String(v.reqName || '').slice(0, 80), metric: String(v.metric || '').slice(0, 20),
        target: typeof v.target === 'number' && isFinite(v.target) ? v.target : 0, axes: Array.isArray(v.axes) ? v.axes.filter(function (a) { return a === 'L' || a === 'B' || a === 'D'; }) : [], snap: v.snap, data: v.data });
    });
    return out;
  }
  /* What if for the report: for each requirement that can be scaled, what the ship would need to meet the shall and the should
     (one direction, L, or the own direction of a length, beam or height). Limited to maxReq requirements and a time budget. */
  function wiAuto(model, opt) {
    opt = opt || {};
    var maxReq = opt.maxReq || 6, budget = opt.budgetMs || 15000, t0 = Date.now(), rows = [], skipped = 0, n = 0;
    if (!(model.hulls || []).length) return { rows: rows, skipped: 0 };
    var base = wiSnapshot(model), cur = evaluateRequirements(model);
    model.__wiBefore = base;
    try {
      model.requirements.forEach(function (r) {
        var okm = ['volume', 'area', 'mass', 'length', 'beam', 'height', 'totalmass', 'gt'].indexOf(r.metric) >= 0;
        if (!okm || (r.shall == null && r.should == null)) return;
        if (n >= maxReq) { skipped++; return; }
        n++;
        var A0 = cur.filter(function (e) { return e.req.id === r.id; })[0].achieved, axes = r.metric === 'beam' ? { B: true } : r.metric === 'height' ? { D: true } : { L: true };
        [['shall', r.shall], ['should', r.should]].forEach(function (k) {
          if (k[1] == null || !(k[1] > 0)) return;
          var row = { reqId: r.id, reqName: r.name, metric: r.metric, kind: k[0], target: k[1], current: A0, base: base };
          if (Math.abs(k[1] - A0) <= 0.005 * Math.abs(A0)) { row.same = true; rows.push(row); return; }
          if (Date.now() - t0 > budget) { row.skipped = true; rows.push(row); return; }
          var w = whatIf(model, r.id, k[1], axes);
          if (!w.ok) row.reason = w.reason; else { row.after = w.after; row.axes = w.axes; row.notes = w.notes; }
          rows.push(row);
        });
      });
    } finally { delete model.__wiBefore; }
    return { rows: rows, skipped: skipped, base: base };
  }

  /* the rows of the comparison of the original with the saved variants (What if), used by the app, the PDF report and the Excel file */
  var WI_ROWS = [['s', 'Weight and stability'], ['Weight', 'weight', 0, 't'], ['Draught', 'draught', 2, 'm'], ['Trim', 'trim', 2, 'm'], ['Heel', 'heel', 2, 'deg'], ['GM', 'GM', 2, 'm'], ['Gross tonnage (estimate)', 'GT', 0, 'GT'],
    ['s', 'Main dimensions'], ['Hull length (LOA)', 'loa', 1, 'm'], ['Length at the waterline', 'LWL', 1, 'm'], ['Hull beam', 'beam', 2, 'm'], ['Beam at the waterline', 'BWL', 2, 'm'], ['Depth', 'depth', 2, 'm'], ['Displacement', 'disp', 0, 't'], ['L/B (waterline)', 'LB', 2, ''], ['B/T', 'BT', 2, ''], ['L/D', 'LD', 2, ''],
    ['s', 'Coefficients'], ['Block coefficient Cb', 'Cb', 3, ''], ['Midship coefficient Cm', 'Cm', 3, ''], ['Prismatic coefficient Cp', 'Cp', 3, ''], ['Waterplane coefficient Cwp', 'Cwp', 3, ''], ['LCB, % of LWL from midship (+ forward)', 'LCBpc', 2, '%'], ['KB', 'KB', 2, 'm']];
  function wiCols(model) {
    return [{ label: 'Original', snap: wiSnapshot(model) }].concat((model.variants || []).map(function (v) { return { label: v.id + (v.name ? ' ' + v.name : ''), snap: v.snap, rec: v }; }));
  }
  function wiRecipe(v) { var un = METRICS[v.metric] ? METRICS[v.metric].unit : ''; return v.reqName + ' ' + (Math.round(v.target * 10) / 10) + ' ' + un + (v.axes.length ? ', scaled ' + v.axes.join('') : ''); }

  var api = {
    FORMAT: FORMAT, VERSION: VERSION, SHAPES: SHAPES, SHAPE_ORDER: SHAPE_ORDER, METRICS: METRICS, STATUS_LABEL: STATUS_LABEL, statusText: statusText, fmtMargin: fmtMargin,
    registerShape: registerShape, parseSTL: parseSTL, reduceSTL: reduceSTL, makeShapeData: makeShapeData, guessUnit: guessUnit, UNIT_SCALE: UNIT_SCALE, CUSTOM: CUSTOM, STL_MAX_BYTES: STL_MAX_BYTES, STL_TARGET: STL_TARGET,
    grossTonnage: grossTonnage, makeGeometry: makeGeometry, shapeContains: shapeContains, makeEdges: makeEdges,
    blockMatrix: blockMatrix, blockVolume: blockVolume, blockPlanArea: blockPlanArea, blockArea: blockArea,
    blockWorldBox: blockWorldBox, envelope: envelope,
    defaultGroups: defaultGroups, groupMap: groupMap, groupOrder: groupOrder, groupPath: groupPath,
    isGroupVisible: isGroupVisible, descendantIds: descendantIds,
    whatIf: whatIf, wiRange: wiRange, wiSnapshot: wiSnapshot, wiSave: wiSave, wiCols: wiCols, wiAuto: wiAuto, wiRecipe: wiRecipe, WI_ROWS: WI_ROWS, wiOpen: wiOpen, WI_MAX: WI_MAX,
    modelStructure: modelStructure, stAutoSize: stAutoSize, stClean: stClean, stDefaults: stDefaults, stSection: stSection, stStiffenerZ: stStiffenerZ, stPdp: stPdp, stSea: stSea, stPlateT: stPlateT, stZreq: stZreq, stStiffenerZ: stStiffenerZ, ST_GRADES: ST_GRADES, ST_AREAS: ST_AREAS,
    summarize: summarize, weightSummary: weightSummary, blockMass: blockMass, blockCentroid: blockCentroid, groupDensity: groupDensity, hullCentroid: hullCentroid, SHAPE_CENTROID: SHAPE_CENTROID, DEFAULT_DENSITY: DEFAULT_DENSITY, DEFAULT_STRUCT_PCT: DEFAULT_STRUCT_PCT, evaluateRequirements: evaluateRequirements, blockReqs: blockReqs, hasReq: hasReq,
    emptyProject: emptyProject, exampleProject: withGT(withDeck(exampleProject), /^Open cargo deck$/), containerShipExample: withGT(withDeck(containerShipExample), /^Deck stack/), tankerExample: withDeck(tankerExample), ahtsExample: withGT(withDeck(ahtsExample), /^(Open working deck|Forward mooring deck)$/), cruiseShipExample: withGT(withDeck(cruiseShipExample), /^(Pool and sun deck|Funnel)$/), bulkCarrierExample: withDeck(bulkCarrierExample), sailingYachtExample: withGT(withDeck(sailingYachtExample), /^(Mast and rigging|Lead ballast)$/), simpleExample: withDeck(simpleExample), gunnerusExample: withGT(withDeck(gunnerusExample), /^Aft working deck$/), catamaranExample: withGT(withDeck(catamaranExample), /^Aft working deck$/), trimaranExample: withGT(withDeck(trimaranExample), /^Aft working deck$/), markedDeck: markedDeck,
    blankProject: blankProject, sanitizeProject: sanitizeProject, serializeProject: serializeProject,
    summaryCSV: summaryCSV, projectXlsx: projectXlsx, zipStore: zipStore, stampText: stampText, APP_VERSION: APP_VERSION, buildReport: buildReport, pdfWriter: pdfWriter, workbookSheets: workbookSheets, xlsxBuild: xlsxBuild, requirementsCSV: requirementsCSV, blocksCSV: blocksCSV,
    HULL_TYPES: HULL_TYPES, HULL_ORDER: HULL_ORDER, hullHalf: hullHalf, hullParams: hullParams, cleanShape: cleanShape, SHAPE_SPEC: SHAPE_SPEC, STERN_PRESETS: STERN_PRESETS, hullXRange: hullXRange, hullContains: hullContains,
    curvesHull: curvesHull, hullGenFromHull: hullGenFromHull, hullGenNow: hullGenNow, applyHullGen: applyHullGen, cleanGenParams: cleanGenParams, hullBulb: hullBulb, modelResistance: modelResistance, seakeepingCurves: seakeepingCurves, seakeepingOff: seakeepingOff, modelSeakeeping: modelSeakeeping, modelSeaState: modelSeaState, wfMag: wfMag, msdvOf: msdvOf, seaLimitSweep: seaLimitSweep, waveSpectrum: waveSpectrum, responseStats: responseStats, SS_CRITERIA: SS_CRITERIA, SS_RESP: SS_RESP, jonswapRaw: jonswapRaw, tsFromTz: tsFromTz, AFT_FORMS: AFT_FORMS, holtropModel: HOLTROP.holtropModel, holtropInputs: HOLTROP.holtropInputs, fitTableHull: fitTableHull, hullVolumeTo: hullVolumeTo, hullOffsets: hullOffsets, HULL_LIBRARY: HULL_LIBRARY, HULL_LIB_ORDER: HULL_LIB_ORDER, libraryHull: libraryHull, parseOffsetsText: parseOffsetsText, offsetsToHull: offsetsToHull, offsetsFullDepth: offsetsFullDepth, cleanOffsets: cleanOffsets, hullHydro: hullHydro, modelHydro: modelHydro, hullCheck: hullCheck, setQuickCheck: setQuickCheck, addHullTo: addHullTo, mirrorHull: mirrorHull, fitHullSet: fitHullSet, MAX_HULLS: MAX_HULLS, MAX_CUSTOM_SHAPES: MAX_CUSTOM_SHAPES, pruneCustomShapes: pruneCustomShapes, autoDeckLine: autoDeckLine, fitHull: fitHull,
    makeHullGeometry: makeHullGeometry, makeWaterGeometry: makeWaterGeometry, floatState: floatState, stabilityState: stabilityState, gzCurve: gzCurve, assessment: assessment, autoFloat: autoFloat, waterExtent: waterExtent, syncDraught: syncDraught, hullNameFor: hullNameFor, makeHullLines: makeHullLines,
    uid: uid, num: num
  };

  root.DBBCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

