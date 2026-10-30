"""Run: python3 -m unittest discover -s hull -p 'test_*.py'."""
import csv
import json
import math
from pathlib import Path
import tempfile
import unittest

from savitsky_sensitivity import ROOT, load_engine, load_baseline, study, export_study


class SensitivityTests(unittest.TestCase):
    def setUp(self):
        self.config, _ = load_baseline()

    def test_original_engine_matches_all_saved_points(self):
        saved = json.loads((ROOT/'outputs/savitsky/current-hull-2026-10-21/results.json').read_text())
        engine, _ = load_engine()
        rows = engine['run_sweep'](saved['inputs'], [r['speed_mph'] for r in saved['results']], .9652, 2)
        for old, new in zip(saved['results'], rows):
            self.assertEqual(old['status'], new['status'])
            for key, value in old.items():
                if isinstance(value, (int, float)):
                    self.assertTrue(math.isclose(new[key], value, rel_tol=1e-8, abs_tol=1e-9), (key, old['speed_mph']))

    def test_sensitivity_gaps_geometry_and_normalization(self):
        m = self.config['inputs']['mass_kg']
        run = study(self.config, [0, 2, 22], {'mass_kg': [m, m*1.1]})
        self.assertEqual(len(run['results']), 6)  # baseline is not repeated as a variant
        low = [r for r in run['results'] if r['speed_mph'] == 2]
        self.assertTrue(all('resistance_n' not in r for r in low))
        points = [r for r in run['sensitivities'] if r['metric'] == 'effective_power_kw']
        self.assertTrue(all(r['elasticity'] is None for r in points if r['speed_mph'] != 22))
        point = next(r for r in points if r['speed_mph'] == 22)
        self.assertAlmostEqual(point['elasticity'], point['percent_change']/10)
        self.assertFalse(point['baseline_geometry_ok'])
        strict = study(self.config, [22], {'mass_kg': [m*1.1]}, require_uniform_aft=True)
        self.assertTrue(all(not r['eligible'] and r['elasticity'] is None for r in strict['sensitivities']))

    def test_zero_baseline_input_and_coupled_scenarios(self):
        run = study(self.config, [22], {'roughness_m': [1e-5]},
                    {'equipment move': {'lcg_m': .62, 'vcg_m': .14}})
        self.assertTrue(all(r['elasticity'] is None for r in run['sensitivities']))
        self.assertTrue(any(r['slope'] is not None for r in run['sensitivities']))
        self.assertTrue(all(r['parameter'] == 'roughness_m' for r in run['sensitivities']))
        self.assertEqual(len(run['results']), 3)

    def test_export_roundtrip_and_refuse_overwrite(self):
        m = self.config['inputs']['mass_kg']
        run = study(self.config, [0, 2, 22], {'mass_kg': [m*1.1]})
        with tempfile.TemporaryDirectory() as temp:
            folder = export_study(run, Path(temp)/'study')
            config, speeds = load_baseline(folder/'study.json')
            self.assertEqual(speeds, [0, 2, 22])
            self.assertEqual(config['inputs'], self.config['inputs'])
            with (folder/'curves.csv').open() as f:
                rows = list(csv.DictReader(f))
            self.assertEqual(len(rows), 6)
            self.assertEqual(next(r for r in rows if r['speed_mph'] == '2')['resistance_n'], '')
            self.assertEqual(len(json.loads((folder/'study.json').read_text())['sensitivities']), 27)
            with self.assertRaises(FileExistsError):
                export_study(run, folder)

    def test_invalid_inputs_are_not_silently_dropped(self):
        for speeds, changes in [([22, 22], {}), ([22, 2], {}), ([float('nan')], {}),
                                ([22], {'beam_typo': [.3]}), ([22], {'mass_kg': [-1]}),
                                ([22], {'flap_angle_deg': [2]})]:
            with self.subTest(speeds=speeds, changes=changes), self.assertRaises(ValueError):
                study(self.config, speeds, changes)


if __name__ == '__main__':
    unittest.main()
