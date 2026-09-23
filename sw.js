/* UCN Navigation & Radar — offline shell.

   The tool is a single index.html served from a static host. Installing it to
   the home screen protects the *log* from being evicted, but it does nothing
   for the *page*: without a service worker an installed app launched with no
   signal shows a network error, which is precisely the moment it is needed.
   This caches the shell so the tool opens whether or not there is a network.

   Deliberately simple, because a service worker is sticky — a bad one outlives
   the deploy that shipped it. It touches only GET requests, only for this
   origin and the two Google Fonts hosts, and never the JSON export or the
   PDF's blob URLs.

   To withdraw it, deploy an sw.js whose body is:
       self.addEventListener('install', function(){ self.registration.unregister(); });
   Every client picks that up on its next load and the caches go with it. */

var VERSION = 'ucn-nav-v1';
var SHELL = './';
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(VERSION)
      // cache:'reload' so installing never picks the shell out of the HTTP
      // cache, which is how a service worker ends up pinning a stale page.
      .then(function(c){ return c.add(new Request(SHELL, { cache: 'reload' })); })
      .then(function(){ return self.skipWaiting(); })
      .catch(function(){ /* a failed precache must not block activation */ })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return k === VERSION ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url;
  try{ url = new URL(req.url); }catch(err){ return; }

  var sameOrigin = url.origin === self.location.origin;
  if(!sameOrigin && FONT_HOSTS.indexOf(url.hostname) === -1) return;

  // Every navigation resolves to the one shell entry, so /index.html and /
  // share a cache entry rather than storing the page twice.
  if(req.mode === 'navigate'){ e.respondWith(serveShell()); return; }

  e.respondWith(serve(req, req));
});

function serveShell(){
  return serve(new Request(SHELL, { cache: 'no-cache' }), SHELL);
}

/* Cache first, then revalidate in the background: the tool opens instantly and
   offline, and a deploy is picked up on the load after it lands. */
function serve(request, key){
  return caches.open(VERSION).then(function(cache){
    return cache.match(key).then(function(hit){
      var network = fetch(request).then(function(res){
        if(!res || !res.ok || res.type === 'opaque') return res;
        var changed = !!hit && stamp(hit) !== stamp(res);
        return cache.put(key, res.clone()).then(function(){
          if(changed) announce();
          return res;
        });
      });
      if(hit){
        network.catch(function(){ /* offline; the cached copy already served */ });
        return hit;
      }
      return network;
    });
  });
}

/* Netlify sends an ETag; the others are fallbacks for hosts that do not. An
   empty stamp on both sides counts as unchanged, so a host with no validators
   nags on every load rather than never — the comparison stays conservative. */
function stamp(res){
  return res.headers.get('etag') ||
         res.headers.get('last-modified') ||
         res.headers.get('content-length') || '';
}

function announce(){
  self.clients.matchAll({ type: 'window' }).then(function(cs){
    cs.forEach(function(c){ c.postMessage({ type: 'ucn-shell-updated' }); });
  });
}
