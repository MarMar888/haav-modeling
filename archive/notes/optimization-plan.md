# Boat Optimization Plan

## Design Thesis

Build an original autonomous planing boat that can complete the PEP27 2-mile uncrewed autonomy race in under 7 minutes while carrying the required 30 lb removable payload, passing safety inspection, and retaining enough electrical, thermal, and stability margin to survive real water conditions.

The optimizer should work backward from the full mission instead of optimizing isolated hull geometry. The hull, propulsion, battery, payload placement, and autonomy strategy are coupled, so the top-level score should be predicted race performance with rule and reliability constraints.

## Top-Level Mission Requirement

The race target is based on beating a known 7-minute benchmark.

```text
Race distance:              2 miles
Benchmark time:             7 minutes
Benchmark average speed:    17.1 mph
Design average speed:       18-22 mph
Straight-line speed target:  24-30 mph
Simulated calm-water target: 5.5-6.0 minutes
Real-world target:          <7.0 minutes
```

If the simulation predicts exactly 7 minutes, the design is not good enough. The model needs margin for turns, GPS path error, chop, prop losses, voltage sag, trim errors, and imperfect fabrication.

## Hard Rule Constraints

These constraints reject a design immediately.

```text
Payload:                 >=30 lb removable payload
Voltage:                 <=55.5 V total system voltage
Propulsion:              no pre-built motor/ESC/shaft/prop kit
Downflooding margin:     >=3 in above waterline fully loaded
Buoyancy:                positive buoyancy even if flooded
Battery retention:       battery secured if boat flips
Main disconnect:         all propulsion current through accessible disconnect
Fuse:                    required for 24-55 V systems
Tow point:               centerline tow point or bridle
Navigation failsafe:     kill behavior on missing/corrupted GPS data
Launch constraint:       launch and leave dock within 5 minutes
```

## Primary Design Variables

The first optimizer should focus on major geometry and mass-placement variables only. Small features like exact strake shape should wait until the hull family is validated.

### Monohull Variables

```text
length_ft:               7.5-9.0
beam_in:                 28-38
transom_beam_in:         24-36
bow_deadrise_deg:        30-50
mid_deadrise_deg:        15-30
aft_deadrise_deg:        6-16
chine_width_in:          variable
rocker_in:               low to moderate
strake_count:            0-2 per side
downflooding_height_in:  geometry-derived
```

### Mass Placement Variables

The 30 lb payload can go anywhere, so it should be used as a trim variable.

```text
payload_mass_lb:         30 fixed
payload_x_from_transom:  25-50% of hull length
payload_y:               centered
payload_z:               as low as possible

battery_x_from_transom:  25-45% of hull length
battery_z:               low
motor_x:                 near transom
electronics_x:           near CG when possible
```

The real boat should have an adjustable payload tray with locking positions. For an 8 ft hull, a useful payload rail spans roughly 24-48 inches forward of the transom.

## Weight Bounds

The optimizer should evaluate several loaded mass cases, not one perfect number.

```text
Best-case loaded mass:       80 lb
Design target loaded mass:   95 lb
Upper acceptable mass:       115 lb
Danger zone:                 120+ lb
```

Fresh water displacement requirement:

```text
80 lb  / 62.4 = 1.28 ft^3
95 lb  / 62.4 = 1.52 ft^3
115 lb / 62.4 = 1.84 ft^3
```

The hull must still pass downflooding clearance at the upper mass case.

## Electrical And Power Bounds

The design should be based around a 12S battery system to stay comfortably under the voltage limit.

```text
Battery voltage:         12S nominal
12S full voltage:        50.4 V
Competition max voltage: 55.5 V

Useful power floor:      ~3 kW
Competitive target:      5-8 kW
Risk zone:               10+ kW
```

At 12S:

```text
5 kW / 44 V = ~114 A total
8 kW / 44 V = ~182 A total
```

Race energy estimate:

```text
5 kW for 7 min = ~583 Wh
8 kW for 7 min = ~933 Wh
```

Battery target:

```text
Minimum energy:          ~700 Wh
Target energy:           1000-1500 Wh
Battery mass target:     12-25 lb
Race energy used:        <=70% battery capacity
Sustained current:       <=70-80% system rating
```

## Modeling Strategy

Do not run high-fidelity CFD inside the main optimizer. That would be too slow and would create fake precision. Use a two-stage model:

```text
Parametric hull generator
        ↓
Fast hydrostatics + planing/drag estimator
        ↓
Mission-level 2-mile race simulator
        ↓
Optimizer searches thousands of variants
        ↓
Top 10-30 variants exported for CFD
        ↓
CFD produces better drag/trim curves
        ↓
Mission simulator reruns finalists
        ↓
Buildable CAD model in Onshape
        ↓
Water testing calibrates the model
```

## Fast Evaluator

Each candidate hull should be evaluated quickly before any CFD work.

### Hydrostatics

Compute:

```text
displacement volume
static waterline
loaded draft
freeboard to downflooding point
center of buoyancy
static trim estimate
reserve buoyancy
```

Reject if:

```text
freeboard_to_downflooding < 3 in
displacement cannot support upper mass case
draft too large
geometry cannot package payload/battery
```

### Mass Properties

Compute:

```text
hull mass estimate
payload location
battery location
motor/shaft/prop location
electronics location
LCG
VCG
roll stability proxy
```

Reject if:

```text
LCG outside viable planing range
VCG too high
payload tray cannot be made removable
battery cannot be secured upside down
```

### Planing Estimate

Use a low-order planing model to estimate:

```text
trim angle vs speed
wetted length
wetted area
drag vs speed
required thrust
required shaft/electrical power
planing transition speed
```

Reject if:

```text
running trim > 7 deg
required power > available propulsion margin
planing transition is too late
bow plows at target speed
stern squat is severe
```

## Mission-Level Race Simulator

This is the real scoring model. The hull evaluator should provide drag/trim curves, but the mission simulator should decide whether the complete boat can beat the race.

Inputs:

```text
drag vs speed
propulsion thrust/power curve
battery capacity
battery voltage sag model
boat mass
payload position
course length
turn count and turn radius
turn speed penalty
wind/current assumptions
autonomy path error
launch/run startup delay
```

Outputs:

```text
predicted race time
average speed
peak speed
energy used
peak current
average current
motor/ESC thermal load proxy
speed through turns
reserve battery percentage
```

Start simple: straight segments plus turn penalties. Add detail only when test data shows the simple model is wrong in an important way.

## Objective Function

The top-level optimization target should be:

```text
minimize predicted 2-mile race time
```

subject to all hard constraints and reliability margins.

An initial scalar score can be:

```text
score =
  predicted_race_time_sec
  + rule_failure_penalties
  + low_margin_penalties
  + thermal_penalty
  + build_complexity_penalty
  + instability_penalty
```

Hard failures should not receive a soft penalty. They should reject the design.

Hard reject examples:

```text
freeboard < 3 in
payload < 30 lb
voltage > 55.5 V
race energy > 70% battery capacity
peak current > allowed system current
running trim > 7 deg
cannot package battery/payload safely
cannot include accessible main disconnect
```

For valid designs, prefer:

```text
lowest race time
with 20-30% energy margin
and 20-30% current/power margin
and robust CG adjustability
```

## CFD Role

CFD should not be asked to directly answer "will this boat win?" CFD should provide better curves for the mission simulator.

Use CFD for:

```text
drag vs speed
trim vs speed
wetted area
spray risk
flow quality near propulsors
relative comparison between hull variants
```

Do not over-trust CFD for:

```text
exact race time
exact planing transition
porpoising onset
small differences between similar designs
rough-water behavior
structural flex
prop efficiency
cooling performance
GPS/autonomy pathing
```

CFD is useful for ranking variants. If one hull predicts 6.0 minutes and another predicts 9.0 minutes, the first is probably better. If one predicts 6.8 and another 7.0, that difference is not meaningful without testing.

## Simulation Boundaries

Simulation should guide decisions, not replace water testing.

Trust simulation for:

```text
rule feasibility
static displacement/freeboard
relative drag ranking
rough power sizing
mass-placement sensitivity
identifying obviously bad hulls
```

Do not trust simulation alone for:

```text
final prop choice
final CG location
porpoising risk
turning behavior
spray into electronics
real battery voltage sag
motor/ESC temperature
waterproofing
launch/recovery ergonomics
```

Any design that wins in simulation must still be validated with staged water tests.

## Test And Calibration Plan

The optimizer becomes more useful when real tests calibrate it.

### Test 1: Float And Freeboard

```text
load boat to 80/95/115 lb cases
measure waterline
measure downflooding margin
compare to hydrostatics prediction
update hull mass/displacement model
```

### Test 2: Low-Speed Tow Or Drive

```text
run 3-8 mph
measure current, speed, trim, wake
compare against low-speed drag estimate
```

### Test 3: Planing Transition

```text
increment throttle
record speed, current, trim, GPS data
identify planing speed
test payload positions
```

### Test 4: Race-Speed Runs

```text
run 18/22/26 mph where safe
record current, voltage sag, GPS, temperatures
compare required power to mission sim
```

### Test 5: Mini Race Simulation

```text
run 0.25-0.5 mile course
include turns
measure average speed and energy
scale model to 2-mile mission
```

## Data Artifacts

Every simulation and test should produce machine-readable records so the white paper can be generated from evidence.

```text
design.yaml              source-of-truth design variables
bounds.yaml              optimizer bounds
runs/*.json              simulation results
meshes/*.stl             candidate hull exports
plots/*.png              drag/freeboard/race plots
tests/*.csv              logged test data
tests/*.md               test notes and observations
bom.csv                  cost/weight/source list
rule-checks.json         pass/fail rule compliance
```

## First Implementation Milestones

### v0: Rule And Mass Checker

Create a design file and compute:

```text
loaded weight
voltage compliance
payload compliance
estimated freeboard requirement
energy requirement
current requirement
rule checklist
```

### v1: Parametric Hull And Hydrostatics

Generate rough monohull geometry and compute:

```text
displacement
draft
waterline
freeboard
LCB
static trim proxy
```

### v2: Mission Simulator

Add:

```text
drag curve placeholder
power curve placeholder
2-mile race integration
turn penalties
energy/current output
```

### v3: Optimizer

Use Optuna or scipy to search:

```text
length
beam
deadrise
chine width
payload position
battery position
loaded mass case
```

### v4: CFD Finalist Pipeline

Export top hulls and run higher-fidelity analysis on finalists only.

### v5: Onshape/Build Integration

Use the winning parameter set to create the buildable CAD model, internal structure, payload tray, battery mounts, tow point, disconnect location, and propulsion mounting.

## Current Recommended Starting Point

Use this as the first baseline monohull before optimization:

```text
Hull type:               wide planing monohull
Length:                  8.5 ft
Beam:                    34 in
Loaded design weight:    95 lb
Max checked weight:      115 lb
Payload:                 30 lb adjustable
Payload rail:            25-50% hull length from transom
Target LCG:              35-40% hull length from transom
Aft deadrise:            10-12 deg
Bow deadrise:            35-45 deg
Target straight speed:   24-30 mph
Target race average:     18-22 mph
Electrical system:       12S
Target power:            5-8 kW
Battery energy:          1000-1500 Wh
```

This baseline is not assumed to be optimal. It is a controlled starting point for the optimizer and a sanity check for all later designs.

