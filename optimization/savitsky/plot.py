"""Optional static PNG/SVG export of a run.js JSON report (needs matplotlib)."""
import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', type=Path)
    args = parser.parse_args()
    report = json.loads(args.report.read_text())
    rows = report['results']
    fig, axes = plt.subplots(1, 3, figsize=(15, 5.4))
    fig.subplots_adjust(left=0.055, right=0.985, bottom=0.28, top=0.87, wspace=0.30)
    measures = [('trim_deg', 'Running trim (degrees)'),
                ('resistance_n', 'Hull resistance (N)'),
                ('effective_power_kw', 'Effective power (kW)')]
    for ax, (key, label) in zip(axes, measures):
        for a, b in zip(rows, rows[1:]):
            if key not in a or key not in b or a['status'] == 'static':
                continue
            outside = any(r['status'] != 'within_screen' for r in (a, b))
            ax.plot([r['speed_m_s'] for r in (a, b)], [r[key] for r in (a, b)],
                    color='#a65108' if outside else '#1859a9',
                    linestyle='--' if outside else '-', linewidth=2)
        for r in rows:
            if key in r:
                ax.plot(r['speed_m_s'], r[key], 'o', markersize=3,
                        color='#1859a9' if r['status'] == 'within_screen' else '#a65108')
        ax.set(xlabel='Speed (m/s)', ylabel=label, xlim=(0, rows[-1]['speed_m_s']))
        ax.grid(alpha=0.2)
    fig.suptitle('Sample prismatic monohull · speed sensitivity', fontsize=17)
    fig.legend(handles=[Line2D([], [], color='#1859a9', label='Within implemented checks'),
                        Line2D([], [], color='#a65108', linestyle='--', label='Outside checks / extrapolation')],
               loc='lower center', bbox_to_anchor=(0.5, 0.09), ncol=2, frameon=False)
    fig.text(0.5, 0.035, 'Low-speed gaps: displacement/wave-making resistance not modeled. No interpolation to the zero-speed point.\n'
             'Effective power is hull resistance × speed; no propulsion losses or dynamic stability analysis.', fontsize=10, ha='center')
    for ext in ('png', 'svg'):
        dest = args.report.with_suffix('.' + ext)
        fig.savefig(dest, dpi=170, facecolor='white')
        print(dest)


if __name__ == '__main__':
    main()
