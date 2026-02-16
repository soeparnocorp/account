// ============ MAIN WORKER ============
import HTML from "./chat.html";

async function handleErrors(request, func) {
  try {
    return await func();
  } catch (err) {
    console.error('Error:', err.stack);
    
    if (request.headers.get("Upgrade") == "websocket") {
      let pair = new WebSocketPair();
      pair[1].accept();
      pair[1].send(JSON.stringify({ error: err.message }));
      pair[1].close(1011, "Uncaught exception during session setup");
      return new Response(null, { status: 101, webSocket: pair[0] });
    } else {
      return new Response(JSON.stringify({ 
        error: err.message, 
        stack: err.stack 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    return await handleErrors(request, async () => {
      let url = new URL(request.url);
      let path = url.pathname.slice(1).split('/');
      
      // Serve HTML frontend
      if (!path[0]) {
        return new Response(HTML, {
          headers: { 
            "Content-Type": "text/html;charset=UTF-8",
            "Cache-Control": "no-cache"
          }
        });
      }

      // 🔥 ROUTE BARU: Global WebSocket untuk user connection
      if (path[0] === "ws") {
        const name = url.searchParams.get("name");
        const device = url.searchParams.get("device");
        
        if (!name || !device) {
          return new Response("Name and device required", { status: 400 });
        }
        
        // Buat ID unik untuk user (nama + IP + device)
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        const userId = `${name}_${ip}_${device}`;
        
        // Dapatkan atau buat UserConnection DO
        const id = env.users.idFromName(userId);
        const userConn = env.users.get(id);
        
        // Forward request ke UserConnection DO
        return userConn.fetch(new Request(
          "https://internal/websocket?" + url.searchParams,
          request
        ));
      }

      switch (path[0]) {
        case "api":
          return await handleApiRequest(path.slice(1), request, env, ctx);
        
        case "health":
          return new Response(JSON.stringify({
            status: "healthy",
            bindings: {
              users: !!env.users,
              rooms: !!env.rooms,
              limiters: !!env.limiters
            }
          }), {
            headers: { "Content-Type": "application/json" }
          });
          
        default:
          return new Response("Not found", { status: 404 });
      }
    });
  }
};

// ============ API HANDLER ============
async function handleApiRequest(path, request, env, ctx) {
  switch (path[0]) {
    case "room": {
      if (!path[1]) {
        if (request.method == "POST") {
          let id = env.rooms.newUniqueId();
          
          // Logging (opsional)
          ctx.waitUntil(logRoomCreation(env, id.toString(), request));
          
          return new Response(id.toString(), {
            headers: { "Access-Control-Allow-Origin": "*" }
          });
        }
        return new Response("Method not allowed", { status: 405 });
      }

      let name = path[1];
      let id;
      
      if (name.match(/^[0-9a-f]{64}$/)) {
        id = env.rooms.idFromString(name);
      } else if (name.length <= 32) {
        id = env.rooms.idFromName(name);
      } else {
        return new Response("Name too long", { status: 400 });
      }

      // 🔥 Catatan: API room masih ada untuk kompatibilitas
      // Tapi WebSocket sekarang pake /ws bukan /api/room/.../websocket
      let roomObject = env.rooms.get(id);
      let newUrl = new URL(request.url);
      newUrl.pathname = "/" + path.slice(2).join("/");

      return roomObject.fetch(newUrl, request);
    }
    
    // Endpoint logging (opsional)
    case "logs": {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      
      const { roomId, type, data } = await request.json();
      
      // Logging ke console untuk uji coba
      console.log(`Log: ${type} in ${roomId}`, data);
      
      return new Response("OK", { status: 200 });
    }
    
    default:
      return new Response("Not found", { status: 404 });
  }
}

// ============ BACKGROUND FUNCTIONS ============
async function logRoomCreation(env, roomId, request) {
  // Untuk uji coba, cukup console log
  console.log(`Room created: ${roomId} from ${request.headers.get("CF-Connecting-IP")}`);
}

// ============ DURABLE OBJECT: USER CONNECTION ============
// 1 user = 1 DO, handle WebSocket global
export class UserConnection {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    this.rooms = new Set(); // Room yang diikuti user ini
    this.username = null;
    this.userId = null;
    this.deviceId = null;
  }

  async fetch(request) {
    return await handleErrors(request, async () => {
      let url = new URL(request.url);
      
      // WebSocket connection
      if (url.pathname === "/websocket") {
        if (request.headers.get("Upgrade") != "websocket") {
          return new Response("Expected websocket", { status: 400 });
        }

        let pair = new WebSocketPair();
        await this.handleSession(pair[1], request);
        return new Response(null, { status: 101, webSocket: pair[0] });
      }
      
      // Internal: kirim pesan dari room
      if (url.pathname === "/internal/message" && request.method === "POST") {
        const message = await request.json();
        
        // Forward ke WebSocket client (kalo masih connected)
        const webSockets = this.state.getWebSockets();
        webSockets.forEach(ws => {
          try {
            ws.send(JSON.stringify(message));
          } catch (err) {
            // ignore
          }
        });
        
        return new Response("OK");
      }
      
      return new Response("Not found", { status: 404 });
    });
  }

  async handleSession(webSocket, request) {
    this.state.acceptWebSocket(webSocket);
    
    // Ambil data dari URL
    const url = new URL(request.url);
    this.username = url.searchParams.get("name") || "anonymous";
    this.deviceId = url.searchParams.get("device") || "unknown";
    this.userId = this.state.id.toString();

    console.log(`User connected: ${this.username} (${this.userId})`);

    // Kirim konfirmasi koneksi
    webSocket.send(JSON.stringify({
      type: "connected",
      userId: this.userId,
      username: this.username
    }));

    webSocket.addEventListener("message", async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case "join_room":
            await this.joinRoom(data.room);
            break;
          case "leave_room":
            await this.leaveRoom(data.room);
            break;
          case "message":
            await this.sendMessage(data.room, data.text);
            break;
          default:
            console.log("Unknown message type:", data.type);
        }
      } catch (err) {
        console.error("Error handling message:", err);
        webSocket.send(JSON.stringify({ error: err.message }));
      }
    });
  }

  async joinRoom(roomName) {
    console.log(`${this.username} joining room: ${roomName}`);
    
    // Dapatkan atau buat ID room
    let roomId;
    if (roomName.match(/^[0-9a-f]{64}$/)) {
      roomId = this.env.rooms.idFromString(roomName);
    } else if (roomName.length <= 32) {
      roomId = this.env.rooms.idFromName(roomName);
    } else {
      throw new Error("Invalid room name");
    }

    // Dapatkan stub room
    const roomStub = this.env.rooms.get(roomId);
    
    // Register user di room (pake internal endpoint)
    const registerUrl = new URL(`http://internal/register?user=${encodeURIComponent(this.userId)}&name=${encodeURIComponent(this.username)}`);
    await roomStub.fetch(registerUrl);
    
    this.rooms.add(roomName);
    
    // Minta history
    const historyUrl = new URL(`http://internal/history?limit=50`);
    const historyRes = await roomStub.fetch(historyUrl);
    const messages = await historyRes.json();
    
    // Kirim history ke client
    const webSockets = this.state.getWebSockets();
    webSockets.forEach(ws => {
      ws.send(JSON.stringify({
        type: "history",
        room: roomName,
        messages
      }));
    });
  }

  async leaveRoom(roomName) {
    console.log(`${this.username} leaving room: ${roomName}`);
    
    let roomId;
    if (roomName.match(/^[0-9a-f]{64}$/)) {
      roomId = this.env.rooms.idFromString(roomName);
    } else {
      roomId = this.env.rooms.idFromName(roomName);
    }

    const roomStub = this.env.rooms.get(roomId);
    await roomStub.fetch(`http://internal/unregister?user=${encodeURIComponent(this.userId)}`);
    
    this.rooms.delete(roomName);
  }

  async sendMessage(roomName, text) {
    console.log(`${this.username} sending message to ${roomName}: ${text}`);
    
    let roomId;
    if (roomName.match(/^[0-9a-f]{64}$/)) {
      roomId = this.env.rooms.idFromString(roomName);
    } else {
      roomId = this.env.rooms.idFromName(roomName);
    }

    const roomStub = this.env.rooms.get(roomId);
    
    await roomStub.fetch("http://internal/message", {
      method: "POST",
      body: JSON.stringify({
        userId: this.userId,
        name: this.username,
        text: text,
        timestamp: Date.now()
      })
    });
  }

  async webSocketClose(webSocket, code, reason, wasClean) {
    console.log(`${this.username} disconnected`);
    
    // Unregister dari semua room
    for (let roomName of this.rooms) {
      await this.leaveRoom(roomName).catch(() => {});
    }
    this.rooms.clear();
  }

  async webSocketError(webSocket, error) {
    console.error(`${this.username} WebSocket error:`, error);
    // Treat like close
    await this.webSocketClose(webSocket, 1006, "Error", false);
  }
}

// ============ DURABLE OBJECT: CHAT ROOM ============
// 1 room = 1 DO, nyimpen messages & members
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    this.members = new Map(); // userId → { name }
    this.lastTimestamp = 0;
    
    // Load members dari storage
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.storage.get("members") || [];
      this.members = new Map(stored);
    });
  }

  async fetch(request) {
    return await handleErrors(request, async () => {
      let url = new URL(request.url);
      
      // Internal: register user
      if (url.pathname === "/internal/register") {
        const userId = url.searchParams.get("user");
        const name = url.searchParams.get("name");
        
        if (!userId || !name) {
          return new Response("Missing parameters", { status: 400 });
        }
        
        this.members.set(userId, { name });
        await this.storage.put("members", Array.from(this.members.entries()));
        
        console.log(`User ${name} joined room ${this.state.id.toString()}`);
        
        // Broadcast joined ke semua member lain
        this.broadcastToUsers({
          type: "joined",
          name: name,
          room: this.state.id.toString()
        }, userId);
        
        return new Response("OK");
      }
      
      // Internal: unregister user
      if (url.pathname === "/internal/unregister") {
        const userId = url.searchParams.get("user");
        const member = this.members.get(userId);
        
        if (member) {
          this.members.delete(userId);
          await this.storage.put("members", Array.from(this.members.entries()));
          
          console.log(`User ${member.name} left room ${this.state.id.toString()}`);
          
          // Broadcast quit ke semua member lain
          this.broadcastToUsers({
            type: "quit",
            name: member.name,
            room: this.state.id.toString()
          }, userId);
        }
        
        return new Response("OK");
      }
      
      // Internal: get history
      if (url.pathname === "/internal/history") {
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const storage = await this.storage.list({ reverse: true, limit });
        const messages = [...storage.values()].reverse();
        return new Response(JSON.stringify(messages));
      }
      
      // Internal: new message
      if (url.pathname === "/internal/message" && request.method === "POST") {
        const data = await request.json();
        
        // Validasi
        if (!data.name || !data.text) {
          return new Response("Invalid message", { status: 400 });
        }
        
        data.timestamp = Math.max(Date.now(), this.lastTimestamp + 1);
        this.lastTimestamp = data.timestamp;
        
        const messageToStore = {
          name: data.name,
          message: data.text,
          timestamp: data.timestamp
        };
        
        const dataStr = JSON.stringify(messageToStore);
        
        // Simpan ke storage
        const key = new Date(data.timestamp).toISOString();
        await this.storage.put(key, dataStr);
        
        console.log(`Message in ${this.state.id.toString()}: ${data.name}: ${data.text}`);
        
        // Broadcast ke semua member
        this.broadcastToUsers({
          type: "message",
          room: this.state.id.toString(),
          name: data.name,
          text: data.text,
          timestamp: data.timestamp
        }, data.userId);
        
        return new Response("OK");
      }
      
      // 🔥 Untuk kompatibilitas dengan WebSocket lama (kalo masih dipake)
      if (url.pathname === "/websocket") {
        return new Response("Please use /ws endpoint instead", { status: 400 });
      }
      
      return new Response("Not found", { status: 404 });
    });
  }

  async broadcastToUsers(message, skipUserId = null) {
    const messageStr = JSON.stringify(message);
    
    for (let [userId, member] of this.members) {
      if (userId === skipUserId) continue;
      
      try {
        // Dapatkan UserConnection DO user ini
        const connId = this.env.users.idFromName(userId);
        const connStub = this.env.users.get(connId);
        
        await connStub.fetch("http://internal/message", {
          method: "POST",
          body: messageStr
        });
      } catch (err) {
        // User mungkin offline, ignore
        console.log(`Failed to send to ${userId}:`, err.message);
      }
    }
  }
}

// ============ DURABLE OBJECT: RATE LIMITER ============
// Tetap sama seperti sebelumnya
export class RateLimiter {
  constructor(state, env) {
    this.state = state;
    this.nextAllowedTime = 0;
    
    // Load state from storage
    this.state.blockConcurrencyWhile(async () => {
      let stored = await this.state.storage.get("nextAllowedTime");
      if (stored) this.nextAllowedTime = parseFloat(stored);
    });
  }

  async fetch(request) {
    return await handleErrors(request, async () => {
      let now = Date.now() / 1000;
      
      await this.state.blockConcurrencyWhile(async () => {
        let stored = await this.state.storage.get("nextAllowedTime");
        if (stored) this.nextAllowedTime = parseFloat(stored);
      });

      this.nextAllowedTime = Math.max(now, this.nextAllowedTime);

      if (request.method == "POST") {
        this.nextAllowedTime += 5;
        await this.state.storage.put("nextAllowedTime", this.nextAllowedTime.toString());
      }

      let cooldown = Math.max(0, this.nextAllowedTime - now - 20);
      return new Response(cooldown.toString());
    });
  }
}

// ============ RATE LIMITER CLIENT ============
class RateLimiterClient {
  constructor(getLimiterStub, reportError) {
    this.getLimiterStub = getLimiterStub;
    this.reportError = reportError;
    this.limiter = getLimiterStub();
    this.inCooldown = false;
  }

  checkLimit() {
    if (this.inCooldown) return false;
    this.inCooldown = true;
    this.callLimiter();
    return true;
  }

  async callLimiter() {
    try {
      let response;
      try {
        response = await this.limiter.fetch("https://dummy-url", { method: "POST" });
      } catch (err) {
        this.limiter = this.getLimiterStub();
        response = await this.limiter.fetch("https://dummy-url", { method: "POST" });
      }

      let cooldown = +(await response.text());
      await new Promise(resolve => setTimeout(resolve, cooldown * 1000));
      this.inCooldown = false;
    } catch (err) {
      this.reportError(err);
    }
  }
}
