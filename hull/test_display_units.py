"""Presentation conversions must never change the SI model data."""
import copy
import unittest

from display_units import (column_info, curve_rows_in_inches, overrides_to_si,
                           sensitivity_rows_in_inches, si_key)


class InchDisplayTests(unittest.TestCase):
    def test_curve_values_units_and_input_provenance(self):
        raw = [{'scenario': 'lcg_m=0.6096', 'parameter': 'lcg_m',
                'parameter_value': .6096, 'parameter_baseline': .3048,
                'keel_wetted_m': 1.2192, 'keel_wetted_in': 48.,
                'wetted_area_m2': .064516, 'input__lcg_m': .6096,
                'input__viscosity_m2_s': .00064516,
                'pressure_moment_nm': .0254, 'geometry_ok': False}]
        original = copy.deepcopy(raw)
        row = curve_rows_in_inches(raw)[0]
        self.assertEqual(raw, original)
        self.assertEqual(row['parameter'], 'lcg_in')
        self.assertAlmostEqual(row['parameter_value'], 24)
        self.assertAlmostEqual(row['parameter_baseline'], 12)
        self.assertAlmostEqual(row['input__lcg_in'], 24)
        self.assertEqual(row['keel_wetted_in'], 48)
        self.assertAlmostEqual(row['wetted_area_in2'], 100)
        self.assertAlmostEqual(row['input__viscosity_in2_s'], 1)
        self.assertAlmostEqual(row['pressure_moment_n_in'], 1)
        self.assertEqual(row['scenario'], 'lcg_in = 24 in')
        self.assertNotIn('keel_wetted_m', row)
        self.assertIs(row['geometry_ok'], False)

    def test_slope_converts_numerator_and_denominator(self):
        raw = [{'scenario': 'beam_m=0.3556', 'parameter': 'beam_m',
                'parameter_value': .3556, 'parameter_baseline': .3048,
                'metric': 'resistance_n', 'change': 10., 'slope': 100.,
                'percent_change': 5., 'elasticity': .3}]
        row = sensitivity_rows_in_inches(raw)[0]
        self.assertAlmostEqual(row['slope'], 2.54)
        self.assertEqual(row['slope_unit'], 'N/in')
        self.assertEqual(row['percent_change'], 5.)
        self.assertEqual(row['elasticity'], .3)
        raw[0].update(parameter='mass_kg', parameter_value=60., parameter_baseline=55.,
                      metric='keel_wetted_m', change=.0254, slope=.0254)
        row = sensitivity_rows_in_inches(raw)[0]
        self.assertAlmostEqual(row['change'], 1.)
        self.assertAlmostEqual(row['slope'], 1.)
        self.assertEqual(row['slope_unit'], 'in/kg')

    def test_inch_overrides_and_legacy_si_values(self):
        converted = overrides_to_si({'lcg_in': 24, 'beam_in': 14, 'mass_kg': 60})
        self.assertAlmostEqual(converted['lcg_m'], .6096)
        self.assertAlmostEqual(converted['beam_m'], .3556)
        self.assertEqual(converted['mass_kg'], 60)
        self.assertEqual(overrides_to_si({'lcg_m': .6}), {'lcg_m': .6})
        with self.assertRaises(ValueError):
            overrides_to_si({'lcg_m': .6, 'lcg_in': 24})
        self.assertEqual(si_key('wetted_area_in2'), 'wetted_area_m2')
        self.assertAlmostEqual(column_info('density_kg_m3')[1], .0254**3)


if __name__ == '__main__':
    unittest.main()
