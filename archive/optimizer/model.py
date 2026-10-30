"""Explicit nonlinear relationships. The supplied resistance law is a demo only."""

from __future__ import annotations

from dataclasses import dataclass
from math import cos, radians
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PositiveFloat, model_validator

Fraction = Annotated[float, Field(gt=0, le=1)]
Position = Annotated[float, Field(ge=0, le=1)]
Nonnegative = Annotated[float, Field(ge=0)]
Deadrise = Annotated[float, Field(ge=0, lt=60)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Range(StrictModel):
    """Closed interval a continuous decision variable may take."""

    min: float
    max: float

    @model_validator(mode="after")
    def ordered(self):
        if self.min > self.max:
            raise ValueError("Range minimum must not exceed maximum")
        return self


class Mission(StrictModel):
    distance_m: PositiveFloat
    benchmark_s: PositiveFloat
    payload_kg: PositiveFloat
    fixed_mass_kg: Nonnegative
    hotel_power_w: Nonnegative
    max_mass_kg: PositiveFloat
    voltage_limit_v: PositiveFloat
    usable_energy_fraction: Fraction
    continuous_rating_fraction: Fraction
    lcg_min_fraction: Position
    lcg_max_fraction: Position
    extra_time_s: Nonnegative

    @model_validator(mode="after")
    def ordered_lcg(self):
        if self.lcg_min_fraction > self.lcg_max_fraction:
            raise ValueError("LCG minimum must not exceed maximum")
        return self


class HullBounds(StrictModel):
    length_m: Range
    beam_m: Range
    transom_beam_m: Range
    bow_deadrise_deg: Range
    aft_deadrise_deg: Range
    shell_kg_per_m2: PositiveFloat
    surface_area_multiplier: PositiveFloat
    structure_mass_kg: Nonnegative

    @model_validator(mode="after")
    def valid_ranges(self):
        if self.length_m.min <= 0 or self.beam_m.min <= 0 or self.transom_beam_m.min <= 0:
            raise ValueError("Hull length, beam and transom beam must be positive")
        if self.transom_beam_m.min > self.beam_m.max:
            raise ValueError("Transom beam range must allow at least the smallest transom below the widest beam")
        for name in ("bow_deadrise_deg", "aft_deadrise_deg"):
            bounds = getattr(self, name)
            if bounds.min < 0 or bounds.max >= 60:
                raise ValueError(f"{name} must stay within [0, 60) degrees")
        if self.bow_deadrise_deg.max < self.aft_deadrise_deg.min:
            raise ValueError("Bow deadrise range must allow at least the smallest aft deadrise")
        return self


class Search(StrictModel):
    """Bounds on the continuous decision variables plus the multistart settings."""

    battery_capacity_wh: Range
    speed_mps: Range
    payload_x_fraction: Range
    battery_x_fraction: Range
    starts_log2: Annotated[int, Field(ge=0, le=10)]
    seed: int
    max_iterations: Annotated[int, Field(ge=1, le=10000)]

    @model_validator(mode="after")
    def valid_ranges(self):
        if self.battery_capacity_wh.min <= 0 or self.speed_mps.min <= 0:
            raise ValueError("Battery capacity and speed must be positive")
        for name in ("payload_x_fraction", "battery_x_fraction"):
            bounds = getattr(self, name)
            if bounds.min < 0 or bounds.max > 1:
                raise ValueError(f"{name} must stay within [0, 1]")
        return self


class Battery(StrictModel):
    id: str
    nominal_voltage_v: PositiveFloat
    full_voltage_v: PositiveFloat
    loaded_voltage_v: PositiveFloat
    specific_energy_wh_per_kg: PositiveFloat
    continuous_c_rate: PositiveFloat

    @model_validator(mode="after")
    def voltage_order(self):
        if not self.loaded_voltage_v <= self.nominal_voltage_v <= self.full_voltage_v:
            raise ValueError("Require loaded <= nominal <= full battery voltage")
        return self


class Drive(StrictModel):
    id: str
    mass_kg: PositiveFloat
    continuous_shaft_power_w: PositiveFloat
    continuous_bus_current_a: PositiveFloat
    max_voltage_v: PositiveFloat
    electrical_to_shaft_efficiency: Fraction


class Prop(StrictModel):
    id: str
    mass_kg: PositiveFloat
    efficiency: Fraction
    compatible_drive_ids: Annotated[list[str], Field(min_length=1)]


class Resistance(StrictModel):
    reference_mass_kg: PositiveFloat
    reference_speed_mps: PositiveFloat
    reference_length_m: PositiveFloat
    reference_beam_m: PositiveFloat
    reference_transom_beam_m: PositiveFloat
    reference_deadrise_deg: Nonnegative
    reference_resistance_n: PositiveFloat
    mass_exponent: PositiveFloat
    speed_exponent: PositiveFloat
    length_exponent: float
    beam_exponent: float
    transom_beam_exponent: float
    deadrise_penalty_per_degree: Nonnegative
    preferred_lcg_fraction: Position
    lcg_penalty: Nonnegative


class Scenario(StrictModel):
    name: str
    data_status: Literal["illustrative_not_calibrated"]
    source: str
    mission: Mission
    hulls: HullBounds
    search: Search
    battery: Battery
    drives: Annotated[list[Drive], Field(min_length=1)]
    props: Annotated[list[Prop], Field(min_length=1)]
    resistance: Resistance

    @model_validator(mode="after")
    def check_catalog(self):
        for items in (self.drives, self.props):
            if len({item.id for item in items}) != len(items):
                raise ValueError("Component ids must be unique within each catalog")
        drive_ids = {drive.id for drive in self.drives}
        for prop in self.props:
            if not set(prop.compatible_drive_ids) <= drive_ids:
                raise ValueError(f"Unknown compatible drive for {prop.id}")
        r = self.resistance
        aft = self.hulls.aft_deadrise_deg
        if min(1 + r.deadrise_penalty_per_degree * (d - r.reference_deadrise_deg)
               for d in (aft.min, aft.max)) <= 0:
            raise ValueError("Resistance deadrise multiplier must stay positive")
        return self


def load_scenario(path: Path) -> Scenario:
    return Scenario.model_validate_json(path.read_text())


@dataclass(frozen=True)
class Hull:
    id: str
    length_m: float
    beam_m: float
    transom_beam_m: float
    bow_deadrise_deg: float
    aft_deadrise_deg: float
    mass_kg: float


@dataclass(frozen=True)
class Setup:
    drive_id: str
    prop_id: str
    battery_capacity_wh: float
    speed_mps: float
    payload_x_fraction: float
    battery_x_fraction: float


@dataclass(frozen=True)
class Candidate:
    id: str
    hull_id: str
    setup: Setup
    metrics: dict[str, float]
    margins: dict[str, float]

    @property
    def feasible(self) -> bool:
        return all(value >= -1e-7 for value in self.margins.values())


def make_hull(s: Scenario, hull_id: str, length_m: float, beam_m: float, transom_beam_m: float,
              bow_deadrise_deg: float, aft_deadrise_deg: float) -> Hull:
    grid = s.hulls
    # Area is a sizing proxy, not CAD-derived wetted or shell surface area. The
    # mean of bow and aft deadrise stands in for the varying bottom angle, and the
    # mean of beam and transom beam for the tapering plan-form width.
    mean_deadrise = (bow_deadrise_deg + aft_deadrise_deg) / 2
    area = grid.surface_area_multiplier * length_m * (beam_m + transom_beam_m) / 2 / cos(radians(mean_deadrise))
    return Hull(
        hull_id, length_m, beam_m, transom_beam_m, bow_deadrise_deg, aft_deadrise_deg,
        area * grid.shell_kg_per_m2 + grid.structure_mass_kg,
    )


def resistance_n(s: Scenario, hull: Hull, mass_kg: float, speed_mps: float, lcg: float) -> float:
    """Synthetic nonlinear response for exercising the optimizer, not a planing model."""
    r = s.resistance
    return (
        r.reference_resistance_n
        * (mass_kg / r.reference_mass_kg) ** r.mass_exponent
        * (speed_mps / r.reference_speed_mps) ** r.speed_exponent
        * (hull.length_m / r.reference_length_m) ** r.length_exponent
        * (hull.beam_m / r.reference_beam_m) ** r.beam_exponent
        * (hull.transom_beam_m / r.reference_transom_beam_m) ** r.transom_beam_exponent
        * (1 + r.deadrise_penalty_per_degree * (hull.aft_deadrise_deg - r.reference_deadrise_deg))
        * (1 + r.lcg_penalty * (lcg - r.preferred_lcg_fraction) ** 2)
    )


def evaluate(s: Scenario, hull: Hull, setup: Setup, candidate_id: str) -> Candidate:
    m, battery = s.mission, s.battery
    drive = next(d for d in s.drives if d.id == setup.drive_id)
    prop = next(p for p in s.props if p.id == setup.prop_id)
    if drive.id not in prop.compatible_drive_ids:
        raise ValueError("Incompatible drive and prop")
    # Capacity is the choice; pack mass follows from the assumed specific energy.
    capacity_wh = setup.battery_capacity_wh
    battery_mass = capacity_wh / battery.specific_energy_wh_per_kg
    mass = hull.mass_kg + m.payload_kg + m.fixed_mass_kg + drive.mass_kg + prop.mass_kg + battery_mass
    # Coordinates are fractions of hull length measured forward from the transom.
    lcg = (
        hull.mass_kg * 0.45 + m.fixed_mass_kg * 0.4
        + (drive.mass_kg + prop.mass_kg) * 0.1
        + m.payload_kg * setup.payload_x_fraction
        + battery_mass * setup.battery_x_fraction
    ) / mass
    drag = resistance_n(s, hull, mass, setup.speed_mps, lcg)
    shaft_power = drag * setup.speed_mps / prop.efficiency
    bus_power = shaft_power / drive.electrical_to_shaft_efficiency + m.hotel_power_w
    race_time = m.distance_m / setup.speed_mps + m.extra_time_s
    # Charge the extra time at cruise demand; no acceleration/turn dynamics yet.
    energy_used = bus_power * race_time / 3600
    capacity_ah = capacity_wh / battery.nominal_voltage_v
    bus_current = bus_power / battery.loaded_voltage_v
    battery_current_limit = capacity_ah * battery.continuous_c_rate * m.continuous_rating_fraction
    drive_current_limit = drive.continuous_bus_current_a * m.continuous_rating_fraction
    metrics = {
        "mass_kg": mass, "lcg_fraction": lcg,
        "resistance_n": drag, "shaft_power_w": shaft_power,
        "electrical_power_w": bus_power, "race_time_s": race_time,
        "energy_used_wh": energy_used, "capacity_wh": capacity_wh, "battery_mass_kg": battery_mass,
        "capacity_ah": capacity_ah, "current_a": bus_current,
        "energy_reserve_fraction": 1 - energy_used / capacity_wh,
        "battery_current_limit_a": battery_current_limit,
        "drive_current_limit_a": drive_current_limit,
    }
    margins = {
        "loaded_mass_kg": m.max_mass_kg - mass,
        "energy_wh": m.usable_energy_fraction * capacity_wh - energy_used,
        "shaft_power_w": m.continuous_rating_fraction * drive.continuous_shaft_power_w - shaft_power,
        "battery_current_a": battery_current_limit - bus_current,
        "drive_current_a": drive_current_limit - bus_current,
        "system_voltage_v": m.voltage_limit_v - battery.full_voltage_v,
        "drive_voltage_v": drive.max_voltage_v - battery.full_voltage_v,
        "lcg_min_fraction": lcg - m.lcg_min_fraction,
        "lcg_max_fraction": m.lcg_max_fraction - lcg,
        # The transom cannot be wider than the widest part of the hull.
        "transom_within_beam_m": hull.beam_m - hull.transom_beam_m,
        # The bottom cannot get steeper toward the transom than at the bow.
        "deadrise_order_deg": hull.bow_deadrise_deg - hull.aft_deadrise_deg,
    }
    return Candidate(candidate_id, hull.id, setup, metrics, margins)
