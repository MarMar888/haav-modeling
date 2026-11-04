"""Render an engineering preview of the saved static model (requires matplotlib)."""
import json
import os
from pathlib import Path
os.environ.setdefault('MPLCONFIGDIR','/private/tmp/boat-mpl-cache')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import numpy as np

folder=Path(__file__).resolve().parent
data=json.loads((folder/'static-view-data.json').read_text());r=data['results']
R=np.array(r['rotation_body_to_world']);origin=np.array(r['waterplane_origin_in'])
def world(points):return (np.array(points)-origin)@R.T
hull=world(data['hull_triangles']);wet=world(data['submerged_triangles'])
cg=world(r['cg_in']);cb=world(r['cb_in'])
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
fig=plt.figure(figsize=(14,8),facecolor='#f5f7f6')
fig.text(.055,.945,'HAV / FRESHWATER HYDROSTATICS',fontsize=19,weight='bold',color='#183b46')
fig.text(.055,.902,f"{r['total_weight_lbs']:.3f} lb all-up    |    {r['displacement_ft3']:.3f} ft³ displaced    |    {r['pitch_deg']:.3f}° stern down    |    {abs(r['roll_deg']):.3f}° heel",color='#526f78',fontsize=12)
ax=fig.add_axes([.065,.49,.87,.31],facecolor='#f5f7f6')
ax.axhspan(-10,0,color='#dcecf0');ax.axhline(0,color='#337b97',lw=1.4)
ax.add_collection(PolyCollection(hull[:,:,[1,2]],facecolor='#bbced1',edgecolor='none',alpha=.28))
ax.add_collection(PolyCollection(wet[:,:,[1,2]],facecolor='#4388a4',edgecolor='none',alpha=.45))
for line in data['waterline']:
    p=world(line);ax.plot(p[:,1],p[:,2],color='#28627c',lw=.7)
ax.scatter([cg[1]],[cg[2]],c='#d89b21',s=65,zorder=5,label='Center of gravity')
ax.scatter([cb[1]],[cb[2]],c='#b54453',s=55,zorder=5,label='Center of buoyancy')
ax.annotate('G',cg[[1,2]],xytext=(9,3),textcoords='offset points',color='#8e6319',weight='bold')
ax.annotate('B',cb[[1,2]],xytext=(9,-5),textcoords='offset points',color='#9c3441',weight='bold')
ax.set_xlim(-28,52);ax.set_ylim(-8,8);ax.set_aspect('equal');ax.set_yticks([-6,-3,0,3,6]);ax.set_ylabel('Height above water (in)');ax.set_xticks([]);ax.set_title('SIDE VIEW  /  stern left, bow right',loc='left',fontsize=11,color='#526f78',pad=12)
ax.text(-24,-7.3,f"Stern waterline: {r['stern_centerline_waterline_z_in']:.3f} in above hull baseline",fontsize=10,color='#244b59')
ax.text(41,.6,'WATER',fontsize=9,color='#337b97')
ax3=fig.add_axes([.05,.07,.53,.35],projection='3d',facecolor='#f5f7f6')
ax3.add_collection3d(Poly3DCollection(hull,facecolor='#bad0d6',edgecolor='none',alpha=.2))
ax3.add_collection3d(Poly3DCollection(wet,facecolor='#28799c',edgecolor='none',alpha=.65))
plane=np.array([[[-35,-35,0],[35,-35,0],[35,55,0],[-35,55,0]]])
ax3.add_collection3d(Poly3DCollection(plane,facecolor='#9ec8d6',alpha=.18))
for line in data['waterline']:
    p=world(line);ax3.plot(*p.T,color='#184f68',lw=.7)
ax3.scatter(*cg,c='#d89b21',s=40,depthshade=False);ax3.scatter(*cb,c='#b54453',s=35,depthshade=False)
ax3.set_xlim(-17,17);ax3.set_ylim(-28,52);ax3.set_zlim(-8,8);ax3.set_box_aspect((34,80,16));ax3.view_init(elev=23,azim=-35);ax3.set_axis_off()
fig.text(.61,.39,'CALCULATED CONDITION',fontsize=11,color='#526f78',weight='bold')
fig.text(.61,.335,f"CG: X {r['cg_in'][0]:.3f}, Y {r['cg_in'][1]:.3f}, Z {r['cg_in'][2]:.3f} in\nCB: X {r['cb_in'][0]:.3f}, Y {r['cb_in'][1]:.3f}, Z {r['cb_in'][2]:.3f} in",fontsize=11,color='#183b46',linespacing=1.8)
fig.text(.61,.235,'Hull: 72.000 × 24.904 × 12.000 in\nFreshwater density: 1,000 kg/m³\nPositive X side slightly lower',fontsize=10,color='#526f78',linespacing=1.7)
fig.text(.61,.12,'Frame weight includes hull. Blank mass rows excluded.\nHull solid only; no tube or appendage buoyancy.\nCalm water. Coordinates reference the source CAD.',fontsize=9,color='#6d8086',linespacing=1.7)
fig.savefig(folder/'static-model-preview.png',dpi=160,facecolor=fig.get_facecolor())
print(folder/'static-model-preview.png')
