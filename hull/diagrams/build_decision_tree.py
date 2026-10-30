"""Regenerate decision trees from the current notebook without executing its cells.

Run from the repository root: python3 hull/diagrams/build_decision_tree.py
Requires matplotlib. Only documentation images, Mermaid and tables are written.
"""
from pathlib import Path
import ast
import json
import math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

HERE = Path(__file__).resolve().parent
ENGINE = HERE.parents[1] / 'optimization/savitsky'
config = json.loads((ENGINE / 'current-hull-inputs.json').read_text())
notebook = json.loads((ENGINE / 'current-hull.ipynb').read_text())
ns = {'math': math, 'config': config, 'G': 9.8066}
for cell in notebook['cells']:
    if cell['cell_type'] == 'code':
        for node in ast.parse(''.join(cell['source'])).body:
            if isinstance(node, ast.FunctionDef):
                exec(compile(ast.Module(body=[node], type_ignores=[]), 'current-hull.ipynb', 'exec'), ns)
p = config['inputs']
v = 22 * .44704
base = ns['solve'](p, v)

def solve(changes):
    r = ns['solve']({**p, **changes}, v)
    assert 'trim_deg' in r, r
    assert abs(r['vertical_residual_n']) < 1e-6 * p['mass_kg'] * 9.8066
    assert abs(r['moment_residual_nm']) < 1e-6 * p['mass_kg'] * 9.8066 * p['length_m']
    return r

plt.rcParams['svg.fonttype'] = 'none'
fig, ax = plt.subplots(figsize=(19, 18))
fig.patch.set_facecolor('#f6f8fc')
ax.set(xlim=(0, 190), ylim=(0, 180)); ax.axis('off')

def box(x, y, w, h, title, body, color='#e8efff', size=11):
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='round,pad=.5,rounding_size=1.2',fc=color,ec='#7185a2',lw=1.2,zorder=3))
    ax.text(x+w/2,y+h-2.5,title,ha='center',va='top',fontsize=13,fontweight='bold',color='#21334c',zorder=4)
    ax.text(x+w/2,y+h-7,body,ha='center',va='top',fontsize=size,linespacing=1.5,color='#21334c',zorder=4)

def edge(a,b):
    ax.add_patch(FancyArrowPatch(a,b,arrowstyle='-|>',mutation_scale=13,color='#7185a2',lw=1.5,zorder=2))

ax.text(3,176,'Decision tree: change chine-to-chine beam b',fontsize=24,fontweight='bold',color='#21334c')
ax.text(3,171,'First follow the equations at fixed trim and wetted keel length; then let the boat re-balance.',fontsize=13,color='#52647a')
box(58,151,74,14,'CHANGE BEAM — keep other inputs fixed','Baseline: 12 in chine beam; 22 mph; 125.25 lb loaded mass')
for x, factor, title in [(3,1.1,'INCREASE b by 10% → 13.2 in'),(101,.9,'DECREASE b by 10% → 10.8 in')]:
    up = factor > 1
    u,d = ('↑','↓') if up else ('↓','↑')
    q = {**p,'beam_m':p['beam_m']*factor}
    fixed=ns['forces'](q,v,base['trim_deg'],base['keel_wetted_m'])
    r=solve({'beam_m':q['beam_m']})
    edge((95,151),(x+43,145))
    box(x,131,86,14,title,'STEP 1: hold running trim τ and wetted keel Lk fixed','#e8efff')
    edge((x+43,131),(x+43,126))
    body=(f'ΔL = (b/π) tanβ / tanτ  {u}   →   Lc = Lk − ΔL  {d}\n'
          f'λ = (Lk + Lc)/(2b)  {d}   |   Cv = V/√(gb)  {d}\n'
          f'Mean wet length λb = Lk − ΔL/2  {d}')
    box(x,104,86,22,'GEOMETRY BRANCH — wet chines',body,'#e5f3ed',12)
    edge((x+23,104),(x+20,98));edge((x+63,104),(x+66,98))
    box(x,67,40,31,'LIFT / PRESSURE',f'CL0(τ, λ, Cv)  {d} *\nCLβ = CL0 − .0065βCL0^.6  {d} *\nLift = ½ρV²b² CLβ  {u} *\nDp = Lift × tanτ  {u} *\nPressure center xp also moves.',size=9.5)
    box(x+46,67,40,31,'FRICTION',f'Wetted area S  {u} *\nRe = V√fv · λb / ν  {d} *\nCf = .075/(log₁₀Re − 2)²  {u} *\nFf = ½ρCf S V²  {u} *\n* Local result at baseline attitude',size=9.5)
    edge((x+20,67),(x+43,61));edge((x+66,67),(x+43,61))
    box(x,43,86,18,'STEP 2: RE-SOLVE force and pitch balance','The old attitude no longer balances the forces and moments.\nTrim τ and wetted keel length Lk adjust together.','#fff0dc',12)
    edge((x+43,43),(x+43,37))
    def pct(key):return (r[key]/base[key]-1)*100
    body=(f"Trim {r['trim_deg']:.3f}° ({r['trim_deg']-base['trim_deg']:+.3f}°); Lk {r['keel_wetted_m']/.0254:.2f} in ({pct('keel_wetted_m'):+.2f}%)\n"
          f"Area {pct('wetted_area_m2'):+.2f}%; Re {pct('reynolds_number'):+.2f}%; friction drag {pct('friction_drag_n'):+.2f}%\n"
          f"Pressure drag {pct('pressure_drag_n'):+.2f}%; total R and power {pct('resistance_n'):+.2f}%\n"
          f"Effective power: {r['effective_power_kw']*1000:.2f} W (baseline {base['effective_power_kw']*1000:.2f} W)")
    box(x,13,86,24,'FINAL LOCAL RESULT at 22 mph',body,'#eee9fa',11.5)
ax.text(3,7,'↑ / ↓ on geometry are conditional on fixed τ, Lk and wet chines. Starred signs are computed local results, not universal laws.',fontsize=11,color='#52647a')
ax.text(3,2,'Final results are model sensitivities, not planing-onset predictions. Baseline and wider case wet beyond the assumed uniform aft section.',fontsize=11,color='#52647a')
for ext in ['svg','png']:
    fig.savefig(HERE/f'beam-decision-tree.{ext}',dpi=145,bbox_inches='tight',facecolor=fig.get_facecolor())
plt.close(fig)

cases=[('Chine beam ±10%','beam_m',p['beam_m']*.1),('Deadrise ±2°','deadrise_deg',2),('Loaded mass ±10%','mass_kg',p['mass_kg']*.1),('CG forward coordinate ±1 in','lcg_m',.0254),('CG height ±1 in','vcg_m',.0254),('Thrust angle ±2°','thrust_angle_deg',2),('Thrust-point height ±1 in','thrust_height_m',.0254),('Thrust-point forward coordinate ±1 in','thrust_x_m',.0254),('Overall hull length ±10%','length_m',p['length_m']*.1)]
lines=['| Decision | Direction | Trim Δ (°) | Lk Δ (%) | Area Δ (%) | Re Δ (%) | Pressure drag Δ (%) | Friction drag Δ (%) | R / power Δ (%) | Screen / geometry |','|---|---|---:|---:|---:|---:|---:|---:|---:|---|']
mermaid=['flowchart LR','  ROOT{"Which decision variable?"}']
for i,(label,key,step) in enumerate(cases):
    mermaid += [f'  ROOT --> V{i}["{label}"]']
    for sign,word in [(1,'Increase'),(-1,'Decrease')]:
        r=solve({key:p[key]+sign*step})
        ds=[(r[k]/base[k]-1)*100 for k in ['keel_wetted_m','wetted_area_m2','reynolds_number','pressure_drag_n','friction_drag_n','resistance_n']]
        geo='beyond aft' if r['keel_wetted_m']>config['uniform_aft_length_m'] else 'within aft'
        lines.append(f"| {label} | {word} | {r['trim_deg']-base['trim_deg']:+.3f} | "+' | '.join(f'{d:+.2f}' for d in ds)+f" | {r['status']} / {geo} |")
        tag=f'R{i}{"p" if sign>0 else "m"}'
        mermaid.append(f'  V{i} --> {tag}["{word}<br/>trim Δ {r["trim_deg"]-base["trim_deg"]:+.3f}°; wetting {ds[0]:+.2f}%<br/>pressure drag {ds[3]:+.2f}%; friction drag {ds[4]:+.2f}%<br/>total R and power {ds[5]:+.2f}%"]')
(HERE/'decision-sensitivities.md').write_text('# Increase / decrease results at 22 mph\n\nGenerated by `build_decision_tree.py` from the notebook functions and default input JSON. One input changes at a time; speed and all other inputs stay fixed. Values are changes from the baseline, not universal signs. `within_screen` is the implemented empirical screen; the uniform-aft geometry check is separate.\n\n'+'\n'.join(lines)+'\n')
(HERE/'decision-tree.mmd').write_text('\n'.join(mermaid)+'\n')
print('Generated beam decision tree, increase/decrease Mermaid tree and sensitivity table.')
