/* Calm-water subset adapted from OpenPlaning (MIT); see NOTICE.txt.
 * Same empirical force/geometry relations; independent bracketed equilibrium solver.
 * No waves, appendage drag, porpoising or motor/propeller performance model.
 */
(function (root) {
  'use strict';
  const G = 9.8066, RAD = Math.PI / 180;
  const defaults = {
    length_m: 2.59, beam_m: 0.4064, mass_kg: 43.1, deadrise_deg: 10,
    lcg_m: 0.9065, vcg_m: 0.16, thrust_height_m: 0.08,
    thrust_x_m: 0, thrust_angle_deg: 0, density_kg_m3: 998.2,
    viscosity_m2_s: 1.004e-6, roughness_m: 150e-6,
    wetted_lengths_type: 2, flap_chord_m: 0, flap_span_ratio: 0, flap_angle_deg: 0
  };
  function validate(p) {
    for (const [k, v] of Object.entries(p)) if (!Number.isFinite(v)) throw new Error(k + ' must be finite.');
    for (const k of ['length_m','beam_m','mass_kg','lcg_m','density_kg_m3','viscosity_m2_s']) {
      if (p[k] <= 0) throw new Error(k + ' must be positive.');
    }
    if (p.beam_m > p.length_m || p.lcg_m >= p.length_m) throw new Error('Beam and LCG must fit within hull length.');
    if (p.deadrise_deg < 0 || p.deadrise_deg > 45) throw new Error('Deadrise must be between 0 and 45 degrees.');
    if (Math.abs(p.thrust_angle_deg) > 20) throw new Error('Sample supports thrust angles between -20 and 20 degrees.');
    if (p.vcg_m < 0 || p.roughness_m < 0 || p.flap_chord_m < 0 || p.flap_span_ratio < 0 || p.flap_span_ratio > 1 || p.flap_angle_deg < 0 || p.flap_angle_deg > 15) throw new Error('Invalid height, roughness or flap input.');
    if (![2, 3].includes(p.wetted_lengths_type)) throw new Error('Wetted-length method must be 2 (1964) or 3 (1976).');
  }
  function forces(p, speed, trim, keel) {
    const b=p.beam_m, beta=p.deadrise_deg, t=trim*RAD, br=beta*RAD;
    let gap, chine, lambda;
    if (p.wetted_lengths_type === 3) {
      const w=(0.57+beta/1000)*(Math.tan(br)/(2*Math.tan(t))-beta/167);
      const q=keel/b-w;
      chine=(q-0.2*Math.exp(-q/0.3))*b;
      gap=keel-chine;
      lambda=(keel/b+Math.max(0,chine)/b)/2+0.03;
    } else {
      gap=b/Math.PI*Math.tan(br)/Math.tan(t);
      chine=keel-gap;
      lambda=(keel+Math.max(0,chine))/(2*b);
    }
    // Preserve spray-line angle before the dry-chine clamp, as in OpenPlaning.
    const alpha=Math.atan2(b,2*gap);
    if (chine<0) { chine=0; gap=keel; }
    const cv=speed/Math.sqrt(G*b);
    const c0=trim**1.1*(0.012*Math.sqrt(lambda)+0.0055*lambda**2.5/cv**2);
    const cb=c0-0.0065*beta*c0**0.6;
    const lift=cb*0.5*p.density_kg_m3*speed**2*b**2;
    const pressureDrag=lift*Math.tan(t);
    const normal=lift/Math.cos(t);
    const cp=lambda*b*(0.75-1/(5.21*(cv/lambda)**2+2.39));
    const s1=gap**2*Math.tan(alpha)/Math.cos(br), s2=b*chine/Math.cos(br), area=s1+s2;
    const base=0.012*trim**1.1*Math.sqrt(lambda);
    const vm2=1-(base-0.0065*beta*base**0.6)/(lambda*Math.cos(t));
    if (!(vm2>0 && area>0)) throw new Error('No physical bottom-flow estimate.');
    const re=speed*Math.sqrt(vm2)*lambda*b/p.viscosity_m2_s;
    if (re<=100) throw new Error('Reynolds number outside friction model.');
    const cf=0.075/(Math.log10(re)-2)**2;
    const dcf=p.roughness_m>0 ? (44*((p.roughness_m/(lambda*b))**(1/3)-10*re**(-1/3))+0.125)/1000 : 0;
    const friction=0.5*p.density_kg_m3*(cf+dcf)*area*speed**2;
    const frictionHeight=(b/4*Math.tan(br)*s2+b/6*Math.tan(br)*s1)/area;
    const flapLift=0.046*(p.flap_chord_m*3.28084)*p.flap_angle_deg*p.flap_span_ratio*(b*3.28084)*(p.density_kg_m3/515.379)/2*(speed*3.28084)**2*4.44822;
    const flapDrag=0.0052*flapLift*(trim+p.flap_angle_deg);
    const drag=pressureDrag+friction*Math.cos(t)+flapDrag;
    const thrust=drag/Math.cos(t+p.thrust_angle_deg*RAD);
    const thrustMoment=thrust*(Math.cos(p.thrust_angle_deg*RAD)*(p.vcg_m-p.thrust_height_m)-Math.sin(p.thrust_angle_deg*RAD)*(p.lcg_m-p.thrust_x_m));
    const vertical=lift-friction*Math.sin(t)+flapLift-p.mass_kg*G+thrust*Math.sin(t+p.thrust_angle_deg*RAD);
    const moment=-normal*(p.lcg_m-cp)+friction*(frictionHeight-p.vcg_m)-flapLift*(p.lcg_m-(0.6*b+p.flap_chord_m*(1-p.flap_span_ratio)))+thrustMoment;
    return {trim_deg:trim,keel_wetted_m:keel,chine_wetted_m:chine,lambda,cv,
      wetted_area_m2:area,transom_draft_m:keel*Math.sin(t),center_pressure_m:cp,
      resistance_n:drag,thrust_n:thrust,effective_power_kw:drag*speed/1000,
      pressure_drag_n:pressureDrag,friction_drag_n:friction*Math.cos(t),flap_drag_n:flapDrag,
      vertical_residual_n:vertical,moment_residual_nm:moment,friction_coefficient:cf+dcf};
  }
  function verticalBalance(p,v,tau) {
    let lo=p.beam_m*1e-5,hi=Math.max(p.length_m,p.beam_m),a,b;
    // The zero-wetting limit is singular in the friction law. Locate a finite
    // lower endpoint rather than rejecting an otherwise valid equilibrium.
    for(let i=0;i<30&&!a;i++){
      try { a=forces(p,v,tau,lo); } catch { lo*=2; }
    }
    if(!a||lo>=hi)return null;
    try { b=forces(p,v,tau,hi); } catch { return null; }
    for(let i=0;i<10 && b.vertical_residual_n<0;i++){hi*=2;b=forces(p,v,tau,hi);}
    if(a.vertical_residual_n>0 || b.vertical_residual_n<0)return null;
    for(let i=0;i<58;i++){
      const mid=(lo+hi)/2,r=forces(p,v,tau,mid);
      if(r.vertical_residual_n>0)hi=mid;else lo=mid;
    }
    return forces(p,v,tau,(lo+hi)/2);
  }
  function solve(input,speed) {
    const p={...defaults,...input};validate(p);
    if(!Number.isFinite(speed)||speed<0)throw new Error('Speed must be finite and nonnegative.');
    if(speed===0)return {speed_m_s:0,status:'static',resistance_n:0,effective_power_kw:0,warnings:['At rest: no steady-motion resistance. Static trim and draft are not calculated.']};
    const cv=speed/Math.sqrt(G*p.beam_m);
    if(cv<1)return {speed_m_s:speed,cv,status:'displacement_unmodeled',warnings:['Low speed: no displacement or wave-making resistance model.']};
    let prior=null;const roots=[];
    for(let i=0;i<=138;i++){
      const t=0.5+i*0.25;let r;
      try{r=verticalBalance(p,speed,t);}catch{r=null;}
      if(r&&prior&&r.moment_residual_nm*prior.moment_residual_nm<=0){
        let lo=prior.trim_deg,hi=t;
        for(let j=0;j<42;j++){
          const mid=verticalBalance(p,speed,(lo+hi)/2);
          if(!mid)break;
          if(mid.moment_residual_nm*prior.moment_residual_nm>0)lo=mid.trim_deg;else hi=mid.trim_deg;
        }
        roots.push(verticalBalance(p,speed,(lo+hi)/2));
      }
      prior=r;
    }
    if(!roots.length)return {speed_m_s:speed,cv,status:'no_equilibrium',warnings:['No bracketed equilibrium in the 0.5–35 degree trim search.']};
    roots.sort((a,b)=>Math.abs(a.trim_deg-3)-Math.abs(b.trim_deg-3));
    const r=roots[0],warnings=[];
    if(r.trim_deg<2||r.trim_deg>15)warnings.push('Trim outside 2–15 degree empirical range.');
    if(r.lambda>4)warnings.push('Mean wetted length / beam exceeds 4.');
    if(r.cv>13)warnings.push('Beam speed coefficient exceeds 13.');
    if(r.keel_wetted_m>p.length_m)warnings.push('Predicted keel wetting exceeds actual hull length.');
    if(r.chine_wetted_m===0)warnings.push('Dry chines: simplified wetted geometry may be unreliable.');
    if(p.deadrise_deg>30)warnings.push('High deadrise: review applicability before using results.');
    if(r.friction_coefficient<=0||r.resistance_n<=0||r.thrust_n<=0)warnings.push('Nonphysical resistance prediction.');
    if(p.flap_chord_m>0&&(p.flap_chord_m>0.1*r.lambda*p.beam_m||cv<2||cv>7))warnings.push('Flap regression outside its documented chord/speed range.');
    if(roots.length>1)warnings.push('Multiple equilibria; showing the solution closest to 3 degrees trim.');
    if(Math.abs(r.vertical_residual_n)>1e-6*p.mass_kg*G||Math.abs(r.moment_residual_nm)>1e-6*p.mass_kg*G*p.length_m)throw new Error('Equilibrium residual tolerance was not met.');
    return {speed_m_s:speed,status:warnings.length?'outside_limits':'within_screen',...r,warnings};
  }
  function sweep(input,maxSpeed=15,count=31){
    if(!Number.isFinite(maxSpeed)||maxSpeed<=0||!Number.isInteger(count)||count<2||count>201)throw new Error('Use a positive maximum speed and 2–201 sweep points.');
    return Array.from({length:count},(_,i)=>solve(input,maxSpeed*i/(count-1)));
  }
  const api={defaults,G,validate,solve,sweep,forces};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.Savitsky=api;
})(typeof globalThis!=='undefined'?globalThis:this);
