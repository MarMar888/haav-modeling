"""Check NavalToolbox against a box, then solve and graph the actual v4 hull.

Run from any folder. Outputs are created only after successful validation.
Uses full-scale metres/kg internally; table lengths are inches.
"""
import argparse
from datetime import datetime, timezone
import hashlib
from importlib.metadata import version
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = next(p for p in HERE.parents if (p / 'prop_motor_battery').is_dir())
INPUT_FILE = ROOT / 'hull/hydrodynamics-savitsky/v4-2026-10-30/savitsky-inputs.json'
IN_TO_M = .0254


def check_box(nt):
    """Independent exact volume/draft/wetted-area benchmark at real boat scale."""
    length, beam, depth, draft, density = 1.8288, .6096, .3048, .12, 998.2
    vessel = nt.Vessel(nt.Hull.from_box(length, beam, depth))
    xmin, xmax, ymin, ymax, zmin, zmax = vessel.get_bounds()
    target = length * beam * draft * density
    cog = ((xmin + xmax) / 2, (ymin + ymax) / 2, zmin + draft / 2)
    loading = nt.LoadingCondition('Analytical box')
    loading.add_mass_simple('Centered load', target, cog, nt.MassCategory.lightship())
    state = nt.HydrostaticsCalculator(vessel, water_density=density).from_loading(loading)
    expected = dict(volume=length * beam * draft, waterplane_area=length * beam,
                    wetted_surface_area=length * beam + 2 * (length + beam) * draft)
    result = {}
    for name, exact in expected.items():
        measured = float(getattr(state, name))
        relative_error = abs(measured / exact - 1)
        result[name] = dict(expected=exact, actual=measured, relative_error=relative_error)
        if not math.isfinite(measured) or relative_error > .005:
            raise ArithmeticError(f'Box benchmark failed: {name}: {result[name]}')
    if abs(state.trim) > .05 or abs(state.heel) > .05:
        raise ArithmeticError('Centered box did not float level.')
    return result


def calculate(mass_offsets, mass_kg=None):
    try:
        import navaltoolbox as nt
    except ImportError as exc:
        raise SystemExit(f'NavalToolbox could not load: {exc}\nRun: sh hull/hydrostatics/setup.sh\nOn macOS, a missing liblzma dependency can be installed with: brew install xz') from exc
    import numpy as np
    import pandas as pd

    geometry = HERE / 'geometry'
    report = json.loads((geometry / 'geometry-report.json').read_text())
    mesh_path = geometry / 'hull-envelope.stl'
    if hashlib.sha256(mesh_path.read_bytes()).hexdigest() != report['stl_sha256']:
        raise ValueError('Envelope changed; rerun prepare_geometry.py.')
    source = ROOT / report['source']
    if hashlib.sha256(source.read_bytes()).hexdigest() != report['source_sha256']:
        raise ValueError('STEP changed; rerun prepare_geometry.py.')
    config = json.loads(INPUT_FILE.read_text())
    p = config['inputs']
    baseline_mass = p['mass_kg'] if mass_kg is None else mass_kg
    # Positive naval Y is negative CAD X; current Savitsky baseline is symmetric.
    cog = (p['lcg_m'], 0.0, p['vcg_m'])
    density = p['density_kg_m3']
    if not math.isfinite(baseline_mass) or baseline_mass <= 0:
        raise ValueError('Mass must be positive and finite.')
    benchmark = check_box(nt)
    vessel = nt.Vessel(nt.Hull(str(mesh_path)))
    points = [tuple(point) for point in json.loads((geometry / 'deck-edge.json').read_text())]
    vessel.add_deck_edge(nt.DeckEdge.from_points('Actual v4 rim', points, nt.DeckEdgeSide.port()))
    calc = nt.HydrostaticsCalculator(vessel, water_density=density)
    rows = []
    for offset in sorted(set([0.0, *mass_offsets])):
        mass = baseline_mass + offset
        if not math.isfinite(mass) or mass <= 0:
            raise ValueError('All resulting masses must be positive and finite.')
        load = nt.LoadingCondition(f'v4, {mass:.3f} kg')
        load.add_mass_simple('Whole boat', mass, cog, nt.MassCategory.lightship())
        state = calc.from_loading(load)
        error = abs(state.volume * density / mass - 1)
        if error > .001 or not math.isfinite(error):
            raise ArithmeticError(f'Buoyancy balance failed at {mass} kg: {error:.3%}')
        freeboard = state.freeboard
        if freeboard is None:
            raise ArithmeticError('Deck-edge freeboard was not calculated.')
        rows.append({
            'added_mass_kg': float(offset), 'mass_kg': mass, 'mass_lb': mass / .45359237,
            'volume_l': state.volume * 1000, 'extra_volume_in3': offset / density / IN_TO_M**3,
            'draft_midship_in': state.draft / IN_TO_M,
            'draft_aft_in': state.draft_ap / IN_TO_M, 'draft_forward_in': state.draft_fp / IN_TO_M,
            'trim_bow_down_deg': state.trim, 'heel_deg': state.heel,
            'freeboard_min_in': freeboard / IN_TO_M,
            'waterline_length_in': state.lwl / IN_TO_M,
            'submerged_length_in': state.los / IN_TO_M,
            'wetted_area_in2': state.wetted_surface_area / IN_TO_M**2,
            'waterplane_area_in2': state.waterplane_area / IN_TO_M**2,
            'gm_transverse_in': None if state.gmt is None else state.gmt / IN_TO_M,
            'mass_balance_relative_error': error,
            'dry_hull_assumption_ok': freeboard > 0,
        })
    frame = pd.DataFrame(rows)
    numeric = frame.select_dtypes(include=np.number).drop(columns=['gm_transverse_in'], errors='ignore')
    if not np.isfinite(numeric.to_numpy()).all():
        raise ArithmeticError('Nonfinite hydrostatic result.')
    metadata = dict(created_utc=datetime.now(timezone.utc).isoformat(),
                    navaltoolbox_version=version('navaltoolbox'),
                    input_file=str(INPUT_FILE.relative_to(ROOT)),
                    input_sha256=hashlib.sha256(INPUT_FILE.read_bytes()).hexdigest(),
                    density_kg_m3=density, cog_naval_m=list(cog), baseline_mass_kg=baseline_mass,
                    geometry=report, analytical_box_check=benchmark,
                    note='Static dry-interior flotation only. Fixed whole-boat CG during mass sweep. Positive trim is bow down. No speed/thrust/planing. Rim immersion invalidates the dry-interior assumption.')
    return frame, metadata


def make_plots(frame):
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(2, 2, figsize=(11, 7), constrained_layout=True)
    for ax, key, label in zip(axes.flat,
            ['draft_midship_in', 'freeboard_min_in', 'waterline_length_in', 'wetted_area_in2'],
            ['Midship draft (in)', 'Minimum freeboard (in)', 'Waterline length (in)', 'Wetted surface (in²)']):
        ax.plot(frame['mass_kg'], frame[key], marker='o')
        ax.set(xlabel='Total boat mass (kg)', ylabel=label)
        ax.grid(alpha=.25)
        if key == 'freeboard_min_in':
            ax.axhline(0, color='red', linewidth=.8)
    return fig


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mass-kg', type=float, default=None)
    parser.add_argument('--offsets-kg', type=float, nargs='+', default=[-10, -5, 0, 5, 10, 20])
    parser.add_argument('--output', type=Path, default=HERE / 'results/navaltoolbox')
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError('Choose a new --output folder to preserve previous results.')
    frame, metadata = calculate(args.offsets_kg, args.mass_kg)
    import matplotlib
    matplotlib.use('Agg')
    fig = make_plots(frame)
    args.output.mkdir(parents=True)
    frame.to_csv(args.output / 'hydrostatics.csv', index=False)
    (args.output / 'study.json').write_text(json.dumps({**metadata, 'results': frame.to_dict(orient='records')}, indent=2, allow_nan=False) + '\n')
    fig.savefig(args.output / 'hydrostatics.png', dpi=150)
    baseline = frame.loc[frame['added_mass_kg'] == 0].iloc[0]
    text = ('# v4 NavalToolbox hydrostatics\n\n'
            f'Mass: {baseline.mass_kg:.3f} kg. Minimum freeboard: {baseline.freeboard_min_in:.2f} in. '
            f'Midship draft: {baseline.draft_midship_in:.2f} in. Waterline length: {baseline.waterline_length_in:.2f} in.\n\n'
            '![Weight sweep](hydrostatics.png)\n\n'
            '[Full results](hydrostatics.csv) · [Inputs and box verification](study.json)\n\n'
            + metadata['note'] + '\n')
    (args.output / 'REPORT.md').write_text(text)
    print(frame.round(3).to_string(index=False))
    print(f'\nSaved: {args.output}')


if __name__ == '__main__':
    main()
