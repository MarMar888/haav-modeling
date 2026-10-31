"""Measure v4 STEP for input review only; does not run Savitsky.

Needs cadquery-ocp-novtk. Coordinates are converted from Open CASCADE mm to inches.
Run: python hull/boats/v4-2026-10-30/measure_geometry.py
"""
from pathlib import Path
import csv
import hashlib
import json
import math
from OCP.STEPControl import STEPControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepBndLib import BRepBndLib
from OCP.Bnd import Bnd_Box
from OCP.TopAbs import TopAbs_EDGE, TopAbs_SOLID, TopAbs_FACE
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Curve

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = ROOT / 'cad/stepfiles/v4 - solid hull 10.30.26'
MASS_FILE = HERE / 'component-masses.csv'

def xyz(p):
    return [getattr(p, k)()/25.4 for k in ['X', 'Y', 'Z']]


def measure():
    reader = STEPControl_Reader()
    if reader.ReadFile(str(SOURCE)) != IFSelect_RetDone:
        raise ValueError('Could not read STEP')
    reader.TransferRoots()
    shape = reader.OneShape()
    if not BRepCheck_Analyzer(shape).IsValid():
        raise ValueError('Invalid STEP topology')
    box = Bnd_Box()
    BRepBndLib.AddOptimal_s(shape, box)
    lower, upper = xyz(box.CornerMin()), xyz(box.CornerMax())
    counts = {}
    for name, kind in [('solids', TopAbs_SOLID), ('faces', TopAbs_FACE)]:
        explorer = TopExp_Explorer(shape, kind)
        count = 0
        while explorer.More():
            count += 1
            explorer.Next()
        counts[name] = count
    # Select OUTER boundary curves by their aft and forward endpoints. The
    # 0.25-inch inner shell starts at Y=.25 and is deliberately not selected.
    curves = {}
    explorer = TopExp_Explorer(shape, TopAbs_EDGE)
    while explorer.More():
        curve = BRepAdaptor_Curve(TopoDS.Edge(explorer.Current()))
        a, b = xyz(curve.Value(curve.FirstParameter())), xyz(curve.Value(curve.LastParameter()))
        if abs(b[1]) < 1e-5:
            a, b = b, a
        if abs(a[1]) < 1e-5 and abs(b[1]-60) < 1e-5:
            for name, aft_x in [('outer_chine', 7), ('inner_chine', 6.50190265), ('keel', 0)]:
                if abs(a[0]-aft_x) < 1e-5:
                    curves[name] = curve
        explorer.Next()
    if set(curves) != {'outer_chine', 'inner_chine', 'keel'}:
        raise ValueError('v4 edge selection no longer matches the expected topology')

    def at_station(curve, station):
        lo, hi = curve.FirstParameter(), curve.LastParameter()
        increasing = curve.Value(hi).Y() > curve.Value(lo).Y()
        for _ in range(70):
            mid = (lo+hi)/2
            if (curve.Value(mid).Y()/25.4 < station) == increasing:
                lo = mid
            else:
                hi = mid
        p = xyz(curve.Value((lo+hi)/2))
        if abs(p[1]-station) > 1e-6:
            raise ValueError('Station did not converge')
        return p

    transom_edges = []
    faces = TopExp_Explorer(shape, TopAbs_FACE)
    while faces.More():
        face_box = Bnd_Box()
        BRepBndLib.AddOptimal_s(faces.Current(), face_box)
        if max(abs(face_box.CornerMin().Y()), abs(face_box.CornerMax().Y())) < 1e-4:
            edge = TopExp_Explorer(faces.Current(), TopAbs_EDGE)
            while edge.More():
                curve = BRepAdaptor_Curve(TopoDS.Edge(edge.Current()))
                transom_edges.append([xyz(curve.Value(curve.FirstParameter() +
                    (curve.LastParameter()-curve.FirstParameter())*index/100))
                    for index in range(101)])
                edge.Next()
        faces.Next()
    if not transom_edges:
        raise ValueError('Outer transom profile not found')
    sections = []
    for station in [0, 6, 12, 18, 24, 30, 36, 38, 42, 48, 54, 59.9]:
        k, i, o = [at_station(curves[name], station) for name in ['keel', 'inner_chine', 'outer_chine']]
        sections.append(dict(station_forward_of_transom_in=station,
            outer_chine_beam_in=2*o[0], main_v_beam_in=2*i[0], keel_z_in=k[2],
            outer_chine_z_in=o[2], inner_chine_z_in=i[2],
            main_v_chord_deg=math.degrees(math.atan2(i[2]-k[2], i[0]-k[0])),
            outer_chine_chord_deg=math.degrees(math.atan2(o[2]-k[2], o[0]-k[0])),
            reverse_chine_chord_deg=math.degrees(math.atan2(o[2]-i[2], o[0]-i[0]))))
    populated, excluded = [], []
    for row in csv.DictReader(MASS_FILE.open()):
        if not row['mass_lbs'].strip():
            excluded.append(row['component_id'])
        else:
            populated.append(row)
    total = sum(float(row['mass_lbs']) for row in populated)
    cg = [sum(float(row['mass_lbs'])*float(row[key]) for row in populated)/total
          for key in ['cg_x_in', 'cg_y_in', 'cg_z_in']]
    report = dict(status='CAD dimensions and supplied loading only; see the separate run outputs for hydrodynamics',
        source=str(SOURCE.relative_to(ROOT)), source_sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        kernel_valid=True, topology=counts, units='inches and degrees',
        axes='CAD X transverse; Y forward from transom; Z above aft keel',
        bounds_in=[lower, upper], dimensions_in=dict(overall_length=upper[1]-lower[1],
            maximum_overall_beam=upper[0]-lower[0], overall_height=upper[2]-lower[2]),
        sections=sections, transom_edges_xyz_in=transom_edges, mass_file='component-masses.csv',
        mass_file_sha256=hashlib.sha256(MASS_FILE.read_bytes()).hexdigest(),
        total_mass_lb=total, total_mass_kg=total*0.45359237, cg_xyz_in=cg,
        cg_longitudinal_m=cg[1]*0.0254, cg_vertical_m=cg[2]*0.0254,
        blank_mass_rows_excluded=excluded,
        proposed_b_m=sections[0]['outer_chine_beam_in']*0.0254,
        b_definition='Outer transom chine to outer transom chine; not overall beam',
        deadrise_candidates_deg=dict(main_v=sections[0]['main_v_chord_deg'],
                                    outer_chine_chord=sections[0]['outer_chine_chord_deg']),
        propulsion_reused=dict(thrust_angle_deg=15,thrust_height_m=-0.0328240561840604,
                               thrust_x_m=-0.12252673981613506,propeller_count=2),
        planned_speeds_mph=list(range(31)),
        notes=['Reverse-chine strip is present; one constant V cannot represent both bottom slopes.',
               'Chine width, transverse chord and keel height vary along the hull; no uniform aft length has been assigned.',
               'Blank masses are excluded, not estimated or assumed included in another component.',
               'Deadrise candidates are transverse chord angles at the transom, not a validated equivalent hull model.'])
    (HERE/'geometry-review.json').write_text(json.dumps(report, indent=2, allow_nan=False)+'\n')
    with (HERE/'sections.csv').open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(sections[0]))
        writer.writeheader()
        writer.writerows(sections)
    return report

if __name__ == '__main__':
    result = measure()
    print(json.dumps({key: result[key] for key in ['dimensions_in', 'proposed_b_m', 'deadrise_candidates_deg',
                                                 'total_mass_lb', 'cg_xyz_in']}, indent=2))
