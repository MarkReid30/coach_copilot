'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const js=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const code=js.slice(js.indexOf('function syncMessage('),js.indexOf('function renderWorkout(){'))+
  '\n'+js.slice(js.indexOf('function workoutSubmission('),js.indexOf('function prescribedNameForSet('));
assert.ok(code.includes('async function flushPendingWorkouts()'));
assert.ok(code.includes("$('finishWorkout').onclick"));
const stores={drafts:new Map(),pending:new Map(),snapshots:new Map()};
const status={workoutSaveStatus:{textContent:''},historySyncStatus:{textContent:''},retrySync:{classList:{toggle(){}}},finishWorkout:{disabled:false}};
const profile={id:'client-1',role:'client',display_name:'Fixture client'};
const workout={id:'workout-1',client_id:'client-1',session_id:'session-1',started_at:'2026-10-13T09:00:00Z',exercises:[{name:'Bench',sets:[{prescribedId:'set-1',kg:'70',reps:'5',rir:'2',done:true,substituted:false}]}]};
let activeWorkout=structuredClone(workout),offline=false,networkFailure=false,dbWrites=0,serverSaves=0,historyReloads=0;
const server=new Map(),messages=[];
const sb={rpc:async(name,payload)=>{
  assert.equal(name,'submit_workout_atomic');
  if(networkFailure)throw Error('network lost');
  if(offline)return {error:{message:'offline'}};
  if(server.has(payload.p_workout_id))return {data:{status:'already_synced',workout_id:payload.p_workout_id},error:null};
  server.set(payload.p_workout_id,structuredClone(payload));serverSaves++;
  return {data:{status:'synced',workout_id:payload.p_workout_id},error:null};
}};
const context={
  $:id=>status[id]||{value:'',classList:{add(){},remove(){}}},
  deviceWrite:Promise.resolve(),syncBusy:false,finishingWorkout:false,
  profile,selectedClient:{id:'client-1',name:'Fixture'},tree:[],activeWorkout,openExercise:0,
  draftStore:'drafts',pendingStore:'pending',snapshotStore:'snapshots',
  devicePut:async(store,entry)=>{dbWrites++;stores[store].set(store==='pending'?entry.workout_id:entry.client_id,structuredClone(entry))},
  deviceDelete:async(store,key)=>{stores[store].delete(key)},
  deviceGet:async(store,key)=>structuredClone(stores[store].get(key)||null),
  deviceAll:async(store)=>[...stores[store].values()].map(x=>structuredClone(x)),
  sb,navigator:{get onLine(){return !offline}},document:{addEventListener(){}},
  window:{addEventListener(){}},console,
  crypto:{randomUUID:(()=>{let i=0;return()=>String(++i).padStart(36,'0')})()},
  num:v=>v===''||v==null?null:Number(v),
  loadHistory:async()=>{historyReloads++},renderAll:()=>{},renderWorkout:()=>{},
  findPRs:()=>[],show:()=>{},err:e=>messages.push(String(e)),
  Date,JSON
};
const fn=vm.runInNewContext(code+';\n({saveWorkoutDraft,restoreWorkoutDraft,flushPendingWorkouts,workoutSubmission})',context);
const getActive=()=>vm.runInNewContext('activeWorkout',context);
async function main(){
  await fn.saveWorkoutDraft();
  assert.equal(stores.drafts.get('client-1').workout.id,'workout-1');
  console.log('PASS: workout saved to device');

  offline=true;
  await status.finishWorkout.onclick();
  assert.equal(serverSaves,0);
  assert.equal(stores.pending.size,1);
  assert.equal(stores.drafts.size,0);
  assert.equal(getActive(),null);
  console.log('PASS: offline finish queues immutable payload, no server write');

  await fn.flushPendingWorkouts();
  assert.equal(stores.pending.size,1);
  offline=false;networkFailure=true;
  await fn.flushPendingWorkouts();
  assert.equal(stores.pending.size,1);
  console.log('PASS: network failure preserves pending payload');

  networkFailure=false;
  await fn.flushPendingWorkouts();
  assert.equal(serverSaves,1);
  assert.equal(stores.pending.size,0);
  const uploaded=server.get('workout-1');
  assert.equal(uploaded.p_sets.length,1);
  assert.equal(uploaded.p_sets[0].exercise_name,'Bench');
  console.log('PASS: reconnect uploads exactly one complete workout');

  await fn.flushPendingWorkouts();
  assert.equal(serverSaves,1);
  console.log('PASS: repeated retry does not duplicate upload');

  await context.devicePut('pending',{workout_id:'workout-1',client_id:'client-1',payload:uploaded});
  await fn.flushPendingWorkouts();
  assert.equal(serverSaves,1);
  assert.equal(stores.pending.size,0);
  console.log('PASS: lost acknowledgement/replay recognised as already_synced');

  context.activeWorkout=structuredClone(workout);
  await fn.saveWorkoutDraft();
  context.activeWorkout=null;
  await fn.restoreWorkoutDraft();
  assert.equal(getActive().id,'workout-1');
  console.log('PASS: in-progress draft restores after simulated reload');

  await context.devicePut('pending',{workout_id:'workout-2',client_id:'other-client',payload:{p_workout_id:'workout-2'}});
  await fn.flushPendingWorkouts();
  assert.equal(stores.pending.size,1);
  assert.equal(serverSaves,1);
  console.log('PASS: pending queue segregated by authenticated client');
}
main().catch(e=>{console.error(e);process.exitCode=1});
