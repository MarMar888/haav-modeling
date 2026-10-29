"""Audit the printed Savitsky 1964 Tables 1 and 2 using only the standard library.

Graph readings are transcribed reference inputs, never inferred from target outputs.
Each arithmetic row is recomputed from its PRINTED parent rows: errors therefore
remain local instead of being silently propagated or tuned away. This is a paper
calculation audit, not a new hull-performance engine. See paper1964-data.json.
"""
import csv
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DEFAULT_OUTPUT = ROOT / 'outputs/savitsky/savitsky-1964-reference-2026-10-28'


def load_data():
    return json.loads((HERE / 'paper1964-data.json').read_text())


def audit_row(table, row, key, printed, calculated, note='', trial=None):
    return dict(table=table, row=row, trial_trim_deg=trial, quantity=key,
                printed=printed, calculated=calculated,
                difference=None if calculated is None else calculated-printed,
                note=note)


def audit_table1(data):
    """Recalculate each non-graph row from its printed upstream operands."""
    g = data['given']
    b, w, beta = g['beam_ft'], g['weight_lbf'], math.radians(g['beta_deg'])
    rho, nu = g['density_slug_ft3'], g['viscosity_ft2_s']
    rows = data['table1_rows']
    output = []
    for j, trim in enumerate(data['table1_trials_deg']):
        r = {item['key']: item['printed'][j] for item in rows}
        t = math.radians(trim)
        calculations = {
            'tau_power': trim**1.1,
            'lift_ratio': r['cl0']/r['tau_power'],
            're': r['vm_ft_s']*r['lambda']*b/nu,
            'cf_total': r['cf']+r['dcf'],
            'df_lbf': rho/2*r['vm_ft_s']**2*r['lambda']*b*b*r['cf_total']/math.cos(beta),
            'tan_tau': math.tan(t), 'sin_tau': math.sin(t), 'cos_tau': math.cos(t),
            'pressure_lbf': w*r['tan_tau'],
            'friction_drag_lbf': r['df_lbf']/r['cos_tau'],
            'drag_lbf': r['pressure_lbf']+r['friction_drag_lbf'],
            'cp_ft': r['cp_ratio']*r['lambda']*b,
            'c_ft': g['lcg_ft']-r['cp_ft'],
            'friction_height_ft': b/4*math.tan(beta),
            'a_ft': g['vcg_ft']-r['friction_height_ft'],
            'sin_sum': math.sin(t+math.radians(g['epsilon_deg'])),
            'vertical_factor': 1-r['sin_tau']*r['sin_sum'],
            'normal_arm_ft': r['vertical_factor']*r['c_ft']/r['cos_tau'],
            'thrust_arm_ft': g['f_ft']*r['sin_tau'],
            'combined_arm_ft': r['normal_arm_ft']-r['thrust_arm_ft'],
            'normal_moment_lbft': w*r['combined_arm_ft'],
            'friction_thrust_arm_ft': r['a_ft']-g['f_ft'],
            'friction_moment_lbft': r['df_lbf']*r['friction_thrust_arm_ft'],
            'moment_lbft': r['normal_moment_lbft']+r['friction_moment_lbft'],
        }
        for item in rows:
            key = item['key']
            note = 'Recomputed from printed parent rows; no hidden rounding.'
            if key not in calculations:
                note = 'Reference input: graph reading or stated friction/roughness choice; not independently verified.'
            if key in {'re', 'df_lbf'}:
                note += ' Uses inferred water properties; see given_notes in JSON.'
            output.append(audit_row(1,item['row'],key,r[key],calculations.get(key),note,trim))
    return output


def replay_table1_summary(data):
    """Perform the printed interpolation, keeping the rounded 0.3 fraction explicit."""
    g = data['given']
    r = {x['key']: x['printed'] for x in data['table1_rows']}
    s = data['table1_summary']
    exact_fraction = -r['moment_lbft'][0]/(r['moment_lbft'][1]-r['moment_lbft'][0])
    fraction = 0.3  # Paper rounds trim to 2.3 degrees before subsequent interpolation.
    interp = lambda key: r[key][0]+fraction*(r[key][1]-r[key][0])
    corrected_lambda = interp('lambda')
    half_gap = g['beam_ft']/(2*math.pi)*math.tan(math.radians(g['beta_deg']))/math.tan(math.radians(s['trim_deg']))
    return {
        'unrounded_interpolation_fraction': exact_fraction,
        'unrounded_interpolated_trim_deg': 2+exact_fraction,
        'rounded_trim_deg': round(2+exact_fraction,1),
        'fraction_used_in_printed_followup': fraction,
        'drag_lbf': interp('drag_lbf'),
        'drag_lbf_from_literal_printed_9424': 9424-(9434-8304)*fraction,
        'ehp_from_printed_drag_and_speed': s['drag_lbf']*g['speed_ft_s']/550,
        'lambda_from_printed_interpolation': corrected_lambda,
        'keel_ft_using_printed_lambda': s['lambda']*g['beam_ft']+half_gap,
        'chine_ft_using_printed_lambda': s['lambda']*g['beam_ft']-half_gap,
        'keel_ft_using_recalculated_lambda': corrected_lambda*g['beam_ft']+half_gap,
        'chine_ft_using_recalculated_lambda': corrected_lambda*g['beam_ft']-half_gap,
        'draft_ft_using_printed_keel_and_sine': s['keel_ft']*math.sin(math.radians(s['trim_deg'])),
    }


def audit_table2(data):
    """Audit simplified-case arithmetic, retaining its graph inputs and rounded rows."""
    g = data['given']
    r = {item['key']: item['printed'] for item in data['table2_rows']}
    b, w = g['beam_ft'], g['weight_lbf']
    rho, nu = g['density_slug_ft3'], g['viscosity_ft2_s']
    cos_beta = math.cos(math.radians(g['beta_deg']))
    calculations = {
        'cp_over_beam': g['lcg_ft']/b,
        'tau_power': r['cl0']/r['lift_ratio'],
        'trim_deg': r['tau_power']**(1/1.1),
        'tan_tau': math.tan(math.radians(r['trim_deg'])),
        'pressure_lbf': w*r['tan_tau'],
        'lambda_b2_ft2': r['lambda']*b*b,
        're': r['vm_ft_s']*r['lambda']*b/nu,
        'cf_total': r['cf']+r['dcf'],
        'df_lbf': rho/2*r['vm_ft_s']**2*r['lambda_b2_ft2']*r['cf_total']/cos_beta,
        'friction_drag_lbf': r['df_lbf']/math.cos(math.radians(r['trim_deg'])),
        'drag_lbf': r['pressure_lbf']+r['friction_drag_lbf'],
        'ehp': r['drag_lbf']*g['speed_ft_s']/550,
        'porpoising_axis': math.sqrt(.069/2),
    }
    output = []
    for item in data['table2_rows']:
        key = item['key']
        note = 'Recomputed from printed parent rows; no hidden rounding.'
        if key not in calculations:
            note = 'Reference input from graph or stated coefficient; not independently verified.'
        if key in {'re','df_lbf'}:
            note += ' Uses inferred water properties.'
        output.append(audit_row(2,item['row'],key,r[key],calculations.get(key),note))
    # An exact carry-through differs from the paper's intermediate rounding.
    precise_trim = (r['cl0']/r['lift_ratio'])**(1/1.1)
    implied_density = 2*r['df_lbf']*cos_beta/(r['vm_ft_s']**2*r['lambda_b2_ft2']*r['cf_total'])
    return output, {'trim_without_intermediate_rounding_deg': precise_trim,
                    'trim_from_printed_2_42_deg': calculations['trim_deg'],
                    'density_implied_by_printed_friction_slug_ft3': implied_density}


def equation_spot_checks(data):
    """Compare graph-derived lift/pressure readings with explicit printed equations.

Equations 15/16 use the load coefficient weight/(rho/2 V² b²), as the
worked tables do, rather than replacing that coefficient with our engine's
coupled vertical-force solution. This distinction is intentional.
"""
    g = data['given']
    cv = g['speed_ft_s']/math.sqrt(g['gravity_ft_s2']*g['beam_ft'])
    cl_beta_load = g['weight_lbf']/(g['density_slug_ft3']/2*g['speed_ft_s']**2*g['beam_ft']**2)
    output = []
    for j, trim in enumerate(data['table1_trials_deg']):
        lam = next(x for x in data['table1_rows'] if x['key']=='lambda')['printed'][j]
        cl0 = trim**1.1*(.012*math.sqrt(lam)+.0055*lam**2.5/cv**2)
        cb = cl0-.0065*g['beta_deg']*cl0**.6
        cp = .75-1/(5.21*(cv/lam)**2+2.39)
        output.append(dict(trial_trim_deg=trim,lambda_from_graph=lam,cv=cv,
                           clbeta_from_loading=cl_beta_load,cl0_from_eq15=cl0,
                           clbeta_from_eq16=cb,cp_ratio_from_eq28=cp))
    return output


def write_audit(out=DEFAULT_OUTPUT):
    data = load_data()
    t1 = audit_table1(data)
    t2, extra = audit_table2(data)
    summary = replay_table1_summary(data)
    report = dict(method='Literal audit of printed graph readings and arithmetic; not a new performance engine.',
                  source=data['source'],given=data['given'],given_notes=data['given_notes'],
                  table1_rows=t1,table1_summary=summary,table2_rows=t2,table2_extra=extra,
                  equation_spot_checks=equation_spot_checks(data))
    out = Path(out)
    out.mkdir(parents=True,exist_ok=True)
    (out/'paper-arithmetic-audit.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    with (out/'paper-arithmetic-rows.csv').open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(t1[0]))
        writer.writeheader();writer.writerows(t1+t2)
    lines = [
        '# Savitsky 1964: exact arithmetic audit', '',
        'This audit uses the original printed tables and graph readings. It reproduces the stated operations without adjusting constants to force agreement. **Some printed results do not follow from their displayed operands, so every printed number cannot be reproduced exactly by consistent arithmetic.**', '',
        'Source: [supplied PDF](Savitsky-1964.pdf). Table 1: PDF p.19 / printed p.89. Table 2: PDF p.20 / printed p.90. Equilibrium Eq.35: PDF p.21 / printed p.91.', '',
        '## Findings that matter', '',
        '| Location | Printed | Recalculated from displayed operands | Interpretation |',
        '|---|---:|---:|---|',
        f"| Table 1 trim interpolation | 2.3° | {summary['unrounded_interpolated_trim_deg']:.8f}° | Consistent after rounding to one decimal |",
        f"| Table 1 drag interpolation | 9095 lbf | {summary['drag_lbf']:.8f} lbf | Exactly matches using table endpoints and rounded trim fraction 0.3 |",
        f"| Table 1 mean wetting ratio | 3.29 | {summary['lambda_from_printed_interpolation']:.8f} | 3.85 − (3.85 − 2.60) × 0.3 = 3.475; printed result does not follow |",
        f"| Table 1 power | 1115 hp | {summary['ehp_from_printed_drag_and_speed']:.8f} hp | 9095 × 67.5 / 550 |",
        f"| Table 2 trim from printed intermediate 2.42 | 2.23° | {extra['trim_from_printed_2_42_deg']:.8f}° | Consistent when rounded to two decimals |",
        f"| Table 2 trim without intermediate rounding | 2.23° | {extra['trim_without_intermediate_rounding_deg']:.8f}° | Keeping 0.085/0.035 at full precision gives a different rounded trim |",
        f"| Table 2 power | 1100 hp | {9010*67.5/550:.8f} hp | Printed power is coarsely rounded |", '',
        'The displayed drag line starts with 9424, while Table 1 gives 9434. Taken literally that line gives 9085 lbf; using the table endpoint 9434 gives the printed 9095. This apparent typo is not silently treated as an exact match.', '',
        'Table 1 wetting lengths propagate the printed 3.29. Correcting just its stated interpolation changes the calculated keel wetting to '+f"{summary['keel_ft_using_recalculated_lambda']:.5f} ft"+' instead of the printed 55.9 ft. Consequently, our earlier wetted-length comparison overstated disagreement with the paper’s own interpolation procedure.', '',
        '## Friction values cannot be exactly recovered from the displayed inputs', '',
        'Eq.19 (PDF p.13 / printed p.83) uses bottom-flow speed squared and Schoenherr friction. The examples add a fixed 0.0004 roughness allowance. Using rho=1.94 slug/ft³ (inferred from the displayed 0.97 lift denominator), and the table’s other rounded operands:', '',
        '| Case | Printed friction Df (lbf) | Eq.19 from displayed operands (lbf) |',
        '|---|---:|---:|',
    ]
    for trial in data['table1_trials_deg']:
        item=next(x for x in t1 if x['trial_trim_deg']==trial and x['quantity']=='df_lbf')
        lines.append(f"| Table 1, {trial}° | {item['printed']:g} | {item['calculated']:.6f} |")
    item=next(x for x in t2 if x['quantity']=='df_lbf')
    lines += [f"| Table 2 | {item['printed']:g} | {item['calculated']:.6f} |", '',
        'The density is inferred rather than separately specified. Table 2’s friction would require an effective density of '+f"{extra['density_implied_by_printed_friction_slug_ft3']:.6f} slug/ft³"+' with its other printed operands held fixed. This points to an unstated convention, rounding, or transcription/arithmetic inconsistency; it is not evidence for changing water density to fit the target.', '',
        '## Exact differences from our existing engine', '',
        '1. **Inputs and water constants:** paper calculations use imperial rounded quantities; rho and nu are reconstructed where not explicitly stated. Our prior engine runs retain SI gravity and conversions.',
        '2. **Lift/wetting procedure:** the worked tables calculate a load coefficient from weight and read lift/wetting from graphs. The engine solves vertical force and moment equilibrium together, including vertical thrust and friction. Graph readings are reference inputs in this audit, not independent verification of the graphs.',
        '3. **Friction law:** paper uses Schoenherr coefficients. Engine uses ITTC 1957.',
        '4. **Roughness:** paper adds fixed delta Cf=0.0004. Engine uses zero or the Townsin allowance from a dimensional roughness.',
        '5. **Velocity in friction force:** paper Eq.19 uses bottom-flow speed squared. Engine uses forward speed squared; corrected bottom speed enters only Reynolds number.',
        '6. **Friction lever arm:** paper Table 1 uses b*tan(beta)/4. Engine area-weights triangular and rectangular wetted regions.',
        '7. **Equilibrium algorithm:** Table 1 uses approximate Eq.35 and linear interpolation between trial trims, then rounds trim before interpolating other outputs. Engine continuously bisects exact implemented residuals.',
        '8. **Table 2 is a different force arrangement:** a=f=c=epsilon=0 by assumption. In particular, the friction line passes through CG; setting thrust angle to zero in the ordinary engine does not implement this case.',
        '9. **Reporting:** the engine labels pressure and friction as horizontal components of its solved forces; the paper’s weight*tan(tau) and Df/cos(tau) are an algebraic resistance decomposition. Their component columns should not be treated as identical definitions in the general thrust case.', '',
        'The close 8997-lbf modern result is not an exact validation. The 9095-lbf paper value is reproducible as a table interpolation; the full printed chain is not internally exact. No production equations or historical runs were changed.', '',
        '## Every arithmetic row', '',
        'Values below are recalculated from printed immediate parent rows, not propagated corrected values. A dash denotes a graph reading or specified coefficient retained as an input. Differences include normal graph/rounding precision as well as larger inconsistencies; no blanket pass/fail tolerance is imposed.', '',
        '| Table | Trial trim | Row | Quantity | Printed | Recomputed | Difference |',
        '|---:|---:|---:|---|---:|---:|---:|',
    ]
    for item in t1+t2:
        value='—' if item['calculated'] is None else f"{item['calculated']:.10g}"
        diff='—' if item['difference'] is None else f"{item['difference']:+.6g}"
        trial='—' if item['trial_trim_deg'] is None else str(item['trial_trim_deg'])
        lines.append(f"| {item['table']} | {trial} | {item['row']} | {item['quantity']} | {item['printed']:.10g} | {value} | {diff} |")
    lines += ['', '## Reproduce or inspect', '',
        'Run `python3 optimization/savitsky/paper1964_audit.py` from the repository root. Requires only Python’s standard library.', '',
        '- [Editable source transcription](../../../optimization/savitsky/paper1964-data.json)',
        '- [Calculation code](../../../optimization/savitsky/paper1964_audit.py)',
        '- [Audit notebook](../../../optimization/savitsky/paper1964-reference.ipynb)',
        '- [Machine-readable audit](paper-arithmetic-audit.json) and [all rows as CSV](paper-arithmetic-rows.csv).', '']
    (out/'PAPER-REPLICATION.md').write_text('\n'.join(lines))
    return report


if __name__ == '__main__':
    result=write_audit()
    print('Wrote PAPER-REPLICATION.md, paper-arithmetic-audit.json, paper-arithmetic-rows.csv')
    print('Table 1 interpolated lambda:',result['table1_summary']['lambda_from_printed_interpolation'])
    print('Table 2 trim with printed intermediate:',result['table2_extra']['trim_from_printed_2_42_deg'])
