"""Continuous multistart search per drive/propeller pair, then one finalops selection."""

from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import asdict
import json
from pathlib import Path

from finalops import CapacityLimit, DemandCoverage, Ledger, run

from .continuous import solve_pair
from .model import Candidate, Scenario, evaluate, load_scenario

FINALOPS_REVISION = "02ebe70a9e19ea584cb525485ddc5e8ac0467620"
UNMODELED = [
    "Calibrated hull resistance, planing transition, running trim and wave response",
    "Hydrostatics, downflooding clearance, flooded buoyancy and self-righting",
    "Structural loads, physical packaging and removable payload mounting",
    "Propeller RPM/torque/thrust matching, cavitation and transient acceleration",
    "Turns, navigation accuracy, voltage sag and thermal behavior",
    "Complete BOM and physical competition safety inspection requirements",
]


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, allow_nan=False) + "\n")


def select(candidates: list[Candidate], name: str, out: Path) -> Candidate | None:
    """Exactly one candidate must pass every modeled constraint. No soft penalties."""
    out.mkdir(parents=True, exist_ok=True)
    if not candidates:
        write_json(out / "selection.json", {"status": "no_candidates", "selected": None})
        return None

    ledger = Ledger()
    objective = {}
    for candidate in candidates:
        ledger.variable(candidate.id, category="Binary", units="selected",
                        source=f"candidates.json:{candidate.id}")
        data_id = f"time_{candidate.id}"
        ledger.data(data_id, candidate.metrics["race_time_s"], units="s",
                    source=f"candidates.json:{candidate.id}.metrics.race_time_s")
        objective[candidate.id] = data_id
    ledger.minimize("race_time", objective, units="s", source="README.md:objective")
    choices = {candidate.id: 1 for candidate in candidates}
    ledger.constrain(DemandCoverage(id="choose_at_least_one", required=1,
                                    covered_by=choices, source="README.md:selection"))
    ledger.constrain(CapacityLimit(id="choose_at_most_one", limit=1,
                                  uses=choices, source="README.md:selection"))
    for margin in candidates[0].margins:
        # With exactly one binary selected, its margin must be nonnegative.
        ledger.constrain(DemandCoverage(
            id=margin, required=0,
            covered_by={c.id: c.margins[margin] for c in candidates},
            source=f"model.py:evaluate.margins.{margin}",
            description=f"Selected candidate must have nonnegative {margin} margin",
        ))

    outcome = run(ledger, name=name, time_limit=30, max_gap=0,
                  out=out / "finalops-report.json")
    ledger.to_json(out / "ledger.json")
    if outcome.report["status"] == "Infeasible":
        write_json(out / "selection.json", {
            "status": "infeasible_among_candidates", "selected": None, "problems": outcome.problems,
        })
        return None
    # finalops currently doesn't itself gate every non-optimal solver status.
    if not outcome.passed or outcome.report["status"] != "Optimal" or not outcome.report["proven_optimal"]:
        raise RuntimeError(f"Unproven selection in {name}: {outcome.report['status']}; {outcome.problems}")
    chosen = [c for c in candidates if outcome.model.var(c.id).value() > 0.5]
    if len(chosen) != 1 or not chosen[0].feasible:
        raise RuntimeError(f"Independent selection validation failed for {name}")
    winner = chosen[0]
    write_json(out / "selection.json", {"status": "optimal_among_candidates", "selected": asdict(winner)})
    return winner


def optimize(scenario: Scenario, out: Path) -> dict:
    if out.exists() and any(out.iterdir()):
        raise ValueError(f"Output directory is not empty: {out}. Use a new run directory.")
    out.mkdir(parents=True, exist_ok=True)
    write_json(out / "scenario.json", scenario.model_dump())
    hulls, all_candidates, rankings = {}, [], []
    pairs = [(drive, prop) for drive in scenario.drives for prop in scenario.props
             if drive.id in prop.compatible_drive_ids]
    # Each local solve endpoint is recorded as its own "hull" so the viewer can show
    # every design the optimizer reached, not only the winner.
    for drive, prop in pairs:
        for hull, candidate in solve_pair(scenario, drive, prop, len(hulls)):
            hulls[hull.id] = hull
            directory = out / "hulls" / hull.id
            directory.mkdir(parents=True, exist_ok=True)
            write_json(directory / "candidates.json", [asdict(candidate)])
            all_candidates.append(candidate)
            rejections = Counter(k for k, margin in candidate.margins.items() if margin < -1e-7)
            rankings.append({
                "hull": asdict(hull), "evaluated": 1, "feasible": int(candidate.feasible),
                "rejections_by_constraint": dict(rejections),
                "best": asdict(candidate) if candidate.feasible else None,
            })

    write_json(out / "candidates.json", [asdict(c) for c in all_candidates])
    # finalops needs strictly nonnegative margins to be certain of the linear rows.
    valid = [c for c in all_candidates if all(margin >= 0 for margin in c.margins.values())]
    best = select(valid or all_candidates, "whole_boat_selection", out)
    if best:
        recomputed = evaluate(scenario, hulls[best.hull_id], best.setup, best.id)
        if not recomputed.feasible or recomputed.metrics != best.metrics:
            raise RuntimeError("Nonlinear re-evaluation failed")
    rankings.sort(key=lambda row: row["best"]["metrics"]["race_time_s"] if row["best"] else float("inf"))
    report = {
        "status": "demo_best_found" if best else "no_feasible_found",
        "optimization_mode": "continuous_nlp",
        "data_status": scenario.data_status,
        "build_ready": False,
        "finalops_revision": FINALOPS_REVISION,
        "optimality_scope": (
            "Best design found by multistart SLSQP from "
            f"{2 ** scenario.search.starts_log2} quasi-random starts per drive/propeller pair; "
            "local optima, no global or real-world optimality claim"
        ),
        "unmodeled_requirements": UNMODELED,
        "beats_benchmark_in_demo": best.metrics["race_time_s"] < scenario.mission.benchmark_s if best else None,
        "best": asdict(best) if best else None,
        "hulls": rankings,
    }
    write_json(out / "results.json", report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenario", type=Path, default=Path(__file__).with_name("scenario.json"))
    parser.add_argument("--out", type=Path, default=Path(__file__).parent / "runs" / "demo")
    args = parser.parse_args()
    try:
        report = optimize(load_scenario(args.scenario), args.out)
    except (ValueError, OSError, RuntimeError) as error:
        parser.exit(1, f"Optimization failed: {error}\n")
    print("ILLUSTRATIVE MODEL: results are not validated boat predictions.")
    print(f"Status: {report['status']}")
    print(f"Results: {args.out / 'results.json'}")
    if report["best"]:
        best = report["best"]
        print(f"Selected: {best['hull_id']} / {best['id']}")
        print(f"Synthetic race time: {best['metrics']['race_time_s']:.1f} s")
        return 0
    print("No feasible design was found within the variable bounds.")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
