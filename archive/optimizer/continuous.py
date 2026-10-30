"""Multistart SLSQP over the continuous variables for one fixed drive/propeller pair.

The nonlinear model in `model.py` is evaluated directly, so hull geometry, battery
capacity, speed and placements can take any value inside their bounds. The
drive/propeller pair is a discrete choice and is enumerated by the caller.
"""

from __future__ import annotations

import numpy as np
from scipy.optimize import minimize
from scipy.stats import qmc

from .model import Candidate, Drive, Hull, Prop, Scenario, Setup, evaluate, make_hull

VARIABLES = (
    "length_m", "beam_m", "transom_beam_m", "bow_deadrise_deg", "aft_deadrise_deg",
    "battery_capacity_wh", "speed_mps", "payload_x_fraction", "battery_x_fraction",
)
# Constraints must hold with this much scaled room so a converged point still passes
# the independent nonnegative-margin recheck despite solver round-off.
MARGIN_BUFFER = 1e-6
TIME_SCALE_S = 100.0


def bounds(s: Scenario) -> list[tuple[float, float]]:
    ranges = (
        s.hulls.length_m, s.hulls.beam_m, s.hulls.transom_beam_m,
        s.hulls.bow_deadrise_deg, s.hulls.aft_deadrise_deg,
        s.search.battery_capacity_wh, s.search.speed_mps,
        s.search.payload_x_fraction, s.search.battery_x_fraction,
    )
    return [(r.min, r.max) for r in ranges]


def margin_scales(s: Scenario, drive: Drive) -> dict[str, float]:
    """Natural magnitudes that put every margin near unit size for the solver."""
    m = s.mission
    return {
        "loaded_mass_kg": m.max_mass_kg,
        "energy_wh": s.search.battery_capacity_wh.max,
        "shaft_power_w": drive.continuous_shaft_power_w,
        "battery_current_a": drive.continuous_bus_current_a,
        "drive_current_a": drive.continuous_bus_current_a,
        "system_voltage_v": m.voltage_limit_v, "drive_voltage_v": drive.max_voltage_v,
        "lcg_min_fraction": 0.1, "lcg_max_fraction": 0.1, "deadrise_order_deg": 10.0,
        "transom_within_beam_m": s.hulls.beam_m.max,
    }


def decode(s: Scenario, u: np.ndarray, drive: Drive, prop: Prop, hull_id: str) -> tuple[Hull, Candidate]:
    """Map unit-cube coordinates onto the variable bounds and evaluate the boat."""
    length, beam, transom, bow, aft, capacity, speed, payload_x, battery_x = (
        lo + float(x) * (hi - lo) for x, (lo, hi) in zip(np.clip(u, 0, 1), bounds(s))
    )
    hull = make_hull(s, hull_id, length, beam, transom, bow, aft)
    setup = Setup(drive.id, prop.id, capacity, speed, payload_x, battery_x)
    return hull, evaluate(s, hull, setup, f"{hull_id}_setup_0000")


def solve_pair(s: Scenario, drive: Drive, prop: Prop, first_index: int) -> list[tuple[Hull, Candidate]]:
    """Run one local solve from each quasi-random start; return every endpoint.

    Endpoints include failed and infeasible ones so the results show the landscape.
    Each gets its own hull id, numbered from `first_index`.
    """
    search = s.search
    scales = margin_scales(s, drive)
    memo: dict[bytes, Candidate] = {}

    def candidate(u: np.ndarray) -> Candidate:
        key = np.clip(u, 0, 1).tobytes()
        if key not in memo:
            memo[key] = decode(s, u, drive, prop, "probe")[1]
        return memo[key]

    def objective(u: np.ndarray) -> float:
        return candidate(u).metrics["race_time_s"] / TIME_SCALE_S

    def margins(u: np.ndarray) -> np.ndarray:
        return np.array([value / scales.get(key, 1.0) - MARGIN_BUFFER
                         for key, value in candidate(u).margins.items()])

    starts = qmc.Sobol(d=len(VARIABLES), scramble=True, seed=search.seed).random_base2(search.starts_log2)
    results = []
    for offset, start in enumerate(starts):
        outcome = minimize(
            objective, start, method="SLSQP", bounds=[(0.0, 1.0)] * len(VARIABLES),
            constraints=[{"type": "ineq", "fun": margins}],
            options={"maxiter": search.max_iterations, "ftol": 1e-10},
        )
        results.append(decode(s, outcome.x, drive, prop, f"hull_{first_index + offset:03d}"))
    return results
