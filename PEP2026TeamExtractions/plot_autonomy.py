#!/usr/bin/env python3
"""Charts of the main design variables for the PEP26 Autonomy division. Reads autonomy_variables.json.

Run with a matplotlib-enabled python: .context/venv/bin/python plot_autonomy.py
"""
import json
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

HERE = Path(__file__).resolve().parent
OUT = HERE / "charts"
OUT.mkdir(exist_ok=True)
T = json.load(open(HERE / "autonomy_variables.json"))["teams"]

# palette: reference categorical slots 1-3 (validated all-pairs), neutral gray for "unknown"
SURFACE, INK, INK2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df"
BLUE, ORANGE, AQUA, GRAY = "#2a78d6", "#eb6834", "#1baf7a", "#a8a79f"
CHEM = {"LiPo": BLUE, "Li-ion": ORANGE, "LiFePO4": AQUA, "Unspecified": GRAY}

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "text.color": INK, "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK,
    "font.family": "sans-serif", "font.size": 10,
})


def frame(title, sub, size=(8.2, 5.0)):
    fig, ax = plt.subplots(figsize=size)
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.grid(axis="x", color=GRID, lw=0.8)
    ax.set_axisbelow(True)
    ax.tick_params(length=0)
    fig.text(0.02, 0.965, title, fontsize=13, fontweight="bold", ha="left", va="top")
    fig.text(0.02, 0.915, sub, fontsize=9, color=INK2, ha="left", va="top")
    return fig, ax


def finish(fig, name, foot=None):
    if foot:
        fig.text(0.02, 0.02, foot, fontsize=8, color=INK2, ha="left", va="bottom")
    fig.subplots_adjust(left=0.25, right=0.95, top=0.84, bottom=(0.19 if "\n" in foot else 0.14) if foot else 0.08)
    fig.savefig(OUT / name, dpi=160)
    plt.close(fig)


def team_axis(ax, label_fn=lambda t: t["team"]):
    ys = list(range(len(T)))[::-1]
    ax.set_yticks(ys)
    ax.set_yticklabels([label_fn(t) for t in T])
    ax.set_ylim(-0.7, len(T) - 0.3)
    return ys


def na(ax, y, x0, text="not stated"):
    ax.text(x0, y, text, va="center", ha="left", fontsize=8.5, color=INK2, style="italic")


# 1. race points -----------------------------------------------------------------
fig, ax = frame("Race points: only 2 of 12 boats finished the course",
                "Autonomy division, team-page race score (max 60). 10 pts per half-mile, plus 20/16/12/8/4 for 1st-5th.")
ys = team_axis(ax)
for y, t in zip(ys, T):
    ax.barh(y, t["race_points"], height=0.55, color=BLUE)
    lab = f'{t["race_points"]:g}'
    if t["race_time_min"]:
        m = int(t["race_time_min"]); s = round((t["race_time_min"] - m) * 60)
        lab += f"   ({m}:{s:02d})"
    ax.text(t["race_points"] + 0.8, y, lab, va="center", fontsize=9)
ax.axvline(40, color=INK2, lw=1, ls=(0, (4, 3)))
ax.text(40.6, len(T) - 0.45, "40 = full 2 miles", fontsize=8.5, color=INK2, va="bottom")
ax.set_xlim(0, 72)
ax.set_xlabel("Race points")
finish(fig, "1_race_points.png", "Times in parentheses are the only two published on the PEP26 page. Longwood posted no paper; its page shows 0.")

# 2. motor power -----------------------------------------------------------------
fig, ax = frame("Installed motor power (kW)",
                "Rated continuous power summed over all motors. Hatched bars are derived, not stated.")
ys = team_axis(ax, lambda t: f'{t["team"]}  ({t["motors"]} motor{"s" if t["motors"] != 1 else ""})' if t["motors"] else f'{t["team"]}  (n/a)')
for y, t in zip(ys, T):
    if t["motor_kw"] is None:
        na(ax, y, 0.3)
        continue
    ax.barh(y, t["motor_kw"], height=0.55, color=BLUE, hatch="////" if t["motor_kw_derived"] else None,
            edgecolor=SURFACE if t["motor_kw_derived"] else BLUE, lw=0)
    ax.text(t["motor_kw"] + 0.4, y, f'{t["motor_kw"]:g}', va="center", fontsize=9)
ax.set_xlim(0, 27)
ax.set_xlabel("kW")
finish(fig, "2_motor_power.png", "JHU uses 2 underwater thrusters (355 N max); a rated power is not given.")

# 3 + 4. battery voltage and energy, colored by chemistry ---------------------------------
def chem_legend(ax):
    h = [Patch(color=c, label=k) for k, c in CHEM.items() if any(t["chemistry"] == k and t["pack_v"] for t in T)]
    ax.legend(handles=h, loc="lower center", bbox_to_anchor=(0.5, 1.0), ncol=len(h), frameon=False, fontsize=9)


fig, ax = frame("Pack voltage (nominal)", "Most teams sit at 12S (44.4 V) to 48 V; the rule caps total voltage at 55.5 V.")
ys = team_axis(ax)
for y, t in zip(ys, T):
    if t["pack_v"] is None:
        na(ax, y, 0.8)
        continue
    ax.barh(y, t["pack_v"], height=0.55, color=CHEM[t["chemistry"]])
    ax.text(t["pack_v"] + 0.8, y, f'{t["pack_v"]:g} V', va="center", fontsize=9, zorder=5,
            bbox=dict(facecolor=SURFACE, edgecolor="none", pad=1.5))
ax.axvline(55.5, color=INK2, lw=1, ls=(0, (4, 3)))
ax.text(55.0, len(T) - 0.45, "55.5 V rule cap", fontsize=8.5, color=INK2, va="bottom", ha="right")
ax.set_xlim(0, 65)
ax.set_xlabel("Volts")
chem_legend(ax)
finish(fig, "3_pack_voltage.png", "W&M's chemistry is not stated in its paper. Stevens plotted at 37 V nominal (paper quotes 42 V full charge).")

fig, ax = frame("Pack energy (Wh)", "Voltage x amp-hours of the main propulsion pack(s). The rule caps capacity at 500 Ah, which nobody approached.")
ys = team_axis(ax)
for y, t in zip(ys, T):
    if t["pack_wh"] is None:
        na(ax, y, 40)
        continue
    ax.barh(y, t["pack_wh"], height=0.55, color=CHEM[t["chemistry"]])
    ax.text(t["pack_wh"] + 50, y, f'{t["pack_wh"]:,}', va="center", fontsize=9)
ax.set_xlim(0, 5800)
ax.set_xlabel("Wh")
chem_legend(ax)
finish(fig, "4_pack_energy.png", "JHU at 19.8 Ah after its planned additions (295 Wh as tested). Pitt's pack capacity is not stated.")

# 5. power vs energy scatter, by race outcome ---------------------------------------
def outcome(t):
    p = t["race_points"]
    return ("Finished the course (40+ pts)", BLUE, "o") if p >= 40 else \
           ("Partial credit (1-39 pts)", ORANGE, "s") if p > 0 else ("No race points", AQUA, "D")

fig, ax = frame("Motor power vs. pack energy, by race outcome",
                "Neither more power nor more energy separates the finishers from the rest.", size=(8.2, 5.4))
seen = {}
for t in T:
    if t["motor_kw"] is None or t["pack_wh"] is None:
        continue
    lab, c, m = outcome(t)
    seen[lab] = (c, m)
    ax.scatter(t["pack_wh"] / 1000, t["motor_kw"], s=110, color=c, marker=m, edgecolor=SURFACE, linewidth=2, zorder=3)
    dx, dy, ha = 0.07, 0.5, "left"
    if t["team"] in ("VCU", "UVA"):
        dx, dy = (0.07, 0.6) if t["team"] == "VCU" else (0.07, -1.1)
    if t["team"] == "Princeton":
        dx, dy, ha = -0.07, -1.1, "right"
    ax.text(t["pack_wh"] / 1000 + dx, t["motor_kw"] + dy, t["team"], fontsize=9, ha=ha, zorder=4)
ax.set_xlabel("Pack energy (kWh)")
ax.set_ylabel("Installed motor power (kW)")
ax.set_xlim(0, 5.5)
ax.set_ylim(4, 26)
ax.grid(axis="y", color=GRID, lw=0.8)
ax.legend(handles=[Line2D([], [], marker=m, color="none", markerfacecolor=c, markeredgecolor=SURFACE, markersize=9, label=l) for l, (c, m) in seen.items()],
          loc="lower left", frameon=False, fontsize=9)
finish(fig, "5_power_vs_energy.png", "Excludes JHU (no motor kW), Pitt, Longwood and Virginia Tech (missing values). VCU, NC State and UVA power is derived.")

# 6. target vs achieved speed ------------------------------------------------------
rows = [t for t in T if t["target_mph"]]
ach = {"W&M": 2 / (7.25 / 60), "VCU": 2 / (38.43 / 60)}
fig, ax = frame("Stated target speed vs. achieved race average (mph)",
                "Only W&M and VCU published race times. Their 2-mile averages sit far below the speeds they designed for.", size=(8.2, 4.6))
ys = list(range(len(rows)))[::-1]
ax.set_yticks(ys); ax.set_yticklabels([t["team"] for t in rows]); ax.set_ylim(-0.7, len(rows) - 0.3)
for y, t in zip(ys, rows):
    ax.scatter(t["target_mph"], y, s=100, color=BLUE, marker="o", zorder=3, edgecolor=SURFACE, linewidth=2)
    ax.text(t["target_mph"] + 0.9, y, f'{t["target_mph"]:g}', va="center", fontsize=9)
    if t["team"] in ach:
        a = ach[t["team"]]
        ax.plot([a, t["target_mph"]], [y, y], color=GRID, lw=2, zorder=1)
        ax.scatter(a, y, s=100, color=ORANGE, marker="D", zorder=3, edgecolor=SURFACE, linewidth=2)
        ax.text(a - 0.9, y, f"{a:.1f}", va="center", ha="right", fontsize=9)
ax.set_xlim(0, 46)
ax.set_xlabel("mph")
ax.tick_params(axis="y", length=0)
ax.legend(handles=[Line2D([], [], marker="o", color="none", markerfacecolor=BLUE, markeredgecolor=SURFACE, markersize=9, label="Target / stated speed"),
                   Line2D([], [], marker="D", color="none", markerfacecolor=ORANGE, markeredgecolor=SURFACE, markersize=8, label="Achieved race average")],
          loc="lower right", frameon=False, fontsize=9)
finish(fig, "6_target_vs_achieved_speed.png", "Targets: W&M tested speed, VCU target, JHU requirement (15 kn), NC State prediction, Illinois 22 kn, Pitt 30 kn, Stevens 20 kn minimum.")

# 7. pack capacity (Ah) -------------------------------------------------------------
fig, ax = frame("Pack capacity (Ah)", "Total amp-hours across all propulsion packs. The rule caps total capacity at 500 Ah; the largest here is 100.")
ys = team_axis(ax)
for y, t in zip(ys, T):
    if t["pack_ah"] is None:
        na(ax, y, 1.5)
        continue
    der = t["pack_ah_derived"]
    ax.barh(y, t["pack_ah"], height=0.55, color=CHEM[t["chemistry"]], hatch="////" if der else None,
            edgecolor=SURFACE if der else CHEM[t["chemistry"]], lw=0)
    ax.text(t["pack_ah"] + 1.2, y, f'{t["pack_ah"]:g} Ah', va="center", fontsize=9)
ax.set_xlim(0, 118)
ax.set_xlabel("Ah")
chem_legend(ax)
finish(fig, "7_pack_ah.png", "Illinois 2 x 30, UVA 2 x 20, Princeton 2 x 16 (one pack per drive). Hatched Kentucky = 4.8 kWh / 48 V.\nJHU shown at its planned 19.8 Ah (13.3 Ah as tested).")
print("wrote", sorted(p.name for p in OUT.glob("*.png")))
