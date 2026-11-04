"""Export a capped external v4 flotation envelope in metres for NavalToolbox.

Uses the actual outer STEP faces. The cap closes the cockpit at the rim only
for dry-interior hydrostatics; freeboard <= 0 invalidates that assumption.
Requires the CAD dependencies in requirements-geometry.txt.
"""
from pathlib import Path
import hashlib
import json
import math
import numpy as np
import trimesh
from OCP.STEPControl import STEPControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.TopAbs import TopAbs_FACE, TopAbs_SHELL, TopAbs_EDGE, TopAbs_REVERSED
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS
from OCP.BRepTools import BRepTools
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeFace, BRepBuilderAPI_Sewing, BRepBuilderAPI_MakeSolid
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepLib import BRepLib
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRep import BRep_Tool
from OCP.TopLoc import TopLoc_Location
from OCP.BRepAdaptor import BRepAdaptor_Curve

HERE = Path(__file__).resolve().parent
ROOT = next(p for p in HERE.parents if (p / 'prop_motor_battery').is_dir())
SOURCE = ROOT / 'hull/geometry/v4-2026-10-30/hull.step'
OUTPUT = HERE / 'geometry'


def explore(shape, kind):
    exp = TopExp_Explorer(shape, kind)
    while exp.More():
        yield exp.Current()
        exp.Next()


def to_naval(xyz_mm):
    # Proper rotation: CAD X transverse/Y forward -> naval X forward/Y transverse.
    x, y, z = xyz_mm
    return [y / 1000, -x / 1000, z / 1000]


def prepare():
    expected = json.loads((ROOT / 'hull/hydrodynamics-cfd/v4-2026-10-30/geometry-report.json').read_text())['source_sha256']
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if digest != expected:
        raise ValueError('STEP changed: review exterior-face selection before export.')
    reader = STEPControl_Reader()
    if reader.ReadFile(str(SOURCE)) != IFSelect_RetDone:
        raise ValueError('Could not read v4 STEP.')
    reader.TransferRoots()
    shape = reader.OneShape()
    faces = [TopoDS.Face(f) for f in explore(shape, TopAbs_FACE)]
    if len(faces) != 17 or not BRepCheck_Analyzer(shape).IsValid():
        raise ValueError('Unexpected v4 topology.')
    # Face 0 is the planar rim; its OUTER wire closes the external surface.
    # Faces 1–7 are the reviewed transom, sides, bottom V, and reverse chines.
    outer = BRepTools.OuterWire_s(faces[0])
    cap = BRepBuilderAPI_MakeFace(outer, True).Face()
    sewing = BRepBuilderAPI_Sewing(1e-5)
    for face in [*faces[1:8], cap]:
        sewing.Add(face)
    sewing.Perform()
    shells = list(explore(sewing.SewedShape(), TopAbs_SHELL))
    if len(shells) != 1:
        raise ValueError('Exterior did not sew into one shell.')
    solid = BRepBuilderAPI_MakeSolid(TopoDS.Shell(shells[0])).Solid()
    if not BRepLib.OrientClosedSolid_s(solid) or not BRepCheck_Analyzer(solid).IsValid():
        raise ValueError('Flotation envelope is invalid.')
    props = GProp_GProps()
    BRepGProp.VolumeProperties_s(solid, props)
    exact_volume = props.Mass() / 1e9
    BRepMesh_IncrementalMesh(solid, .3, False, .15, True).Perform()
    triangles = []
    for f in explore(solid, TopAbs_FACE):
        face = TopoDS.Face(f)
        loc = TopLoc_Location()
        mesh = BRep_Tool.Triangulation_s(face, loc)
        if mesh is None:
            raise ValueError('Missing triangulation.')
        for i in range(1, mesh.NbTriangles() + 1):
            ids = list(mesh.Triangle(i).Get())
            if face.Orientation() == TopAbs_REVERSED:
                ids.reverse()
            tri = []
            for idx in ids:
                point = mesh.Node(idx).Transformed(loc.Transformation())
                tri.append(to_naval([point.X(), point.Y(), point.Z()]))
            triangles.append(tri)
    tris = np.asarray(triangles)
    mesh = trimesh.Trimesh(vertices=tris.reshape(-1, 3), faces=np.arange(tris.size // 3).reshape(-1, 3), process=True)
    mesh.merge_vertices(digits_vertex=8)
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.update_faces(mesh.unique_faces())
    mesh.remove_unreferenced_vertices()
    if not mesh.is_watertight or not mesh.is_winding_consistent or mesh.volume <= 0:
        raise ValueError('Invalid flotation mesh.')
    relative_error = abs(mesh.volume / exact_volume - 1)
    if relative_error > .001:
        raise ValueError('Mesh volume differs from exact STEP envelope by >0.1%.')
    if not math.isclose(mesh.extents[0], 1.8288, abs_tol=1e-5):
        raise ValueError('Length/units mismatch.')
    if not math.isclose(mesh.extents[2], .3048, abs_tol=1e-5):
        raise ValueError('Height/units mismatch.')
    rim = []
    for edge in explore(outer, TopAbs_EDGE):
        curve = BRepAdaptor_Curve(TopoDS.Edge(edge))
        for t in np.linspace(curve.FirstParameter(), curve.LastParameter(), 81):
            p = curve.Value(float(t))
            rim.append(to_naval([p.X(), p.Y(), p.Z()]))
    if not np.allclose(np.asarray(rim)[:, 2], .3048, atol=1e-6):
        raise ValueError('Expected horizontal 12-inch rim.')
    OUTPUT.mkdir(exist_ok=True)
    target = OUTPUT / 'hull-envelope.stl'
    mesh.export(target)
    (OUTPUT / 'deck-edge.json').write_text(json.dumps(rim, indent=2) + '\n')
    report = dict(source=str(SOURCE.relative_to(ROOT)), source_sha256=digest,
                  stl_sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
                  axes='X forward = CAD Y; Y = -CAD X; Z up. All metres. No 10x scaling.',
                  watertight=bool(mesh.is_watertight), winding_consistent=bool(mesh.is_winding_consistent),
                  bounds_m=mesh.bounds.tolist(), triangles=len(mesh.faces),
                  exact_envelope_volume_m3=exact_volume, mesh_volume_m3=float(mesh.volume),
                  relative_volume_error=relative_error,
                  assumption='Dry interior below the rim; artificial cap at 12 inches. No tubes/appendages. Stop interpreting dry-hull results when freeboard <= 0.')
    (OUTPUT / 'geometry-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return report


if __name__ == '__main__':
    prepare()
