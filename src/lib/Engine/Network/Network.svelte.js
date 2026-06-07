import Codec from "./Codec.js";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

class GameInstance {
  ping = $state();
  connected = $state(false);
  connecting = $state(false);

  constructor(game, id, name, partyKey, serverData) {
    this.game = game;
    this.id = id;
    this.name = name;
    this.partyKey = partyKey;
    this.serverData = serverData;
    
    this.socket = null;
    this.codec = new Codec(game);
    this.codec.instance = this;

    this.pingStart = null;
    this.pingCompletion = null;
    this.connectionAttempts = 0;
    this.options = {
      name,
      partyKey,
      serverData,
    };

    this.socketIntentionallyClosed = false;

    // Track statistics for visual feedback in the UI
    this.playerTick = $state(null);
    this.partyMembers = $state([]);
    this.savedTools = null;
    this.enterWorldData = null;
  }

  connect() {
    if (!this.connected && !this.connecting) {
      this.connecting = true;
      const url =
        this.options.serverData.url ||
        `wss://server-${this.options.serverData.id}.zombia.io`;
      this.socket = new WebSocket(url);
      this.socket.binaryType = "arraybuffer";
      this.bindAllListeners();
    }
  }

  bindAllListeners() {
    this.socket.onopen = this.onSocketOpen.bind(this);
    this.socket.onmessage = this.onSocketMessage.bind(this);
    this.socket.onclose = this.onSocketClose.bind(this);
  }

  unbindSocket() {
    this.codec.setSync(false);
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
    }
  }

  rebindSocket() {
    this.bindAllListeners();
    this.codec.setSync(true, true);
  }

  onSocketOpen() {
    this.connected = true;
    this.connecting = false;
    this.codec.knownEntities = [];

    this.sendEnterWorld(this.options.name, this.options.partyKey);
    this.sendPingIfNecessary();

    if (this.game.network.activeInstanceId === this.id) {
      this.game.eventEmitter.emit("SocketOpened");
    }
    this.game.network.broadcastState(true);
  }

  onSocketClose() {
    this.pingStart = null;
    this.connected = false;
    this.connecting = false;

    if (this.socketIntentionallyClosed) {
      this.socketIntentionallyClosed = false;
    } else {
      if (this.connectionAttempts < 3) {
        this.connectionAttempts++;
        setTimeout(this.connect.bind(this), 1e3);
      } else {
        this.connectionAttempts = 0;
      }
    }
    if (this.game.network.activeInstanceId === this.id) {
      this.game.eventEmitter.emit("SocketClosed");
    }
    this.game.network.broadcastState(true);
  }

  onSocketMessage(t) {
    if ("string" == typeof t.data) return console.log(t.data);
    const e = this.codec.decode(t.data);
    if (null != e.opcode) {
      const isActive = this.game.network.activeInstanceId === this.id;
      switch (e.opcode) {
        case 4:
          this.handleEnterWorldResponse(e, isActive);
          break;
        case 0:
          this.handleEntityUpdate(e, isActive);
          break;
        case 9:
          this.handleRpc(e, isActive);
          break;
        case 7:
          this.handlePing(e);
          break;
      }
    }
  }

  sendPingIfNecessary() {
    null !== this.pingStart ||
      (null !== this.pingCompletion &&
        new Date().getTime() - this.pingCompletion.getTime() <= 5e3) ||
      ((this.pingStart = new Date()), this.sendPing());
  }

  sendPacket(t, e) {
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(this.codec.encode(t, e));
    }
  }

  sendEnterWorld(t, e) {
    this.sendPacket(4, {
      name: t,
      partyKey: e,
      reconnectSecret: this.codec.reconnectSecret,
    });
  }

  sendInput(t) {
    this.sendPacket(3, t);
  }

  sendRpc(t) {
    this.sendPacket(9, {
      response: t,
    });
  }

  sendPing() {
    this.sendPacket(7);
  }

  handleEnterWorldResponse(t, isActive) {
    if (false === t.allowed) return (this.socketIntentionallyClosed = true);

    this.codec.currentTickNumber = t.startingTick;
    this.enterWorldData = t;

    if (isActive) {
      this.game.eventEmitter.emit("EnterWorldResponse", t);
    }
    this.game.network.broadcastState(true);
  }

  handleEntityUpdate(t, isActive) {
    const e = performance.now();
    this.codec.entityUpdateTimeDelta =
      e - this.codec.lastEntityUpdateMessageReceived;
    this.codec.lastEntityUpdateMessageReceived = e;

    this.sendPingIfNecessary();

    // Update player stats for this instance
    if (t.entities && this.enterWorldData) {
      const myUid = this.enterWorldData.uid;
      const myEntity = t.entities[myUid];
      if (myEntity && myEntity !== true) {
        this.playerTick = {
          ...this.playerTick,
          ...myEntity
        };
      }
    }

    if (isActive) {
      this.game.eventEmitter.emit("EntityUpdate", t);
    }
    this.game.network.broadcastState(false);
  }

  handleRpc(t, isActive) {
    if (t.name === "PartyMembersUpdated") {
      this.partyMembers = t.response;
    }
    if (t.name === "SetTool") {
      this.savedTools = t.response;
    }
    if (t.name === "PartyKey") {
      this.partyKey = t.response.partyKey;
    }

    if (isActive) {
      this.game.eventEmitter.emit(`${t.name}RpcReceived`, t.response);
    }
    this.game.network.broadcastState(true);
  }

  handlePing() {
    const t = new Date();
    if (this.pingStart) {
      this.ping = (t.getTime() - this.pingStart.getTime()) / 2;
    }
    this.pingStart = null;
    this.pingCompletion = t;
    this.game.network.broadcastState(true);
  }

  onVisibilityChange() {
    this.codec.setSync(this.game.network.isWindowVisible());
  }
}

export default class {
  instances = $state({});
  activeInstanceId = $state(null);
  lastBroadcast = 0;

  get activeInstance() {
    return this.instances[this.activeInstanceId] || null;
  }

  // Delegator properties
  get connected() {
    return this.activeInstance?.connected || false;
  }
  set connected(val) {
    if (this.activeInstance) this.activeInstance.connected = val;
  }

  get connecting() {
    return this.activeInstance?.connecting || false;
  }
  set connecting(val) {
    if (this.activeInstance) this.activeInstance.connecting = val;
  }

  get ping() {
    return this.activeInstance?.ping;
  }
  set ping(val) {
    if (this.activeInstance) this.activeInstance.ping = val;
  }

  get options() {
    return this.activeInstance?.options || {};
  }
  set options(val) {
    if (this.activeInstance) this.activeInstance.options = val;
  }

  get codec() {
    return this.activeInstance?.codec;
  }

  get socket() {
    return this.activeInstance?.socket;
  }

  constructor(game) {
    this.game = game;
    this.hostWindowVisible = true;
  }

  isWindowVisible() {
    return this.hostWindowVisible && document.visibilityState !== "hidden";
  }

  init() {
    document.onvisibilitychange = this.onVisibilityChange.bind(this);

    // Set up Tauri IPC communication
    listen("client-ready", () => {
      this.broadcastState(true);
    });

    listen("client-spawn-alt", () => {
      const active = this.activeInstance;
      if (active) {
        this.createInstance(active.name, active.partyKey, active.serverData);
      }
    });

    listen("client-switch-control", (event) => {
      this.switchInstance(event.payload.id);
    });

    listen("client-disconnect-alt", (event) => {
      this.removeInstance(event.payload.id);
    });

    listen("client-toggle-visibility", async () => {
      const appWindow = getCurrentWindow();
      const isVisible = await appWindow.isVisible();
      if (isVisible) {
        await appWindow.hide();
        this.hostWindowVisible = false;
        this.game.renderer.skipRendering = true;
      } else {
        await appWindow.show();
        await appWindow.setFocus();
        this.hostWindowVisible = true;
        this.game.renderer.skipRendering = false;

        // Wait for the Webview layout reflow to complete, then trigger resize to restore WebGL canvas
        setTimeout(() => {
          if (this.game.renderer && typeof this.game.renderer.onWindowResize === "function") {
            this.game.renderer.onWindowResize();
          }
        }, 100);
      }
      if (this.activeInstance) {
        this.activeInstance.codec.setSync(this.isWindowVisible());
      }
      this.broadcastState(true);
    });
  }

  setConnectionData(t, e, r) {
    if (!this.activeInstanceId) {
      const mainInstance = new GameInstance(this.game, "main", t, e, r);
      this.instances["main"] = mainInstance;
      this.activeInstanceId = "main";
    } else {
      const active = this.activeInstance;
      active.name = t;
      active.partyKey = e;
      active.serverData = r;
      active.options = { name: t, partyKey: e, serverData: r };
    }
    this.broadcastState(true);
  }

  connect() {
    if (this.activeInstance) {
      this.activeInstance.connect();
    }
    this.broadcastState(true);
  }

  onVisibilityChange() {
    if (this.activeInstance) {
      this.activeInstance.onVisibilityChange();
    }
  }

  sendInput(t) {
    if (this.activeInstance) {
      this.activeInstance.sendInput(t);
    }
  }

  sendRpc(t) {
    if (this.activeInstance) {
      this.activeInstance.sendRpc(t);
    }
  }

  handleEntityUpdate(t) {
    if (this.activeInstance) {
      this.activeInstance.handleEntityUpdate(t, true);
    }
  }

  // Multi-instance controls
  createInstance(name, partyKey, serverData) {
    const id = "inst_" + Math.random().toString(36).substring(2, 9);
    const instance = new GameInstance(this.game, id, name, partyKey, serverData);
    this.instances[id] = instance;
    instance.connect();
    this.broadcastState(true);
    return instance;
  }

  removeInstance(id) {
    const instance = this.instances[id];
    if (instance) {
      instance.socketIntentionallyClosed = true;
      if (instance.socket) {
        instance.socket.close();
      }
      instance.unbindSocket();
      delete this.instances[id];
      
      if (this.activeInstanceId === id) {
        const remainingIds = Object.keys(this.instances);
        if (remainingIds.length > 0) {
          this.switchInstance(remainingIds[0]);
        } else {
          this.activeInstanceId = null;
        }
      }
    }
    this.broadcastState(true);
  }

  switchInstance(id) {
    const newInstance = this.instances[id];
    if (!newInstance) return;

    const oldInstance = this.activeInstance;
    if (oldInstance && oldInstance.id === id) return;

    // Unbind old socket visibility sync
    if (oldInstance) {
      oldInstance.codec.setSync(false);
    }

    // Switch active ID
    this.activeInstanceId = id;

    // Rebind new socket visibility sync
    newInstance.codec.setSync(this.isWindowVisible());

    // Reset visual world
    if (newInstance.enterWorldData) {
      this.game.eventEmitter.emit("EnterWorldResponse", newInstance.enterWorldData);

      if (newInstance.savedTools) {
        this.game.eventEmitter.emit("SetToolRpcReceived", newInstance.savedTools);
      }

      if (newInstance.partyMembers && newInstance.partyMembers.length > 0) {
        this.game.eventEmitter.emit("PartyMembersUpdatedRpcReceived", newInstance.partyMembers);
      }

      if (newInstance.playerTick) {
        this.game.ui.setPlayerTick(newInstance.playerTick);
      }

      newInstance.codec.packetArr = [];
      newInstance.codec.knownEntities = [];
      newInstance.codec.outOfSync = true;
      newInstance.sendRpc({ name: "OutOfSync" });
    }
    this.broadcastState(true);
  }

  async broadcastState(force = false) {
    const now = Date.now();
    if (now - this.lastBroadcast < 200 && !force) return;
    this.lastBroadcast = now;

    try {
      const appWindow = getCurrentWindow();
      const isHostVisible = await appWindow.isVisible();

      const serialized = Object.values(this.instances).map(inst => ({
        id: inst.id,
        name: inst.name,
        connected: inst.connected,
        connecting: inst.connecting,
        ping: inst.ping,
        serverData: inst.serverData,
        stats: inst.playerTick ? {
          health: inst.playerTick.health,
          maxHealth: inst.playerTick.maxHealth,
          wood: inst.playerTick.wood,
          stone: inst.playerTick.stone,
          gold: inst.playerTick.gold,
          tokens: inst.playerTick.tokens,
          wave: inst.playerTick.wave,
          zombieShieldHealth: inst.playerTick.zombieShieldHealth,
          zombieShieldMaxHealth: inst.playerTick.zombieShieldMaxHealth,
        } : null
      }));

      emit("host-instances-update", {
        instances: serialized,
        activeInstanceId: this.activeInstanceId,
        partyShareKey: this.activeInstance?.partyKey || "",
        isHostVisible
      });
    } catch (err) {
      console.warn("Failed to broadcast instances state:", err);
    }
  }
}
