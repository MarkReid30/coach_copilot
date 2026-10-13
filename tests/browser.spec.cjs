const {test,expect}=require('@playwright/test');
const user='11111111-1111-4111-8111-111111111111';
const fakeSupabase=String.raw`
(()=>{
 const user={id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.invalid'};
 const data={
  profiles:[{id:user.id,display_name:'Fixture client',role:'client'}],
  programmes:[{id:'programme-1',client_id:user.id,name:'Test programme',goal:'test',status:'active',start_date:'2026-10-13'}],
  programme_weeks:[{id:'week-1',programme_id:'programme-1',week_number:1,name:'Week 1',notes:''}],
  sessions:[{id:'session-1',week_id:'week-1',name:'Test session',position:1,notes:''}],
  session_exercises:[
   {id:'exercise-1',session_id:'session-1',exercise_name:'Bench',position:1,coach_notes:''},
   {id:'exercise-2',session_id:'session-1',exercise_name:'Row',position:2,coach_notes:''}],
  prescribed_sets:[
   {id:'set-1',session_exercise_id:'exercise-1',set_number:1,target_load_kg:70,target_reps:5,target_rir:2,notes:''},
   {id:'set-2',session_exercise_id:'exercise-2',set_number:1,target_load_kg:50,target_reps:8,target_rir:2,notes:''}],
  workouts:[],completed_sets:[],session_feedback:[]
 };
 const submissions=new Map();
 const api={
  auth:{
   getSession:async()=>({data:{session:{user}},error:null}),
   getUser:async()=>({data:{user},error:null}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
   signOut:async()=>({error:null})
  },
  rpc:async(name,args)=>{
   if(name==='my_client_onboarding_status')return {data:'active',error:null};
   if(name==='submit_workout_atomic'){
     if(!navigator.onLine)return {error:{message:'Offline'}};
     if(submissions.has(args.p_workout_id))return {data:{status:'already_synced'},error:null};
     submissions.set(args.p_workout_id,args);
     data.workouts.push({id:args.p_workout_id,client_id:user.id,session_id:args.p_session_id,status:'completed',completed_at:args.p_completed_at,started_at:args.p_started_at,client_notes:args.p_client_notes});
     data.completed_sets.push(...args.p_sets.map(x=>({...x,workout_id:args.p_workout_id,created_at:new Date().toISOString()})));
     data.session_feedback.push({...args.p_feedback,workout_id:args.p_workout_id});
     return {data:{status:'synced'},error:null};
   }
   return {data:null,error:null};
  },
  from(table){
   let filters=[],sort=null;
   const q={
    select:()=>q,
    eq:(k,v)=>{filters.push(x=>x[k]===v);return q},
    in:(k,v)=>{filters.push(x=>v.includes(x[k]));return q},
    order:(k,opt)=>{sort=[k,opt?.ascending!==false];return q},
    maybeSingle:async()=>{const r=await q;return {data:r.data[0]||null,error:null}},
    single:async()=>{const r=await q;return {data:r.data[0]||null,error:r.data.length?null:{message:'not found'}}},
    then(resolve,reject){
     let rows=(data[table]||[]).filter(x=>filters.every(f=>f(x))).map(x=>({...x}));
     if(sort)rows.sort((a,b)=>sort[1]?String(a[sort[0]]).localeCompare(String(b[sort[0]])):String(b[sort[0]]).localeCompare(String(a[sort[0]])));
     return Promise.resolve(navigator.onLine?{data:rows,error:null}:{data:null,error:{message:'Offline'}}).then(resolve,reject);
    }
   };return q;
  }
 };
 window.supabase={createClient:()=>api};
 window.__testBackend={submissions,data};
})();
`;
test.beforeEach(async({page})=>{
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',r=>r.fulfill({status:200,contentType:'application/javascript',body:fakeSupabase}));
});
test('mobile exercise navigation and offline queue, reconnect, replay',async({page,context})=>{
  page.on('pageerror',e=>console.log('PAGEERROR',e.message));
  page.on('console',e=>{if(e.type()==='error')console.log('BROWSER',e.text())});
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('#startWorkout')).toBeVisible();
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.evaluate(async(source)=>{const cache=await caches.open('coach-copilot-v3.4.4-rc4');await cache.put('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',new Response(source,{headers:{'content-type':'application/javascript'}}))},fakeSupabase);
  await page.locator('#startWorkout').click();
  await expect(page.locator('.exerciseNav button')).toHaveCount(2);
  await page.locator('#workoutArea .setrow input.kg').fill('72.5');
  await page.locator('#workoutArea .setrow input.reps').fill('6');
  await page.locator('.exerciseNav button').nth(1).click();
  await expect(page.locator('#workoutArea .exercise h3')).toContainText('Row');
  await page.locator('.exerciseNav button').nth(0).click();
  await expect(page.locator('#workoutArea .setrow input.kg')).toHaveValue('72.5');
  await expect(page.locator('#workoutArea .setrow input.reps')).toHaveValue('6');
  await context.setOffline(true);
  await page.reload();
  console.log('OFFLINE DIAGNOSTICS',JSON.stringify(await page.evaluate(async()=>({title:document.title,auth:document.querySelector('#auth')?.className,main:document.querySelector('#main')?.className,msg:document.querySelector('#msg')?.textContent,workout:document.querySelector('#workoutArea')?.innerText,supabase:typeof window.supabase,caches:await caches.keys()}))));
  await expect(page.locator('#workoutArea .exercise h3')).toContainText('Bench');
  await expect(page.locator('#workoutArea .setrow input.kg')).toHaveValue('72.5');
  await page.locator('#finishWorkout').click();
  await expect(page.locator('#historySyncStatus')).toContainText('pending sync');
  await expect(page.locator('#retrySync')).toBeVisible();
  await context.setOffline(false);
  await expect(page.locator('#historySyncStatus')).toContainText('Synced with coach');
  const submitted=await page.evaluate(()=>window.__testBackend.submissions.size);
  expect(submitted).toBe(1);
  const rows=await page.evaluate(()=>window.__testBackend.data.completed_sets);
  expect(rows).toHaveLength(2);
  expect(rows[0].load_kg).toBe(72.5);
  await expect(page.locator('#retrySync')).toBeHidden();
});
