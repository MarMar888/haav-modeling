from dataclasses import replace
from itertools import product
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import numpy as np
from pydantic import ValidationError

from .continuous import VARIABLES, bounds, decode
from .model import Scenario, evaluate, load_scenario, make_hull
from .solve import optimize, select

SCENARIO = Path(__file__).with_name("scenario.json")


def quick(scenario: Scenario, starts_log2: int = 2) -> Scenario:
    """Copy with fewer multistart points so unit tests stay fast."""
    copy = scenario.model_copy(deep=True)
    copy.search.starts_log2 = starts_log2
    return copy


def midpoint(s: Scenario):
    drive, prop = s.drives[0], s.props[0]
    return decode(s, np.full(len(VARIABLES), 0.5), drive, prop, "hull_000")


class OptimizationTests(unittest.TestCase):
    def setUp(self):
        self.scenario = load_scenario(SCENARIO)

    def test_battery_capacity_propagates_through_physics(self):
        s = self.scenario
        hull, first = midpoint(s)
        extra_wh = s.battery.specific_energy_wh_per_kg
        second = evaluate(s, hull, replace(first.setup, battery_capacity_wh=first.setup.battery_capacity_wh + extra_wh), "bigger")
        self.assertAlmostEqual(first.metrics["battery_mass_kg"], first.setup.battery_capacity_wh / s.battery.specific_energy_wh_per_kg)
        self.assertAlmostEqual(second.metrics["mass_kg"] - first.metrics["mass_kg"], 1)
        self.assertAlmostEqual(second.metrics["capacity_wh"] - first.metrics["capacity_wh"], extra_wh)
        self.assertGreater(second.metrics["electrical_power_w"], first.metrics["electrical_power_w"])
        self.assertGreater(second.metrics["energy_used_wh"], first.metrics["energy_used_wh"])

    def test_energy_and_efficiency_units(self):
        s = self.scenario
        row = midpoint(s)[1]
        values = row.metrics
        self.assertAlmostEqual(values["race_time_s"], 3218.688 / row.setup.speed_mps + 20)
        self.assertAlmostEqual(values["energy_used_wh"], values["electrical_power_w"] * values["race_time_s"] / 3600)
        self.assertAlmostEqual(values["current_a"], values["electrical_power_w"] / s.battery.loaded_voltage_v)
        self.assertGreater(values["electrical_power_w"], values["shaft_power_w"])
        self.assertGreater(values["shaft_power_w"], values["resistance_n"] * row.setup.speed_mps)

    def test_deadrise_order_is_a_constraint(self):
        s = self.scenario
        hull = make_hull(s, "hull_000", 2.0, 0.8, 0.7, 35, 12)
        _, candidate = midpoint(s)
        self.assertAlmostEqual(evaluate(s, hull, candidate.setup, "x").margins["deadrise_order_deg"], 23)
        flipped = make_hull(s, "hull_000", 2.0, 0.8, 0.7, 10, 12)
        self.assertLess(evaluate(s, flipped, candidate.setup, "x").margins["deadrise_order_deg"], 0)

    def test_transom_beam_tapers_the_hull_and_cannot_exceed_beam(self):
        s = self.scenario
        _, candidate = midpoint(s)
        wide = make_hull(s, "hull_000", 2.0, 0.8, 0.8, 35, 12)
        narrow = make_hull(s, "hull_000", 2.0, 0.8, 0.5, 35, 12)
        self.assertAlmostEqual(evaluate(s, wide, candidate.setup, "x").margins["transom_within_beam_m"], 0)
        self.assertAlmostEqual(evaluate(s, narrow, candidate.setup, "x").margins["transom_within_beam_m"], 0.3)
        self.assertAlmostEqual(narrow.mass_kg - s.hulls.structure_mass_kg, (wide.mass_kg - s.hulls.structure_mass_kg) * 0.65 / 0.8)
        over = make_hull(s, "hull_000", 2.0, 0.8, 0.9, 35, 12)
        self.assertLess(evaluate(s, over, candidate.setup, "x").margins["transom_within_beam_m"], 0)

    def test_continuous_search_is_feasible_in_bounds_and_beats_a_coarse_grid(self):
        s = quick(self.scenario, 3)
        with TemporaryDirectory() as temp:
            out = Path(temp)
            with patch("optimization.solve.select", wraps=select) as selection:
                result = optimize(s, out)
                selection.assert_called_once()
            self.assertEqual(result["optimization_mode"], "continuous_nlp")
            self.assertEqual(result["status"], "demo_best_found")
            self.assertFalse(result["build_ready"])
            best = result["best"]
            self.assertTrue(all(margin >= 0 for margin in best["margins"].values()))
            hull = next(row["hull"] for row in result["hulls"] if row["hull"]["id"] == best["hull_id"])
            values = [hull["length_m"], hull["beam_m"], hull["transom_beam_m"], hull["bow_deadrise_deg"], hull["aft_deadrise_deg"],
                      best["setup"]["battery_capacity_wh"], best["setup"]["speed_mps"],
                      best["setup"]["payload_x_fraction"], best["setup"]["battery_x_fraction"]]
            for value, (low, high) in zip(values, bounds(s)):
                self.assertTrue(low - 1e-9 <= value <= high + 1e-9)
            # Independent re-evaluation must reproduce the reported boat exactly.
            drive = next(d for d in s.drives if d.id == best["setup"]["drive_id"])
            prop = next(p for p in s.props if p.id == best["setup"]["prop_id"])
            u = [(v - lo) / (hi - lo) for v, (lo, hi) in zip(values, bounds(s))]
            again = decode(s, np.array(u), drive, prop, best["hull_id"])[1]
            for key, value in best["metrics"].items():
                self.assertAlmostEqual(again.metrics[key], value, places=6, msg=key)
            for name in ("candidates.json", "results.json", "finalops-report.json", "selection.json", "ledger.json"):
                self.assertTrue((out / name).exists(), name)
            report = json.loads((out / "finalops-report.json").read_text())
            self.assertEqual(report["unlinked_requirements"], [])
            self.assertEqual(report["rule_violations"], [])
            self.assertTrue(report["proven_optimal"])
            with self.assertRaisesRegex(ValueError, "not empty"):
                optimize(s, out)

            # Every combination of variable bounds and midpoints is a valid design to
            # try; the continuous search must not lose to any of them.
            grid_best = float("inf")
            compatible = [(d, p) for d in s.drives for p in s.props if d.id in p.compatible_drive_ids]
            for drive, prop in compatible:
                for point in product((0.0, 0.5, 1.0), repeat=len(VARIABLES)):
                    candidate = decode(s, np.array(point), drive, prop, "grid")[1]
                    if candidate.feasible:
                        grid_best = min(grid_best, candidate.metrics["race_time_s"])
            self.assertLessEqual(best["metrics"]["race_time_s"], grid_best + 0.5)

    def test_infeasible_mass_limit_returns_no_winner(self):
        s = quick(self.scenario)
        s.mission.max_mass_kg = 1
        with TemporaryDirectory() as temp:
            result = optimize(s, Path(temp))
            self.assertEqual(result["status"], "no_feasible_found")
            self.assertIsNone(result["best"])

    def test_full_voltage_is_checked_not_nominal(self):
        s = self.scenario.model_copy(deep=True)
        s.battery.full_voltage_v = 58.8
        s.battery.nominal_voltage_v = 51.8
        candidate = midpoint(s)[1]
        self.assertLess(candidate.margins["system_voltage_v"], 0)
        with TemporaryDirectory() as temp:
            self.assertIsNone(select([candidate], "overvoltage", Path(temp)))

    def test_invalid_data_fails_early(self):
        for section, key, value in [
            ("battery", "specific_energy_wh_per_kg", 0),
            ("mission", "usable_energy_fraction", 1.1),
            ("search", "speed_mps", {"min": 5, "max": 2}),
            ("search", "battery_capacity_wh", {"min": 0, "max": 1000}),
            ("search", "starts_log2", -1),
            ("hulls", "beam_m", {"min": 0, "max": 1}),
            ("hulls", "transom_beam_m", {"min": 2, "max": 3}),
            ("hulls", "bow_deadrise_deg", {"min": 1, "max": 4}),
            ("battery", "loaded_voltage_v", 100),
            ("resistance", "reference_resistance_n", float("nan")),
        ]:
            with self.subTest(key=key):
                data = self.scenario.model_dump()
                data[section][key] = value
                with self.assertRaises(ValidationError):
                    Scenario.model_validate(data)


if __name__ == "__main__":
    unittest.main()
