import HTML from "./index.html";

async function handleErrors(request, func) {
  try {
    return await func();
  } catch (err) {
    if (request.headers.get("Upgrade") == "websocket") {
      let pair = new WebSocketPair();
      pair[1].accept();
      pair[1].send(JSON.stringify({error: err.stack}));
      pair[1].close(1011, "Uncaught exception during session setup");
      return new Response(null, { status: 101, webSocket: pair[0] });
    } else {
      return new Response(err.stack, {status: 500});
    }
  }
}

export default {
  async fetch(request, env) {
    return await handleErrors(request, async () => {
      let url = new URL(request.url);
      let path = url.pathname.slice(1).split('/');

      if (!path[0]) {
        return new Response(HTML, {headers: {"Content-Type": "text/html;charset=UTF-8"}});
      }

      switch (path[0]) {
        case "api":
          return handleApiRequest(path.slice(1), request, env);
        default:
          return new Response("Not found", {status: 404});
      }
    });
  }
}

async function handleApiRequest(path, request, env) {
  // ===== TURN CREDENTIALS ENDPOINT (NEW) =====
  if (path[0] === "turn" && path[1] === "credentials" && request.method === "POST") {
    return await handleTURNRequest(request, env);
  }
  
  // ===== SFU PROXY ENDPOINTS (NEW) =====
  if (path[0] === "sfu") {
    return await handleSFURequest(path.slice(1), request, env);
  }

  // ===== D1 ENDPOINTS =====
  if (path[0] === "rooms" && request.method === "GET") {
    try {
      const { results } = await env.READTALK_DB.prepare(
        "SELECT * FROM rooms ORDER BY created_at DESC"
      ).all();
      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  if (path[0] === "rooms" && request.method === "POST") {
    try {
      const { name, description } = await request.json();
      const deviceId = request.headers.get("CF-Connecting-IP") || "anonymous";
      
      const { results } = await env.READTALK_DB.prepare(
        "INSERT INTO rooms (name, description, created_by) VALUES (?, ?, ?) RETURNING id"
      ).bind(name, description, deviceId).run();
      
      return new Response(JSON.stringify(results[0]), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // ===== KV ENDPOINTS =====
  if (path[0] === "cache" && request.method === "GET") {
    try {
      const cached = await env.READTALK_KV.get("public_rooms");
      if (cached) {
        return new Response(cached, {
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ cached: false }), { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  if (path[0] === "cache" && request.method === "POST") {
    try {
      const { key, value, ttl } = await request.json();
      await env.READTALK_KV.put(key, JSON.stringify(value), { expirationTtl: ttl || 60 });
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // ===== R2 ENDPOINTS =====
  if (path[0] === "upload" && request.method === "POST") {
    try {
      const formData = await request.formData();
      const file = formData.get("file");
      const key = formData.get("key") || `upload_${Date.now()}`;
      
      await env.READTALK_R2.put(key, file);
      
      return new Response(JSON.stringify({ key: key, success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  if (path[0] === "download" && request.method === "GET") {
    try {
      const url = new URL(request.url);
      const key = url.searchParams.get("key");
      
      const object = await env.READTALK_R2.get(key);
      if (!object) {
        return new Response("Not found", { status: 404 });
      }
      
      return new Response(object.body, {
        headers: {
          "Content-Type": object.httpMetadata?.contentType || "application/octet-stream"
        }
      });
    } catch (err) {
      returnet-stream"
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
 : 500 });
 }

  // ===== ORIG    }
  }

  // ===== ORIGINAL ROOM ENDPOINTSINAL ROOM ENDPOINTS =====
  switch (path[0]) {
    case " =====
  switch (path[0]) {
    case "room": {
      if (!room": {
      if (!path[1]) {
       path[1]) {
        if (request.method == " if (request.method == "POST")POST") {
          let id = env.rooms.new {
          let id = env.roomsUniqueId();
          
          // Sim.newUniqueId();
          
          // Simpan ke D1pan ke D1 untuk tracking
          untuk tracking
          try {
 try {
            await env.READTALK_DB.p            await env.READTALK_DB.preparerepare(
              "INSERT(
              "INSERT INTO rooms INTO rooms (name, is (name, is_private) VALUES (?,_private) VALUES (?, ?)"
 ?)"
            ).bind(id.toString(),            ).bind(id.toString(), 1).run();
          } catch (e 1).run();
          } catch (e) {
            //) {
 Abaikan error, tetap return ID
                     // Abaikan error, tetap return ID
          }
          
          return new Response(id.toString }
          
          return new Response(id.toString(), {(), {headers: {"Access-Control-headers: {"Access-Control-Allow-Origin": "*"Allow-Origin": "*"}});
        } else {
}});
        } else {
          return          return new Response("Method not allowed", new Response("Method not allowed {status: 405", {status: 405});
        }
      }

     });
        }
      }

      let name = path[1 let name = path[1];
      let id;
     ];
      let id;
      if (name.match if (name.match(/^[0(/^[0-9a-f-9a-f]{64}$/)) {
]{64}$/)) {
        id        id = env.rooms = env.rooms.idFromString(name);
     .idFromString(name);
      } else if ( } else if (name.length <= 32) {
       name.length <= 32) {
        id = env.rooms.id id = env.rooms.idFromNameFromName(name);
        
        // Simpan public(name);
        
        // Simpan public room ke D1
        try {
 room ke D1
        try {
          await env.READTALK_D          await env.READTALK_DB.prepare(
           B.prepare(
            "INSERT OR IGNORE "INSERT OR IGNORE INTO rooms INTO rooms (name, is (name, is_private) VALUES (?, ?_private) VALUES (?, ?)"
          ).bind(name)"
          ).bind(name, 0)., 0).run();
run();
        } catch (e) {
          // Ab        } catch (e) {
          // Abaikan error
        }
        
      } else {
        returnaikan error
        }
        
      } else new Response("Name too long", {status {
        return new Response("Name too long", {status: 404});
      }

: 404});
      }

      let roomObject =      let env.rooms roomObject = env.rooms.get(id);
      let newUrl = new URL.get(id);
      let newUrl =(request.url);
      newUrl.pathname new URL(request.url);
      newUrl.pathname = "/" + path.slice(2).join = "/" + path.slice(2).join("/");
      return roomObject.fetch(new("/");
      return roomObject.fetch(newUrl, request);
    }

Url, request);
    }

    default:
         default:
      return new return new Response(" Response("Not found", {status: 404});
 Not found", {status: 404});
  }
}

// ===== NEW }
}

// ===== NEW: TURN CREDENTIALS HAND: TURN CREDENTIALLER =S HANDLER =====
====
async function handleTURNRequest(request,async function handleTURNRequest env) {
  // Only(request, env) {
  // Only allow POST allow POST
  if (request.method
  if (request.method !== 'POST') {
    !== 'POST') {
 return new Response('Method not    return new Response('Method not allowed', { status allowed', { status: 405 });
  }

  try {
    // Get: 405 });
  }

  try {
    // Get TTL TTL from request body (optional, default from request body (optional, default 86400 = 24 jam)
    const { 86400 = 24 jam)
    const ttl = 86400 } { ttl = 86400 } = = await request.json().catch(() => ({ ttl: await request.json().catch(() => ({ ttl: 86400 86400 }));
    
    // Validate TTL (max  }));
    
    // Validate TTL (7 days)
    const validTtl = Math.min(ttlmax 7 days)
    const validTtl = Math.min(, 604800ttl, 604800);
    
    // Check if App ID and Secret);
    
    // Check if App ID and Secret are configured are configured
   
    if (!env.ACCOUNT if (!env.ACCOUNT_APP_ID || !env.ACCOUNT__APP_ID || !env.ACCOUNT_APP_SECRET) {
      console.errorAPP_SECRET) {
      console.error('Missing ACCOUNT_APP_ID('Missing ACCOUNT_APP_ID or ACCOUNT or ACCOUNT_APP_SECRET');
      
_APP_SECRET');
      
      // Fallback to STUN only      // Fallback to STUN only if credentials not configured if credentials not configured
      return new
      return new Response(JSON.stringify({
        iceServ Response(JSON.stringify({
        iceServers: [
          {
           ers: [
          {
            urls: [
              "stun:stun.cloudflare.com:3478"
 urls: [
              "stun:stun.cloudflare.com:3478"
            ]
            ]
          }
        ]
      }          }
        ]
      }), {
        headers), {
        headers: { "Content-Type": "application: { "Content-Type": "application/json" }
     /json" }
      });
    }

    // Call });
    }

    // Call Cloudflare TURN API
 Cloudflare TURN API
    const turnResponse = await    const fetch(
      ` turnResponse = await fetch(
      `https://rtc.live.cloudflarehttps://rtc.live.com/v1/turn/.cloudflare.com/v1/tkeys/${env.ACCOUNTurn/keys/${env._APP_ID}/credentials/gACCOUNT_APP_ID}/enerate-ice-scredentials/generate-ice-servers`,
      {
        method:ervers`,
      {
        method: 'POST 'POST',
        headers: {
         ',
        headers: {
          'Authorization': `Bearer ${ 'Authorization': `Bearerenv.ACCOUNT_APP ${env.ACCOUNT_APP_SECRET}`,
          'Content-Type': 'application_SECRET}`,
          'Content-Type': 'application/json'
/json'
        },
        body:        },
        body: JSON.stringify({ ttl: validT JSON.stringify({ ttl: validTtl })
tl })
      }
    );

    if (!turn      }
    );

    if (!turnResponse.ok) {
     Response.ok) {
      const errorText = await turnResponse.text();
      console const errorText = await turnResponse.text();
      console.error('TURN.error('TURN API error:', turn API error:', turnResponse.statusResponse.status, errorText);
      
      // Fallback to, errorText);
      
      // Fallback to STUN only on error
      STUN only on error
      return new Response( return new Response(JSON.stringify({
        iceServers:JSON.stringify({
        iceServers: [
          {
            urls: [
              " [
          {
            urls: [
              "stun:stun.cloudflare.comstun:stun.cloudflare.com:347:3478"
            ]
          }
        ]
      }), {
       8"
            ]
          }
        ]
      }), {
        headers headers: { "Content-Type": "application: { "Content-Type": "application/json" }
      });
    }

    const turnData = await turnResponse.json();
    
/json" }
      });
    }

    const turnData = await turnResponse.json    // Add CORS headers
    return();
    
    // Add CORS headers
    return new Response new Response(JSON.stringify(t(JSON.stringify(turnData), {
      headersurnData), {
      headers: {
        "Content-Type": ": {
        "Content-Type": "application/json",
        "Accessapplication/json",
        "Access-Control-Allow-Origin": "*",
        "-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
       Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
 "Access-Control-Allow-Headers": "Content-Type"
      }
    });

  } catch (      }
    });

  } catch (err)err) {
    {
    console.error('TURN handler console.error('TURN handler error:', err);
    
    error:', err);
    
    // Fallback to STUN only on error
    return new Response(JSON.stringify({
 // Fallback to STUN only on error
    return new Response(JSON.stringify({
      iceServers: [
        {
      iceServers: [
        {
          urls:          urls: [
            [
            "stun:stun.cloudflare.com: "stun:stun.cloudflare.com:3478"
         3478"
          ]
        ]
        }
      ],
      error: err.message
    }), {
 }
      ],
      error: err.message
    }), {
      headers: { 
        "Content      headers: { 
        "Content-Type": "application/json",
        "-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
     Access-Control-Allow-Origin": "* }
    });
  }
}

// ===== NEW: SFU PROXY HAND"
      }
    });
  }
}

// ===== NEW: SFULER =====
async function handleSFURequest PROXY HANDLER =====
async function handleSF(path, request, env) {
  // HandleURequest(path, request, env) {
  OPTIONS preflight
  if // Handle OPTIONS preflight
  if (request (request.method === 'OPT.method === 'OPTIONS') {
    return new Response(nullIONS') {
    return new Response(null, {
, {
      headers: {
        "Access-Control-Allow      headers: {
        "Access-Control-Allow-Origin": "*-Origin":",
        "Access-Control- "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETEAllow-Methods": "GET, POST, PUT, DELETE, OPT, OPTIONS",
        "IONS",
        "Access-Control-Allow-HeadersAccess-Control-Allow-Headers": "Content-Type",
        "Access": "Content-Type",
        "Access-Control-Max-Age":-Control-Max-Age": "86400"
      }
 "86400"
      }
    });
    });
  }

  try {
    // Check  }

  try {
    if App ID and Secret // Check if App ID and Secret are are configured
    if (!env.ACCOUNT_ configured
    if (!env.ACCOUNT_APP_IDAPP_ID || !env. || !ACCOUNT_APP_SECRET) {
env.ACCOUNT_APP_SECRET) {
      return      return new Response(JSON.stringify({ new Response(JSON.stringify({ 
        error: "SFU not configured - 
        error: "SFU not configured - missing credentials" 
      }), { missing credentials" 
      } 
        status: 501), { 
        status: 501,
       ,
        headers: { " headers: { "Content-TypeContent-Type": "application/json" }
      });
": "application/json" }
    }

    //      });
    }

    // Construct path Construct path
    const pathStr
    const pathStr = path = path.join('/');
    const target.join('/');
    const targetUrl = `https://rtUrl = `https://rtc.lc.live.cloudflare.comive.cloudflare.com/v1/v1/apps/${env.ACCOUNT/apps/${env.AC_APP_ID}/${pathStr}`;
    
    //COUNT_APP_ID}/${pathStr}`;
    
    // Get request Get request body for non body for non-GET requests
    let body = null;
-GET requests
    let body =    if (request.method !== 'GET null;
    if (request.method !==' && request.method !== ' 'GET' && request.method !== 'HEAD')HEAD') {
      body = await request {
      body = await request.text();
.text();
    }

    // Forward request to Cloud    }

    // Forward requestflare SFU
    const sfu to Cloudflare SFU
    constResponse = await fetch(targetUrl sfuResponse = await fetch(targetUrl, {
, {
      method: request      method: request.method,
.method,
      headers: {
      headers: {
        'Authorization': `Bearer ${env        'Authorization': `Bearer ${env..ACCOUNT_APP_SECRET}`ACCOUNT_APP_SEC,
        'Content-Type':RET}`,
        'Content-Type': 'application 'application/json'
      },
      body/json'
      },
      body: body
    });

   : body
    });

    // Get // Get response data
    const response response data
    const responseData = awaitData = await sfuResponse.text sfuResponse.text();

    // Return();

    // Return with with CORS headers
    return new CORS headers
    Response(responseData, {
      return new Response(responseData, status: sfuResponse.status,
      {
      status: sfuResponse.status headers: {
        ",
      headers: {
        "Content-TypeContent-Type": sfuResponse": sfuResponse.headers.get.headers.get("Content-Type") ||("Content-Type") "application/json",
        "Access || "application/json",
        "-Control-Access-Control-Allow-Origin": "*",
Allow-Origin": "*",
        "Access-Control-Allow-Methods        "Access-Control-Allow": "GET, POST,-Methods": "GET, POST, PUT, PUT, DELETE, OPTIONS DELETE, OPTIONS",
       ",
        "Access-Control-Allow-Headers": "Access-Control-Allow- "Content-Type"
      }
    });

Headers": "Content-Type"
      }
  } catch (    });

  } catch (err)err) {
    {
    console.error('SF console.error('SFU proxy error:',U proxy error:', err);
 err);
    return new Response(JSON.stringify({ error: err.message }), { 
    return new Response(JSON.stringify({ error: err.message }),      status: 500,
      headers: { { 
      status: 500,
      headers: { 
        "Content-Type": 
        "Content-Type": "application/json",
        "Access-Control "application/json",
        "Access-Control-Allow-Origin": "*-Allow-Origin": "*"
     "
      }
    });
  }
}

export class ChatRoom {
  }
    });
  }
}

export class ChatRoom {
  constructor(state constructor(state, env) {
    this, env) {
    this.state = state;
    this.state = state;
    this.storage = state.storage;
    this.env.storage = state.storage;
    this.env = env = env;
    this.s;
    this.sessions =essions = new Map();
    this.lastTimestamp = 0 new Map();
    this.lastTimestamp = 0;

   ;

    this.state.getWebSockets().forEach((webSocket) => {
      let this.state.getWebSockets().forEach((webSocket) => {
      let meta = meta = webSocket.deserializeAttachment();
 webSocket.deserializeAttachment();
      let limiterId = this.env      let limiterId = this.env.limiters.id.limiters.idFromString(meta.limiterId);
      letFromString(meta.limiterId);
      let lim limiter = new RateLimiterClient(
       iter = new RateLimiter () => this.env.limitersClient(
        () => this.env.limiters.get(limiterId),
        err =>.get(limiterId),
 webSocket.close(1011, err.stack));
      let blockedMessages = [];
      this.s        err => webSocket.close(1011, err.stack));
      let blockedMessages = [];
      this.sessions.set(webessions.set(webSocket, { ...meta, limiter, blockedMessages });
    });
  }

Socket, { ...meta, limiter, blockedMessages });
    });
  }

  async fetch(request) {
    return await handleErrors(request, async  async fetch(request) {
    return await handleErrors(request, async () => {
      let url = new URL(request.url);

      switch (url () => {
      let url = new URL(request.url);

     .pathname) {
        case "/websocket": {
          if (request.headers switch (url.pathname) {
        case "/webs.get("Upgrade") != "websocket") {
           ocket": {
          if (request.headers.get("Upgrade") != "websocket") return new Response("expected webs {
            return new Response("expected websocket", {statusocket", {status: : 400});
          }

          let ip = request.headers.get("CF-Connecting-IP");
         400});
          }

          let ip = request.headers.get("CF-Connecting-IP let pair = new WebSocketPair();
          await this.handle");
          let pair = new WebSocketPair();
Session(pair[1], ip);
          return new Response          await this.handleSession(pair[1], ip);
          return new Response(null, { status: 101, webSocket: pair(null, { status: 101, webSocket: pair[0] });
        }

        default:
          return new Response("Not found", {status:[0] });
        }

        default:
          return new Response("Not found", {status: 404});
      }
    404});
      }
    });
  }

  async handleSession( });
  }

  async handleSession(webSocketwebSocket, ip) {
    this.state.acceptWebSocket(, ip) {
    this.state.acceptWebSocket(webSocket);

    let limiterId = this.env.limiters.idFromName(ip);
webSocket);

    let limiterId = this.env.limiters.idFromName(ip);
    let limiter = new    let limiter = new RateLimiterClient(
        RateLimiterClient(
        () => this.env.limiters.get(limiterId () => this.env.limiters.get(limiterId),
       ),
        err => webSocket.close(1011, err.stack));

    let session = { lim err => webSocket.close(1011, err.stack));

    let session = { limiterIditerId, limiter, blockedMessages: [] };
    webSocket.serialize, limiter, blockedMessages: [] };
    webSocket.serializeAttachment({ ...webSocket.desAttachment({ ...webSocket.deserializeAttachment(), limiterId: limiterIderializeAttachment(), limiterId: limiterId.toString() });
    this.s.toString() });
    this.sessions.set(webSocket, session);

essions.set(webSocket, session);

    for (let otherSession    for (let otherSession of this.sessions.values()) {
      of this.sessions.values()) {
      if ( if (otherSession.name) {
        session.blockedMessagesotherSession.name) {
        session.blockedMessages.push(.push(JSON.stringify({joined: otherSession.name}));
JSON.stringify({joined: otherSession.name}));
      }
      }
    }

    let storage = await this.storage.list({reverse: true, limit: 100});
       }

    let storage = await this.storage.list({reverse: true, limit: 100});
    let backlog = [...storage.values()];
    backlog.reverse();
 let backlog = [...storage.values()];
    backlog.reverse();
    backlog.forEach(value => {
      session.blocked    backlog.forEach(value => {
      session.blockMessages.push(value);
    });
  }

  async webSocketMessage(webSocket, msg) {
edMessages.push(value);
    });
  }

  async webSocketMessage(webSocket, msg) {
    try {
      let session = this.sessions.get(    try {
      let session = this.sessions.get(webSocketwebSocket);
      if (session.quit) {
        webSocket.close();
      if (session.quit) {
        webSocket.close(1011, "WebSocket broken.");
1011, "WebSocket broken.");
        return;
      }

      if (!session        return;
      }

      if (!session.limiter.checkLimit()) {
        webSocket.send(JSON.stringify({
.limiter.checkLimit()) {
        webSocket.send(JSON.stringify({
          error          error: "Your IP is being rate-limited, please try again: "Your IP is being rate-limited, please try again later."
        }));
 later."
        }));
        return;
      }

      let data = JSON        return;
      }

      let data = JSON.parse(msg);

      // Handle call signaling messages.parse(msg);

      // Handle call signaling messages - NEW
      if (data.type === 'call-signal') {
        // Forward call - NEW
      if (data.type === 'call-signal') {
        // Forward call signal to target user
        let targetName = data signal to target user
        let targetName = data.signal?.target;
        if (targetName) {
.signal?.target;
        if (targetName) {
          // Add sender info to signal
          data.signal.from = session.name          // Add sender info to signal
          data.signal.from = session.name;
          
          // Send to target session
          let sent = false;
          for (let;
          
          // Send to target session
          let sent = false;
          for (let [ws, sess] of this.s [ws, sess] of this.sessions) {
            if (sess.name === targetName && wsessions) {
            if (sess.name === targetName && ws.readyState === 1) { // WebSocket.readyState === 1) { // WebSocket.OPEN = 1
             .OPEN = 1
              ws.send(JSON.stringify({
                type: 'call-sign ws.send(JSON.stringify({
                type: 'call-signal',
                signalal',
                signal: data.signal,
                from: session.name
              }));
              sent = true;
              break;
            }
: data.signal,
                from: session.name
              }));
                       }
          
          if sent = true;
              break;
            }
          }
          
          if (!sent) {
            webSocket.send(JSON.stringify({
              type: 'call-signal',
              signal (!sent) {
            webSocket.send(JSON.stringify({
              type: 'call-signal',
              signal: {
                type: 'error',
                message: {
                type: 'error',
                message: `${targetName} is offline or not available`
              }
            }));
          }
        }
        return;
      }

: `${targetName} is offline or not available`
              }
            }));
          }
        }
        return;
      }

      if      if (!session.name) {
        session.name = "" + (data.name (!session.name) {
        session.name = "" + (data.name || "anonymous");
        webSocket.serializeAttachment({ ... || "anonymous");
        webSocket.serializeAttachment({ ...webSocket.deserializewebSocket.deserializeAttachment(), name: session.name });

        if (session.name.length > 32) {
          webSocket.send(JSONAttachment(), name: session.name });

        if (session.name.length > 32) {
          webSocket.send(.stringify({error: "Name too long."}));
          webSocket.close(JSON.stringify({error: "Name too long."}));
          webSocket.close(1009, "Name too long.");
          return;
        }

        session.block1009, "Name too long.");
          return;
        }

        session.blockedMessages.forEach(queued => {
          webSocket.send(queued);
        });
        delete session.blockedMessages;

       edMessages.forEach(queued => {
          webSocket.send(queued);
        });
        delete session.block this.broadcast({joined: sessionedMessages;

        this.broadcast({joined: session.name});
        webSocket.send(JSON.stringify({ready:.name});
        webSocket.send(JSON.stringify({ready: true}));
        return;
      }

 true}));
        return;
      }

      data = { name: session.name      data = { name: session.name, message: "" + data.message };

, message: "" + data.message };

      if (data.message.length > 256) {
        webSocket      if (data.message.length > 256) {
        webSocket.send(JSON.stringify({error: ".send(JSON.stringify({error: "Message too long."}));
        return;
      }

      data.timestamp =Message too long."}));
        return;
      }

      data.timestamp = Math.max(Date.now(), this.lastTimestamp + 1 Math.max(Date.now(), this.lastTimestamp + 1);
      this.lastTimestamp = data.timestamp;

     );
      this.lastTimestamp = data.timestamp;

      let dataStr = JSON.stringify(data);
      this.broadcast(dataStr);

      let key = new Date(data.timestamp).toISO let dataStr = JSON.stringify(data);
      this.broadcast(dataStr);

      let key = new Date(data.timestamp).toString();
      await this.storage.put(key, dataStr);
      
      //ISOString();
      await this.storage.put(key, dataStr);
      
      // Simpan ke D1 untuk history panjang (ops Simpan ke D1 untuk history panjang (opsional)
      try {
        let roomId =ional)
      try {
        let roomId = this.state.id.toString();
        await this.env.READTALK_DB.prepare(
          "INSERT INTO messages ( this.state.id.toString();
        await this.env.READTALK_DB.prepare(
          "INSERT INTO messages (roomroom_id, user, message, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(roomId, data.name, data_id, user, message, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(roomId, data.name, data.message, data.timestamp).run();
      } catch (e) {
        // Abaikan error, tetap lan.message, data.timestamp).run();
      } catch (e) {
        // Abaikan error, tetapjut
      }
      
    } catch (err) {
      webSocket.send(JSON.stringify({error: err.stack lanjut
      }
      
    } catch (err) {
      webSocket.send(JSON.stringify({error: err.stack}));
    }
  }

  async closeOrErrorHandler}));
    }
  }

  async closeOrErrorHandler((webSocket) {
    let session = this.sessions.get(webSocket) || {};
   webSocket) {
    let session = this.sessions.get(webSocket) || {};
    session.quit = true;
    this.sessions.delete(webSocket session.quit = true;
    this.sessions.delete(webSocket);
   );
    if (session.name) {
      this.broadcast({quit: session.name});
      
      // Update status online di KV
 if (session.name) {
      this.broadcast({quit: session.name});
      
      // Update status online di KV
      try {
        let roomId = this.state.id.toString      try {
        let roomId = this.state.id.toString();
        let count = await this.env.READTALK();
        let count = await this.env_KV.get(`online:${roomId}`) || 0;
       .READTALK_KV.get(`online:${roomId}`) || 0;
        await this await this.env..env.READTALK_KV.put(`online:${roomIdREADTALK_KV.put(`online:${roomId}`, (parseInt(count) - 1).toString}`, (parseInt(count) - 1).toString());
      } catch (e) {
        // Abaikan error
      }
    }
  }

  async webSocketClose());
      } catch (e) {
        // Abaikan error
      }
    }
  }

  async webSocketClose(webSocket, code, reason, wasClean) {
(webSocket, code, reason, wasClean) {
    this.closeOrErrorHandler(webSocket)
  }

  async webSocket    this.closeOrErrorHandler(webSocket)
  }

  async webSocketError(webSocketError(webSocket, error, error) {
    this.closeOrErrorHandler(webSocket)
  }

  broadcast) {
    this.closeOrErrorHandler(webSocket)
  }

  broadcast(message) {
    if (typeof message !== "string")(message) {
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }

 {
      message = JSON.stringify(message);
    }

    let    let quitters = [];
    this.sessions.forEach((session, webSocket) => quitters = [];
    this.sessions.forEach((session, webSocket) => {
      if (session.name) {
        try {
          {
      if (session.name) {
        try {
          webSocket.send(message);
        } catch (err) {
          session.quit = true;
          quitters.push(session);
          this.sessions webSocket.send(message);
        } catch (err) {
          session.quit = true;
          quitters.push(session);
          this.sessions.delete(.delete(webSocket);
        }
      } else {
        session.blockedMessages.push(message);
      }
   webSocket);
        }
      } else {
        session.blockedMessages.push(message);
      }
    });

    quitters.forEach(quitter => {
      if (quitter.name });

    quitters.forEach(quitter => {
      if (quitter.name) {
        this.broadcast({quit: quitter.name});
) {
        this.broadcast({quit: quitter      }
    });
  }
}

export class RateLimiter {
  constructor(state, env) {
.name});
      }
    });
  }
}

export class RateLimiter {
  constructor(state, env) {
    this.nextAllowedTime = 0;
  }

  async fetch(request)    this.nextAllowedTime = 0;
  }

  async fetch(request) {
    return await handleErrors(request, async () => {
      let now = Date.now() / 1000;
      this {
    return await handleErrors(request, async () => {
      let now = Date.now() / 1000;
      this.nextAllowedTime = Math.max(now, this.nextAllowedTime);

      if (request.nextAllowedTime = Math.max(now, this.nextAllowedTime);

      if (request.method == "POST") {
        this.nextAllowedTime += 5;
      }

      let cooldown = Math.max(0, this.nextAllowedTime - now - 20);
.method == "POST") {
        this.nextAllowedTime += 5;
      }

      let cooldown = Math.max(0, this.nextAllowedTime - now - 20);
      return new Response(cooldown);
    })
  }
}

class RateLimiterClient {
  constructor(getLimiterStub, reportError) {
         return new Response(cooldown);
    })
  }
}

class RateLimiterClient {
  constructor(getLimiterStub, reportError) {
    this.getLimiterStub = getLimiter this.getLimiterStub = getLimiterStub;
    this.reportError = reportError;
Stub;
    this.reportError = reportError;
    this.limiter = getLimiterStub();
    this.limiter = getLimiterStub();
    this.inCooldown = false;
  }

  checkLimit() {
    if    this.inCooldown = false;
  }

  checkLimit() {
    if (this.inCooldown) {
      return false;
    }
    this.inCooldown = true (this.inCooldown) {
      return false;
    }
    this.inCooldown = true;
   ;
    this.callLimiter();
    return true;
  }

  async callLimiter() {
    try {
      let response;
      try {
 this.callLimiter();
    return true;
  }

  async callLimiter() {
    try {
      let response;
      try {
        response = await this.l        response = await this.limiterimiter.fetch("https://dummy-url", {method: "POST"});
     .fetch("https://dummy-url", {method: "POST"});
      } catch } catch (err) {
        this.limiter = this.getLimiterStub();
        response = await this (err) {
        this.limiter = this.getLimiterStub();
        response = await this.limiter.fetch("https://dummy-url", {method: "POST"});
.limiter.fetch("https://dummy-url", {method: "POST"});
      }

      let cooldown = +(await response.text());
      await new Promise(resolve => setTimeout(resolve,      }

      let cooldown = +(await response.text());
      await new Promise(resolve => setTimeout(resolve, cooldown * 1000));

      this.inCo cooldown * 1000));

      this.inCooldown = false;
    } catch (err) {
      this.reportError(erroldown = false;
    } catch (err) {
      this.reportError(err);
    }
  }
}
