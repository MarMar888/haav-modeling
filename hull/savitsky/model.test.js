'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const s=require('./model.js');
const ref={length_m:24.38,beam_m:7.315,mass_kg:827400/s.G,deadrise_deg:15,
  lcg_m:10.67,vcg_m:7.315/7,thrust_height_m:7.315/7,thrust_x_m:10.67,
  density_kg_m3:1025.87,viscosity_m2_s:1.19e-6,wetted_lengths_type:3,
  flap_chord_m:0.3048,flap_span_ratio:1,flap_angle_deg:5};
function close(a,b,tolerance){assert(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);}
test('reproduces published OpenPlaning Savitsky 1976 worked example',()=>{
  // Published results, not fixtures computed by this implementation:
  // https://github.com/elcf/python-openplaning#examples
  const r=s.solve(ref,13.07);
  close(r.trim_deg,2.878945,1e-5);
  close(r.keel_wetted_m,28.69256,1e-4);
  close(r.chine_wetted_m,17.67617,1e-4);
  close(r.wetted_area_m2,175.5762,1e-3);
  close(r.transom_draft_m,1.441111,1e-5);
  close(r.pressure_drag_n,39245.86,0.02);
  close(r.friction_drag_n,31893.98,0.02);
  // The reference also exceeds its stated hull length; surface this.
  assert(r.warnings.some(w=>w.includes('hull length')));
});
test('at rest has zero motion resistance without inventing static attitude',()=>{
  const r=s.solve({},0);assert.equal(r.status,'static');assert.equal(r.effective_power_kw,0);
  assert.equal(r.resistance_n,0);assert.equal(r.trim_deg,undefined);assert.equal(r.transom_draft_m,undefined);
});
test('low-speed resistance stays unavailable rather than zero or a planing extrapolation',()=>{
  const r=s.solve({},1);assert.equal(r.status,'displacement_unmodeled');assert.equal(r.resistance_n,undefined);
});
test('sample balances vertical forces and pitching moments across speed sweep',()=>{
  const rows=s.sweep({},15,31);assert(rows.some(r=>r.status==='within_screen'));assert.equal(rows[0].speed_m_s,0);
  for(const r of rows.filter(r=>Number.isFinite(r.trim_deg))){
    assert(Math.abs(r.vertical_residual_n)<1e-6);
    assert(Math.abs(r.moment_residual_nm)<1e-6);
    close(r.effective_power_kw,r.resistance_n*r.speed_m_s/1000,1e-10);
    close(r.resistance_n,r.pressure_drag_n+r.friction_drag_n+r.flap_drag_n,1e-8);
  }
});
test('changing speed changes demand; low trim is flagged',()=>{
  const slow=s.solve({},8),fast=s.solve({},15);
  assert(fast.effective_power_kw>slow.effective_power_kw);assert(fast.trim_deg<slow.trim_deg);
  assert.equal(fast.status,'outside_limits');assert(fast.warnings.some(w=>w.includes('Trim')));
});
test('moving CG changes solved attitude',()=>{
  const a=s.solve({lcg_m:0.8},8),b=s.solve({lcg_m:1.0},8);
  assert(Number.isFinite(a.trim_deg)&&Number.isFinite(b.trim_deg));assert(Math.abs(a.trim_deg-b.trim_deg)>0.1);
});
test('flat-bottom limit returns finite equilibrium without deadrise division',()=>{
  const r=s.solve({deadrise_deg:0},8);assert(Number.isFinite(r.trim_deg));assert(Number.isFinite(r.resistance_n));
});
test('rejects bad geometry, nonfinite inputs and invalid sweeps',()=>{
  for(const p of [{beam_m:0},{mass_kg:-1},{lcg_m:100},{deadrise_deg:46},{vcg_m:NaN},{wetted_lengths_type:1}])assert.throws(()=>s.solve(p,8));
  for(const v of [-1,NaN,Infinity])assert.throws(()=>s.solve({},v));
  assert.throws(()=>s.sweep({},0));assert.throws(()=>s.sweep({},15,1));
});
