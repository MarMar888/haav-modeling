// Execute an unmodified calculation-core script from the downloaded original app.
// This is a numerical run, not a browser/UI verification.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url));
const [appPath,threePath]=process.argv.slice(2);
if(!appPath||!threePath)throw new Error('Usage: node run_original_dbb.mjs ORIGINAL_INDEX_HTML ORIGINAL_THREE_JS');
const source=await fs.readFile(appPath,'utf8');
const scripts=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const core=scripts.find(s=>s.includes('/* DBB core:'));
if(!core)throw new Error('Original DBB core script not found');
const sandbox={console};sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(await fs.readFile(threePath,'utf8'),sandbox,{filename:'original-dbb-three.js'});
vm.runInContext(core,sandbox,{filename:'original-dbb-core.js'});
const C=sandbox.DBBCore;
const raw=JSON.parse(await fs.readFile(path.join(folder,'dbb-project-10x.json'),'utf8'));
const {model,warnings}=C.sanitizeProject(raw);
if(warnings.length)throw new Error('Project load warnings: '+JSON.stringify(warnings));
if(model.hulls[0].depth!==raw.hulls[0].depth)throw new Error('Hull changed during project import');
const weights=C.weightSummary(model);
const floating=C.floatState(model);
const stability=C.stabilityState(model,floating);
const scale=10,inch=0.0254,poundInTonnes=.00045359237;
const normalized={weight_lbs:weights.total.mass/(scale**3*poundInTonnes),
    stern_waterline_z_in:floating.draftAft/(scale*inch),bow_station_waterline_z_in:floating.draftFwd/(scale*inch),
    trim_deg:floating.angle,heel_deg:floating.heel,
    cg_source_in:[weights.total.tcg,weights.total.lcg,weights.total.vcg].map(v=>v/(scale*inch)),
    cb_source_in:[floating.tcb,floating.lcb,floating.kb].map(v=>v==null?null:v/(scale*inch)),
    gm_in:stability.GM/(scale*inch)};
const own=JSON.parse(await fs.readFile(path.join(folder,'static-results.json'),'utf8'));
const comparison={stern_waterline_difference_in:normalized.stern_waterline_z_in-own.stern_centerline_waterline_z_in,
    trim_difference_deg:normalized.trim_deg-own.pitch_deg,heel_difference_deg:normalized.heel_deg-own.roll_deg};
const roundTrip=C.sanitizeProject(JSON.parse(C.serializeProject(model)));
const roundTripFloat=C.floatState(roundTrip.model);
// Independent analytical case: a rectangular box hull, centered load, calm water.
const box=JSON.parse(JSON.stringify(raw)),bh=box.hulls[0];
bh.name='Analytical rectangular barge';
bh.offsets={xs:[0,bh.loa],zs:[0,bh.depth],halfBreadth:[[bh.beam/2,bh.beam/2],[bh.beam/2,bh.beam/2]]};
box.blocks=[{...box.blocks[0],id:'analytic_weight',position:[bh.loa/2,0,bh.depth/4],massOverride:weights.total.mass}];
const bm=C.sanitizeProject(box).model,bf=C.floatState(bm),bs=C.stabilityState(bm,bf);
const expectedDraft=weights.total.mass/(box.waterDensity*bh.loa*bh.beam);
const expectedGM=expectedDraft/2+bh.beam**2/(12*expectedDraft)-bh.depth/4;
const analyticalCheck={case:'Rectangular box hull, centered load',expected_draft_m:expectedDraft,dbb_draft_m:bf.T,
    draft_error_percent:100*(bf.T-expectedDraft)/expectedDraft,expected_GM_m:expectedGM,dbb_GM_m:bs.GM,
    GM_error_percent:100*(bs.GM-expectedGM)/expectedGM,trim_deg:bf.angle,heel_deg:bf.heel};
if(Math.abs(analyticalCheck.draft_error_percent)>.01||Math.abs(analyticalCheck.GM_error_percent)>.1||Math.abs(bf.angle)>.001||Math.abs(bf.heel)>.001)throw new Error('Analytical check failed: '+JSON.stringify(analyticalCheck));
const output={source_url:'https://shiplab.github.io/dbb/index.html',source_sha256:crypto.createHash('sha256').update(source).digest('hex'),core_sha256:crypto.createHash('sha256').update(core).digest('hex'),
    app_reported_version:C.APP_VERSION,three_revision:sandbox.THREE.REVISION,
    geometry_scale:scale,mass_scale:scale**3,load_warnings:warnings,normalized_full_size:normalized,comparison_to_cad_solid:comparison,
    dbb_weights:weights,dbb_float:floating,dbb_stability:stability,analytical_rectangular_hull_check:analyticalCheck,
    save_reload_normalized:{weight_lbs:C.weightSummary(roundTrip.model).total.mass/(scale**3*poundInTonnes),stern_waterline_z_in:roundTripFloat.draftAft/(scale*inch),trim_deg:roundTripFloat.angle,heel_deg:roundTripFloat.heel,warnings:roundTrip.warnings}};
await fs.writeFile(path.join(folder,'dbb-results.json'),JSON.stringify(output,null,2)+'\n');
await fs.mkdir(path.join(folder,'dbb-source'),{recursive:true});
await fs.writeFile(path.join(folder,'dbb-source','core.js'),core);
console.log(JSON.stringify({normalized,comparison,analyticalCheck},null,2));
