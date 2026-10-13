// Guard against accidental staging-to-production crossover.
// Run on the isolated staging branch or on main once staging is published.
const fs=require('node:fs'),assert=require('node:assert/strict');
const live=fs.readFileSync('index.html','utf8');
const stage=fs.readFileSync('staging/index.html','utf8');
const worker=fs.readFileSync('staging/service-worker.js','utf8');
const manifest=JSON.parse(fs.readFileSync('staging/manifest.webmanifest','utf8'));
assert.match(live,/<title>Coach Copilot V3\.4\.3<\/title>/);
assert.match(live,/ysalexpeiynndagqufpl\.supabase\.co/);
assert.doesNotMatch(stage,/ysalexpeiynndagqufpl/);
assert.match(stage,/afurfucflcwiiedueair\.supabase\.co/);
assert.match(stage,/STAGING · TEST ACCOUNTS ONLY/);
assert.match(stage,/coach-copilot-workouts-v344-staging/);
assert.match(worker,/coach-copilot-staging-v3\.4\.4/);
assert.match(worker,/k\.startsWith\('coach-copilot-staging-'\)/);
assert.equal(manifest.short_name,'CC Staging');
assert.equal(manifest.icons[0].src,'icons/icon.svg');
console.log('PASS: staging backend, storage, service worker, manifest and production isolation');
