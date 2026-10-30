"""Solve this loading condition against the STEP solid and export viewer data.

Requires numpy and cadquery-ocp-novtk. Run from any working directory.
Masses in the input CSV are pounds; positions and exported geometry are inches.
"""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from OCP.Bnd import Bnd_Box
from OCP.BRep import BRep_Tool
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common, BRepAlgoAPI_Section
from OCP.BRepAdaptor import BRepAdaptor_Curve
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeFace
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepGProp import BRepGProp
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRepPrimAPI import BRepPrimAPI_MakeHalfSpace
from OCP.GProp import GProp_GProps
from OCP.IFSelect import IFSelect_RetDone
from OCP.STEPControl import STEPControl_Reader
from OCP.TopAbs import TopAbs_FACE, TopAbs_EDGE
from OCP.TopExp import TopExp_Explorer
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS
from OCP.gp import gp_Dir, gp_Pln, gp_Pnt

ROOT = Path(__file__).resolve().parents[2]
MM_PER_IN = 25.4
KG_PER_LB = 0.45359237


def rotation(roll, pitch):
    """Body to world: rotate about longitudinal Y, then transverse X."""
    cr, sr, cp, sp = math.cos(roll), math.sin(roll), math.cos(pitch), math.sin(pitch)
    return np.array([[cr, 0, sr], [sp * sr, cp, -sp * cr], [-cp * sr, sp, cp * cr]])


def properties(shape):
    props = GProp_GProps()
    BRepGProp.VolumeProperties_s(shape, props)
    c = props.CentreOfMass()
    return props.Mass() / MM_PER_IN**3, np.array([c.X(), c.Y(), c.Z()]) / MM_PER_IN


def triangles(shape):
    BRepMesh_IncrementalMesh(shape, 0.6, False, 0.12, True)
    result = []
    explorer = TopExp_Explorer(shape, TopAbs_FACE)
    while explorer.More():
        face = TopoDS.Face(explorer.Current())
        loc = TopLoc_Location()
        mesh = BRep_Tool.Triangulation_s(face, loc)
        if mesh:
            for i in range(1, mesh.NbTriangles() + 1):
                triangle = []
                for index in mesh.Triangle(i).Get():
                    p = mesh.Node(index).Transformed(loc.Transformation())
                    triangle.append([round(p.X()/25.4, 6), round(p.Y()/25.4, 6), round(p.Z()/25.4, 6)])
                result.append(triangle)
        explorer.Next()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--water-density', type=float, default=1000.0, help='Freshwater kg/m³; nominal default 1000')
    args = parser.parse_args()
    if args.water_density <= 0:
        raise ValueError('Water density must be positive')
    folder = Path(__file__).resolve().parent
    source = ROOT / 'cad/stepfiles/v3 - solid hull. 10.29.26'
    mass_path = folder / 'component-masses.csv'
    components, excluded = [], []
    with mass_path.open(newline='') as stream:
        for row in csv.DictReader(stream):
            if not row['mass_lbs'].strip():
                excluded.append(row['component_id'])
                continue
            mass = float(row['mass_lbs'])
            cg = [float(row[k]) for k in ['cg_x_in', 'cg_y_in', 'cg_z_in']]
            if mass < 0 or not np.isfinite([mass, *cg]).all():
                raise ValueError(f'Invalid component: {row["component_id"]}')
            components.append(dict(id=row['component_id'], name=row['component'], mass_lbs=mass, cg_in=cg))
    weight = sum(c['mass_lbs'] for c in components)
    if weight <= 0:
        raise ValueError('Positive total weight required')
    cg = sum(c['mass_lbs'] * np.array(c['cg_in']) for c in components) / weight
    rho_lb_in3 = args.water_density / KG_PER_LB * 0.0254**3
    target_volume = weight / rho_lb_in3
    reader = STEPControl_Reader()
    if reader.ReadFile(str(source)) != IFSelect_RetDone:
        raise ValueError('Could not read STEP')
    reader.TransferRoots()
    shape = reader.OneShape()
    if not BRepCheck_Analyzer(shape).IsValid():
        raise ValueError('Invalid hull geometry')
    full_volume, _ = properties(shape)
    if target_volume >= full_volume:
        raise ValueError('Weight exceeds displacement of the complete solid')
    bounds = Bnd_Box()
    BRepBndLib.AddOptimal_s(shape, bounds)
    lo, hi = bounds.CornerMin(), bounds.CornerMax()
    limits = np.array([[lo.X(), lo.Y(), lo.Z()], [hi.X(), hi.Y(), hi.Z()]]) / 25.4
    y_ref = float(cg[1])

    def submerged(state):
        h, roll, pitch = state
        R = rotation(roll, pitch)
        normal = R[2]
        origin = np.array([0., y_ref, h])
        plane = gp_Pln(gp_Pnt(*(origin*25.4)), gp_Dir(*normal))
        face = BRepBuilderAPI_MakeFace(plane).Face()
        halfspace = BRepPrimAPI_MakeHalfSpace(face, gp_Pnt(*((origin-normal*200)*25.4))).Solid()
        common = BRepAlgoAPI_Common(shape, halfspace)
        common.Build()
        if not common.IsDone():
            raise RuntimeError('Submerged solid intersection failed')
        result = common.Shape()
        volume, cb = properties(result)
        return volume, cb, result

    def residual(state):
        volume, cb, _ = submerged(state)
        horizontal_offset = (rotation(state[1], state[2]) @ (cb-cg))[:2]
        return np.array([(volume-target_volume)/target_volume, *horizontal_offset/72])

    # Newton solve in waterline height, roll, pitch; central finite differences.
    state = np.array([6., 0., 0.])
    steps = np.array([0.002, 0.00005, 0.00005])
    history = []
    for iteration in range(30):
        f = residual(state)
        norm = float(np.linalg.norm(f))
        history.append(dict(iteration=iteration, state=state.tolist(), residual_norm=norm))
        print(f'Iteration {iteration}: h={state[0]:.5f} in, roll={math.degrees(state[1]):.5f}°, pitch={math.degrees(state[2]):.5f}°, residual={norm:.3g}', flush=True)
        if norm < 1e-8:
            break
        jac = np.column_stack([(residual(state+np.eye(3)[i]*steps[i])-residual(state-np.eye(3)[i]*steps[i]))/(2*steps[i]) for i in range(3)])
        delta = np.linalg.solve(jac, -f)
        scale = 1.
        while scale > 1/128:
            trial = state + scale*delta
            if abs(trial[1]) < math.radians(35) and abs(trial[2]) < math.radians(35) and np.linalg.norm(residual(trial)) < norm:
                state = trial
                break
            scale /= 2
        else:
            raise RuntimeError('Equilibrium solve failed to improve')
    else:
        raise RuntimeError('Equilibrium did not converge')
    volume, cb, wet_shape = submerged(state)
    R = rotation(state[1], state[2])
    origin = np.array([0., y_ref, state[0]])
    n = R[2]
    def waterline_z(x,y):
        return float(state[0] - (n[0]*x+n[1]*(y-y_ref))/n[2])
    # Approximate local angular restoring stiffness: re-settle height at each angle.
    def settle_height(roll,pitch,h):
        for _ in range(15):
            v, c, _ = submerged([h,roll,pitch])
            error=v-target_volume
            if abs(error)/target_volume<1e-9: return h,c
            dv=(submerged([h+.002,roll,pitch])[0]-submerged([h-.002,roll,pitch])[0])/.004
            h-=error/dv
        raise RuntimeError('Height perturbation failed')
    def moment(roll,pitch):
        h,c=settle_height(roll,pitch,state[0])
        # Body torques from upward buoyancy and downward weight.
        torque=weight*np.cross(c-cg,rotation(roll,pitch)[2])
        # Generalized axes for R=Rx(pitch)Ry(roll).
        return np.array([torque[1],np.dot(torque,[math.cos(roll),0,math.sin(roll)])])
    angle_step=math.radians(.05)
    stiffness=np.column_stack([(moment(state[1]+(i==0)*angle_step,state[2]+(i==1)*angle_step)-moment(state[1]-(i==0)*angle_step,state[2]-(i==1)*angle_step))/(2*angle_step) for i in range(2)])
    eigenvalues=np.linalg.eigvalsh((stiffness+stiffness.T)/2)
    horizontal_error=(R@(cb-cg))[:2]
    results=dict(
        source=str(source.relative_to(ROOT)), source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        mass_csv_sha256=hashlib.sha256(mass_path.read_bytes()).hexdigest(),
        water_density_kg_m3=args.water_density, total_weight_lbs=weight,components=components,excluded_blank_rows=excluded,
        cg_in=cg.tolist(),cb_in=cb.tolist(),hull_bounds_in=limits.tolist(),full_volume_in3=full_volume,
        displacement_in3=volume,displacement_ft3=volume/1728,buoyant_weight_lbs=volume*rho_lb_in3,
        roll_deg=math.degrees(state[1]),pitch_deg=math.degrees(state[2]),
        heel_direction='positive X side lower' if state[1]>0 else 'negative X side lower',
        trim_direction='stern down' if state[2]>0 else 'bow down',
        stern_centerline_waterline_z_in=waterline_z(0,0), bow_centerline_waterline_z_in=waterline_z(0,72),
        waterplane_origin_in=origin.tolist(), waterplane_normal_body=n.tolist(),rotation_body_to_world=R.tolist(),
        weight_residual_lbs=volume*rho_lb_in3-weight,horizontal_cg_cb_error_in=horizontal_error.tolist(),
        restoring_stiffness_lb_in_per_rad=stiffness.tolist(),restoring_eigenvalues=eigenvalues.tolist(),
        locally_restoring=bool(np.all(eigenvalues<0)),history=history,
        assumptions=['Nominal freshwater density 1000 kg/m³ unless overridden.', 'Frame mass and CG represent the combined hull/frame assembly.',
                     'Blank mass rows are excluded, not estimated.', 'Only the supplied hull solid contributes buoyancy; tubes and appendages are excluded.',
                     'Calm water, no speed, waves, thrust or mooring forces.', 'Upper CAD closure is treated as sealed; physical downflooding is not modeled.',
                     'Component markers show CG positions, not component sizes.'])
    plane=gp_Pln(gp_Pnt(*(origin*25.4)),gp_Dir(*n))
    section=BRepAlgoAPI_Section(shape,plane,False)
    section.Build()
    if not section.IsDone():
        raise RuntimeError('Waterline section failed')
    waterline=[]
    explorer=TopExp_Explorer(section.Shape(),TopAbs_EDGE)
    while explorer.More():
        curve=BRepAdaptor_Curve(TopoDS.Edge(explorer.Current()))
        points=[]
        for parameter in np.linspace(curve.FirstParameter(),curve.LastParameter(),101):
            point=curve.Value(parameter)
            points.append([point.X()/25.4,point.Y()/25.4,point.Z()/25.4])
        waterline.append(points)
        explorer.Next()
    waterline_array=np.array([p for line in waterline for p in line])
    results['waterline_y_limits_in']=[float(waterline_array[:,1].min()),float(waterline_array[:,1].max())]
    (folder/'static-results.json').write_text(json.dumps(results,indent=2)+'\n')
    (folder/'static-view-data.json').write_text(json.dumps(dict(results=results,hull_triangles=triangles(shape),submerged_triangles=triangles(wet_shape),waterline=waterline),separators=(',',':')))
    print(json.dumps({k:v for k,v in results.items() if k not in ['components','history','assumptions']},indent=2))


if __name__ == '__main__':
    main()
