#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),model=require('./model.js');
function main(){
  const options={};
  for(let i=2;i<process.argv.length;i+=2){
    const name=process.argv[i];
    if(name==='--help'){
      console.log('node optimization/savitsky/run.js [--config inputs.json] [--max-speed 15] [--output results.json]');return;
    }
    if(!['--config','--max-speed','--output'].includes(name)||!process.argv[i+1])throw new Error('Unknown or incomplete option: '+name);
    options[name.slice(2)]=process.argv[i+1];
  }
  const input=options.config?JSON.parse(fs.readFileSync(options.config,'utf8')):{};
  const inputs={...model.defaults,...input},max=Number(options['max-speed']??15),results=model.sweep(inputs,max,31);
  const report={
    model:'Savitsky calm-water sample; 1964 wetted-length default',
    version:fs.readFileSync(path.join(__dirname,'../VERSION'),'utf8').trim(),
    generated_at:new Date().toISOString(),
    source:'https://github.com/elcf/python-openplaning',inputs,
    scope:'Generic prismatic monohull. No displacement resistance, waves, appendages, air drag, propulsion efficiency, stability analysis or CAD import. Effective power is resistance times speed.',
    results
  };
  const json=JSON.stringify(report,null,2)+'\n';
  if(options.output){fs.mkdirSync(path.dirname(options.output),{recursive:true});fs.writeFileSync(options.output,json);console.log(options.output);}
  else process.stdout.write(json);
}
try{main();}catch(e){console.error(e.message);process.exitCode=1;}
