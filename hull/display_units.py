"""Inch-based presentation; model inputs, equations and study JSON stay in SI."""
import copy

INCH_M = 0.0254


def column_info(key):
    """Return (display key, SI-to-display multiplier, unit) for a numeric field."""
    prefix = 'input__' if key.startswith('input__') else ''
    name = key[len(prefix):]
    for suffix, replacement, factor, unit in [
        ('_kg_m3', '_kg_in3', INCH_M**3, 'kg/in³'),
        ('_m2_s', '_in2_s', 1/INCH_M**2, 'in²/s'),
        ('_m_s', '_in_s', 1/INCH_M, 'in/s'),
        ('_nm', '_n_in', 1/INCH_M, 'N·in'),
        ('_m2', '_in2', 1/INCH_M**2, 'in²'),
        ('_m3', '_in3', 1/INCH_M**3, 'in³'),
        ('_m', '_in', 1/INCH_M, 'in'),
    ]:
        if name.endswith(suffix):
            return prefix+name[:-len(suffix)]+replacement, factor, unit
    units = {'_mph': 'mph', '_deg': 'deg', '_kw': 'kW', '_kg': 'kg',
             '_n': 'N', '_lbf': 'lbf', '_in': 'in', '_in2': 'in²'}
    unit = next((unit for suffix, unit in units.items() if name.endswith(suffix)), '1')
    return key, 1.0, unit


def si_key(display_key):
    """Accept inch aliases in controls, while continuing to accept existing SI IDs."""
    for suffix, replacement in [('_kg_in3', '_kg_m3'), ('_in2_s', '_m2_s'),
                                 ('_in_s', '_m_s'), ('_n_in', '_nm'),
                                 ('_in2', '_m2'), ('_in3', '_m3'), ('_in', '_m')]:
        if display_key.endswith(suffix):
            return display_key[:-len(suffix)]+replacement
    return display_key


def overrides_to_si(values):
    result = {}
    for key, value in values.items():
        internal = si_key(key)
        if internal in result:
            raise ValueError(f'Duplicate unit aliases for {internal}')
        factor = column_info(internal)[1] if internal != key else 1
        result[internal] = value/factor
    return result


def value_in_inches(key, value):
    return None if value is None else value*column_info(key)[1]


def quantity_label(key):
    name, _, unit = column_info(si_key(key))
    return f'{name} ({unit})'


def scenario_label(name):
    if name == 'baseline':
        return 'Baseline'
    if name.startswith('scenario:'):
        return name.removeprefix('scenario:')
    if '=' in name:
        key, value = name.split('=', 1)
        try:
            converted = value_in_inches(key, float(value))
        except ValueError:
            return name
        display_key, _, unit = column_info(key)
        return f'{display_key} = {converted:.5g} {unit}'
    return name


def curve_rows_in_inches(rows):
    """Return a copy with converted numeric columns, names and parameter values."""
    result = []
    for row in rows:
        converted = {}
        for key, value in row.items():
            if key in {'parameter_value', 'parameter_baseline'}:
                parameter = row.get('parameter')
                converted[key] = value_in_inches(parameter, value) if parameter else value
            elif key == 'parameter' and value is not None:
                converted[key] = column_info(value)[0]
            elif key == 'scenario':
                converted[key] = scenario_label(value)
            else:
                name, factor, _ = column_info(key)
                converted[name] = (value*factor if factor != 1 and isinstance(value, (int, float))
                                   and not isinstance(value, bool) else copy.deepcopy(value))
        result.append(converted)
    return result


def sensitivity_rows_in_inches(rows):
    result = []
    for row in rows:
        converted = copy.deepcopy(row)
        parameter, xfactor, xunit = column_info(row['parameter'])
        metric, yfactor, yunit = column_info(row['metric'])
        converted.update(parameter=parameter, metric=metric, scenario=scenario_label(row['scenario']),
                         input_unit=xunit, output_unit=yunit, slope_unit=f'{yunit}/{xunit}')
        for key in ['parameter_value', 'parameter_baseline']:
            converted[key] = value_in_inches(row['parameter'], row[key])
        if row.get('change') is not None:
            converted['change'] = row['change']*yfactor
        if row.get('slope') is not None:
            converted['slope'] = row['slope']*yfactor/xfactor
        result.append(converted)
    return result
