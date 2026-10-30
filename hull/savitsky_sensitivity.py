"""Speed sweeps and sensitivity reporting; equations come from current-hull.ipynb.

No archive dependency and no copied hydrodynamic formulas. Uses the standard
library; pandas/matplotlib are only needed by the notebook that displays results.
"""
from pathlib import Path
import ast
import copy
import csv
from datetime import datetime, timezone
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / 'optimization/savitsky/current-hull.ipynb'
DEFAULT_INPUTS = ROOT / 'optimization/savitsky/current-hull-inputs.json'
FUNCTIONS = ('validate', 'geometry_and_lift', 'forces', 'vertical_balance', 'solve', 'run_sweep')
MPH_TO_M_S = 0.44704


def load_engine():
    """Load only named function definitions, never notebook top-level code."""
    notebook = json.loads(NOTEBOOK.read_text())
    definitions = {}
    sources = []
    for cell in notebook['cells']:
        if cell['cell_type'] != 'code':
            continue
        source = ''.join(cell['source'])
        for node in ast.parse(source).body:
            if isinstance(node, ast.FunctionDef) and node.name in FUNCTIONS:
                if node.name in definitions:
                    raise ValueError(f'Duplicate engine function: {node.name}')
                definitions[node.name] = node
                sources.append(ast.get_source_segment(source, node))
    if set(definitions) != set(FUNCTIONS):
        raise ValueError('Notebook engine functions have changed; review the adapter.')
    config = json.loads(DEFAULT_INPUTS.read_text())
    namespace = {'math': math, 'config': config, 'G': 9.8066,
                 'MPH_TO_M_S': MPH_TO_M_S, 'IN_TO_M': .0254,
                 'N_PER_LBF': 4.4482216152605}
    for name in FUNCTIONS:
        exec(compile(ast.Module(body=[definitions[name]], type_ignores=[]),
                     str(NOTEBOOK), 'exec'), namespace)
    return namespace, hashlib.sha256('\n'.join(sources).encode()).hexdigest()


def load_baseline(path=DEFAULT_INPUTS, *, uniform_aft_length_m=None, propeller_count=None):
    """Read the input JSON, a prior study JSON or a historical/notebook run JSON.

    Reloading a study starts from its baseline configuration, not its variants.
    Exported curves supply a default speed grid; variants are always re-solved.
    CSV is for external analysis; JSON retains the metadata needed to restart.
    Older run files need explicit uniform_aft_length_m / propeller_count overrides
    if those assumptions were not saved; they are never guessed.
    """
    path = Path(path).resolve()
    data = json.loads(path.read_text())
    if data.get('schema') == 'haav.savitsky-sensitivity.v1':
        config = copy.deepcopy(data['baseline_config'])
        speeds = data['speeds_mph']
    else:
        config = copy.deepcopy(data)
        if 'inputs' not in config:
            raise ValueError('Baseline JSON must contain an inputs object.')
        speeds = [r['speed_mph'] for r in data.get('results', [])]
    if uniform_aft_length_m is not None:
        config['uniform_aft_length_m'] = uniform_aft_length_m
    if propeller_count is not None:
        config['propeller_count'] = propeller_count
    if 'uniform_aft_length_m' not in config or 'propeller_count' not in config:
        raise ValueError('Baseline needs uniform_aft_length_m and propeller_count; '
                         'supply the physical assumptions rather than guessing them.')
    config['source'] = {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    return config, speeds


def study(config, speeds_mph, variations, scenarios=None, require_uniform_aft=False):
    """Re-solve baseline, one-input variants, and optional coupled scenarios.

    variations maps an input name to absolute SI values (angles in degrees).
    Sensitivity = fractional output change / fractional input change, not an
    analytic derivative or a global variance-based sensitivity measure.
    """
    engine, digest = load_engine()
    p = copy.deepcopy(config['inputs'])
    engine['validate'](p)
    speeds = list(speeds_mph)
    if not speeds or any(isinstance(v, bool) or not isinstance(v, (float, int)) or
                         not math.isfinite(v) or v < 0 for v in speeds):
        raise ValueError('Speeds must be finite nonnegative mph values.')
    if len(set(speeds)) != len(speeds) or speeds != sorted(speeds):
        raise ValueError('Speeds must be unique and increasing.')
    choices = [('baseline', None, None, p)]
    for key, values in variations.items():
        if key not in p:
            raise ValueError(f'Unknown input: {key}')
        if key in {'wetted_lengths_type', 'flap_chord_m', 'flap_span_ratio', 'flap_angle_deg'}:
            raise ValueError(f'{key} is not a supported design sweep in this engine.')
        seen = set()
        for value in values:
            if not isinstance(value, (float, int)) or isinstance(value, bool) or not math.isfinite(value):
                raise ValueError(f'{key}: sweep values must be finite numbers.')
            if value == p[key] or value in seen:
                continue
            seen.add(value)
            q = {**p, key: value}
            engine['validate'](q)
            choices.append((f'{key}={value:.12g}', key, value, q))
    for name, changes in (scenarios or {}).items():
        if not name or not changes or set(changes) - set(p):
            raise ValueError('Coupled scenarios need a name and known input changes.')
        q = {**p, **changes}
        engine['validate'](q)
        choices.append((f'scenario:{name}', None, None, q))
    if len({name for name, *_ in choices}) != len(choices):
        raise ValueError('Scenario labels must be unique; use less closely spaced values.')
    rows = []
    for name, key, value, q in choices:
        result = engine['run_sweep'](q, speeds, config['uniform_aft_length_m'], config['propeller_count'])
        for row in result:
            solved = 'trim_deg' in row
            row.update(scenario=name, parameter=key, parameter_value=value,
                       parameter_baseline=p[key] if key else None,
                       solved=solved,
                       screen_ok=solved and row['status'] == 'within_screen',
                       geometry_ok=solved and not row['forebody_approximation'])
            row.update({f'input__{k}': v for k, v in q.items()})
            rows.append(row)
    baseline = {r['speed_mph']: r for r in rows if r['scenario'] == 'baseline'}
    metrics = ['resistance_n', 'effective_power_kw', 'trim_deg', 'keel_wetted_m',
               'wetted_area_m2', 'reynolds_number', 'pressure_drag_n', 'friction_drag_n', 'thrust_n']
    sensitivity = []
    for row in rows:
        if row['parameter'] is None:
            continue  # coupled scenarios have no single-input elasticity
        old = baseline[row['speed_mph']]
        dx = row['parameter_value'] - row['parameter_baseline']
        eligible = row['screen_ok'] and old['screen_ok']
        if require_uniform_aft:
            eligible = eligible and row['geometry_ok'] and old['geometry_ok']
        for metric in metrics:
            reason = ('ok' if eligible else 'Not both within empirical screen / required geometry')
            y, y0 = row.get(metric), old.get(metric)
            change = slope = percent = elasticity = None
            if eligible and y is not None and y0 is not None:
                change = y - y0
                slope = change / dx
                if y0 != 0:
                    percent = 100 * change / y0
                    if row['parameter_baseline'] != 0:
                        elasticity = (change/y0) / (dx/row['parameter_baseline'])
                    else:
                        reason = 'Zero baseline input: normalized sensitivity undefined; use slope'
                else:
                    reason = 'Zero baseline output: percent and normalized sensitivity undefined'
            sensitivity.append(dict(scenario=row['scenario'], speed_mph=row['speed_mph'],
                                    parameter=row['parameter'], parameter_value=row['parameter_value'],
                                    parameter_baseline=row['parameter_baseline'], metric=metric,
                                    eligible=eligible, reason=reason, change=change, slope=slope,
                                    percent_change=percent, elasticity=elasticity,
                                    variant_status=row['status'], baseline_status=old['status'],
                                    variant_geometry_ok=row['geometry_ok'], baseline_geometry_ok=old['geometry_ok']))
    return dict(schema='haav.savitsky-sensitivity.v1', created_utc=datetime.now(timezone.utc).isoformat(),
                model='current-hull.ipynb: Savitsky 1964, no flap',
                engine_source=str(NOTEBOOK.relative_to(ROOT)), engine_functions_sha256=digest,
                repository_version=(ROOT/'VERSION').read_text().strip(),
                baseline_config=copy.deepcopy(config), speeds_mph=speeds,
                variations=copy.deepcopy(variations), scenarios=copy.deepcopy(scenarios or {}),
                require_uniform_aft=require_uniform_aft, results=rows, sensitivities=sensitivity,
                units={'speed_mph': 'mph', 'speed_m_s': 'm/s', 'resistance_n': 'N',
                       'effective_power_kw': 'kW (effective, not electrical)', 'trim_deg': 'deg',
                       'keel_wetted_m': 'm', 'wetted_area_m2': 'm²', 'reynolds_number': 'dimensionless',
                       'pressure_drag_n': 'N', 'friction_drag_n': 'N', 'thrust_n': 'N (along shafts)',
                       'elasticity': '(fractional output change)/(fractional input change)',
                       'slope': 'output SI unit / input SI unit (angles in degrees)'})


def export_study(payload, folder):
    """Write a new directory containing JSON and two plain CSV tables; never overwrite."""
    folder = Path(folder)
    serialized = json.dumps(payload, indent=2, allow_nan=False) + '\n'
    folder.mkdir(parents=True, exist_ok=False)
    (folder/'study.json').write_text(serialized)
    for filename, rows in [('curves.csv', payload['results']), ('sensitivities.csv', payload['sensitivities'])]:
        fields = sorted({key for row in rows for key in row}) or [
            'scenario', 'speed_mph', 'parameter', 'parameter_value', 'parameter_baseline',
            'metric', 'eligible', 'reason', 'change', 'slope', 'percent_change', 'elasticity']
        with (folder/filename).open('w', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=fields)
            writer.writeheader()
            for row in rows:
                writer.writerow({k: json.dumps(v) if isinstance(v, (list, dict)) else v for k, v in row.items()})
    return folder
