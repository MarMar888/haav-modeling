"""Dimensioned drawings of the hull, generated from hull.py so they can't drift.

Run from cad/:   ../.venv-cad/bin/python drawings/make_drawings.py

Writes into drawings/:
  hull-dimensions.png / .pdf   general arrangement: profile, plan, two sections
  hull-offsets.png / .pdf      body plan + table of offsets (rebuild the hull from this)
  offsets.csv                  the same offsets at 5% spacing, for importing into CAD

Drawing datums (not the same as hull.py's internal origin):
  x = distance forward of the transom, mm
  h = height above the BASELINE, mm (baseline = bottom of the keel at the transom)
  hull.py's CAD coordinates are y = x - 390, z = h - 230.
"""
import csv
import re
from math import tan, radians, degrees, atan

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Arc, Circle, Polygon, Rectangle

# --------------------------------------------------------------- pull the geometry
SRC = open("hull.py").read()
g = {}
exec(SRC[: SRC.index("# ---------------------------------------------------------------------- hull")], g)
exec(SRC[SRC.index("def tube_path(t):") : SRC.index("def _unit(v):")], g)


def nums(pattern):
    return [float(v) for v in re.search(pattern, SRC, re.M).groups()]


(PEL_Y,) = nums(r"^PEL_Y = ([-\d.]+)")
(BASE_Z,) = nums(r"^BASE_Z\s*=\s*([-\d.]+)")
(BASE_THK,) = nums(r"^BASE_THK\s*=\s*([-\d.]+)")
TWR_Y, SHELF_Z = nums(r"^TWR_Y, SHELF_Z = ([-\d.]+), ([-\d.]+)")
POD_X, POD_Z, PROP_R = nums(r"^POD_X, POD_Z, PROP_R = ([-\d.]+), ([-\d.]+), ([-\d.]+)")

T0, LOA, K0 = g["TRANSOM_Y"], g["LOA"], g["KEEL_Z_AFT"]
TUBE_R, WL_Z, FLANGE, SHELL = g["TUBE_R"], g["WATERLINE_Z"], g["FLANGE"], g["SHELL"]
deadrise, keel_z, chine_hb = g["deadrise"], g["keel_z"], g["chine_hb"]
sheer_hb, sheer_z = g["sheer_hb"], g["sheer_z"]
tube_path, tube_r = g["tube_path"], g["tube_r"]

X = lambda y: y - T0  # CAD y -> from transom
H = lambda z: z - K0  # CAD z -> above baseline
WL = H(WL_Z)


def section(t):
    """Half-section at station t: keel, chine and sheer, in drawing coordinates."""
    kz, chb, shb, sz = keel_z(t), chine_hb(t), sheer_hb(t), sheer_z(t)
    cz = kz + chb * tan(radians(deadrise(t)))
    return dict(x=LOA * t, keel=H(kz), chb=chb, chine=H(cz), shb=shb, sheer=H(sz), dr=deadrise(t))


N = 241
TS = [i / (N - 1) for i in range(N)]
SEC = [section(t) for t in TS]
TT = [-0.05 + 1.05 * i / (N - 1) for i in range(N)]  # tube runs aft of the transom
TUBE = [(tube_path(t), tube_r(t)) for t in TT]

s0, s_mid = section(0.0), section(0.5)
max_beam = 2 * max(s["shb"] for s in SEC)
tube_beam = 2 * max(p[0] + r for p, r in TUBE)
tube_aft = min(X(p[1]) for p, _ in TUBE)
tube_fwd = max(X(p[1]) for p, _ in TUBE)
top_bow = SEC[-1]["sheer"]
prop_bottom = H(POD_Z - PROP_R)
LCG_X = 0.35 * LOA
PEL_X0, PEL_X1 = X(PEL_Y) - 135, X(PEL_Y) + 135
BASE_H = H(BASE_Z)
PEL_H0, PEL_H1 = BASE_H + BASE_THK, BASE_H + BASE_THK + 124
MM_IN = 25.4

# --------------------------------------------------------------- drawing helpers
INK, DIM, CHINE, WATER = "#111", "#b03a2e", "#1f5fbf", "#1a9bd6"
TUBEC, PAY, POD = "#e9967a", "#9aa0a6", "#2e8b57"


def fmt(mm, inch=True):
    return f"{mm:.0f}" + (f"  ({mm / MM_IN:.1f}\")" if inch else "")


def hdim(ax, x1, x2, y, text, y1=None, y2=None, fs=9, below=False):
    for x, yy in ((x1, y1), (x2, y2)):
        if yy is not None:
            ax.plot([x, x], [yy, y], color=DIM, lw=0.5, ls=(0, (2, 2)))
    ax.annotate("", xy=(x1, y), xytext=(x2, y),
                arrowprops=dict(arrowstyle="<|-|>", color=DIM, lw=0.8, mutation_scale=7))
    ax.text((x1 + x2) / 2, y, text, color=DIM, fontsize=fs, ha="center",
            va="top" if below else "bottom",
            bbox=dict(fc="white", ec="none", pad=0.6, alpha=0.9))


def vdim(ax, y1, y2, x, text, x1=None, x2=None, fs=9, left=False):
    for y, xx in ((y1, x1), (y2, x2)):
        if xx is not None:
            ax.plot([xx, x], [y, y], color=DIM, lw=0.5, ls=(0, (2, 2)))
    ax.annotate("", xy=(x, y1), xytext=(x, y2),
                arrowprops=dict(arrowstyle="<|-|>", color=DIM, lw=0.8, mutation_scale=7))
    ax.text(x, (y1 + y2) / 2, text, color=DIM, fontsize=fs, rotation=90,
            ha="right" if left else "left", va="center",
            bbox=dict(fc="white", ec="none", pad=0.6, alpha=0.9))


def note(ax, x, y, text, fs=8.5, color="#333", **kw):
    ax.text(x, y, text, fontsize=fs, color=color, **kw)


def frame(ax, title, fill=False):
    ax.set_aspect("equal", adjustable="datalim" if fill else "box")
    ax.set_title(title, loc="left", fontsize=12, fontweight="bold", pad=6)
    ax.tick_params(labelsize=7, colors="#888")
    for s in ax.spines.values():
        s.set_color("#ccc")
    ax.grid(True, color="#eee", lw=0.5)


# --------------------------------------------------------------- sheet 1
fig = plt.figure(figsize=(26, 19))
gs = fig.add_gridspec(3, 4, height_ratios=[7.4, 7.0, 4.2], width_ratios=[1, 1, 1, 1.08],
                      hspace=0.16, wspace=0.10, left=0.03, right=0.99, top=0.93, bottom=0.02)
fig.suptitle("Project Hav — hull dimensions (deep-V RIB, v5)", fontsize=20, fontweight="bold",
             x=0.035, ha="left")
fig.text(0.035, 0.945, "All dimensions in mm (inches in brackets).  x = forward of transom, "
         "h = above baseline (keel at transom).  Generated from hull/geometry/legacy-parametric/hull.py — "
         "regenerate, don't hand-edit.", fontsize=10.5, color="#555")

# ---- side profile
ax = fig.add_subplot(gs[0, :3])
frame(ax, "PROFILE  (starboard side, bow to the right)")
xs = [s["x"] for s in SEC]
tx = [X(p[1]) for p, _ in TUBE]
ax.fill_between(tx, [p[2] - K0 - r for p, r in TUBE], [p[2] - K0 + r for p, r in TUBE],
                color=TUBEC, alpha=0.35, lw=0, label="tube (5\")")
ax.plot(tx, [p[2] - K0 + r for p, r in TUBE], color=TUBEC, lw=1)
ax.plot(tx, [p[2] - K0 - r for p, r in TUBE], color=TUBEC, lw=1)
ax.plot(xs, [s["keel"] for s in SEC], color=INK, lw=1.8, label="hull outline (glassed)")
ax.plot(xs, [s["sheer"] for s in SEC], color=INK, lw=1.8)
ax.plot(xs, [s["chine"] for s in SEC], color=CHINE, lw=1.1, ls="--", label="chine")
ax.plot([0, 0], [s0["keel"], s0["sheer"]], color=INK, lw=1.8)
ax.plot([LOA, LOA], [SEC[-1]["keel"], SEC[-1]["sheer"]], color=INK, lw=1.8)
ax.axhline(WL, color=WATER, lw=1.2, ls="-.")
note(ax, 700, WL + 5, "static waterline @ 62 lb", color=WATER, fs=9.5)
ax.axhline(0, color="#777", lw=0.8)
note(ax, 1330, 4, "baseline", color="#777", ha="right")
# payload (light)
ax.add_patch(Rectangle((40, BASE_H), 810, BASE_THK, fc=PAY, ec="none", alpha=0.6))
ax.add_patch(Rectangle((PEL_X0, PEL_H0), 270, 124, fc="none", ec=PAY, lw=1.2))
note(ax, (PEL_X0 + PEL_X1) / 2, PEL_H0 + 55, "Pelican\n1200", ha="center", color="#777", fs=8)
note(ax, 450, BASE_H - 16, "baseboard", color="#777", ha="center", fs=8)
twx = X(TWR_Y)
ax.add_patch(Polygon([(twx - 37, PEL_H0), (twx - 23, H(SHELF_Z)), (twx + 23, H(SHELF_Z)),
                      (twx + 37, PEL_H0)], fc="none", ec=PAY, lw=1))
ax.add_patch(Rectangle((twx - 65, H(SHELF_Z)), 130, 6, fc="none", ec=PAY))
ax.add_patch(Rectangle((twx + 26 - 28, H(SHELF_Z) + 6), 56, 42, fc="none", ec=PAY))
note(ax, twx + 70, H(SHELF_Z) + 20, "lidar", color="#777", fs=8)
note(ax, twx - 70, H(SHELF_Z) - 60, "sensor\ntower", color="#777", fs=8, ha="right")
# pod + prop
ax.add_patch(Rectangle((-10, H(POD_Z) - 32.75), 150, 65.5, fc=POD, alpha=0.25, ec=POD))
ax.plot([-28, -28], [H(POD_Z) - PROP_R, H(POD_Z) + PROP_R], color=POD, lw=3)
note(ax, 150, H(POD_Z) - 5, "Flipsky 65150 pod", color=POD, fs=8.5)
# LCG
ax.plot(LCG_X, WL - 30, marker="$\\oplus$", ms=16, color="#7b2cbf")
note(ax, LCG_X + 14, WL - 44, "LCG", color="#7b2cbf", fs=9.5)
# dims
hdim(ax, 0, LOA, -150, f"LOA hull  {fmt(LOA)}", y1=s0["keel"], y2=SEC[-1]["keel"])
hdim(ax, tube_aft, tube_fwd, -205, f"LOA over tubes  {fmt(tube_fwd - tube_aft)}",
     y1=-40, y2=H(tube_path(1.0)[2]))
hdim(ax, 0, LCG_X, WL - 90, f"LCG {fmt(LCG_X)}  = 35% LOA", y1=0, y2=WL - 30, fs=8.5)
hdim(ax, 0, 0.55 * LOA, -95, f"straight run (keel rises only 5 mm)  {fmt(0.55 * LOA, False)}", fs=8)
hdim(ax, PEL_X0, PEL_X1, PEL_H1 + 20, f"{PEL_X0:.0f} – {PEL_X1:.0f}", y1=PEL_H1, y2=PEL_H1, fs=8)
hdim(ax, -28, 0, H(POD_Z) - PROP_R - 20, "28", fs=8, below=True)
vdim(ax, 0, s0["sheer"], -120, f"depth @ transom  {fmt(s0['sheer'])}", x1=0, x2=0, left=True)
vdim(ax, 0, WL, -55, f"draft {fmt(WL)}", left=True, fs=8.5)
vdim(ax, WL, s0["sheer"], 55, f"freeboard {fmt(s0['sheer'] - WL, False)}", x1=0, x2=0, fs=8)
vdim(ax, prop_bottom, WL, -200, f"draft to prop tips  {fmt(WL - prop_bottom)}",
     x1=-28, x2=0, left=True)
vdim(ax, SEC[-1]["keel"], 0, LOA + 40, f"keel rise {fmt(SEC[-1]['keel'], False)}", x1=LOA)
vdim(ax, 0, top_bow, LOA + 110, f"max height  {fmt(top_bow)}", x1=LOA, x2=LOA)
vdim(ax, s0["sheer"], top_bow, LOA - 80, f"sheer rise {fmt(top_bow - s0['sheer'], False)}",
     x1=0, fs=8, left=True)
ax.set_xlim(-280, 1420)
ax.set_ylim(-240, 480)
ax.legend(loc="upper left", fontsize=8.5, ncol=4, framealpha=0.95)

# ---- plan view
ax = fig.add_subplot(gs[1, :3])
frame(ax, "PLAN  (looking down, bow to the right)")
ax.fill_between(tx, [-(p[0] + r) for p, r in TUBE], [p[0] + r for p, r in TUBE],
                color=TUBEC, alpha=0.18, lw=0)
for sgn in (1, -1):
    ax.plot(tx, [sgn * (p[0] + r) for p, r in TUBE], color=TUBEC, lw=1)
    ax.plot(tx, [sgn * p[0] for p, _ in TUBE], color=TUBEC, lw=0.6, ls=":")
    ax.plot(xs, [sgn * s["shb"] for s in SEC], color=INK, lw=1.8)
    ax.plot(xs, [sgn * s["chb"] for s in SEC], color=CHINE, lw=1.1, ls="--")
    op = [(s["x"], sgn * (s["shb"] - FLANGE)) for s in SEC if 16 <= s["x"] <= 0.9 * LOA]
    ax.plot(*zip(*op), color="#555", lw=0.8, ls=(0, (4, 2)))
    ax.add_patch(Rectangle((-10, sgn * POD_X - 32.75), 150, 65.5, fc=POD, alpha=0.25, ec=POD))
    ax.plot([-28, -28], [sgn * POD_X - PROP_R, sgn * POD_X + PROP_R], color=POD, lw=3)
ax.plot([0, 0], [-s0["shb"], s0["shb"]], color=INK, lw=1.8)
ax.axhline(0, color="#999", lw=0.6, ls="-.")
ax.add_patch(Rectangle((PEL_X0, -123), 270, 246, fc="none", ec=PAY, lw=1.2))
note(ax, (PEL_X0 + PEL_X1) / 2, 0, "Pelican 1200\n270 × 246", ha="center", va="center",
     color="#777", fs=8)
ax.add_patch(Rectangle((twx - 75, -75), 150, 150, fc="none", ec=PAY, lw=1))
note(ax, twx, 0, "tower\nbase", ha="center", va="center", color="#777", fs=8)
imax = max(range(N), key=lambda i: SEC[i]["shb"])
xb = SEC[imax]["x"]
vdim(ax, -max_beam / 2, max_beam / 2, xb, f"max rigid beam  {fmt(max_beam)}", fs=8.5)
vdim(ax, -s0["chb"], s0["chb"], 120, f"chine beam\n{fmt(2 * s0['chb'])}", fs=8)
vdim(ax, -s0["shb"], s0["shb"], -110, f"transom {fmt(2 * s0['shb'])}", x1=0, x2=0, left=True, fs=8.5)
vdim(ax, -tube_beam / 2, tube_beam / 2, 1180, f"beam over tubes  {fmt(tube_beam)}", fs=8.5)
vdim(ax, -(s0["shb"] - FLANGE), s0["shb"] - FLANGE, 300,
     f"deck opening {fmt(2 * (s0['shb'] - FLANGE), False)}", fs=8)
vdim(ax, -POD_X, POD_X, -190, f"pods ±{POD_X:.0f}", left=True, fs=8.5)
note(ax, 140, -s0["chb"] - 22, "chine", color=CHINE, fs=8)
note(ax, 560, s0["shb"] - FLANGE - 26, "deck flange (35 wide)", color="#555", fs=8)
ax.set_xlim(-260, 1420)
ax.set_ylim(-335, 335)

# ---- sections
def draw_section(ax, s, title, extras, chine_above=False, dr_at=(105, -4)):
    frame(ax, title)
    kz, chb, cz, shb, sz = 0, s["chb"], s["chine"] - s["keel"], s["shb"], s["sheer"] - s["keel"]
    base = s["keel"]
    pts = [(-shb, sz), (-chb, cz), (0, 0), (chb, cz), (shb, sz)]
    pts = [(x, y + base) for x, y in pts]
    tp = tube_path(s["x"] / LOA)
    for sgn in (1, -1):
        ax.add_patch(Circle((sgn * tp[0], H(tp[2])), TUBE_R, fc=TUBEC, ec=TUBEC, alpha=0.35))
    ax.add_patch(Polygon(pts, closed=False, fill=False, ec=INK, lw=2))
    ax.plot([-shb, shb], [sz + base] * 2, color="#555", lw=0.8, ls=(0, (4, 2)))
    ax.axhline(WL, color=WATER, lw=1.2, ls="-.")
    ax.axhline(0, color="#777", lw=0.8)
    ax.axvline(0, color="#999", lw=0.6, ls="-.")
    ax.add_patch(Arc((0, base), 180, 180, theta1=0, theta2=s["dr"], color=DIM, lw=1))
    ax.plot([0, 110], [base, base], color=DIM, lw=0.6, ls=":")
    note(ax, dr_at[0], base + dr_at[1], f"{s['dr']:.0f}° deadrise", color=DIM, fs=9, va="top")
    vdim(ax, base, sz + base, shb + 95, f"depth {fmt(sz, False)}", x1=shb, x2=shb, fs=8.5)
    cy = cz + base + (22 if chine_above else -30)
    hdim(ax, -chb, chb, cy, f"chine {fmt(2 * chb, False)}", y1=cz + base, y2=cz + base,
         fs=8.5, below=not chine_above)
    hdim(ax, -shb, shb, sz + base + 90, f"sheer {fmt(2 * shb, False)}", y1=sz + base, y2=sz + base, fs=8.5)
    ax.plot(0, 0, "o", color="#777", ms=3)
    note(ax, 8, -18, "baseline", color="#777", fs=7.5)
    extras(ax, s)
    ax.set_xlim(-360, 360)


def transom_extras(ax, s):
    for sgn in (1, -1):
        ax.add_patch(Circle((sgn * POD_X, H(POD_Z)), PROP_R, fc="none", ec=POD, lw=1.5))
        ax.add_patch(Circle((sgn * POD_X, H(POD_Z)), 32.75, fc=POD, alpha=0.25, ec=POD))
    hdim(ax, -POD_X, POD_X, H(POD_Z) - PROP_R - 26, f"pods {2 * POD_X:.0f} apart",
         y1=H(POD_Z), y2=H(POD_Z), fs=8.5, below=True)
    vdim(ax, H(POD_Z) - PROP_R, H(POD_Z) + PROP_R, POD_X + PROP_R + 20, "prop Ø120", fs=8)
    tp = tube_path(0.0)
    note(ax, -tp[0], H(tp[2]) + TUBE_R + 8, "tube Ø127", ha="center", color="#b5563b", fs=8.5)
    ax.set_ylim(-150, 330)


def mid_extras(ax, s):
    ax.add_patch(Rectangle((-135, BASE_H), 270, BASE_THK, fc=PAY, alpha=0.6, ec="none"))
    ax.add_patch(Rectangle((-123, PEL_H0), 246, 124, fc="none", ec=PAY, lw=1.3))
    note(ax, 0, PEL_H0 + 62, "Pelican 1200\n246 wide", ha="center", va="center", color="#777", fs=8)
    vdim(ax, 0, BASE_H, -200, f"baseboard {BASE_H:.1f}", x2=-120, left=True, fs=8.5)
    ax.set_ylim(-60, 370)


draw_section(fig.add_subplot(gs[0, 3]), s0, "SECTION AT TRANSOM  (looking forward)", transom_extras, chine_above=True, dr_at=(40, 50))
draw_section(fig.add_subplot(gs[1, 3]), s_mid, f"SECTION AT MIDSHIPS  (x = {s_mid['x']:.0f})", mid_extras)

# ---- key numbers + constraints
rows = [
    ("LENGTH & BEAM", ""),
    ("LOA hull / over tubes", f"{LOA:.0f} / {tube_fwd - tube_aft:.0f}   ({LOA / MM_IN:.1f}\" / {(tube_fwd - tube_aft) / MM_IN:.1f}\")"),
    ("Chine beam / max rigid beam / over tubes",
     f"{2 * s0['chb']:.0f} / {max_beam:.0f} / {tube_beam:.0f}   ({tube_beam / MM_IN:.1f}\"; 591 over rub strake)"),
    ("L / B (chine)", f"{LOA / (2 * s0['chb']):.2f}"),
    ("DEPTH & DRAFT", ""),
    ("Depth @ transom / max height", f"{s0['sheer']:.1f} / {top_bow:.1f}"),
    ("Draft @ 62 lb / to prop tips", f"{WL:.1f} / {WL - prop_bottom:.1f}   ({WL / MM_IN:.1f}\" / {(WL - prop_bottom) / MM_IN:.1f}\")"),
    ("Freeboard @ transom (to rigid sheer)", f"{s0['sheer'] - WL:.1f}"),
    ("SHAPE", ""),
    ("Deadrise", "16° to 35% LOA → 26° at 85% → 40° at stem"),
    ("Keel", "straight for aft 55% (5 mm rise), then +200 to stem"),
    ("Sheer rise / topside flare", "110 mm to bow / 15 mm aft → 45 mm fwd"),
    ("Hull shell", f"3 mm PETG + 1.2 mm glass skin = {SHELL:.1f}; transom 16"),
    ("PAYLOAD & PROPULSION", ""),
    ("LCG", f"{LCG_X:.0f} fwd of transom (35% LOA)"),
    ("Pods / props", f"±{POD_X:.0f} off CL, axis {-H(POD_Z):.0f} below baseline, Ø{2 * PROP_R:.0f}, 28 aft of transom"),
    ("Baseboard / Pelican", f"h {BASE_H:.1f}, 1/4\" ply  /  x {PEL_X0:.0f}–{PEL_X1:.0f}"),
    ("Tubes", f"Ø{2 * TUBE_R:.0f} (5\"), centred on the sheer, {-tube_aft:.0f} aft of transom"),
    ("BINDING CONSTRAINTS", ""),
    ("Printer Z (H2D 325)", f"hull height {top_bow:.0f} → {325 - top_bow:.0f} mm spare"),
    ("Prop tip vs chine", f"{POD_X + PROP_R:.0f} vs {s0['chb']:.0f} → {s0['chb'] - POD_X - PROP_R:.0f} mm spare"),
    ("Pod crown to hull bottom", "27.5 mm — all the bracket gets"),
    ("Pelican in the V", "baseboard height set by where the V fits 246 mm"),
]
# split into groups, then lay the groups out in three columns
groups, cur = [], None
for k, v in rows:
    if not v:
        cur = [k, []]
        groups.append(cur)
    else:
        cur[1].append((k, v))
cols = [groups[0:2], groups[2:4], groups[4:]]
sub = gs[2, :].subgridspec(1, 3, wspace=0.05)
for ci, col in enumerate(cols):
    ax = fig.add_subplot(sub[0, ci])
    ax.axis("off")
    y = 0.97
    for head, items in col:
        ax.text(0.0, y, head, fontsize=11, fontweight="bold", color=DIM, transform=ax.transAxes)
        y -= 0.1
        for k, v in items:
            ax.text(0.01, y, k, fontsize=10, color="#333", transform=ax.transAxes)
            ax.text(0.40, y, v, fontsize=10, color="#111", family="monospace", transform=ax.transAxes)
            y -= 0.087
        y -= 0.04

for ext in ("png", "pdf"):
    fig.savefig(f"drawings/hull-dimensions.{ext}", dpi=150)
plt.close(fig)

# --------------------------------------------------------------- sheet 2: offsets
TABLE_TS = [i / 10 for i in range(11)]
fig = plt.figure(figsize=(24, 9.5))
gs = fig.add_gridspec(1, 2, width_ratios=[1, 1.35], left=0.035, right=0.985, top=0.86,
                      bottom=0.07, wspace=0.08)
fig.suptitle("Project Hav — body plan & table of offsets", fontsize=20, fontweight="bold",
             x=0.035, ha="left")
fig.text(0.035, 0.895, "Outside of the glassed hull (the print is 1.2 mm inside this).  "
         "Each section is straight lines: keel → chine → sheer.  "
         "Stations are 10% of LOA (123 mm) apart, 0 = transom.", fontsize=10.5, color="#555")

ax = fig.add_subplot(gs[0, 0])
frame(ax, "BODY PLAN  (aft stations left, forward stations right)")
cmap = plt.get_cmap("viridis")
for i, t in enumerate(TABLE_TS):
    s = section(t)
    sgn = -1 if t <= 0.5 else 1
    xs_ = [0, sgn * s["chb"], sgn * s["shb"]]
    ys_ = [s["keel"], s["chine"], s["sheer"]]
    ax.plot(xs_, ys_, color=cmap(i / 10), lw=1.6)
    ax.text(sgn * (s["shb"] + 6), s["sheer"] + 4, f"{i}", fontsize=9, color=cmap(i / 10),
            ha="left" if sgn > 0 else "right")
ax.axhline(WL, color=WATER, lw=1.2, ls="-.")
note(ax, 250, WL + 5, "WL @ 62 lb", color=WATER, fs=9)
ax.axvline(0, color="#999", lw=0.8)
ax.axhline(0, color="#777", lw=0.8)
ax.set_xlim(-290, 290)
ax.set_ylim(-20, 330)
ax.set_xlabel("half-breadth (mm)", fontsize=9)
ax.set_ylabel("height above baseline (mm)", fontsize=9)

ax = fig.add_subplot(gs[0, 1])
ax.axis("off")
cols = ["Stn", "x fwd of\ntransom", "keel h", "deadrise", "chine\nhalf-breadth", "chine h",
        "sheer\nhalf-breadth", "sheer h", "tube ctr\nhalf-breadth", "tube ctr h"]
cells = []
for i, t in enumerate(TABLE_TS):
    s = section(t)
    tp = tube_path(t)
    cells.append([f"{i}", f"{s['x']:.0f}", f"{s['keel']:.1f}", f"{s['dr']:.1f}°", f"{s['chb']:.1f}",
                  f"{s['chine']:.1f}", f"{s['shb']:.1f}", f"{s['sheer']:.1f}", f"{tp[0]:.1f}",
                  f"{H(tp[2]):.1f}"])
tb = ax.table(cellText=cells, colLabels=cols, loc="upper center", cellLoc="center")
tb.auto_set_font_size(False)
tb.set_fontsize(11)
tb.scale(1, 2.6)
for (r, c), cell in tb.get_celld().items():
    cell.set_edgecolor("#ccc")
    if r == 0:
        cell.set_facecolor("#f1f3f5")
        cell.set_text_props(fontweight="bold")
ax.text(0.0, 0.02, "All mm.  Tube centre = the sweep path of the 127 mm tube "
        "(it follows the sheer aft, then lifts and converges to the bow point).\n"
        f"Full 5%-spacing offsets, plus the tube path, are in drawings/offsets.csv.",
        fontsize=10, color="#555", transform=ax.transAxes)

for ext in ("png", "pdf"):
    fig.savefig(f"drawings/hull-offsets.{ext}", dpi=150)
plt.close(fig)

# --------------------------------------------------------------- CSV
with open("drawings/offsets.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["station_pct", "x_from_transom_mm", "keel_h_mm", "deadrise_deg",
                "chine_halfbreadth_mm", "chine_h_mm", "sheer_halfbreadth_mm", "sheer_h_mm",
                "tube_centre_halfbreadth_mm", "tube_centre_h_mm", "tube_radius_mm"])
    for pct in range(0, 101, 5):
        t = pct / 100
        s, tp = section(t), tube_path(t)
        w.writerow([pct, f"{s['x']:.1f}", f"{s['keel']:.2f}", f"{s['dr']:.2f}", f"{s['chb']:.2f}",
                    f"{s['chine']:.2f}", f"{s['shb']:.2f}", f"{s['sheer']:.2f}", f"{tp[0]:.2f}",
                    f"{H(tp[2]):.2f}", f"{tube_r(t):.2f}"])

print("wrote drawings/hull-dimensions.{png,pdf}, drawings/hull-offsets.{png,pdf}, drawings/offsets.csv")
print(f"LOA {LOA:.0f}  over tubes {tube_fwd - tube_aft:.0f}  rigid beam {max_beam:.1f}  "
      f"tube beam {tube_beam:.1f}  height {top_bow:.1f}  draft {WL:.1f}  prop draft {WL - prop_bottom:.1f}")
