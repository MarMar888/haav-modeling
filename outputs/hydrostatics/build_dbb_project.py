"""Prepare an original-DBB project using hydrostatic geometric similarity.

Lengths are 10x full size; masses are 1000x, keeping water density unchanged.
This avoids the original app's minimum hull-depth clamp and small mass rounding.
"""
import csv
import json
from pathlib import Path

folder=Path(__file__).resolve().parent
scale=10.0
offset_rows=list(csv.reader((folder/'hull-offsets-m.csv').open(newline='')))
xs=[float(v)*scale for v in offset_rows[0][1:]]
zs=[float(row[0])*scale for row in offset_rows[1:]]
half=[[None if v=='' else float(v)*scale for v in row[1:]] for row in offset_rows[1:]]
blocks=[]
with (folder/'component-masses.csv').open(newline='') as stream:
    for row in csv.DictReader(stream):
        if not row['mass_lbs'].strip():continue
        mass=float(row['mass_lbs'])*0.00045359237*scale**3
        position=[float(row[k])*0.0254*scale for k in ['cg_y_in','cg_x_in','cg_z_in']]
        blocks.append(dict(id=row['component_id'].replace(' ','_'),name='Frame + hull assembly' if row['component_id']=='backbone' else row['component'],
                           shape='box',group='weights',reqs=[],position=position,size=[0.1,0.1,0.1],rotation=[0,0,0],
                           density=None,fill=100,massOverride=mass,freeSurface=False,deck=False,gt=False,hidden=False,areaOverride=None))
project=dict(app='dbb-block-editor',version=2,name='HAV — 10x hydrostatic similarity model (divide lengths by 10; masses by 1000)',
             units='m',axes='DBB x = source CAD Y; DBB y = source CAD X; DBB z = source CAD Z. Lengths 10x; masses 1000x. Positive transverse sign follows CAD X; physical port sign is unconfirmed.',
             groups=[dict(id='weights',name='Measured/CAD component weights — 1000x mass',color='#397986',parent=None,visible=True,density=None)],
             requirements=[],customShapes=[],waterDensity=1.0,draught=.162*scale,waterline=True,float=True,structurePercent=0,
             hulls=[dict(id='hav',name='HAV hull — 10x geometry',type='offsets',x=0,y=0,loa=1.8288*scale,
                         beam=2*max(v for row in half for v in row if v is not None),depth=.3048*scale,draught=.162*scale,visible=True,
                         offsets=dict(xs=xs,zs=zs,halfBreadth=half))],blocks=blocks)
dest=folder/'dbb-project-10x.json'
dest.write_text(json.dumps(project,indent=2)+'\n')
print(dest)
