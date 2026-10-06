/**
 * Shared User Journey tracking snippet builder - SINGLE SOURCE OF TRUTH.
 *
 * Returns a self-contained inline `<script>` string that POSTs page/session
 * events to the central backend Worker's /api/track endpoint. Reused by:
 *   - injector-worker/src/index.js   (edge auto-inject on Cloudflare zones)
 *   - examples/workers-wrapper.js    (wrap the 2 Worker projects' responses)
 *   - examples/pages-middleware.js   (Cloudflare Pages Functions middleware)
 * The manual-embed file ../../tracking/analytics.js implements the same model.
 *
 * `endpoint` = full /api/track URL, `project` = a stable label (usually hostname;
 * the backend resolves hostname -> project/account across both accounts).
 * `nonce` (optional) = a per-response CSP nonce for strict-CSP zones.
 *
 * EVENT MODEL: page_view, page_duration, navigation, session_activity. No
 * session_start/session_end source of truth - a session rolls over after 30 min
 * idle; while the tab is VISIBLE a session_activity heartbeat keeps it alive and
 * supplies last-activity for exit/session-duration.
 *
 * TIME-ON-PAGE counts ACTIVE/visible time only (visibilitychange + focus/blur
 * pause/resume the clock), so hidden/background time is never counted.
 *
 * Anonymous only: random visitorId (localStorage) + sessionId (sessionStorage).
 * No cookies, no PII. Respects Do Not Track.
 */
export function SNIPPET(endpoint, project, nonce) {
  const open = nonce ? "<script nonce=" + JSON.stringify(String(nonce)) + ">" : "<script>";
  const js = [
    "(function(){'use strict';",
    "if(navigator.doNotTrack==='1'||window.doNotTrack==='1')return;",
    "var ENDPOINT=" + JSON.stringify(endpoint) + ";var PROJECT=" + JSON.stringify(project) + ";",
    "var IDLE=1800000,HB=30000,KV='cfj_vid',KS='cfj_sid',KT='cfj_last';",
    "function rid(){return (crypto&&crypto.randomUUID&&crypto.randomUUID())||Date.now().toString(36)+Math.random().toString(36).slice(2,10);}",
    "function lg(k){try{return localStorage.getItem(k);}catch(e){return null;}}",
    "function lsv(k,v){try{localStorage.setItem(k,v);}catch(e){}}",
    "function sg(k){try{return sessionStorage.getItem(k);}catch(e){return null;}}",
    "function ssv(k,v){try{sessionStorage.setItem(k,v);}catch(e){}}",
    "var vid=lg(KV)||rid();lsv(KV,vid);",
    "var now=Date.now(),last=Number(sg(KT)||0),sid=sg(KS);",
    "var newSess=!sid||now-last>IDLE;if(newSess)sid=rid();ssv(KS,sid);ssv(KT,String(now));",
    "function send(ev,extra){extra=extra||{};var pl={e:ev,p:PROJECT,d:location.hostname,path:extra.path!=null?extra.path:location.pathname,ref:extra.ref!=null?extra.ref:'',v:vid,s:sid,dur:extra.dur||0,ts:Date.now()};var b=JSON.stringify(pl);try{if(navigator.sendBeacon){navigator.sendBeacon(ENDPOINT,new Blob([b],{type:'application/json'}));}else{fetch(ENDPOINT,{method:'POST',body:b,mode:'no-cors',keepalive:true});}}catch(e){}}",
    "function touch(){ssv(KT,String(Date.now()));}",
    // active-time tracking for the current page
    "var path=location.pathname,acc=0,seg=(document.visibilityState==='visible')?Date.now():null,open=true;",
    "function activeSec(){return Math.round((acc+(seg!=null?Date.now()-seg:0))/1000);}",
    "function pause(){if(seg!=null){acc+=Date.now()-seg;seg=null;}}",
    "function resume(){if(seg==null&&document.visibilityState==='visible')seg=Date.now();}",
    "function startPage(p){path=p;acc=0;seg=(document.visibilityState==='visible')?Date.now():null;open=true;}",
    "function endPage(){if(!open)return;var s=activeSec();open=false;if(s>0)send('page_duration',{path:path,ref:path,dur:s});}",
    "function pageView(ref){send('page_view',{path:location.pathname,ref:ref!=null?ref:document.referrer||''});}",
    // route change: finalize old -> page_duration -> navigation(from,to) -> new page_view -> start timing
    "function go(){if(location.pathname===path)return;endPage();var from=path;send('navigation',{path:location.pathname,ref:from});startPage(location.pathname);pageView(from);touch();}",
    "['pushState','replaceState'].forEach(function(fn){var o=history[fn];history[fn]=function(){var r=o.apply(history,arguments);setTimeout(go,0);return r;};});",
    "window.addEventListener('popstate',function(){setTimeout(go,0);});",
    "document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')pause();else resume();});",
    "window.addEventListener('blur',pause);",
    "window.addEventListener('focus',resume);",
    "function bye(){endPage();}",
    "window.addEventListener('pagehide',bye);",
    "window.addEventListener('beforeunload',bye);",
    // liveness heartbeat while visible: keeps the session open and marks last activity
    "setInterval(function(){if(document.visibilityState==='visible'){touch();send('session_activity',{path:location.pathname});}},HB);",
    // initial
    "if(newSess)send('session_activity',{path:location.pathname,ref:document.referrer||''});",
    "pageView(document.referrer||'');",
    "})();",
  ];
  return open + js.join("") + "</script>";
}
