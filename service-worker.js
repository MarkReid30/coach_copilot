const CACHE='coach-copilot-v3.4.4-rc4';
const LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const ASSETS=['./','./index.html','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(ASSETS);
  // A failed third-party CDN request must never prevent offline shell installation.
  try{const response=await fetch(LIB);if(response.ok)await cache.put(LIB,response)}catch(error){console.warn('Supabase offline cache pending',error)}
  await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(response=>{
      if(response.ok)caches.open(CACHE).then(cache=>cache.put('./index.html',response.clone()));
      return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  if(e.request.url===LIB){
    e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(response=>{
      if(response.ok)caches.open(CACHE).then(cache=>cache.put(e.request,response.clone()));
      return response;
    })));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));
});
