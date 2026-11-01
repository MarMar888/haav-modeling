"""Rebuild the Markdown report's charts from results.json (requires matplotlib)."""
import json
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
os.environ.setdefault("MPLCONFIGDIR", str(HERE / ".matplotlib"))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

rows = json.loads((HERE / "results.json").read_text())["results"]
solved = [r for r in rows if "trim_deg" in r]
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10,
                     "axes.spines.top": False, "axes.spines.right": False})
fig, axes = plt.subplots(2, 2, figsize=(11, 8))
fig.subplots_adjust(left=.08, right=.97, top=.86, bottom=.18, hspace=.48, wspace=.25)
specs = [
    ("total_thrust_lbf", "Total shaft thrust", "Thrust (lbf)", 0, 32),
    ("trim_deg", "Running trim", "Bow-up trim (degrees)", 0, 13),
    ("effective_power_kw", "Effective power", "Power (kW)", 0, 1.6),
    ("keel_wetted_in", "Predicted wetted keel length", "Length (inches)", 0, 80),
]
for ax, (key, title, label, low, high) in zip(axes.flat, specs):
    ax.axvspan(0, 3, color="#e5e7eb", alpha=.8)
    ax.axvspan(3.5, 8.5, color="#fff0d9", alpha=.8)
    # Dashed 4–8 mph region remains connected to 9 mph without implying
    # interpolation through the unmodeled 1–3 mph gap.
    for a, b in zip(solved, solved[1:]):
        outside = a["status"] == "outside_limits" or b["status"] == "outside_limits"
        ax.plot([a["speed_mph"], b["speed_mph"]], [a[key], b[key]],
                color="#b56516" if outside else "#2166a5",
                linestyle="--" if outside else "-", linewidth=2)
    for r in solved:
        ax.plot(r["speed_mph"], r[key], "o", markersize=3,
                color="#b56516" if r["status"] == "outside_limits" else "#2166a5")
    end = solved[-1]
    ax.annotate(f'{end[key]:.2f}', (30, end[key]), xytext=(-8, 9),
                textcoords="offset points", ha="right", color="#174b79", weight="bold")
    if key == "effective_power_kw":
        ax.plot(0, 0, "o", color="#555", markersize=4)
    if key == "keel_wetted_in":
        ax.axhline(38, color="#9f3038", linestyle=":", linewidth=1.5)
        ax.text(2, 34, "38 in: assumed uniform aft section", fontsize=9, color="#9f3038")
        ax.axhline(72, color="#555", linestyle=":", linewidth=1)
        ax.text(15, 74, "72 in: overall hull length", fontsize=9, color="#555")
    ax.set(title=title, xlabel="Speed (mph)", ylabel=label, xlim=(0, 31), ylim=(low, high))
    ax.set_xticks(range(0, 31, 5))
    ax.grid(axis="y", alpha=.2)
    ax.set_axisbelow(True)
fig.suptitle("Current hull · preliminary Savitsky estimates", fontsize=18, weight="bold", y=.97)
fig.text(.5, .915, "125.249 lb loaded  |  12 in chine beam  |  13.16° equivalent V  |  15° thrust angle",
         ha="center", fontsize=10, color="#444")
fig.legend(handles=[
    Line2D([], [], color="#2166a5", linewidth=2, label="Equivalent-hull estimate"),
    Line2D([], [], color="#b56516", linestyle="--", linewidth=2, label="Also outside empirical wetting limit"),
], loc="lower center", bbox_to_anchor=(.5, .085), ncol=2, frameon=False)
fig.text(.5, .035,
         "All solved points wet beyond the assumed 38-inch uniform section; actual curved-hull performance is unvalidated.\n"
         "1–3 mph unavailable. Power excludes propulsion losses. Total thrust is shared by both propellers.",
         ha="center", fontsize=9, color="#444", linespacing=1.6)
for extension in ("png", "svg"):
    dest = HERE / f"performance-charts.{extension}"
    fig.savefig(dest, dpi=180, facecolor="white")
    print(dest)
