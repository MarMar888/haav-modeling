"""Project Hav — deep-V RIB, v5.

Bodies, all in real millimetres:
  HULL      the printed shell: warped deep-V, open top, hardpoints built in.
            Printed in sections and used as a male plug for the layup.
  SKIN      the outside layup over the print: 2 x 6 oz glass, faired and painted.
            The skin carries the final hull shape, so the print is made smaller
            by SKIN_OUT and the outside shape stays where the hydrostatics put it.
  TUBES     custom sponsons, bonded to the HULL SIDE (not sitting on the deck)
  FRAME     the bonded aluminium backbone: transom plate, keelson, floors
  BASEBOARD the floor over the V, built from 1/4 in marine ply and glassed both
            sides -- without it nothing sits flat
  PAYLOAD   Pelican 1200, electronics tray, sensor tower
  WATER     the static waterline plane at the 62 lb design weight
  PODS      the two Flipsky 65150s, to scale, with struts and prop discs

The tubes are custom now, so their path is derived from the hull's own sheer
line rather than from the Onshape import: each tube is centred on the sheer and
then trimmed by the hull, which is what a sponson bonded to a topside actually
looks like in section. Forward of midships the tubes lift off the sheer and
converge to a point above the stem so the rigid bow stays fine.
"""
from math import tan, radians, cos, sin

# ------------------------------------------------------------------ envelope
TRANSOM_Y   = -390.0
BOW_Y       =  840.0          # LOA 1230 mm / 48.4 in
LOA         = BOW_Y - TRANSOM_Y
KEEL_Z_AFT  = -230.0
ROCKER      =  200.0
CHINE_HB    =  200.0          # chine half-beam over the parallel midbody
SHEER_Z_AFT =  -31.8          # solved: puts the tube bottom 20 mm over the WL
SHEER_RISE  =  110.0
TUBE_R      =   63.5          # 5 in custom sponson
WATERLINE_Z = -115.3          # static WL at 62 lb all-up

SKIN_OUT    =    1.2   # outside layup: 2 x 6 oz glass plus fairing and paint
SKIN_IN     =    0.6   # inside tape: section joints and under the backbone only
WALL        =    3.0   # printed wall, measured inside the outside skin
SHELL       = SKIN_OUT + WALL   # outside shape to the inside face of the print
DECK_THK    =    6.0
FLANGE      =   35.0
TRANSOM_THK =   16.0
STATIONS    =   45          # ruled lofts: enough stations to hide the facets

# Deep-V forward for wave cutting, moderated aft so it still planes and so the
# pods sit under a surface that is close to flat.
def deadrise(t):
    if t <= 0.35:
        return 16.0
    if t <= 0.85:
        return 16.0 + 10.0 * (t - 0.35) / 0.50
    return 26.0 + 14.0 * (t - 0.85) / 0.15


def keel_z(t):
    """Straight run aft -- a planing pan must not have a hook."""
    if t <= 0.55:
        return KEEL_Z_AFT + 5.0 * (t / 0.55)
    return KEEL_Z_AFT + 5.0 + ROCKER * ((t - 0.55) / 0.45) ** 1.8


def chine_hb(t):
    if t <= 0.55:
        return CHINE_HB
    return max(18.0, CHINE_HB * (1.0 - ((t - 0.55) / 0.45) ** 1.85))


def sheer_hb(t):
    return chine_hb(t) + 15.0 + 30.0 * t ** 1.5      # flare grows forward


def sheer_z(t):
    return SHEER_Z_AFT + SHEER_RISE * t ** 1.7


def y_at(t):
    return TRANSOM_Y + LOA * t


# ---------------------------------------------------------------------- hull
def outer_station(t, inset=0.0):
    """Hull section. inset > 0 draws the print, SKIN_OUT inside the outside skin."""
    y = TRANSOM_Y + inset + (LOA - 2.0 * inset) * t
    lift = inset / cos(radians(deadrise(t)))
    kz = keel_z(t) + lift
    chb, shb = chine_hb(t) - inset, sheer_hb(t) - inset
    sz = sheer_z(t) + (1.0 if inset else 0.0)   # run the plug past the rim
    cz = kz + chb * tan(radians(deadrise(t)))
    return polygon_wire([(-shb, y, sz), (-chb, y, cz), (0.0, y, kz),
                         (chb, y, cz), (shb, y, sz)], closed=True)


def inner_station(t):
    """SHELL off the outside shape, stepping inboard under the deck for a flange."""
    y, kz = y_at(t), keel_z(t)
    chb, shb, sz = chine_hb(t), sheer_hb(t), sheer_z(t)
    cz = kz + chb * tan(radians(deadrise(t)))
    zf = sz - DECK_THK
    ihb = max(3.0, (chb + (shb - chb) * (zf - cz) / (sz - cz)) - SHELL)
    fhb = max(2.0, shb - FLANGE)
    return polygon_wire([
        (-fhb, y, sz + 70.0), (-fhb, y, zf), (-ihb, y, zf),
        (-max(3.0, chb - SHELL), y, cz + SHELL), (0.0, y, kz + SHELL),
        (max(3.0, chb - SHELL), y, cz + SHELL),
        (ihb, y, zf), (fhb, y, zf), (fhb, y, sz + 70.0),
    ], closed=True)


# build123d's loft, ruled, not the agentcad loft_sections helper: that helper
# returns inside-out solids (zero volume), and subtracting the plug from the
# outside shape -- two surfaces 1.2 mm apart -- only works on proper solids.
def hull_loft(wires):
    return loft([Face(Wire(w)) for w in wires], ruled=True).wrapped


ts = [i / (STATIONS - 1) for i in range(STATIONS)]
outer = hull_loft([outer_station(t) for t in ts])
plug = hull_loft([outer_station(t, SKIN_OUT) for t in ts])

t_aft, t_fwd, n_in = TRANSOM_THK / LOA, 0.90, 27
ts_in = [t_aft + (t_fwd - t_aft) * i / (n_in - 1) for i in range(n_in)]
inner = hull_loft([inner_station(t) for t in ts_in])
hull = safe_cut(plug, inner)
skin = safe_cut(outer, plug)

# ------------------------------------------------------- transom hardpoints
Y_IN = TRANSOM_Y + TRANSOM_THK
backing = Box(340.0, 14.0, 120.0, align=(Align.CENTER, Align.MIN, Align.MIN))
hull = (Part(hull) + Part(safe_intersection(
    backing.locate(Location((0.0, Y_IN, KEEL_Z_AFT + 20.0))).wrapped, inner))).wrapped

cuts = []
for bx in (-148.0, -72.0, 72.0, 148.0):          # 8 x M8 for the pod plates
    for bz in (KEEL_Z_AFT + 46.0, KEEL_Z_AFT + 106.0):
        cuts.append(Cylinder(radius=4.25, height=160.0, rotation=(90, 0, 0))
                    .locate(Location((bx, TRANSOM_Y + 20.0, bz))).wrapped)
skin = safe_cut(skin, *cuts)                    # the pod bolts pass through it
for te in [0.06, 0.20, 0.34, 0.48, 0.62, 0.76]:  # 12 collar pad eyes
    for sign in (-1.0, 1.0):
        cuts.append(Cylinder(radius=3.25, height=90.0)
                    .locate(Location((sign * (sheer_hb(te) - FLANGE / 2),
                                      y_at(te), sheer_z(te)))).wrapped)
hull = safe_cut(hull, *cuts)

# --------------------------------------------------------------------- tubes
# Centreline follows the sheer aft, then lifts and converges to a point above
# the stem. Radius tapers to a cone at each end.
def tube_path(t):
    if t <= 0.0:                      # aft taper: hold the section, run aft
        return sheer_hb(0.0), y_at(t), sheer_z(0.0)
    if t <= 0.55:
        return sheer_hb(t), y_at(t), sheer_z(t)
    f = (t - 0.55) / 0.45
    x0, z0 = sheer_hb(0.55), sheer_z(0.55)
    return (max(9.0, x0 * (1.0 - f ** 1.4)),
            y_at(t) + 70.0 * f ** 2,
            z0 + (sheer_z(1.0) + 35.0 - z0) * f ** 1.5)


def tube_r(t):
    if t < 0.0:
        return max(10.0, TUBE_R * (1.0 - (-t / 0.05) ** 1.6))
    if t > 0.94:
        return max(8.0, TUBE_R * (1.0 - ((t - 0.94) / 0.06) ** 1.5))
    return TUBE_R


def _unit(v):
    m = (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) ** 0.5
    return (v[0] / m, v[1] / m, v[2] / m)


def tube_frame(t):
    """Local axes on the tube path: T along it, U outboard, W up."""
    a = tube_path(max(-0.05, t - 0.004))
    b = tube_path(min(1.0, t + 0.004))
    T = _unit((b[0] - a[0], b[1] - a[1], b[2] - a[2]))
    U = _unit((T[1], -T[0], 0.0))
    if U[0] < 0:
        U = (-U[0], -U[1], -U[2])
    W = (T[1] * U[2] - T[2] * U[1], T[2] * U[0] - T[0] * U[2],
         T[0] * U[1] - T[1] * U[0])
    return tube_path(t), T, U, _unit((-W[0], -W[1], -W[2]))


def around(U, W, deg):
    """Unit vector deg degrees up from outboard-horizontal, round the tube."""
    a = radians(deg)
    return tuple(cos(a) * U[i] + sin(a) * W[i] for i in range(3))


def on_surface(t, deg, sink):
    """Point sunk `sink` mm below the tube skin at angle `deg`."""
    p, T, U, W = tube_frame(t)
    d = around(U, W, deg)
    r = tube_r(t) - sink
    return tuple(p[i] + d[i] * r for i in range(3)), d


# Body
tts = [-0.05 + 0.05 * i / 6 for i in range(6)] + [i / 30 for i in range(31)]
secs = []
for i, t in enumerate(tts):
    p, T, _, _ = tube_frame(t)
    secs.append(Plane(origin=p, z_dir=T) * Circle(tube_r(t)))
stbd = Part(loft(secs, ruled=False).wrapped)

# Chamber seams -- three chambers a side, so a puncture costs a third of one.
SEAM_T = (0.30, 0.62)
for st in SEAM_T:
    p, T, _, _ = tube_frame(st)
    # Sunk 1.5 mm so the band meets the skin transversally -- a torus sitting
    # exactly on the surface is tangential and the kernel will not take it.
    stbd = (stbd + Part((Plane(origin=p, z_dir=T)
                         * Torus(major_radius=tube_r(st) - 1.5,
                                 minor_radius=4.0)).wrapped)).clean()

# Rubbing strake down the outboard face, tapering out at both ends.
def strake_r(t):
    if t < 0.0:
        return max(2.5, 7.0 * (1.0 - (-t / 0.02) ** 1.5)) if t > -0.02 else 2.5
    if t > 0.70:
        return max(2.5, 7.0 * (1.0 - ((t - 0.70) / 0.10) ** 1.4))
    return 7.0

# Stops at 80% -- forward of that the path turns hard in plan and the outboard
# normal stops meaning anything.
ss = []
for i in range(31):
    st = -0.018 + 0.818 * i / 30
    p, T, U, _ = tube_frame(st)
    c = tuple(p[j] + (tube_r(st) - 2.0) * U[j] for j in range(3))
    ss.append(Plane(origin=c, z_dir=T) * Circle(strake_r(st)))
stbd = (stbd + Part(loft(ss, ruled=False).wrapped)).clean()

# Lacing-eye patches, on the same stations as the hull's pad eyes.
EYE_T = (0.06, 0.20, 0.34, 0.48, 0.62, 0.76)
for st in EYE_T:
    base, d = on_surface(st, 38.0, 6.0)
    stbd = (stbd + Part(extrude(Plane(origin=base, z_dir=d) * Circle(15.0),
                                amount=10.0).wrapped)).clean()

# One inflation valve boss per chamber, up on the inboard face.
for st in (0.14, 0.46, 0.76):
    base, d = on_surface(st, 122.0, 5.0)
    stbd = (stbd + Part(extrude(Plane(origin=base, z_dir=d) * Circle(11.0),
                                amount=13.0).wrapped)).clean()

eyes = []
for st in EYE_T:
    c, d = on_surface(st, 38.0, 0.0)
    eyes.append(extrude(Plane(origin=c, z_dir=d) * Circle(3.5),
                        amount=9.0, both=True).wrapped)
for e in eyes:                      # plain booleans: the fused tube has
    stbd = stbd - Part(e)           # tangencies that trip the validated ops
stbd = (stbd - Part(outer)).clean()

# Two separate solids, deliberately. They are two separate physical tubes, and
# fusing them at the bow -- where they meet on the centreline -- is a tangential
# union the kernel will not produce a valid solid from.
tubes = Compound(children=[stbd, mirror(stbd, Plane.YZ)])

# ------------------------------------------------------------------- frame
# The metal backbone. Load path is continuous and never goes through printed
# plastic: pod -> straddle plate -> M8 through the transom -> TRANSOM PLATE ->
# gussets -> KEELSON -> bonded into the hull over ~785 mm. The ring frames hang
# the Pelican and foot the tower off the same spine.
#
# Aluminium, not steel: these parts spread load into plastic rather than carry
# it, so area and stiffness matter more than strength.
BASE_Z   = -182.5              # underside of the baseboard; see its section below
BASE_THK =    6.35             # 1/4 in marine ply, glassed both sides
FRAME_TOP = BASE_Z             # keelson caps out under the baseboard, which bears on it
KEEL_HW, FOOT_W, AL = 38.0, 30.0, 3.0
KSN_T0, KSN_T1 = TRANSOM_THK / LOA, 0.64


def hull_inner_z(x, t):
    return keel_z(t) + SHELL + SKIN_IN + abs(x) * tan(radians(deadrise(t)))


def keelson_station(t):
    """U-channel hat over the keel, open at the bottom."""
    y, zi = y_at(t), hull_inner_z(KEEL_HW, t)
    iw = KEEL_HW - AL
    return polygon_wire([
        (-KEEL_HW, y, zi), (-KEEL_HW, y, FRAME_TOP), (KEEL_HW, y, FRAME_TOP),
        (KEEL_HW, y, zi), (iw, y, zi), (iw, y, FRAME_TOP - AL),
        (-iw, y, FRAME_TOP - AL), (-iw, y, zi),
    ], closed=True)


def foot_station(t, sign):
    """Bonding foot lying on the V, outboard of each web."""
    y = y_at(t)
    xi, xo = sign * KEEL_HW, sign * (KEEL_HW + FOOT_W)
    zi, zo = hull_inner_z(KEEL_HW, t), hull_inner_z(KEEL_HW + FOOT_W, t)
    return polygon_wire([(xi, y, zi), (xo, y, zo),
                         (xo, y, zo + AL * 1.04), (xi, y, zi + AL * 1.04)],
                        closed=True)


kts = [KSN_T0 + (KSN_T1 - KSN_T0) * i / 21 for i in range(22)]
# Separate fabricated pieces, kept as separate solids: hat, feet, plate, gussets
# and ring frames are bolted and welded together, not one monolithic casting.
# NOTE: loft_sections returns a degenerate zero-volume solid on sections this
# small; build123d's own loft over Faces handles them, so use that here.
pieces = [loft([Face(Wire(keelson_station(t))) for t in kts], ruled=False)]
for sign in (-1.0, 1.0):
    pieces.append(loft([Face(Wire(foot_station(t, sign))) for t in kts],
                       ruled=False))

# Transom plate: the 8 pod bolts land on this, not on the print.
pieces.append(Part(safe_intersection(
    Box(360.0, 6.0, 118.0, align=(Align.CENTER, Align.MIN, Align.CENTER))
    .locate(Location((0.0, TRANSOM_Y + TRANSOM_THK, KEEL_Z_AFT + 76.0))).wrapped,
    inner)))

# Gussets tying the plate to the keelson
for gx in (-KEEL_HW - AL, KEEL_HW):
    pieces.append(Part(Box(AL, 150.0, 44.0, align=(Align.MIN, Align.MIN, Align.MAX))
                       .locate(Location((gx, TRANSOM_Y + TRANSOM_THK + 6.0,
                                         FRAME_TOP))).wrapped))

# Transverse floors in the bilge, notched over the keelson. These are what tie
# the keelson to the hull sides and what the baseboard -- and through it the tower
# foot and the Pelican straps -- bolts down to.
for fy in (-30.0, 140.0, 260.0, 350.0):
    ft = (fy - TRANSOM_Y) / LOA
    hw = (FRAME_TOP - keel_z(ft) - SHELL - SKIN_IN) / tan(radians(deadrise(ft)))
    prof = polygon_wire([(-hw, fy, FRAME_TOP), (0.0, fy, keel_z(ft) + SHELL + SKIN_IN),
                         (hw, fy, FRAME_TOP)], closed=True)
    pieces.append(extrude(Face(Wire(prof)), amount=4.0) - pieces[0])

# Bolts, because an epoxy-to-aluminium bond is not allowed to be the only thing
# holding the backbone in: M5 through each foot and the hull, plus the 8 M8 in
# the transom plate that the pod brackets pull against.
holes = []
for i in range(8):
    bt = KSN_T0 + (KSN_T1 - KSN_T0) * (0.06 + 0.88 * i / 7)
    for sx in (-1.0, 1.0):
        holes.append(Cylinder(radius=2.75, height=40.0)
                     .locate(Location((sx * (KEEL_HW + FOOT_W / 2), y_at(bt),
                                       hull_inner_z(KEEL_HW + FOOT_W / 2, bt))))
                     .wrapped)
for bx in (-148.0, -72.0, 72.0, 148.0):
    for bz in (KEEL_Z_AFT + 46.0, KEEL_Z_AFT + 106.0):
        holes.append(Cylinder(radius=4.25, height=60.0, rotation=(90, 0, 0))
                     .locate(Location((bx, TRANSOM_Y + 20.0, bz))).wrapped)
pieces = [(p - Compound(children=[Part(h) for h in holes])).clean() for p in pieces]

frame = Compound(children=pieces)

# ----------------------------------------------------------- baseboard + payload
# A deep-V is about 50 mm wide down at the keel, so nothing can sit on the hull
# bottom. BASE_Z is the height where the hull is wide enough to take the
# Pelican; everything bolts through the baseboard into the keelson and floors.
# Built, not printed: 1/4 in okoume ply, cut to this outline, sealed and glassed
# both sides. Stiffer and about half the weight of printing it. Bilge water
# lives underneath.
baseboard = safe_intersection(
    Box(520.0, 810.0, BASE_THK, align=(Align.CENTER, Align.CENTER, Align.MIN))
    .locate(Location((0.0, 55.0, BASE_Z))).wrapped, inner)
BASE_TOP = BASE_Z + BASE_THK

# Pelican 1200 -- 270 x 246 x 124 exterior, amidships, batteries and anti-spark.
PEL_Y = 225.0
case = Part(Box(246.0, 270.0, 118.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
            .locate(Location((0.0, PEL_Y, BASE_TOP))).wrapped)
case += Part(Box(252.0, 276.0, 10.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
             .locate(Location((0.0, PEL_Y, BASE_TOP + 114.0))).wrapped)
for lx in (-70.0, 70.0):                       # latches on the aft face
    case += Part(Box(46.0, 14.0, 26.0, align=(Align.CENTER, Align.MAX, Align.MIN))
                 .locate(Location((lx, PEL_Y - 135.0, BASE_TOP + 96.0))).wrapped)

# Autopilot / Pi / receiver tray, aft of the batteries and out of their heat.
tray = Part(Box(200.0, 140.0, 68.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
            .locate(Location((0.0, -110.0, BASE_TOP))).wrapped)

# ------------------------------------------------------------- sensor tower
# Light and only as tall as it has to be: the lidar clears the tube crown, the
# sidelights sit just above it. Mass up here is what costs roll stability.
TWR_Y, SHELF_Z = 55.0, 170.0
tower = Part(Box(150.0, 150.0, 6.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
             .locate(Location((0.0, TWR_Y, BASE_TOP))).wrapped)
tower += Part(loft([Plane(origin=(0.0, TWR_Y, BASE_TOP + 6.0)) * Rectangle(74.0, 74.0),
                    Plane(origin=(0.0, TWR_Y, SHELF_Z)) * Rectangle(46.0, 46.0)],
                   ruled=True).wrapped)
tower += Part(Box(130.0, 130.0, 6.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
              .locate(Location((0.0, TWR_Y, SHELF_Z))).wrapped)

# RPLidar C1 -- 360 deg, so nothing may sit beside it at its own height.
tower += Part(Cylinder(radius=28.0, height=42.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
              .locate(Location((0.0, TWR_Y + 26.0, SHELF_Z + 6.0))).wrapped)
# GPS / compass puck, forward of the lidar and clear of it
tower += Part(Cylinder(radius=31.0, height=16.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
              .locate(Location((0.0, TWR_Y - 44.0, SHELF_Z + 6.0))).wrapped)
# Masthead all-round white, on a post above the lidar
tower += Part(Cylinder(radius=6.0, height=22.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
              .locate(Location((0.0, TWR_Y + 26.0, SHELF_Z + 48.0))).wrapped)
tower += Part(Cylinder(radius=13.0, height=30.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
              .locate(Location((0.0, TWR_Y + 26.0, SHELF_Z + 70.0))).wrapped)
# Pilot camera on the shelf, forward of the lidar and under its scan plane
tower += Part(Box(38.0, 34.0, 34.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
              .locate(Location((0.0, TWR_Y - 44.0, SHELF_Z + 6.0))).wrapped)
# Wind sensor outboard on a short arm
tower += Part(Box(88.0, 16.0, 10.0, align=(Align.MIN, Align.CENTER, Align.CENTER))
              .locate(Location((22.0, TWR_Y, SHELF_Z - 30.0))).wrapped)
tower += Part(Cylinder(radius=11.0, height=50.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
              .locate(Location((104.0, TWR_Y, SHELF_Z - 30.0))).wrapped)

# Sidelights go on the tubes, not the mast -- red to port, green to starboard,
# forward where they are actually visible from ahead.
lights = []
lp, ld = on_surface(0.80, 62.0, 4.0)
lights.append(Part(extrude(Plane(origin=lp, z_dir=ld) * Circle(15.0),
                           amount=26.0).wrapped))
lights.append(mirror(lights[0], Plane.YZ))

payload = Compound(children=[case, tray, tower] + lights)

# --------------------------------------------------------------------- pods
# Flipsky 65150: 65.5 dia x 150 body, prop aft, 4 x M4 side holes take the
# strut. Sat aft of the transom so both props run in clean water.
POD_X, POD_Z, PROP_R = 125.0, -254.0, 60.0   # prop swept dia 120 per drawing
pods = []
for sx in (-POD_X, POD_X):
    body = Cylinder(radius=32.75, height=150.0, rotation=(90, 0, 0)) \
        .locate(Location((sx, -325.0, POD_Z)))
    hub = Cylinder(radius=17.1, height=36.0, rotation=(90, 0, 0)) \
        .locate(Location((sx, -418.0, POD_Z)))
    disc = Cylinder(radius=PROP_R, height=9.0, rotation=(90, 0, 0)) \
        .locate(Location((sx, -418.0, POD_Z)))
    pods += [body.wrapped, hub.wrapped, disc.wrapped]
    for side in (-38.0, 38.0):                   # straddle plates on the 4 x M4
        pods.append(Box(8.0, 105.0, 74.0, align=(Align.CENTER,) * 3)
                    .locate(Location((sx + side, -342.0, POD_Z + 21.0))).wrapped)

water = Box(640.0, 1480.0, 1.5, align=(Align.CENTER,) * 3) \
    .locate(Location((0.0, 215.0, WATERLINE_Z)))

show_object(Part(hull), id="printed-shell", name="Printed shell (PETG)")
show_object(Part(skin), id="glass-skin", name="Outside glass skin")
show_object(tubes, id="tubes", name="Tubes")
show_object(Part(baseboard), id="baseboard", name="Baseboard (glassed ply)")
show_object(frame, id="backbone", name="Aluminium backbone")
show_object(payload, id="payload", name="Pelican, electronics, sensor tower")
show_object(Compound(children=[Part(p) for p in pods]), id="pods", name="Pods and props")
show_object(water, id="waterline", name="Waterline at 62 lb")
