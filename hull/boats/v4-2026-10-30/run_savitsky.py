"""Run the agreed v4 speed sweep and the alternative deadrise approximation.

Run from repo root: python3 hull/boats/v4-2026-10-30/run_savitsky.py --output NEW_FOLDER
Existing output folders are refused. Requires matplotlib for charts.
"""
from pathlib import Path
import argparse
import json
import sys
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT/'hull'))
from savitsky_sensitivity import load_baseline, study, export_study


def make_charts(payload, folder):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    plt.rcParams['svg.fonttype'] = 'none'
    fig, axes = plt.subplots(2, 2, figsize=(12, 8), constrained_layout=True)
    metrics = [('resistance_n', 'Resistance (N)'), ('effective_power_kw', 'Effective power (kW)'),
               ('trim_deg', 'Running trim (deg)'), ('keel_wetted_in', 'Wetted keel (in)')]
    for name in dict.fromkeys(r['scenario'] for r in payload['results']):
        rows = [r for r in payload['results'] if r['scenario'] == name]
        label = '20° main-panel approximation' if name == 'baseline' else '18.358° outer-chine-chord approximation'
        for ax, (key, title) in zip(axes.flat, metrics):
            speed = [r['speed_mph'] for r in rows]
            line, = ax.plot(speed, [r.get(key, float('nan')) if r['screen_ok'] else float('nan') for r in rows], label=label)
            ax.plot(speed, [r.get(key, float('nan')) if r['solved'] and not r['screen_ok'] else float('nan') for r in rows],
                    '--', color=line.get_color())
            ax.set(xlabel='Speed (mph)', ylabel=title)
            ax.grid(alpha=.2)
    axes[0, 0].legend(fontsize=9)
    fig.suptitle('v4 · 14-inch outer chine beam · 125.107 lb\nAll solved points require a non-prismatic / reverse-chine approximation; dashed = outside empirical screen')
    fig.savefig(Path(folder)/'performance.svg', bbox_inches='tight')
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'outputs/savitsky/v4-2026-10-30')
    args = parser.parse_args()
    config, _ = load_baseline(HERE/'savitsky-inputs.json')
    payload = study(config, list(range(31)), {'deadrise_deg': [config['comparison_deadrise_deg']]})
    folder = export_study(payload, args.output)
    make_charts(payload, folder)
    print(folder)

if __name__ == '__main__':
    main()
