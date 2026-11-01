"""Render a local, standalone hull comparison from the sourced case collection."""
from pathlib import Path
import textwrap

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Rectangle

OUT = Path(__file__).resolve().parent
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11})
fig = plt.figure(figsize=(16, 11), facecolor='white')
fig.text(.045, .955, 'Hull design choices from the 2025–2026 papers', fontsize=23, weight='bold')
fig.text(.045, .918, 'Shapes, construction routes and practical design checks • selected examples • no mass comparison', color='#475569', fontsize=12)

def hull(ax, x, width, low=.13, high=.9):
    ax.add_patch(Polygon([(x-width/2,low),(x+width/2,low),(x+width/2,high-.25),
                          (x+width*.32,high-.08),(x,high),(x-width*.32,high-.08),
                          (x-width/2,high-.25)], facecolor='#dbeafe', edgecolor='#2563eb', lw=2, joinstyle='round'))

data = [
    ('Monohull', 'Single continuous hull', 'VCU #2 Autonomy; Mass Maritime #1 Open',
     'Check loaded freeboard, hatch height, usable mounting space and fore–aft trim.'),
    ('Catamaran', 'Two hulls + connecting bridge', 'W&M #1 Autonomy; East Carolina #2 Open',
     'Check tunnel clearance, bridge stiffness, turning behavior and water flow into the propellers.'),
    ('Hull + outriggers', 'Central hull + side floats', 'Johns Hopkins #3 Autonomy',
     'Check added float drag, frame loads, equipment height and watertight attachments.'),
    ('Hull + hydrofoils', 'Lifting surfaces below the hull', 'Madison College #3 Open',
     'Check thrust through takeoff, pitch control, alignment and concentrated foil loads.'),
]
for i, (title, subtitle, teams, check) in enumerate(data):
    left=.045+i*.24
    ax=fig.add_axes([left+.025,.645,.18,.22]);ax.set_xlim(0,1);ax.set_ylim(0,1);ax.set_aspect('equal');ax.axis('off')
    if i==0:
        hull(ax,.5,.42)
        for x in [.4,.5,.6]:ax.plot([x,x],[.16,.63],color='#2563eb',lw=1,ls='--')
    elif i==1:
        ax.add_patch(Rectangle((.25,.25),.5,.35,fc='#e2e8f0',ec='#64748b'))
        hull(ax,.23,.2);hull(ax,.77,.2)
    elif i==2:
        for y in [.28,.53]:ax.plot([.12,.88],[y,y],lw=5,color='#64748b')
        hull(ax,.5,.32);hull(ax,.12,.13,high=.64);hull(ax,.88,.13,high=.64)
    else:
        ax.add_patch(Polygon([(.12,.42),(.88,.42),(.82,.52),(.18,.52)],fc='#fed7aa',ec='#c2410c',lw=2))
        hull(ax,.5,.32,low=.2)
        ax.plot([.5,.5],[.08,.22],color='#64748b',lw=3)
        ax.add_patch(Rectangle((.31,.06),.38,.06,fc='#fed7aa',ec='#c2410c',lw=2))
    fig.text(left,.628,title,fontsize=15,weight='bold')
    fig.text(left,.603,subtitle,fontsize=10,color='#475569')
    fig.text(left,.557,textwrap.fill('2026: '+teams,31),fontsize=11,linespacing=1.45)
    fig.text(left,.473,textwrap.fill(check,33),fontsize=11,linespacing=1.45)

fig.text(.045,.394,'Leading 2026 entries used several construction strategies',fontsize=16,weight='bold')
rows=[
    ['William & Mary','1st · Autonomy','Carbon fiber + foam','Reuse and refine 2025 hull'],
    ['VCU','2nd · Autonomy','Inherited V-bottom hull','Reuse; revise internal mounts'],
    ['Johns Hopkins','3rd · Autonomy','Fiberglass + foam / PVC','Buy RC hull; add outriggers'],
    ['Mass Maritime','1st · Open','Plywood + epoxy + fiberglass','Assemble stitch-and-glue kit'],
    ['East Carolina','2nd · Open','Carbon fiber / epoxy','Custom mold and vacuum layup'],
    ['Madison College','3rd · Open','Marine plastic + aluminum','Custom tooling and thermoforming'],
]
ax=fig.add_axes([.045,.117,.92,.245]);ax.axis('off')
t=ax.table(cellText=rows,colLabels=['Team','Overall placement','Hull / supporting materials','Procurement / construction'],colWidths=[.19,.17,.29,.35],cellLoc='left',colLoc='left',bbox=[0,0,1,1])
t.auto_set_font_size(False);t.set_fontsize(11)
for (r,c),cell in t.get_celld().items():
    cell.set_edgecolor('#cbd5e1');cell.set_linewidth(.5)
    cell.set_facecolor('#eaf0f7' if r==0 else ('#f8fafc' if r%2==0 else 'white'))
    if r==0:cell.set_text_props(weight='bold')
fig.text(.045,.075,'Schematic top views; bow upward. Not to scale or exact boat geometry. Hydrofoils are below the hull.',fontsize=10,color='#475569')
fig.text(.045,.050,'Placements include paper/video scores and do not isolate hull performance. Successful race foiling is not established here.',fontsize=10,color='#475569')
fig.text(.045,.025,'Sources: team papers in PEP2025TeamExtractions and PEP2026TeamExtractions; paper links and page references in pep-hull-cases.json.',fontsize=9,color='#475569')
for ext in ['png','svg']:
    fig.savefig(OUT/f'pep-hull-comparison.{ext}',dpi=160,facecolor='white')
print(OUT/'pep-hull-comparison.png')
