'use strict';
(() => {
  const form=document.getElementById('calculator'),slider=document.getElementById('selected-speed');
  let params,results,maxSpeed;
  const fmt=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):'—';
  const labels={static:'At rest',displacement_unmodeled:'Low speed — unmodeled',no_equilibrium:'No equilibrium found',outside_limits:'Outside checks',within_screen:'Within implemented checks'};
  function inspect(){
    const v=+slider.value,r=Savitsky.solve(params,v);
    document.getElementById('speed-label').textContent=fmt(v,1)+' m/s · '+fmt(v*2.236936,1)+' mph';
    document.getElementById('selection').innerHTML='<div class="stats">'+[
      ['Running trim',fmt(r.trim_deg)+'°'],['Resistance',fmt(r.resistance_n,1)+' N'],
      ['Effective power',fmt(r.effective_power_kw,3)+' kW'],['Keel wetted length',fmt(r.keel_wetted_m)+' m']
    ].map(([name,val])=>'<div class="stat"><span>'+name+'</span><strong>'+val+'</strong></div>').join('')+
    '<div id="selection-note"'+(r.warnings.length?' class="warning"':'')+'>'+labels[r.status]+(r.warnings.length?' · '+r.warnings.join(' '):' · Passing these checks does not confirm planing or stability.')+'</div>';
  }
  function chart(id,key,title,unit){
    const el=document.getElementById(id),width=Math.max(270,el.getBoundingClientRect().width),height=280;
    const left=61,right=15,top=36,bottom=49,w=width-left-right,h=height-top-bottom;
    const values=results.map(r=>r[key]).filter(Number.isFinite),ymax=Math.max(0.001,...values)*1.12;
    const x=v=>left+v/maxSpeed*w,y=v=>top+h-v/ymax*h;
    let svg='<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+title+' versus speed; low-speed predictions unavailable"><text x="'+left+'" y="19">'+title+' ('+unit+')</text>';
    svg+='<rect x="'+left+'" y="'+top+'" width="'+w+'" height="'+h+'" fill="none" stroke="#8b9aab"/>';
    for(let i=0;i<=4;i++){
      const v=maxSpeed*i/4,val=ymax*i/4;
      svg+='<text text-anchor="middle" x="'+x(v)+'" y="'+(top+h+22)+'">'+fmt(v,1)+'</text>';
      svg+='<text text-anchor="end" x="'+(left-8)+'" y="'+(y(val)+4)+'">'+fmt(val,ymax<1?2:1)+'</text>';
    }
    svg+='<text text-anchor="middle" x="'+(left+w/2)+'" y="'+(height-5)+'">Speed (m/s)</text>';
    for(let i=1;i<results.length;i++){
      const a=results[i-1],b=results[i];
      if(a.status==='static'||!Number.isFinite(a[key])||!Number.isFinite(b[key]))continue;
      const outside=a.status!=='within_screen'||b.status!=='within_screen';
      svg+='<path d="M '+x(a.speed_m_s)+' '+y(a[key])+' L '+x(b.speed_m_s)+' '+y(b[key])+'" fill="none" stroke="'+(outside?'#ad5a08':'#1859a9')+'" stroke-width="2.5"'+(outside?' stroke-dasharray="5 4"':'')+'/>';
    }
    for(const r of results)if(Number.isFinite(r[key]))svg+='<circle cx="'+x(r.speed_m_s)+'" cy="'+y(r[key])+'" r="2.5" fill="'+(r.status==='within_screen'?'#1859a9':'#ad5a08')+'"/>';
    svg+='</svg>';el.innerHTML=svg;
  }
  function draw(){chart('power-plot','effective_power_kw','Effective power','kW');chart('trim-plot','trim_deg','Running trim','degrees');}
  function calculate(event){
    if(event)event.preventDefault();
    const error=document.getElementById('error');error.textContent='';
    try{
      const fields=Object.fromEntries(new FormData(form));const next={...Savitsky.defaults};
      for(const key of Object.keys(next))if(key in fields)next[key]=Number(fields[key]);
      const max=Number(fields.max_speed);if(max>50)throw new Error('Maximum speed is 50 m/s in this sample.');
      const points=Savitsky.sweep(next,max,31);
      params=next;maxSpeed=max;results=points;slider.max=String(max);slider.value=String(Math.min(+slider.value,max));
      draw();inspect();
      document.getElementById('sweep-rows').innerHTML=results.map(r=>'<tr><td>'+fmt(r.speed_m_s,1)+'</td><td class="numeric">'+fmt(r.trim_deg)+'</td><td class="numeric">'+fmt(r.resistance_n,1)+'</td><td class="numeric">'+fmt(r.effective_power_kw,3)+'</td><td>'+labels[r.status]+'</td></tr>').join('');
    }catch(e){error.textContent='Calculation not updated: '+e.message;}
  }
  form.addEventListener('submit',calculate);
  slider.addEventListener('input',()=>{try{inspect();}catch(e){document.getElementById('error').textContent=e.message;}});
  document.getElementById('export').addEventListener('click',()=>{
    if(!results)return;
    const keys=['speed_m_s','status','trim_deg','resistance_n','thrust_n','effective_power_kw','keel_wetted_m','chine_wetted_m','wetted_area_m2','transom_draft_m','cv','lambda','warnings'];
    const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
    // Include every model input in each row so exported curves remain traceable.
    const inputs=Object.keys(params),csv=[inputs.concat(keys).join(','),...results.map(r=>inputs.map(k=>quote(params[k])).concat(keys.map(k=>quote(k==='warnings'?r.warnings.join('; '):r[k]))).join(','))].join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='savitsky-speed-sweep.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  new ResizeObserver(()=>{if(results)draw();}).observe(document.getElementById('power-plot'));
  calculate();
})();
