#!/usr/bin/env python3
"""Join the TFL North America SSS motor listing (prices) with TFL's SSS spec sheet and chart it.

Inputs (downloaded earlier into <repo>/.context/tfl/): rows_full.json (product list + prices), blocks.json (spec sheet per series),
Outputs: sss_motors.json and charts/sss_*.png.  Run with .context/venv/bin/python.
Source: https://tflnorthamerica.com/product-category/propulsion/brushless-power-sss/  and  .../wp-content/uploads/2020/07/SSS-Specs-2.pdf
"""
import json
import re
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.ticker import NullFormatter
from matplotlib.lines import Line2D

HERE = Path(__file__).resolve().parent
TFL = HERE.parent / ".context" / "tfl"
OUT = HERE / "charts"
OUT.mkdir(exist_ok=True)

products = [r for r in json.load(open(TFL / "rows_full.json")) if r["prices"]]
blocks = json.load(open(TFL / "blocks.json"))


def find_block(series, ver, kv, ver_explicit):
    cands = [b for b in blocks if b["series"] == series]
    if not cands:
        return None, None
    order = sorted(cands, key=lambda b: b["ver"] != ver)  # preferred version first
    pool = order[:1] if ver_explicit else order
    for tol in (0.015, 0.05):  # exact KV row first, then a near match
        for b in pool:
            for name, bkv, amps, volts in b["rows"]:
                if abs(bkv - kv) <= tol * kv:
                    return b, (bkv, amps, volts)
    best = min(((abs(r[1] - kv) / kv, b, r) for b in order[:1] for r in b["rows"]), default=None, key=lambda t: t[0])
    if best and best[0] <= 0.12:  # nearest winding in the labeled version
        return best[1], best[2][1:]
    return order[0], None


motors = []
for p in products:
    n = p["name"]
    kv_m = re.search(r"/\s*(\d{3,4})\s*kv", n, re.I) or re.search(r"(\d{3,4})\s*kv", n, re.I) or re.search(r"/(\d{4})\b", n)
    ser_m = re.search(r"\b(2960|3650|3656|3660|3674|3682|4074|4082|4092|5684|5694|56104|56114|56123|56135|56154)\b", n)
    if not (kv_m and ser_m):
        continue
    kv, series = int(kv_m.group(1)), ser_m.group(1)
    spec_series = "56133" if series == "56135" else series  # product 56135 matches sheet 56133-V2
    ver_explicit = bool(re.search(r"v-?2|version 2", n, re.I))
    ver = "V2" if ver_explicit else "V1"
    b, row = find_block(spec_series, ver, kv, ver_explicit)
    if b is None:
        continue
    diam = int(series[:2]) if len(series) == 4 else 56
    motors.append({
        "name": n, "url": p["url"], "series": series, "version": b["ver"], "kv": kv,
        "price": min(p["prices"]), "list_price": max(p["prices"]),
        "continuous_w": b["cont"], "max_w": b["max"], "diameter_mm": b["dia"], "length_mm": b["length"],
        "weight_g": b["weight"], "max_rpm": b["rpm_k"] * 1000, "poles": b["poles"],
        "max_amps": row[1] if row else None, "max_volts": row[2] if row else None,
        "water_cooling": "listed without" if re.search(r"w/o water", n, re.I) else "not stated",
        "size_class": "29-36 mm" if b["dia"] <= 36 else "40 mm" if b["dia"] <= 40 else "56 mm",
        "used_in_pep26": series in ("56123", "5684", "56154"),
    })
json.dump(motors, open(HERE / "sss_motors.json", "w"), indent=2)
print(len(motors), "motors joined,", sum(1 for m in motors if m["max_volts"] is None), "without a matching KV row")

# ---------------------------------------------------------------- charts
SURFACE, INK, INK2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df"
BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
CLS = {"29-36 mm": BLUE, "40 mm": ORANGE, "56 mm": AQUA}
plt.rcParams.update({"figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
                     "text.color": INK, "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
                     "font.family": "sans-serif", "font.size": 10})


def frame(title, sub, size=(8.4, 5.4)):
    fig, ax = plt.subplots(figsize=size)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(GRID)
    ax.grid(color=GRID, lw=0.8)
    ax.set_axisbelow(True)
    ax.tick_params(length=0)
    fig.text(0.02, 0.965, title, fontsize=13, fontweight="bold", ha="left", va="top")
    fig.text(0.02, 0.915, sub, fontsize=9, color=INK2, ha="left", va="top")
    return fig, ax


def legend_handles():
    h = [Line2D([], [], marker="o", color="none", markerfacecolor=c, markeredgecolor=SURFACE, markersize=9, label=f"{k} diameter")
         for k, c in CLS.items()]
    h.append(Line2D([], [], marker="s", color="none", markerfacecolor=INK2, markeredgecolor=SURFACE, markersize=8, label="Listed 'W/O water cooling'"))
    h.append(Line2D([], [], marker="o", color="none", markerfacecolor="none", markeredgecolor=INK, markeredgewidth=1.8, markersize=11, label="Same series a PEP26 team used"))
    return h


def scatter(ax, xs, ys_fn, x_fn, ms=70):
    for m in motors:
        wo = m["water_cooling"] == "listed without"
        ax.scatter(x_fn(m), ys_fn(m), s=ms, marker="s" if wo else "o", color=CLS[m["size_class"]],
                   edgecolor=INK if m["used_in_pep26"] else SURFACE, linewidth=1.8 if m["used_in_pep26"] else 1.2, zorder=3 if m["used_in_pep26"] else 2)


def save(fig, name, foot):
    fig.text(0.02, 0.02, foot, fontsize=8, color=INK2, ha="left", va="bottom")
    fig.subplots_adjust(left=0.1, right=0.97, top=0.84, bottom=0.14)
    fig.savefig(OUT / name, dpi=160)
    plt.close(fig)


FOOT = "TFL North America SSS listing (50 motors) + TFL spec sheet. Cooling is only stated when a title says 'W/O water cooling'."

# 1. price vs continuous power
fig, ax = frame("Price vs. continuous power", "Price climbs with power. Everything above 3 kW is a 56 mm motor, the class the PEP teams used.")
scatter(ax, None, lambda m: m["price"], lambda m: m["continuous_w"] / 1000)
ax.set_xlabel("Rated continuous power (kW)")
ax.set_ylabel("Price (USD)")
ax.set_ylim(0, 360)
ax.annotate("56123 V2: 9.5 kW, $290\n(VCU, Illinois, Texas A&M)", (9.5, 289.9), (4.2, 318), fontsize=8.5, arrowprops=dict(arrowstyle="-", color=INK2, lw=0.8))
ax.annotate("56154 V2: 14 kW, $329 (ECU)", (14, 329), (9.6, 345), fontsize=8.5, arrowprops=dict(arrowstyle="-", color=INK2, lw=0.8))
ax.annotate("5684 V2: 4.5 kW, ~$190 (Alabama)", (4.5, 189.5), (5.0, 120), fontsize=8.5, arrowprops=dict(arrowstyle="-", color=INK2, lw=0.8))
ax.legend(handles=legend_handles(), loc="lower right", frameon=False, fontsize=8.5)
save(fig, "sss_1_price_vs_power.png", FOOT)

# 2. KV vs max voltage, with the PEP cap
fig, ax = frame("KV vs. maximum rated voltage, against the 55.5 V PEP cap",
                "Low-KV motors are the ones that can take a full ~50 V pack. Above the dashed line a motor can use the whole PEP voltage.")
scatter(ax, None, lambda m: m["max_volts"] if m["max_volts"] else float("nan"), lambda m: m["kv"])
ax.axhline(55.5, color=INK2, lw=1, ls=(0, (4, 3)))
ax.text(2950, 58, "55.5 V PEP cap", fontsize=8.5, color=INK2, ha="right")
ax.set_xscale("log")
ax.xaxis.set_minor_formatter(NullFormatter())
ax.set_xticks([200, 300, 500, 1000, 2000]); ax.set_xticklabels(["200", "300", "500", "1000", "2000"])
ax.set_xlabel("KV (RPM per volt, log scale)")
ax.set_ylabel("Max rated voltage (V)")
ax.set_xlim(150, 3300)
ax.legend(handles=legend_handles(), loc="upper right", frameon=False, fontsize=8.5)
save(fig, "sss_2_kv_vs_voltage.png", FOOT)

# 3. weight vs continuous power
fig, ax = frame("Continuous power vs. weight", "Power per kg rises with size: 3-5 kW/kg for the 29-36 mm motors, 4-5.5 for 40 mm, and 5.5-8 for the 56 mm class.")
scatter(ax, None, lambda m: m["continuous_w"] / 1000, lambda m: m["weight_g"] / 1000)
ax.set_xlabel("Weight (kg)")
ax.set_ylabel("Rated continuous power (kW)")
ax.annotate("56154 V2: 1.78 kg", (1.78, 14), (1.05, 14.8), fontsize=8.5, arrowprops=dict(arrowstyle="-", color=INK2, lw=0.8))
ax.annotate("56123 V2: 1.33 kg", (1.33, 9.5), (0.55, 10.4), fontsize=8.5, arrowprops=dict(arrowstyle="-", color=INK2, lw=0.8))
ax.legend(handles=legend_handles(), loc="upper left", frameon=False, fontsize=8.5, bbox_to_anchor=(0.0, 0.85))
save(fig, "sss_3_power_vs_weight.png", FOOT)

# 4. dollars per continuous kW by series (V2 where available)
by = {}
for m in motors:
    by.setdefault((m["series"], m["version"]), []).append(m)
rows = []
for (s, v), ms in by.items():
    price = sorted(x["price"] for x in ms)[len(ms) // 2]
    rows.append((f"{s} {v}", price / (ms[0]["continuous_w"] / 1000), ms[0]["size_class"], ms[0]["used_in_pep26"], ms[0]["continuous_w"]))
rows.sort(key=lambda r: r[1], reverse=True)
fig, ax = frame("Cost per continuous kW, by series", "Median listed price divided by rated continuous power. Outlined bars are series PEP26 teams used.", size=(8.4, 6.6))
ys = list(range(len(rows)))[::-1]
for y, (lab, d, cls, used, w) in zip(ys, rows):
    ax.barh(y, d, height=0.62, color=CLS[cls], edgecolor=INK if used else SURFACE, linewidth=1.8 if used else 0)
    ax.text(d + 4, y, f"${d:,.0f}/kW", va="center", fontsize=8.5)
ax.set_yticks(ys); ax.set_yticklabels([r[0] for r in rows], fontsize=8.5)
ax.grid(axis="y", visible=False)
ax.set_xlabel("USD per rated continuous kW")
ax.set_xlim(0, 215)
ax.legend(handles=[Line2D([], [], marker="s", color="none", markerfacecolor=c, markersize=9, label=f"{k} diameter") for k, c in CLS.items()],
          loc="lower right", frameon=False, fontsize=8.5)
fig.text(0.02, 0.012, "V1 vs V2 as labeled on TFL's sheet. Prices are TFL North America list prices, not what the teams paid.", fontsize=8, color=INK2)
fig.subplots_adjust(left=0.13, right=0.97, top=0.88, bottom=0.12)
fig.savefig(OUT / "sss_4_cost_per_kw.png", dpi=160)
plt.close(fig)
print("wrote", sorted(p.name for p in OUT.glob("sss_*.png")))
