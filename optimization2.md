# Optimization Plan 2

This restarts the model design from the inputs. It supersedes the variable lists in
`optimization-plan.md` (which stays as background research) and describes the
target the executable model in `optimization/` should grow into.

Scope: the 2-mile autonomous race boat with a removable 30 lb payload. Nothing
here is validated. The resistance law currently in `optimization/model.py` is a
synthetic placeholder, and cost is deliberately not modeled.

The plan has three parts: the objective, the constraints, and the decision
variables grouped by section. Supporting notes (derived quantities, how the
variables bubble up to speed, which variables are likely to hit their bounds,
status, open assumptions, build order) follow at the end.

A final section summarizes what published research and industry are doing today
for this kind of model, and what that means for ours.

The full hull drag equation is deliberately not built yet. The constraints come
first, so we know what the model has to respect before deciding how to compute drag.

## Objective

```text
minimize race time = 2 miles / cruise speed + course allowance
```

Course distance is 2 mi (10,560 ft). Cruise speed is the steady average speed over
the course. Acceleration, turns and stopping are not simulated; a flat allowance
(currently 20 s) stands in for them.

Other quantities (mass, power, energy, freeboard) are constraints, not additional
objectives.

## Constraints

Marked "in model" if the executable model in `optimization/` enforces it today, and
"not yet" otherwise.

### Rules

Only three competition rules are treated as constraints. The other rules in
`optimization-plan.md` (kit ban, flooded buoyancy, battery retention, disconnect,
fuse, tow point, GPS failsafe, launch time) are not part of this model.

```text
1. Payload:      >= 30 lb, removable                                (in model, fixed)
2. Voltage:      total system voltage <= 55.5 V                     (in model)
3. Downflooding: >= 3 in above the waterline, fully loaded          (not yet)
```

How each is handled:

```text
payload      fixed at exactly 30 lb. Carrying more only adds mass, so nothing is gained
             by making it a variable. Whether the mount is removable is not checked.
voltage      checked against the pack voltage. 12S is 50.4 V full. Higher series counts
             are allowed only if the start-of-race voltage stays under the limit, which
             depends on the partial-charge question in the Battery section.
freeboard    depth - draft >= 3 in at the actual loaded mass. Needs hydrostatics.
             This is the still-water rule. The wave allowance under Environment is a
             separate design margin on top of it, not a rule.
```

### Environment

Only three environmental inputs are modeled. Wind, temperature, water depth, spray
and GPS quality are left to race-time margin and water testing, not the optimizer.

```text
maximum wave height        H     value still to be set (in)
maximum water current      U     value still to be set (mph)
water density              rho   fresh 62.4 lb/ft^3 (salt is about 64.0)
```

How each one acts:

```text
wave height H
  - freeboard with waves: depth - draft >= 3 in + wave allowance tied to H
    (assumption: H/2, the crest above still water; to be confirmed)
  - added resistance in waves is not modeled

water current U
  - speed through the water v sets resistance, power and energy
  - speed over the ground sets race time
  - worst case, whole course against the current:
        race time = D / (v - U) + allowance,  and v must exceed U
    energy is charged over that longer time
  - if the course is an out-and-back with equal legs the penalty is smaller:
        race time = D/2 / (v - U) + D/2 / (v + U) + allowance

water density rho
  - displaced volume = total mass / rho, which sets draft and freeboard
  - planing lift and resistance scale with rho
  - fresh water gives the deeper draft, so it is the conservative case for freeboard
```

### Design limits

```text
race energy <= 70% of battery capacity                              (in model)
shaft power <= 80% of motor rating                                  (in model)
current <= 80% of battery and motor current ratings                 (in model)
full-charge voltage <= motor maximum voltage                        (in model)
LCG within its allowed band                                         (in model)
```

There is no separate loaded-mass cap. Mass is limited only by freeboard, power,
current and energy. (The executable model still carries a 115 lb cap until it is
removed there.)

### Geometry consistency

```text
transom beam <= beam                                                (in model)
bow deadrise >= aft deadrise                                        (in model)
```

All hull constraints above stay: freeboard (with its wave margin), transom beam,
bow versus aft deadrise, and the LCG band. Trim, planing-validity and slamming
limits were removed and are not restored.

### Candidate constraints (to confirm)

These exist to stop variables running to the edge of their bounds for no physical
reason. None are built yet.

Hull profile (the side-view keel line, for the new hull variables):

```text
0 < flat point < hull length, and the flat run >= a minimum fraction of length (TBD)
keel line never dips below the flat bottom and rises steadily to the stem
stem height <= hull depth
arc control point lies between the flat point and the stem
bow entry angle within its bounds
```

Propulsion:

```text
needed Kv within the market range of the chosen motor (bounds from products)
propeller tip speed <= a limit (TBD), from the rpm equation
propeller stays immersed and clears the hull (depends on thrust angle, diameter, draft)
motor mass tied to rated power and peak efficiency by a market fit (see Propulsion)
```

## Decision Variables

Five sections. Types are continuous (C) or discrete (D).

### Hull

```text
waterline length            C   currently 3-10 ft
chine beam                  C   currently 1-4 ft
transom beam                C   currently 0.75-4 ft, never wider than the beam
bow deadrise                C   30-50 deg
aft deadrise                C   6-16 deg
hull depth                  C   new; keel to deck, one value for the whole hull
flat point                  C   new; where the side-view keel line ends its rise and the
                                bottom goes flat, as a fraction of length from the
                                transom; bounds TBD
arc control point           C   new; shapes the keel arc between the flat point and the
                                stem; bounds TBD
bow entry angle             C   new; angle between the keel line at the stem and the
                                flat bottom; bounds TBD
```

The three new profile variables overlap. If the arc is drawn from the stem to the
flat point through one control point, the entry angle at the stem is fixed by where
that control point sits, so entry angle and control point cannot both be free. A
non-redundant set is flat point, bow entry angle, and one "arc fullness" number
(how far along the entry tangent the control point sits, 0 to 1). The stem height
then follows. Choose the parameterization before setting bounds.

**Version 1 uses a prismatic hull**: constant beam, constant deadrise and a straight
keel. That is what Savitsky's method and OpenPlaning assume, and it is a reasonable
first guess. Under it:

```text
active         waterline length, chine beam, deadrise (one value), hull depth
deferred       transom beam (equals the beam), bow deadrise (equals the deadrise),
               flat point, arc control point, bow entry angle
```

The deferred variables stay listed above for later. While they are deferred, the
constraints "transom beam <= beam", "bow deadrise >= aft deadrise" and the hull
profile constraints are trivially satisfied or inactive, and five of the variables
that had nothing pushing back drop out of the search.

A pure prism has the same section from transom to bow with no taper, so it overstates
the static volume and therefore the buoyancy. Apply a prismatic coefficient below 1
(value still to be set): volume = coefficient x section area x length.

### Propulsion

Propulsion is a motor and a propeller. The motor stands for the whole drive (ESC,
shaft, wiring, cooling) and is not split up. Nothing is picked from a catalog; the bounds come from products on the market.

```text
motor rated power           C   continuous shaft power, currently 3-10 kW
                                (plan: useful floor ~3 kW, target 5-8 kW, 10+ is risk)
motor peak efficiency       C   bounds from products on the market (TBD)
propeller pitch             C   in inches; bounds TBD (lower bound above 0)
propeller diameter          C   0-10 in (lower bound above 0); kept from before
thrust angle                C   0-30 deg; how much thrust goes forward versus down
```

Motor: efficiency is a variable so the optimizer cannot simply take the largest
motor. Without a link between the two, though, it takes the highest efficiency and
the highest power. Peak efficiency has to trade against something, so motor mass, current
rating and maximum voltage become functions of rated power and peak efficiency fitted
to real products (higher efficiency or power costs mass). Those fits are placeholders
until there are product data. The model also treats peak efficiency as the operating
efficiency, which a real motor reaches only near one load.

Pitch and thrust angle are different things. Pitch (inches advanced per turn) sets
the rpm for a speed. Thrust angle (the angle between thrust and the direction of
travel) sets how much thrust goes forward, `T x cos(angle)`, and how much goes down,
`T x sin(angle)`. The 0-30 deg bound is the thrust angle. Forward thrust only falls
as the angle rises, so an unconstrained thrust angle goes to 0. A nonzero angle is
only needed to keep the propeller in the water and clear of the hull, which is the
immersion constraint under Candidate constraints.

Propeller speed and motor Kv are derived from the chosen speed and pitch:

```text
rpm = (speed in mph x 1056) / (prop pitch in inches x 0.85)
Kv  = needed rpm / loaded voltage
```

- 1056 converts mph to inches per minute. The 0.85 is an assumed slip factor (15% slip).
- Speed is boat speed through the water.
- The loaded voltage comes from the voltage equation in the Battery section.
- Kv is therefore derived, not a free variable. A real motor turns slower under
  load than Kv x voltage, so the Kv of the motor you buy needs margin above this.
- With a gear ratio g, motor rpm = g x propeller rpm.
- Pitch has no cost in this model, so it also runs to an edge unless the Kv range
  and tip-speed constraints above are applied.

Still to add for real thrust matching (the plan bans pre-built kits):

```text
blade count                 D
gear ratio, if any          C
motor position              C   near the transom; also affects LCG
```

### Battery

```text
series cells per string     D   S, e.g. 12S, 13S or 14S
parallel strings            D   P, a whole number
```

Capacity is not chosen. It is calculated from the cell counts:

```text
capacity_Wh = S * P * Ah_cell * V_nominal_cell
pack mass   = S * P * cell mass (plus a packaging allowance)
```

Start-of-race charge is derived too: the largest charge at which the start voltage
stays at or under 55.5 V, capped at 100%. Battery position is under Placement. One
cell type is held fixed, so `Ah_cell`, `V_nominal_cell`, `R_cell`, cell mass and the
voltage-versus-charge curve `V_cell(SOC)` all come from one datasheet.

Loaded voltage replaces the fixed 40 V used in the executable model. For a pack of
`S` cells in series and `P` strings in parallel, with the bus power drawn from it
treated as constant:

```text
V_loaded = ( V_oc + sqrt( V_oc^2 - 4 * R_pack * P_bus ) ) / 2

  V_oc   = S * V_cell(SOC_start)      open-circuit pack voltage at the start charge
  R_pack = (S / P) * R_cell           pack internal resistance
  P_bus  = shaft power / motor efficiency + hotel load
  I      = P_bus / V_loaded           bus current
```

This comes from `V = V_oc - I * R_pack` with `I = P_bus / V`, which gives
`V^2 - V_oc * V + R_pack * P_bus = 0`. The larger root is the loaded voltage. It has
a real solution only while `V_oc^2 >= 4 * R_pack * P_bus`, so the pack has a
maximum deliverable power of `V_oc^2 / (4 * R_pack)`. The rule check is
`V_oc <= 55.5 V` at the start charge. V_cell(SOC) and R_cell come from a cell
datasheet.

A pack above the voltage limit at full charge (14S is 58.8 V) is legal only if
charged partway for the race. 80% of full voltage is not 80% state of charge: on
lithium cells it is far lower. Model the start voltage from a per-cell voltage at
the chosen charge level, and check the rule wording before designing around it.

### Placement

```text
payload position            C   25-50% of hull length forward of the transom
battery position            C   25-45% of hull length forward of the transom
```

### Operation

```text
cruise speed                C   currently 4-14 m/s
```

Speed is not truly independent: for any design it follows from that design's
limits (see the notes below). Once the planing physics is in, solve for it instead
of searching it, which leaves the optimizer with one fewer variable.

### Held fixed (not chosen)

```text
payload                     30 lb (rule)
water density               fresh, 62.4 lb/ft^3 (environment)
course distance             2 mi
course allowance            20 s (synthetic)
laminate                    0.41 lb/ft^2 shell + 4.4 lb structure (synthetic)
fixed equipment             8.8 lb (synthetic)
battery cell                one cell type: Ah, nominal voltage, resistance, mass, V(SOC) curve (TBD)
```

## Supporting Notes

These are not part of the three sections above.

### Derived quantities, in calculation order

Nothing below is chosen. Each step feeds the next.

```text
1. Section shape       version 1 (prismatic): a V-bottom section of chine beam and
                       deadrise with side walls up to the hull depth, the same from
                       transom to bow. Later versions: beam tapers to the transom
                       beam, deadrise varies from aft to bow, and the keel line is
                       flat to the flat point then rises along the arc to the stem
2. Hull mass, VCG      shell surface area from the shape x laminate mass
3. Total mass          hull + payload + battery + motor + prop + fixed equipment
   LCG, VCG            mass-weighted positions
4. Hydrostatics        solve the draft where buoyancy = total mass
                       freeboard = depth - draft
5. Planing balance     inputs: beam, aft deadrise, LCG, mass, speed
                       outputs: running trim, wetted length, resistance
6. Power and energy    shaft power  = resistance x speed / propeller efficiency
                       bus power    = shaft power / motor efficiency + hotel load
                       race energy  = bus power x race time
                       current      = bus power / pack voltage
7. Race time           distance / speed + course allowance
```

### How everything bubbles up to speed

Each non-hull variable acts on one of three ceilings on speed, or on the mass that
moves the resistance curve:

```text
Battery capacity     mass; energy ceiling; current ceiling (Ah x C-rate)
Motor                mass; power ceiling; current ceiling; efficiency
Propeller            mass; efficiency
Placement            LCG -> trim -> resistance
Hull                 shapes the resistance curve and freeboard
```

The ceilings, as functions of speed v:

```text
power:     shaft power(v) <= 0.8 x motor rating
current:   bus power(v) / V <= 0.8 x battery and motor current ratings
energy:    bus power(v) x (D/v + allowance) <= 0.7 x capacity
```

Fastest allowed speed for a design: `v*` = the largest v satisfying every ceiling.
Race time is `D / v* + allowance`, and the optimizer searches the other variables
for the design with the largest `v*`.

Scaling to keep in mind: resistance grows with v^2, so power grows roughly with
v^3 and race energy roughly with v^2. The power ceiling therefore rises as the cube
root of the power limit, and the energy ceiling as the square root of capacity.
Extra battery or motor buys speed slowly and costs mass, draft and freeboard.

With real planing physics the resistance curve has a hump near the transition
onto the plane, so the set of allowed speeds may not be one contiguous range.
Search speed with a scan plus a root-find rather than one local solve.

### Rules to model around (no CFD)

Hard and fast rules to get started, in order of how much to trust them. The
numbers here were checked against sources or computed directly; where a source is
weak it says so.

Exact physics (no empirical coefficients):

```text
buoyancy        displaced volume = total mass / water density (Archimedes); draft
                is the depth at which the hull section volume equals it
freeboard       depth - draft >= 3 in (rule), plus the wave allowance
balance         LCG = sum(mass x position) / total mass, same for VCG
power chain     shaft power = resistance x speed / propeller efficiency
                bus power = shaft power / motor efficiency + hotel load
                race energy = bus power x race time
                current = bus power / loaded voltage (voltage equation above)
propeller       rpm = (mph x 1056) / (pitch in x 0.85)
                tip speed = pi x diameter x rpm / 60
```

These need only a resistance value at each speed, and that is the part we are not
building yet.

Applicability box for a Savitsky-type evaluator (use as a check that the method
can be trusted, not as a design goal):

```text
Cv = V / sqrt(g x beam)         0.6 to 13
mean wetted length / beam       at most 4
running trim                    2 to 15 deg
deadrise                        0 to 35 deg (PIAS), hull must be prismatic
```

You removed the "planing model inside its valid range" constraint earlier. This box
is what that constraint would be, so it is listed here for reference and is not
restored.

Regime checks from dimensionless numbers (weaker sources: search summaries whose
pages I did not identify or read):

```text
volumetric Froude number = V / sqrt(g x displaced volume^(1/3))
    displacement hulls about 1.3 or less, semi-planing about 1.0 to 3.0,
    planing about 2.3 or more (no sharp dividing line)
beam speed coefficient Cv at planing onset: about 1.5 (Savitsky and Brown, as cited)
```

Computed for our boat (fresh water), these do not bind at race speed:

```text
loaded mass     volumetric Froude 2.3 at     volumetric Froude 3.0 at
80 lb           9.3 mph                      12.1 mph
95 lb           9.5 mph                      12.4 mph
115 lb          9.8 mph                      12.8 mph
Race speeds of 18 to 30 mph give volumetric Froude numbers of about 4.2 to 7.5.
Cv at 18 to 30 mph is 2.3 to 7.8 for any beam from 1 to 4 ft (Cv 1.5 needs 5.8 to
11.6 mph). Cv stays inside 0.6 to 13 for every beam in our bounds.
```

So planing onset is not what will shape the design, and the transition into planing
does not need modeling effort. The Savitsky trim and wetted-length limits are a
different matter: they do bind at our dimensions (see the OpenPlaning test drive
below), along with freeboard, the energy and current ceilings, and the LCG band.

The team's own bounds from `optimization-plan.md` are the most practical hard rules
for rough dimensions (they encode judgment about a boat this size, and unlike the
formulas above they need no model):

```text
length            7.5 to 9 ft
beam              28 to 38 in
transom beam      24 to 36 in
bow deadrise      30 to 50 deg
mid deadrise      15 to 30 deg
aft deadrise      6 to 16 deg
target LCG        35 to 40% of length forward of the transom
payload position  25 to 50% of length; battery position 25 to 45%
```

Our current bounds (3-10 ft length, 1-4 ft beam) are much wider. Using the plan's
ranges as bounds is the fastest way to get rough dimensions and also removes the
implausible corners. Variables will then sit on these bounds, which is acceptable
when the bound itself is the physical rule.

Direction only, no numbers (from the literature): lower deadrise cuts trim and
resistance, higher deadrise improves seakeeping at a cost in resistance; longer
length-to-beam improves seakeeping. Use these to decide which way each variable is
pulled and what pushes back, and encode the push-back as a bound, not an equation.

### Building on OpenPlaning (test drive)

Tested 2026-09-29 in a scratch environment, not in the repo. Version 0.4.9, MIT
license, last commit 2026-09-11. Assumptions I made for the runs: fresh water,
95 lb, 8.5 ft, LCG 37% from the transom, VCG 0.18 m, radius of gyration 0.25 x length,
thrust line 0.1 m above the keel at the transom, aft deadrise 10 degrees unless
stated. These are my inputs, not measurements.

What it offers:

- **Fast.** Each equilibrium solve takes milliseconds, so it fits inside an
  optimizer loop.
- **Its inputs match our variables:** beam, deadrise, LCG, VCG, weight, speed, thrust
  angle and thrust position, and significant wave height.
- **Its outputs** are running trim, wetted keel and chine lengths, wetted area,
  transom draft, the thrust needed (with skin friction, air drag and flaps), a
  porpoising check, and Savitsky-Brown impact acceleration and added resistance in
  waves.
- **It warns when a result is outside a method's range.** The ranges are in the code,
  not the documentation. The lift equation warns outside trim 2 to 15 degrees. The
  seaway estimates (Savitsky and Brown 1976) warn outside displacement coefficient
  100 to 250, length-to-beam 3 to 5, trim 3 to 7 degrees, deadrise 10 to 30 degrees,
  wave height over beam 0.2 to 0.7, and speed/sqrt(length) 2 to 6. The porpoising chart
  warns outside lift coefficient 0.0338 to 0.18 and deadrise 0 to 20 degrees.

What it does not do, so we still build it:

- **Only prismatic hulls**, which is the version 1 choice. One beam, one deadrise, a
  straight keel. Transom beam, bow
  deadrise, flat point, arc and entry angle do not enter it. Those variables would
  still only change hull mass, volume and freeboard in our own code.
- **No hydrostatics, no mass, no propeller, no battery.** It takes weight, LCG and
  VCG as inputs.
- **Warnings, not constraints.** We would turn them into constraints ourselves.
- **Fragile at the edges.** It raised errors for deadrise 0 degrees ("SVD did not
  converge") and for a 30 degree thrust angle (no trim solution). Failures have to be
  caught and treated as infeasible.
- **Packaging.** On Python 3.14 it fails to import because it uses `pkg_resources`,
  which current setuptools no longer ships. Installing `setuptools<81` fixed it. Its
  data-table paths are written with Windows backslashes. It is one 1,118-line file,
  so vendoring a patched copy is an option.

Results, 95 lb at 22 mph unless stated (thrust needed is the resistance the propeller
must overcome):

```text
The plan's boat: 34 in beam, 8.5 ft, 95 lb
  10 mph   trim 2.2 deg   thrust  69 N
  22 mph   trim 1.0 deg   thrust 216 N
  30 mph   trim 0.7 deg   thrust 257 N
  Trim falls below the 2 degree limit above about 12 mph, and the wetted keel length
  exceeds the hull length. The result is an extrapolation at race speed.

Beam sweep (95 lb, 22 mph): inside the 2 to 15 degree trim range and wetted-length
ratio 4 or less
  beam   trim   wetted length/beam   thrust
  10 in  3.2    6.1                   91 N    ratio above 4
  12 in  2.8    5.0                   99 N    ratio above 4
  14 in  2.4    4.2                  108 N    ratio above 4
  16 in  2.1    3.6                  117 N    valid
  18 in  1.9    3.2                  127 N    trim below 2
  24 in  1.5    2.3                  159 N    trim below 2
  Outside the limits the sweep stops making sense: 28, 34, 38 and 48 in give 182, 216,
  197 and 154 N, which rises and then falls.
  Valid window: about 15 to 17 in at 95 lb, about 15 to 20 in at 115 lb.

At 16 in beam, 22 mph
  deadrise   4 deg 115 N   10 deg 117 N   22 deg 128 N    (lower is better, small effect)
  LCG 25%    92 N   35% 113 N   45% 138 N                 (further aft is better)
  thrust angle -6 deg 116 N   0 deg 117 N   +10 deg 121 N (small effect)
  speed 12 mph 61 N   20 mph 103 N   30 mph 191 N         (trim below 2 deg past 22 mph)
```

What this says about our variables:

- **The limits are what stop the variables at the edge.** Inside the valid region,
  narrower beam, lower deadrise and a more aft LCG all cut thrust every time. What
  stops each is the Savitsky box: wetted-length ratio 4 or less stops narrow beam,
  and trim of at least 2 degrees stops low deadrise, wide beam and a forward LCG.
  Without those limits the optimizer would hug the bounds, as you feared.
- **The plan's beam is outside the method's data.** At 95 lb the method is only
  trustworthy for a beam of roughly 15 to 20 in, far below the plan's 28 to 38 in. That
  does not make the plan wrong. It means the boat is very lightly loaded for its beam,
  so it runs at about 1 degree of trim with almost dry chines, and no empirical data
  backs that regime. Payload space and roll stability, which we do not model, would
  push the beam wider.
- **Thrust angle barely matters** (about 1.4% of thrust per 6 degrees, and it always
  favors the lower bound). It is not worth being a variable unless the immersion
  constraint is built.
- **Power is modest.** At 16 in beam the effective power is about 1.2 kW at 22 mph and
  2.6 kW at 30 mph, before propeller and motor losses. That is far below the plan's
  5 to 8 kW, so the power ceiling may not bind and the energy and current ceilings
  would decide the speed. Unvalidated.

An exploration notebook, `optimization/explore.ipynb`, wraps OpenPlaning with the
prismatic hydrostatics, propeller, battery and constraint chain from this plan, with
sweeps, an interactive panel and a small search. Its placeholders are marked in the
code and listed in its last section.

Proposed use, for you to decide: wrap OpenPlaning as the planing core, catch its
failures as infeasible, and turn its applicability limits into constraints. Build the
rest on top: hull shape, hydrostatics and freeboard, mass, the motor, propeller and
battery, and the ceilings. This restores the planing-validity limits you removed
earlier, which is what gives beam, deadrise and LCG real limits, so that removal is
worth reconsidering.

### Which variables will hit their bounds

A variable runs to the edge of its range whenever nothing pushes back on it. There
are two kinds of edge. One is expected and fine: a real constraint stops the
variable (the voltage rule, freeboard, a speed ceiling). The other is a flaw in the
model: nothing real opposes the variable, so it lands on an arbitrary bound.

```text
variable              pulled toward            pushed back by                 verdict
waterline length      longer (less drag)       hull mass, freeboard           interior possible once hydrostatics is in
chine beam            narrower (less drag)     freeboard, displacement        minimum until hydrostatics is in
transom beam          narrower                 transom <= beam only           likely minimum
bow deadrise          nothing                  nothing (slamming removed)     arbitrary bound
aft deadrise          lower (less drag)        nothing                        likely minimum
hull depth            deeper (freeboard)       shell mass                     sits on the freeboard limit (fine)
flat point, arc,
entry angle           nothing until a drag     profile constraints only       arbitrary bounds until drag or
                      or ride term exists                                     ride is modeled
motor rated power     more power               motor mass, battery current,   may reach the 10 kW upper bound
                                               voltage sag
motor peak efficiency higher                   nothing unless tied to mass    highest market value
propeller pitch       nothing (slip fixed)     Kv range, tip speed            edge unless those are applied
thrust angle          0 (cos of the angle)     immersion and clearance        0 unless that is applied
series cells          more (less current)      55.5 V rule                    at the voltage limit (fine)
parallel strings      more capacity            pack mass                      interior likely
cruise speed          faster                   power, current, energy         sits on a ceiling (fine)
payload, battery x    LCG for best running     LCG band                       on the band edge
```

Every "arbitrary bound" row is a place where a constraint or a coupling is missing,
not a result. Either add the physical reason, or fix the variable as an input.

Under the prismatic version 1 hull, transom beam, bow deadrise and the three profile
variables are inactive, which removes five of the rows above that had nothing
pushing back. Chine beam, deadrise and LCG are then held in place by the Savitsky
applicability limits (see the OpenPlaning test drive).

### Model status and known gaps

```text
Resistance:        synthetic power law, not Savitsky, CFD or test data; the full
                   hull drag equation is deferred until the constraints are settled
Cost:              removed from the model
Hydrostatics:      not modeled; nothing checks that the hull floats, so the
                   optimizer chooses long, narrow hulls
Bow deadrise:      affects shell area and mass only (no slamming term)
Depth, waterline,
wetted area:       not modeled
Propeller:         thrust, RPM and cavitation not modeled
Battery counts:    series and parallel counts are integers; the continuous solver
                   needs them enumerated, or relaxed and rounded
Solver:            multistart SLSQP over the continuous variables; local optima only
```

### Assumptions to confirm

1. Hull depth is one number, constant along the hull. Freeboard is checked at the
   actual loaded mass. There is no separate mass cap; mass is limited only by
   freeboard, power, current and energy.
2. Numbers are needed for maximum wave height and maximum current. Also confirm the wave allowance on freeboard (H/2) and whether
   the current penalty assumes the whole course against the current or an out-and-back.
3. The hull is prismatic for version 1 (constant beam and deadrise, straight keel).
   A prismatic coefficient below 1 corrects the static volume; its value is to be set.
   The tapered form with a curved keel line is deferred.
4. Hull bounds stay at 3-10 ft length and 1-4 ft beam. The plan's 7.5-9 ft length
   and 28-38 in beam are the sanity check on what the optimizer picks.
5. Propeller pitch is in inches and drives the rpm equation. Thrust angle (0-30 deg)
   is the forward-versus-down split. Confirm this is the reading you meant, and that
   propeller diameter stays a variable.
6. Motor rated power and peak efficiency are tied to motor mass by a fit to market
   products, and Kv comes from the rpm equation. Motor product data and bounds for
   power, efficiency, pitch and diameter are still to be set.
7. Deferred with the prismatic hull: the hull profile parameterization (flat point,
   entry angle, arc fullness), its bounds, and its candidate constraints.
8. Battery cell type and its datasheet values; the range of parallel strings.

### Build order

```text
1. Hydrostatics and the hull profile constraints: section shape, hull mass, draft,
   freeboard. No drag equation yet.
2. Battery: series and parallel counts, cell data, the voltage equation.
3. Motor: rated power and peak efficiency tied to market products, Kv from the rpm
   equation, thrust angle and immersion.
4. Solve for cruise speed instead of searching it.
5. The full hull drag equation, once the constraints above are settled.
```

## What Research Is Doing Today

Researched 2026-09-29 from published papers, tool documentation and vendor pages.
"Verified" below means I read the source. Sources I could only see as search-result
snippets are marked, and I have not relied on them for numbers.

### "Digital twin" means two different things

- **Operational twin (what industry mostly means).** DNV defines it as a virtual
  representation of a physical asset kept alive with real-time data across its
  lifecycle. Wartsila describes ship twins as models continuously updated from sensor
  data, used for weather routing, voyage planning, performance monitoring and
  anomaly detection, and says design use is "some time off". Its caution applies to
  us: outputs "can only be as good as the data that goes into the model and the
  mathematics behind the model itself."
- **Design model (what we are building).** DNV's hull-monitoring specialist puts it
  bluntly: "Design models, which are also sometimes referred to as digital twins,
  die at birth." The aim is to keep them alive after design by feeding them
  measurements. For us that means calibrating against the staged water tests already
  in `optimization-plan.md`, not treating the first model as final.
- Siemens markets a design-phase "virtual towing tank" for electric boats: a
  full-scale CFD model with weight, speed and center of mass as parameters, running
  in seconds. I saw this on a webinar page only.

### Standard pipeline for hull optimization

The field calls it simulation-based design optimization (SBDO). The largest recent
survey (Serani, Scholcz and Vanzi, 2024) covers 277 studies across marine
engineering (surface ships and underwater vehicles, not only small craft). Verified
findings:

- **Parameterize the hull, evaluate it, search.** 72% of studies use fully parametric
  hull models (splines, B-splines, Bezier curves, sectional area curves, NURBS). The
  rest use partially parametric deformation such as free-form deformation.
- **Small design spaces.** Most studies have 10 variables or fewer. A few go past 50,
  and one reaches 420, using adjoint gradients.
- **Single objective is the norm, and most problems are constrained.** 63% are
  constrained and 19% are unconstrained (18% did not say). Where multi-objective is
  used, two objectives is the most common case (67%).
- **Global search dominates.** Among global methods, genetic algorithms are 65% and
  particle swarm 24%. Among local methods, sequential quadratic programming (SQP) is
  preferred (49%), described as suited to fine-tuning in a smooth region with a good
  starting guess. The review also lists local algorithms run from multiple starts as
  a recognized hybrid approach.
- **Surrogates.** Surrogate-based optimization has overtaken surrogate-free. Kriging
  or Gaussian processes are 34% of surrogates, radial basis functions 21%, response
  surfaces 18% and neural networks 14%. Latin hypercube sampling is the most common
  way to pick training points (37%).
- **Multi-fidelity is rare.** Only 12% of surrogate-based studies mix cheap and
  expensive models, even though a companion review (Zhu et al., 2024) highlights
  co-Kriging with a cheap model plus few expensive samples as a hotspot.
- **Multidisciplinary optimization is rare.** About 8% of studies couple more than
  one discipline (for example hydrodynamics with structure or energy use).
- **Uncertainty is mostly ignored.** Robust or reliability-based methods make up
  about 9%. The review names wave dynamics and ocean currents as uncertainties the
  field handles poorly.

### Planing craft specifically

- **Savitsky's semi-empirical method is the workhorse for conceptual design.** It is
  fast, analytic and fits inside an optimization loop. OpenPlaning is an open-source
  Python implementation of the 1964 and 1976 Savitsky methods. It solves the
  equilibrium trim and wetted length by root-finding instead of chart lookup, takes
  speed, weight, beam, LCG, VCG, deadrise, trim tabs and wave height as inputs, and
  returns trim, wetted lengths and area, resistance and effective power. It also does
  a porpoising check. Its documentation states no validity ranges. It ships a
  multi-objective optimization example.
- **Stated validity of the Savitsky method.** Two sources I read give slightly
  different boxes. The Nautical Solver documentation states Cv 0.60 to 13.00, mean
  wetted length-to-beam ratio (lambda) at most 4, and running trim 2 to 15 degrees,
  and calls these applicability notices, not acceptance limits. The PIAS resistance
  manual states deadrise 0 to 35 degrees and Cv 0.6 to 13, plus a wetted keel
  length over knuckle breadth "larger than 4". That last statement reads differently
  from lambda at most 4. OpenPlaning's own code warns on "lambda <= 4" for its lift
  equation, which supports the Nautical Solver reading. I did not check Savitsky's
  original paper.
  Both agree the method is for prismatic hard-chine hulls carried mainly by dynamic
  lift, and Nautical Solver adds that it does not cover warped or non-prismatic
  bottoms, porpoising stability, waves or propeller interaction.
- **Typical studies.** A Pareto genetic algorithm study varied beam, deadrise and LCG
  (Savitsky for hydrodynamics), minimizing resistance-to-displacement and spray wetted
  area, under Savitsky-method limits, hydrostatic stability and pitch and yaw
  stability. Another search-result summary (not read) describes studies that also
  vary length, flap angle and chord, with constraints on dynamic trim for porpoising,
  length-to-beam ratio, metacentric height, freeboard and required deck area.
- **Unmanned surface vehicles.** A parametric multi-objective USV hull study optimizes
  wave resistance and seakeeping in a two-step strategy (abstract only). A
  multi-fidelity study of a catamaran survey vessel (SWAMP) combined a RANS solver and
  a linear potential-flow solver in a Gaussian-process model with active learning. It
  varied payload mass and center-of-mass position at fixed speed and found that
  performance depends on the position of the center of mass, not only the payload.

### Gaps the literature names

- Multi-objective and stochastic formulations are underused.
- Multidisciplinary coupling is rare, and most hull work stops at hydrodynamics.
- Multi-fidelity methods and adjoint gradients are underused.
- Many papers omit the dimensionality of their design space (26%) or the problem
  formulation (18%), which makes results hard to reproduce.
- Design twins are rarely carried into operation and updated from measurements.

### What this means for our model

These are my readings, not findings from the sources.

- **Our pipeline is the standard one.** A parametric hull, a fast semi-empirical
  evaluator and a search loop is the usual conceptual-design stack. Finalists going
  to CFD, as in `optimization-plan.md`, is also what the field does. Our multistart
  SLSQP is a recognized hybrid and suits a smooth analytic model, but genetic
  algorithms dominate global search. A genetic algorithm or differential evolution
  run is a sensible cross-check on our local optima.
- **Surrogates are not needed yet.** They pay off when each evaluation is a CFD run.
  Ours is analytic, so keep them for the CFD stage.
- **Our problem is larger than typical.** We have about 19 variables against a norm of
  10 or fewer. Solving cruise speed instead of searching it, fixing weak variables,
  and screening sensitivities first would bring that down.
- **Bezier-style keel parameters fit practice.** Our flat point, arc control point
  and entry angle are the kind of few-parameter curve the literature uses.
- **Our formulation is conventional.** One objective with the rest as constraints is
  the most common setup. Deterministic worst-case waves and current match usual
  practice. Robust optimization is a later upgrade.
- **Validity checks are standard practice.** Studies bound the Savitsky method's
  range and usually include length-to-beam, trim or porpoising, stability and freeboard
  limits. We removed the trim, planing-validity and slamming constraints from this
  plan. Savitsky assumes a prismatic hull, which is why version 1 uses one. When the
  deferred shape variables (bow deadrise, curved keel line) come back, the method
  would apply to the aft planing section only, or through a variable-deadrise
  extension (a "virtual prismatic hulls" method appears in the literature; I saw its
  abstract only).
- **Payload position is a real variable.** The SWAMP study supports keeping payload
  and center-of-mass position in the search.
- **Plan to calibrate.** Both DNV and Wartsila make the point that a model is only as
  good as its data. The staged water tests should update the model, not just check it.

### Sources

Verified (read):

- Serani, Scholcz, Vanzi, "A Scoping Review on Simulation-based Design Optimization
  in Marine Engineering: Trends, Best Practices, and Gaps", 2024.
  https://arxiv.org/abs/2404.18654 (Archives of Computational Methods in
  Engineering, doi 10.1007/s11831-024-10127-1)
- Zhu et al., "Research progress on intelligent optimization techniques for
  energy-efficient design of ship hull forms", 2024. https://arxiv.org/abs/2403.05832
- "Multi-fidelity hydrodynamic analysis of an autonomous surface vehicle at surveying
  speed in deep water subject to variable payload", 2022.
  https://arxiv.org/abs/2209.03127
- OpenPlaning (Savitsky 1964 and 1976). https://github.com/elcf/python-openplaning
  and https://onepetro.org/snamefast/proceedings/FAST21/1-FAST21/D011S001R004/470728
- "Hydrodynamic Optimization of Hull Form of High Speed Planing Craft by Multi
  Objective Genetic Algorithm in Calm Water", Journal of Marine Engineering.
  http://marine-eng.ir/article-1-95-en.html
- PIAS manual, resistance prediction with empirical methods.
  https://www.sarc.nl/images/manuals/pias/htmlEN/resistance.html
- Nautical Solver, Savitsky planing hull resistance calculator (stated applicability
  ranges). https://nauticalsolver.com/calculators/resistance/savitsky/savitsky.php
- DNV, "Digital twins and sensor monitoring".
  https://www.dnv.com/expert-story/maritime-impact/Digital-twins-and-sensor-monitoring/
- Wartsila, "Does your ship need a digital double?".
  https://www.wartsila.com/insights/article/does-your-ship-need-a-digital-double

Search-result snippets only (not read):

- Volumetric Froude number regimes and the Savitsky and Brown planing-onset value:
  appeared in search summaries drawing on Boat Design Net threads, shipcalculators.com
  and a ScienceDirect review of planing hull hydrodynamics
  (https://www.sciencedirect.com/science/article/pii/S0029801824003834, blocked to
  automated fetching). I could not tell which page each number came from.
- Siemens, "Designing Electric Boats with CFD Simulation Software".
  https://webinars.sw.siemens.com/en-US/design-efficient-electrified-vessels-to-meet-performance-targets/
- "Parametric automatic optimal design of USV hull form with respect to wave
  resistance and seakeeping", Ocean Engineering.
  https://www.sciencedirect.com/science/article/abs/pii/S0029801821008660
- "Optimization strategy for planing hull design".
  https://www.sciencedirect.com/science/article/pii/S2092678222000371
- "Digital Twin for Autonomous Surface Vessels: Enabler for Safe Maritime Navigation".
  https://arxiv.org/abs/2411.03465
