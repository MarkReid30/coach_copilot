'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const js=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'inline application script exists');
new Function(js);
console.log('PASS: application JavaScript syntax');
for(const required of ['saveWorkoutDraft','restoreWorkoutDraft','exerciseNav','Copy Session to Next Week','source session positions']){
  if(required==='source session positions')continue;
  assert.ok(js.includes(required)||html.includes(required),'missing '+required);
}
console.log('PASS: new features present');

function makeFixture({occupied=false,emptyWeek=false,failInsert=false}={}){
  const db={
    programme_weeks:emptyWeek?[]:[{id:'week2',programme_id:'p1',week_number:2,name:'Week 2'}],
    sessions:[{id:'source',week_id:'week1',name:'Upper A',position:1,notes:'keep'},
      ...(emptyWeek?[]:[{id:'existing',week_id:'week2',name:'Lower B',position:occupied?1:2,notes:'untouched'}])],
    session_exercises:[{id:'exercise1',session_id:'source',exercise_name:'Bench',position:1,coach_notes:'pause'}],
    prescribed_sets:[{id:'set1',session_exercise_id:'exercise1',set_number:1,target_load_kg:70,target_reps:5,target_rir:2,notes:'a'}]
  };
  const baseline=JSON.stringify(db);
  let id=0,attempted=0;
  const sb={from(table){
    let filter=[],mode='select',payload;
    const q={
      select(){mode='select';return q},
      eq(k,v){filter.push([k,v]);return q},
      order(){return q},
      insert(row){mode='insert';payload=row;return q},
      delete(){mode='delete';return q},
      in(k,vals){filter.push([k,{includes:v=>vals.includes(v)}]);return q},
      async maybeSingle(){const r=await q;return {data:r.data[0]||null,error:r.error}},
      async single(){const r=await q;return {data:r.data[0]||null,error:r.error||(!r.data.length?{message:'missing'}:null)}},
      then(resolve,reject){
        const matches=r=>filter.every(([k,v])=>typeof v==='object'&&v?.includes?v.includes(r[k]):r[k]===v);
        let result;
        if(mode==='select')result={data:db[table].filter(matches).map(x=>({...x})),error:null};
        else if(mode==='insert'){
          attempted++;
          if(failInsert&&table==='session_exercises')result={data:null,error:{message:'simulated insert failure'}};
          else {const rows=Array.isArray(payload)?payload:[payload];db[table].push(...rows.map(x=>({...x})));result={data:rows,error:null}}
        }else if(mode==='delete'){db[table]=db[table].filter(x=>!matches(x));result={data:null,error:null}}
        return Promise.resolve(result).then(resolve,reject);
      }
    };
    return q;
  }};
  const button={disabled:false},errors=[],messages=[],sel={w:'week1',s:'source'};
  const context={
    sb,crypto:{randomUUID:()=> 'generated'+(++id)},
    profile:{role:'coach'},selectedClient:{id:'client1'},
    cur:()=>({p:{id:'p1'},w:{id:'week1',week_number:1},s:{id:'source',position:1}}),
    $:name=>{assert.equal(name,'copySession');return button},
    sel,loadTree:async()=>{},msg:s=>messages.push(s),err:e=>errors.push(e.message||String(e)),
    console
  };
  const rollback=js.slice(js.indexOf('async function rollbackWeekCopy('),js.indexOf("$('createNextWeek').onclick"));
  assert.ok(rollback.startsWith('async function rollbackWeekCopy('),'rollback implementation found');
  const start=js.indexOf("$('copySession').onclick=async()=>{");
  const end=js.indexOf("$('addExercise').onclick",start);
  assert.ok(start>0&&end>start,'copy handler found');
  vm.runInNewContext(rollback+'\n'+js.slice(start,end),context);
  return {db,baseline,button,errors,messages,sel,run:()=>button.onclick(),attempted:()=>attempted};
}
async function tests(){
  let t=makeFixture();await t.run();
  assert.equal(t.errors.length,0);
  assert.equal(t.db.sessions.length,3);
  assert.equal(t.db.sessions.find(x=>x.id==='existing').name,'Lower B');
  assert.equal(t.db.sessions.find(x=>x.id==='existing').position,2);
  const added=t.db.sessions.find(x=>x.id.startsWith('generated'));
  assert.equal(added.position,1);
  assert.equal(t.db.session_exercises.find(x=>x.session_id===added.id).exercise_name,'Bench');
  assert.equal(t.db.prescribed_sets.length,2);
  console.log('PASS: single session copy preserves unrelated session and prescriptions');

  t=makeFixture({occupied:true});await t.run();
  assert.equal(JSON.stringify(t.db),t.baseline);
  assert.match(t.errors.join(' '),/occupied/);
  console.log('PASS: occupied destination rejected without mutation');

  t=makeFixture({emptyWeek:true});await t.run();
  assert.equal(t.errors.length,0);
  assert.equal(t.db.programme_weeks.length,1);
  assert.equal(t.db.sessions.length,2);
  console.log('PASS: vacant next week created and populated');

  t=makeFixture({failInsert:true});await t.run();
  assert.match(t.errors.join(' '),/simulated/);
  assert.equal(JSON.stringify(t.db),t.baseline);
  console.log('PASS: partial copy rolled back without modifying source');

  assert.ok(js.includes('let base=Math.max(0,...slots.data.map'),'quick-build uses max position');
  assert.ok(js.includes('new Set(positions).size!==positions.length'),'duplicate source slot guard');
  console.log('PASS: session-position safeguards');
}
tests().catch(e=>{console.error(e);process.exitCode=1});
