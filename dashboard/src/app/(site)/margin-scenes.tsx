import type { ReactNode, SVGProps } from "react";

// Blueprint-style schematics for the site's side margins. Every scene is drawn in a 300 x 900 box; margin-art.tsx
// stacks them and fades between them as the page scrolls. Styling (ink colour, draw-in, trim) lives in globals.css
// under `.ma`. Paths with class "d" draw themselves in as their scene fades in.

const f = (n: number) => +n.toFixed(1);
const D = (p: SVGProps<SVGPathElement>) => <path className="d" pathLength={1} {...p} />;
const T = ({ x, y, a = "start", s = 8, children }: { x: number; y: number; a?: "start" | "middle" | "end"; s?: number; children: ReactNode }) => (
  <text x={x} y={y} textAnchor={a} fontSize={s}>{children}</text>
);

const line = (x1: number, y1: number, x2: number, y2: number) => `M${f(x1)},${f(y1)}L${f(x2)},${f(y2)}`;
function arrow(x1: number, y1: number, x2: number, y2: number, h = 5) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (da: number) => `${f(x2 - h * Math.cos(a + da))},${f(y2 - h * Math.sin(a + da))}`;
  return `${line(x1, y1, x2, y2)}M${p(0.4)}L${f(x2)},${f(y2)}L${p(-0.4)}`;
}
// Dimension line: arrowheads at both ends.
function dim(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return arrow(mx, my, x2, y2) + arrow(mx, my, x1, y1);
}
const CENTERLINE = "10 3 2 3";

// ---------- 1. Lines plan: hull form ----------

function BodyPlan() {
  const cx = 150, base = 650;
  const deadrise = (s: number) => ((18 + (s > 5 ? (s - 5) * 7 : s * 0.5)) * Math.PI) / 180;
  const beam = (s: number) => (s <= 5 ? 82 + s * 3.6 : 100 * Math.pow(Math.cos(((s - 5) / 5) * (Math.PI / 2)), 0.7) + 6);
  const rise = (s: number) => (s > 6 ? (s - 6) ** 2 * 5 : 0);
  // One half-section: keel -> chine -> sheer. Aft stations are drawn left of the centerline, forward ones right.
  const half = (s: number, side: -1 | 1) => {
    const b = beam(s), hc = b * Math.tan(deadrise(s)), depth = hc + 0.6 * b + 14, cy = base - rise(s);
    const x = (k: number) => cx + side * k;
    return {
      d: `M${cx},${f(cy)}L${f(x(b))},${f(cy - hc)}Q${f(x(b * 1.03))},${f(cy - hc - (depth - hc) * 0.55)} ${f(x(b * 1.08))},${f(cy - depth)}`,
      lx: x(b * 1.08), ly: cy - depth - 5,
    };
  };
  const stations = Array.from({ length: 11 }, (_, s) => s);
  const r = 46, b0 = (deadrise(0) * 180) / Math.PI;
  const ruler = Array.from({ length: 59 }, (_, i) => line(16, 120 + i * 10, i % 5 === 0 ? 28 : 22, 120 + i * 10)).join("");
  return (
    <>
      <T x={cx} y={112} a="middle" s={9}>BODY PLAN</T>
      <T x={cx} y={126} a="middle" s={8}>DEADRISE β = {b0.toFixed(0)}° AT TRANSOM</T>
      <D d={ruler} opacity={0.6} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <D d={line(34, base - i * 34, 266, base - i * 34)} opacity={i === 0 ? 1 : 0.4} />
          <T x={296} y={base - i * 34 - 3} a="end" s={8}>{i === 0 ? "BL" : `WL ${i}`}</T>
        </g>
      ))}
      <path d={line(cx, 140, cx, base + 20)} strokeDasharray={CENTERLINE} opacity={0.7} />
      {stations.map((s) => {
        const sides: (-1 | 1)[] = s < 5 ? [-1] : s > 5 ? [1] : [-1, 1];
        return sides.map((side) => {
          const h = half(s, side);
          return (
            <g key={`${s}${side}`}>
              <D d={h.d} />
              {(s !== 5 || side === 1) && <T x={h.lx} y={h.ly} a="middle" s={8}>{s}</T>}
            </g>
          );
        });
      })}
      <D d={`M${cx - r},${base}A${r},${r} 0 0 1 ${f(cx - r * Math.cos(deadrise(0)))},${f(base - r * Math.sin(deadrise(0)))}`} className="d acc" />
      <T x={cx - r - 14} y={base - 8} s={9}>β</T>
      <T x={cx - 8} y={base + 30} a="end" s={8}>AFT 0–5</T>
      <T x={cx + 8} y={base + 30} s={8}>FWD 5–10</T>
    </>
  );
}

function SheerProfile() {
  const x0 = 30, len = 240, y0 = 500;
  const sx = (s: number) => x0 + (len * s) / 10;
  const stations = Array.from({ length: 11 }, (_, s) => line(sx(s), y0 - 140, sx(s), y0 + 24)).join("");
  return (
    <>
      <T x={x0} y={y0 - 178} s={9}>SHEER PROFILE</T>
      <T x={x0} y={y0 - 164} s={8}>STATIONS 0–10, 1:10</T>
      <D d={stations} opacity={0.35} />
      {Array.from({ length: 11 }, (_, s) => <T key={s} x={sx(s)} y={y0 + 38} a="middle" s={8}>{s}</T>)}
      <D d={`M${x0},${y0 - 80}C${x0 + 80},${y0 - 76} ${x0 + 170},${y0 - 86} ${x0 + len},${y0 - 130}`} />
      <D d={`M${x0},${y0}L${x0 + 150},${y0}C${x0 + 200},${y0} ${x0 + 230},${y0 - 45} ${x0 + len},${y0 - 130}`} />
      <D d={line(x0, y0 - 80, x0, y0)} />
      <D d={`M${x0},${y0 - 30}C${x0 + 90},${y0 - 28} ${x0 + 180},${y0 - 52} ${x0 + len},${y0 - 130}`} opacity={0.6} />
      <D d={`M${x0},${y0 - 14}C${x0 + 100},${y0 - 12} ${x0 + 190},${y0 - 26} ${x0 + len - 14},${y0 - 92}`} opacity={0.4} />
      <path d={line(x0 - 10, y0 - 24, x0 + len + 10, y0 - 24)} strokeDasharray={CENTERLINE} opacity={0.7} />
      <T x={x0 + len + 10} y={y0 - 28} a="end" s={8}>DWL</T>
      <circle cx={sx(4.2)} cy={y0 - 44} r={5} className="acc" />
      <path d={`M${sx(4.2) - 8},${y0 - 44}h16M${sx(4.2)},${y0 - 52}v16`} className="acc" />
      <T x={sx(4.2)} y={y0 - 58} a="middle" s={8}>LCG</T>
      <D d={dim(x0, y0 + 70, x0 + len, y0 + 70) + line(x0, y0 + 48, x0, y0 + 78) + line(x0 + len, y0 + 48, x0 + len, y0 + 78)} opacity={0.7} />
      <T x={x0 + len / 2} y={y0 + 64} a="middle" s={8}>LOA 1219</T>
    </>
  );
}

// ---------- 2. Savitsky planing model ----------

function PlaningFreeBody() {
  const wl = 500;
  const hatch = Array.from({ length: 19 }, (_, i) => line(20 + i * 14, wl + 2, 14 + i * 14, wl + 12)).join("");
  return (
    <>
      <T x={150} y={150} a="middle" s={9}>SAVITSKY PLANING MODEL</T>
      <T x={150} y={164} a="middle" s={8}>FREE BODY AT TRIM τ</T>
      <path d={line(16, wl, 284, wl)} strokeDasharray="4 3" opacity={0.7} />
      <D d={hatch} opacity={0.3} />
      <path d={`M186,${wl}q12,-4 17,-32`} strokeDasharray="2 2" opacity={0.7} />
      <T x={206} y={wl - 34} s={8}>SPRAY ROOT</T>
      <g className="ma-trim">
        <D d={`M60,${wl}L190,${wl}C225,${wl} 250,${wl - 14} 262,${wl - 48}C200,${wl - 50} 120,${wl - 46} 60,${wl - 46}Z`} />
        <circle cx={135} cy={wl - 30} r={4} className="acc" />
        <path d={`M129,${wl - 30}h12M135,${wl - 36}v12`} className="acc" />
        <T x={146} y={wl - 34} s={8}>CG</T>
        <D d={arrow(160, wl, 160, wl - 70)} className="d acc" />
        <T x={166} y={wl - 62} s={8}>N</T>
        <D d={arrow(64, wl - 12, 112, wl - 18)} className="d acc" />
        <T x={116} y={wl - 15} s={8}>T</T>
        <D d={arrow(184, wl + 9, 132, wl + 9)} className="d acc" />
        <T x={158} y={wl + 20} a="middle" s={8}>Df</T>
        <g className="ma-untrim">
          <D d={arrow(135, wl - 30, 135, wl + 28)} className="d acc" />
          <T x={141} y={wl + 28} s={8}>Δ</T>
        </g>
      </g>
      <T x={222} y={wl - 5} s={9}>τ</T>
      <D d={dim(60, wl + 58, 190, wl + 58) + line(60, wl + 50, 60, wl + 66) + line(190, wl + 50, 190, wl + 66)} opacity={0.7} />
      <T x={125} y={wl + 52} a="middle" s={8}>Lk</T>
      <D d={dim(60, wl + 80, 160, wl + 80) + line(60, wl + 72, 60, wl + 88) + line(160, wl + 72, 160, wl + 88)} opacity={0.7} />
      <T x={110} y={wl + 74} a="middle" s={8}>Lc</T>
      <T x={150} y={wl + 128} a="middle" s={8}>R = Δ tan τ + Df / cos τ</T>
      <T x={150} y={wl + 144} a="middle" s={8}>ΣFx = ΣFz = ΣM = 0</T>
      <T x={150} y={wl + 160} a="middle" s={8}>SAVITSKY, 1964</T>
    </>
  );
}

function WettedPlanform() {
  const cx = 150, top = 190, bot = 520, half = 70;
  const hull = `M${cx},${top}C${cx + 30},${top + 60} ${cx + half},${top + 130} ${cx + half},${top + 190}L${cx + half},${bot}L${cx - half},${bot}L${cx - half},${top + 190}C${cx - half},${top + 130} ${cx - 30},${top + 60} ${cx},${top}Z`;
  return (
    <>
      <defs>
        <pattern id="ma-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
        </pattern>
      </defs>
      <T x={cx} y={150} a="middle" s={9}>WETTED PLANFORM</T>
      <T x={cx} y={164} a="middle" s={8}>WETTED LENGTH SHRINKS AS SPEED RISES</T>
      <D d={hull} />
      <g className="ma-wet">
        <path d={`M${cx - half},${bot}L${cx - half},${bot - 140}L${cx},${bot - 190}L${cx + half},${bot - 140}L${cx + half},${bot}Z`} style={{ fill: "url(#ma-hatch)" }} className="acc" />
      </g>
      <path d={line(cx, top - 14, cx, bot + 20)} strokeDasharray={CENTERLINE} opacity={0.7} />
      <T x={40} y={bot + 50} s={8}>b   BEAM AT CHINES</T>
      <T x={40} y={bot + 64} s={8}>Lk  WETTED KEEL LENGTH</T>
      <T x={40} y={bot + 78} s={8}>Lc  WETTED CHINE LENGTH</T>
      <T x={40} y={bot + 92} s={8}>λ = (Lk + Lc) / 2b</T>
      {/* resistance against speed: the hump, then planing */}
      <D d={`${line(40, 780, 270, 780)}${line(40, 780, 40, 640)}`} opacity={0.7} />
      <path d={`M40,776C80,770 95,665 130,655C170,646 210,690 270,705`} className="dk" pathLength={1} />
      <T x={34} y={646} a="end" s={8}>R/W</T>
      <T x={270} y={794} a="end" s={8}>SPEED</T>
      <T x={130} y={647} a="middle" s={8}>HUMP</T>
      <T x={250} y={697} a="middle" s={8}>PLANING</T>
      <T x={cx} y={826} a="middle" s={7}>CLβ = CL0 − 0.0065 β CL0^0.6</T>
    </>
  );
}

// ---------- 3. General arrangement ----------

function PlanView() {
  const cx = 150, top = 190, bot = 640, half = 70;
  const hull = `M${cx},${top}C${cx + 36},${top + 90} ${cx + half},${top + 190} ${cx + half},${top + 300}L${cx + half},${bot}L${cx - half},${bot}L${cx - half},${top + 300}C${cx - half},${top + 190} ${cx - 36},${top + 90} ${cx},${top}Z`;
  const inner = `M${cx - half + 9},${bot - 10}L${cx - half + 9},${top + 310}C${cx - half + 9},${top + 200} ${cx - 28},${top + 100} ${cx},${top + 28}C${cx + 28},${top + 100} ${cx + half - 9},${top + 200} ${cx + half - 9},${top + 310}L${cx + half - 9},${bot - 10}Z`;
  return (
    <>
      <T x={cx} y={150} a="middle" s={9}>PLAN VIEW</T>
      <T x={cx} y={164} a="middle" s={8}>GENERAL ARRANGEMENT, 1:10</T>
      <D d={hull} />
      <D d={inner} opacity={0.5} />
      {[300, 390, 480, 570].map((y) => <D key={y} d={line(cx - half + 9, y, cx + half - 9, y)} opacity={0.45} />)}
      <D d={`M${cx - 14},${bot - 110}h28v50h-28z`} opacity={0.8} />
      <D d={line(cx, bot - 60, cx, bot + 26)} />
      <D d={ell(cx - 11, bot + 28, 10, 3) + ell(cx + 11, bot + 28, 10, 3)} />
      <D d={`M${cx - 2.5},${bot + 38}h5v20h-5z`} />
      <circle cx={cx} cy={top + 200} r={7} className="acc" />
      <path d={`M${cx - 11},${top + 200}h22M${cx},${top + 189}v22`} className="acc" />
      <path d={line(cx, top - 24, cx, bot + 70)} strokeDasharray={CENTERLINE} opacity={0.7} />
      <D d={dim(cx + half + 32, top, cx + half + 32, bot) + line(cx + half + 6, top, cx + half + 40, top) + line(cx + half + 6, bot, cx + half + 40, bot)} opacity={0.7} />
      <g transform={`rotate(-90 ${cx + half + 26} ${(top + bot) / 2})`}>
        <T x={cx + half + 26} y={(top + bot) / 2} a="middle" s={8}>LOA 1219</T>
      </g>
      <D d={dim(cx - half, bot + 78, cx + half, bot + 78) + line(cx - half, bot + 48, cx - half, bot + 86) + line(cx + half, bot + 48, cx + half, bot + 86)} opacity={0.7} />
      <T x={cx} y={bot + 72} a="middle" s={8}>BEAM 410</T>
      <D d={`M${cx - 14},${bot - 85}H${cx - 84}`} opacity={0.7} />
      <T x={cx - 86} y={bot - 82} a="end" s={8}>MOTOR</T>
      <D d={`M${cx + 21},${bot + 30}L${cx + 44},${bot + 46}`} opacity={0.7} />
      <T x={cx + 46} y={bot + 49} s={8}>PROP + RUDDER</T>
      <D d={`M${cx + 6},${top + 200}L${cx + 40},${top + 170}h26`} opacity={0.7} />
      <T x={cx + 70} y={top + 168} s={8}>LIDAR</T>
    </>
  );
}

function ProfileArrangement() {
  const x0 = 44, len = 232, y0 = 440;
  return (
    <>
      <T x={x0} y={y0 - 214} s={9}>SECTION A-A</T>
      <T x={x0} y={y0 - 200} s={8}>PROFILE, SCALE 1:10</T>
      <D d={`M${x0},${y0 - 60}C${x0 + 120},${y0 - 56} ${x0 + 190},${y0 - 66} ${x0 + len},${y0 - 104}`} />
      <D d={`M${x0},${y0}L${x0 + 150},${y0}C${x0 + 210},${y0} ${x0 + 235},${y0 - 36} ${x0 + len},${y0 - 104}`} />
      <D d={line(x0, y0 - 60, x0, y0)} />
      <path d={line(x0 - 14, y0 - 20, x0 + len + 8, y0 - 20)} strokeDasharray={CENTERLINE} opacity={0.7} />
      <T x={x0 + len + 8} y={y0 - 24} a="end" s={8}>DWL</T>
      <D d={`M${x0 + 96},${y0 - 90}h46v26h-46z`} opacity={0.8} />
      <D d={`M${x0 + 186},${y0 - 104}h18v14h-18z${line(x0 + 195, y0 - 90, x0 + 195, y0 - 72)}`} />
      <D d={`M${x0 + 119},${y0 - 90}V${y0 - 146}h-10`} opacity={0.7} />
      <T x={x0 + 106} y={y0 - 143} a="end" s={8}>BATTERY / AVIONICS</T>
      <D d={`M${x0 + 195},${y0 - 104}V${y0 - 146}h12`} opacity={0.7} />
      <T x={x0 + 210} y={y0 - 143} s={8}>LIDAR</T>
      <D d={`M${x0 + 24},${y0 - 38}h44v26h-44z`} opacity={0.8} />
      <D d={line(x0 + 24, y0 - 25, x0 - 14, y0 - 25)} />
      <D d={ell(x0 - 14, y0 - 25, 3, 9)} />
      <D d={poly([[x0 - 28, y0 - 34], [x0 - 22, y0 - 34], [x0 - 22, y0 + 8], [x0 - 30, y0 + 4]])} />
      <T x={x0 - 30} y={y0 + 30} s={8}>MOTOR / PROP / RUDDER</T>
      <D d={dim(x0, y0 + 64, x0 + len, y0 + 64) + line(x0, y0 + 40, x0, y0 + 72) + line(x0 + len, y0 - 104, x0 + len, y0 + 72)} opacity={0.7} />
      <T x={x0 + len / 2} y={y0 + 58} a="middle" s={8}>LOA 1219 MM</T>
      <D d="M64,760h212v64H64zM64,788h212M196,788v36" opacity={0.8} />
      <T x={72} y={778} s={8}>HAAV HULL GENERAL ARRANGEMENT</T>
      <T x={72} y={810} s={8}>UW-MADISON 2027</T>
      <T x={204} y={806} s={8}>HAAV-001</T>
      <T x={204} y={818} s={8}>REV A</T>
    </>
  );
}

// ---------- 4. Exploded view ----------
// Isometric (axes 120 degrees apart), so a circle in any plane is an ellipse with semi-axes r*RX by r*RY.

type Pt = [number, number];
const RX = 1.2247, RY = 0.7071;
const U: Pt = [0.866, 0.5]; // the boat's length axis (iso x) on screen
const iso = (x: number, y: number, z: number, ox: number, oy: number): Pt => [f(ox + (x - y) * 0.866), f(oy + (x + y) * 0.5 - z)];
const poly = (pts: Pt[]) => `M${pts.map((p) => p.join(",")).join("L")}Z`;
const polyline = (pts: Pt[]) => `M${pts.map((p) => p.join(",")).join("L")}`;
const ell = (cx: number, cy: number, rx: number, ry: number, rot = 0) => {
  const a = (rot * Math.PI) / 180, dx = f(rx * Math.cos(a)), dy = f(rx * Math.sin(a));
  return `M${f(cx - dx)},${f(cy - dy)}a${f(rx)},${f(ry)} ${rot} 1 0 ${f(2 * dx)},${f(2 * dy)}a${f(rx)},${f(ry)} ${rot} 1 0 ${f(-2 * dx)},${f(-2 * dy)}`;
};
function isoBox(ox: number, oy: number, w: number, d: number, h: number) {
  const p = (x: number, y: number, z: number) => iso(x, y, z, ox, oy);
  return poly([p(0, 0, h), p(w, 0, h), p(w, d, h), p(0, d, h)]) + poly([p(0, d, h), p(w, d, h), p(w, d, 0), p(0, d, 0)]) + poly([p(w, 0, h), p(w, d, h), p(w, d, 0), p(w, 0, 0)]);
}
// Upright cylinder standing on (cx, cy); `rings` are extra circles at those heights.
function vcyl(cx: number, cy: number, r: number, h: number, rings: number[] = []) {
  const rx = r * RX, ry = r * RY;
  const arc = (y: number) => `M${f(cx - rx)},${f(y)}a${f(rx)},${f(ry)} 0 0 0 ${f(2 * rx)},0`;
  return ell(cx, cy - h, rx, ry) + `M${f(cx - rx)},${f(cy - h)}V${f(cy)}M${f(cx + rx)},${f(cy - h)}V${f(cy)}` + arc(cy) + rings.map((z) => arc(cy - z)).join("");
}
// Cylinder lying along the boat's length axis, starting at (ax, ay).
function hcyl(ax: number, ay: number, len: number, r: number, rings: number[] = []) {
  const rx = r * RX, ry = r * RY, ox = -0.5 * rx, oy = 0.866 * rx;
  const at = (t: number): Pt => [ax + t * len * U[0], ay + t * len * U[1]];
  const [bx, by] = at(1);
  return ell(ax, ay, rx, ry, 120) + ell(bx, by, rx, ry, 120) + rings.map((t) => ell(...at(t), rx, ry, 120)).join("") +
    line(ax + ox, ay + oy, bx + ox, by + oy) + line(ax - ox, ay - oy, bx - ox, by - oy);
}
// Three-blade propeller seen in the plane across the boat's length axis.
function propeller(cx: number, cy: number, R: number, rh: number) {
  const dir = (a: number): Pt => [-0.866 * Math.cos(a), 0.5 * Math.cos(a) - Math.sin(a)];
  return [90, 210, 330].map((deg) => {
    const a = (deg * Math.PI) / 180, d = dir(a), s = dir(a + Math.PI / 2), m = (rh + R) / 2, w = R * 0.3;
    const pt = (k: number, side = 0) => `${f(cx + k * d[0] + side * s[0])},${f(cy + k * d[1] + side * s[1])}`;
    return `M${pt(rh)}Q${pt(m, w)} ${pt(R)}Q${pt(m, -w * 0.3)} ${pt(rh)}Z`;
  }).join("");
}
const balloon = (x: number, y: number, n: number) => (
  <>
    <circle cx={x} cy={y} r={9} />
    <T x={x} y={y + 3} a="middle" s={9}>{n}</T>
  </>
);
const dash = (x1: number, y1: number, x2: number, y2: number) => <path d={line(x1, y1, x2, y2)} strokeDasharray="3 4" opacity={0.7} />;
const dot = (x: number, y: number) => <circle cx={x} cy={y} r={2.6} className="dot" />;

function ExplodedElectronics() {
  const ax = 170;
  // 1. GPS antenna: ground plane, mast, domed puck, cable
  const gps = vcyl(ax, 246, 14, 3) + line(ax, 243, ax, 214) + vcyl(ax, 214, 9, 9) + `M${f(ax - 8)},205Q${ax},188 ${f(ax + 8)},205` + `M${ax + 10},249q22,6 14,30`;
  // 2. Lidar: bolted flange, window band, capped head
  const bolts = [0, 60, 120, 180, 240, 300].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return <circle key={deg} cx={f(ax + 24 * RX * Math.cos(a))} cy={f(374 + 24 * RY * Math.sin(a))} r={1.5} />;
  });
  // 3. Avionics box: lid lifted off, vents on one face, connectors on the other
  const bo = ax - 4, p = (x: number, y: number, z: number) => iso(x, y, z, bo, 520);
  const vents = [8, 12, 16, 20].map((z) => line(...p(64, 10, z), ...p(64, 38, z))).join("");
  const ports = poly([p(10, 48, 6), p(28, 48, 6), p(28, 48, 16), p(10, 48, 16)]) + poly([p(36, 48, 8), p(48, 48, 8), p(48, 48, 14), p(36, 48, 14)]);
  // 4. Battery pack: cells, terminals, strap
  const bp = (x: number, y: number, z: number) => iso(x, y, z, ax - 13, 640);
  const cells = [18, 36, 54].map((x) => line(...bp(x, 0, 24), ...bp(x, 42, 24))).join("");
  const strap = poly([bp(30, 0, 24), bp(36, 0, 24), bp(36, 42, 24), bp(30, 42, 24)]) + poly([bp(30, 42, 24), bp(36, 42, 24), bp(36, 42, 0), bp(30, 42, 0)]);
  return (
    <>
      <path d={line(ax, 130, ax, 790)} strokeDasharray="3 5" opacity={0.5} />
      <D d={gps} />
      {balloon(92, 196, 1)}{dash(101, 198, ax - 14, 212)}{dot(ax, 205)}
      <D d={vcyl(ax, 380, 28, 6) + vcyl(ax, 374, 20, 34, [10, 24]) + vcyl(ax, 340, 15, 7) + ell(ax, 333, RX * 6, RY * 6)} />
      {bolts}
      {balloon(82, 360, 2)}{dash(91, 362, ax - 28, 366)}{dot(ax, 333)}
      <D d={isoBox(bo, 446, 64, 48, 5)} />
      <D d={isoBox(bo, 520, 64, 48, 28) + vents + ports} />
      {[[64, 0], [64, 48], [0, 48]].map(([x, y]) => <g key={`${x}${y}`}>{dash(...iso(x, y, 0, bo, 446), ...p(x, y, 28))}</g>)}
      {balloon(70, 530, 3)}{dash(79, 532, bo - 38, 520)}{dot(...iso(32, 24, 5, bo, 446))}
      <D d={isoBox(ax - 13, 640, 72, 42, 24) + cells + strap + vcyl(...bp(14, 10, 24), 4, 6) + vcyl(...bp(14, 32, 24), 4, 6)} />
      {balloon(80, 668, 4)}{dash(89, 670, ax - 52, 664)}{dot(...bp(14, 10, 30))}
      <T x={24} y={756} s={8}>1  GPS ANTENNA</T>
      <T x={24} y={770} s={8}>2  LIDAR</T>
      <T x={24} y={784} s={8}>3  AVIONICS BOX</T>
      <T x={24} y={798} s={8}>4  BATTERY PACK</T>
    </>
  );
}

function ExplodedHull() {
  const HL = 190, yc = 34;
  const half = (x: number) => (x <= 100 ? 34 : 34 * Math.pow(Math.cos(((x - 100) / 90) * (Math.PI / 2)), 0.8));
  const keelZ = (x: number) => Math.pow(Math.max(0, (x - 110) / 80), 2) * 26;
  const chineZ = (x: number) => 10 + keelZ(x) * 0.5;
  const h = (x: number, y: number, z: number) => iso(x, y, z, 70, 350);
  const xs = Array.from({ length: 11 }, (_, i) => (HL * i) / 10);
  const deckL = xs.map((x) => h(x, yc - half(x) * 1.08, 26)), deckR = xs.map((x) => h(x, yc + half(x) * 1.08, 26));
  const section = (x: number) => polyline([h(x, yc - half(x) * 1.08, 26), h(x, yc - half(x), chineZ(x)), h(x, yc, keelZ(x)), h(x, yc + half(x), chineZ(x)), h(x, yc + half(x) * 1.08, 26)]);
  const opening = poly([h(60, yc - 18, 26), h(120, yc - 18, 26), h(120, yc + 18, 26), h(60, yc + 18, 26)]);
  // hatch cover floating above the opening
  const hc = (x: number, y: number, z: number) => iso(x, y, z, 112, 238);
  const screws = [[7, 7], [63, 7], [63, 37], [7, 37]].map(([x, y]) => ell(...hc(x, y, 4), 2.2, 1.2)).join("");
  // drivetrain along the boat's length axis: motor, coupling, shaft, propeller
  const A: Pt = [30, 522], mL = 56, mr = 11;
  const at = (s: number, t = 0): Pt => [f(A[0] + (s + t) * U[0]), f(A[1] + (s + t) * U[1])];
  const shaftA = at(mL + 22), propC = at(mL + 22 + 70 + 16);
  const motor = hcyl(...A, mL, mr, [0.2, 0.35, 0.5, 0.65, 0.8]) + hcyl(...at(mL), 10, 4) + isoBox(...(iso(0, 0, 0, at(mL / 2)[0] - 6, at(mL / 2)[1] - mr * 1.5) as Pt), 12, 8, 6);
  // rudder: fin, stock and servo arm
  const rd = (x: number, y: number, z: number) => iso(x, y, z, 104, 706);
  const fin = poly([rd(0, 0, 0), rd(28, 0, 0), rd(22, 0, -40), rd(4, 0, -44)]) + poly([rd(0, 5, 0), rd(28, 5, 0), rd(22, 5, -40), rd(4, 5, -44)]) +
    line(...rd(28, 0, 0), ...rd(28, 5, 0)) + line(...rd(22, 0, -40), ...rd(22, 5, -40)) + line(...rd(4, 0, -44), ...rd(4, 5, -44));
  const stock = vcyl(...rd(14, 2, 0), 2.5, 24);
  const arm = isoBox(...(rd(14, 2, 24)), 22, 4, 3);
  return (
    <>
      <D d={poly([...deckL, ...deckR.reverse()])} />
      <D d={polyline(xs.map((x) => h(x, yc - half(x), chineZ(x)))) + polyline(xs.map((x) => h(x, yc + half(x), chineZ(x)))) + polyline(xs.map((x) => h(x, yc, keelZ(x))))} opacity={0.8} />
      <D d={[0, 20, 60, 100, 140].map(section).join("")} opacity={0.55} />
      <D d={opening} opacity={0.6} />
      <D d={isoBox(112, 238, 70, 44, 4) + screws + isoBox(...hc(26, 20, 4), 18, 5, 5)} />
      {dash(...hc(35, 22, 0), ...h(90, yc, 26))}
      {balloon(256, 214, 5)}{dash(248, 219, ...hc(66, 6, 4))}{dot(...hc(66, 6, 4))}
      {balloon(262, 372, 6)}{dash(254, 377, ...h(170, yc, 24))}{dot(...h(170, yc, 24))}
      <path d={line(...at(-26), ...at(mL + 22 + 70 + 56))} strokeDasharray="3 5" opacity={0.5} />
      <D d={motor} />
      <D d={hcyl(...at(mL + 10), 12, 4.5) + hcyl(...shaftA, 70, 2.5)} />
      <D d={hcyl(propC[0] - 4.3, propC[1] - 2.5, 10, 5) + propeller(...propC, 24, 5)} />
      {balloon(30, 500, 7)}{dash(39, 504, ...at(-4))}{dot(...at(mL * 0.35, 0))}
      {balloon(150, 560, 8)}{dash(150, 569, ...at(mL + 22 + 30, -6))}
      {balloon(244, 586, 9)}{dash(238, 592, ...at(mL + 22 + 70 + 24, 0))}
      <D d={fin + stock + arm} />
      {dash(...rd(14, 2, 24), ...rd(14, 2, 66))}
      {balloon(214, 718, 10)}{dash(205, 720, ...rd(26, 4, -16))}{dot(...rd(14, 2, 0))}
      <T x={24} y={776} s={8}>5  HATCH COVER</T>
      <T x={24} y={790} s={8}>6  HULL SHELL</T>
      <T x={24} y={804} s={8}>7  MOTOR</T>
      <T x={150} y={776} s={8}>8  DRIVESHAFT</T>
      <T x={150} y={790} s={8}>9  PROPELLER</T>
      <T x={150} y={804} s={8}>10 RUDDER</T>
      <T x={150} y={826} s={8}>FIG. 1  EXPLODED VIEW</T>
    </>
  );
}

export const LEFT_SCENES = [BodyPlan, PlaningFreeBody, PlanView, ExplodedElectronics];
export const RIGHT_SCENES = [SheerProfile, WettedPlanform, ProfileArrangement, ExplodedHull];
