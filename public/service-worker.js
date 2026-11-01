const VERSION = 'love-space-shell-v3';
const APP_SHELL = ['/', '/manifest.webmanifest', '/assets/css/couple.css', '/assets/css/experience.css', '/assets/css/experience-pages.css', '/assets/css/experience-motion.css', '/assets/js/experience.js', '/assets/js/couple.js', '/assets/icons/heart.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(APP_SHELL)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // Never cache accounts, API data, messages, location, or private media.
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/socket.io/')||url.pathname.startsWith('/uploads/'))return;
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(request,copy));}return response;}).catch(async()=>(await caches.match(request))||(request.mode==='navigate'?caches.match('/'):Response.error())));
});
