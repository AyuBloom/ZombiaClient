import Codec from "./Codec.js";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

class GameInstance {
  constructor(game, id, name, partyKey, serverData) {
    this.game = game;
    this.id = id;
    this.name = name;
    this.partyKey = $state(partyKey);
    this.serverData = serverData;

    this.socket = null;
    this.codec = new Codec(game);
    this.codec.instance = this;

    this.ping = $state();
    this.connected = $state(false);
    this.connecting = $state(false);
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

    // Recorded RPC states
    this.partyBuildings = {};
    this.partyRequests = {};
    this.openParties = [];
    this.leaderboard = [];
    this.isDead = false;
    this.deadData = null;
    this.toolInfo = null;
    this.buildingInfo = null;
    this.spellInfo = null;
    this.disabledSpells = {};
    this.entityData = null;
    this.chatHistory = [];
    this.tickRate = null;
    this.dayNightCycle = null;
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

    // Reset tracked RPC states upon entering a new world
    this.partyBuildings = {};
    this.partyRequests = {};
    this.openParties = [];
    this.leaderboard = [];
    this.isDead = false;
    this.deadData = null;
    this.toolInfo = null;
    this.buildingInfo = null;
    this.spellInfo = null;
    this.disabledSpells = {};
    this.entityData = null;
    this.chatHistory = [];
    this.tickRate = null;
    this.dayNightCycle = null;

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
    // Record state/data for all stateful RPCs
    if (t.name === "PartyKey") {
      this.partyKey = t.response.partyKey;
    } else if (t.name === "PartyBuilding") {
      for (const b of t.response) {
        if (b.dead) {
          delete this.partyBuildings[b.uid];
        } else {
          this.partyBuildings[b.uid] = b;
        }
      }
    } else if (t.name === "PartyRequest") {
      this.partyRequests[t.response.uid] = t.response;
    } else if (t.name === "PartyRequestCancelled") {
      delete this.partyRequests[t.response.uid];
    } else if (t.name === "PartyRequestMet") {
      this.partyRequests = {};
    } else if (t.name === "PartyMembersUpdated") {
      this.partyMembers = t.response;
    } else if (t.name === "UpdateParty") {
      this.openParties = t.response;
    } else if (t.name === "UpdateLeaderboard") {
      this.leaderboard = t.response;
    } else if (t.name === "Respawned") {
      this.isDead = false;
      this.deadData = null;
    } else if (t.name === "SetTool") {
      this.savedTools = t.response;
    } else if (t.name === "Dead") {
      this.isDead = true;
      this.deadData = t.response;
    } else if (t.name === "ToolInfo") {
      this.toolInfo = t.response;
    } else if (t.name === "BuildingInfo") {
      this.buildingInfo = t.response;
    } else if (t.name === "SpellInfo") {
      this.spellInfo = t.response;
    } else if (t.name === "CastSpellResponse") {
      this.disabledSpells[t.response.name] = t.response;
    } else if (t.name === "ClearActiveSpell") {
      delete this.disabledSpells[t.response.name];
    } else if (t.name === "EntityData") {
      this.entityData = t.response;
    } else if (t.name === "ReceiveChatMessage") {
      this.chatHistory.push(t.response);
      // don't think i should limit it here
      /*
      if (this.chatHistory.length > 500) {
        this.chatHistory.shift();
      }
      */
    } else if (t.name === "SetTickRate") {
      this.tickRate = t.response;
    } else if (t.name === "UpdateDayNightCycle") {
      this.dayNightCycle = t.response;
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

    listen("client-spawn-alt", (event) => {
      const active = this.activeInstance;
      if (active) {
        const name = (event.payload && event.payload.name) || active.name;
        const serverData = (event.payload && event.payload.serverData) || active.serverData;
        const partyKey = (event.payload && typeof event.payload.partyKey === "string") ? event.payload.partyKey : active.partyKey;
        this.createInstance(name, partyKey, serverData);
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

      // Re-emit all recorded RPC states
      if (newInstance.toolInfo) {
        this.game.eventEmitter.emit("ToolInfoRpcReceived", newInstance.toolInfo);
      }
      if (newInstance.buildingInfo) {
        this.game.eventEmitter.emit("BuildingInfoRpcReceived", newInstance.buildingInfo);
      }
      if (newInstance.spellInfo) {
        this.game.eventEmitter.emit("SpellInfoRpcReceived", newInstance.spellInfo);
      }
      if (newInstance.entityData) {
        this.game.eventEmitter.emit("EntityDataRpcReceived", newInstance.entityData);
      }
      if (newInstance.tickRate) {
        this.game.eventEmitter.emit("SetTickRateRpcReceived", newInstance.tickRate);
      }
      if (newInstance.dayNightCycle) {
        this.game.eventEmitter.emit("UpdateDayNightCycleRpcReceived", newInstance.dayNightCycle);
      }
      if (newInstance.partyKey) {
        this.game.eventEmitter.emit("PartyKeyRpcReceived", { partyKey: newInstance.partyKey });
      }
      if (newInstance.partyMembers && newInstance.partyMembers.length > 0) {
        this.game.eventEmitter.emit("PartyMembersUpdatedRpcReceived", newInstance.partyMembers);
      }
      if (Object.keys(newInstance.partyBuildings).length > 0) {
        this.game.eventEmitter.emit("PartyBuildingRpcReceived", Object.values(newInstance.partyBuildings));
      }
      for (const req of Object.values(newInstance.partyRequests)) {
        this.game.eventEmitter.emit("PartyRequestRpcReceived", req);
      }
      if (newInstance.openParties && newInstance.openParties.length > 0) {
        this.game.eventEmitter.emit("UpdatePartyRpcReceived", newInstance.openParties);
      }
      if (newInstance.leaderboard && newInstance.leaderboard.length > 0) {
        this.game.eventEmitter.emit("UpdateLeaderboardRpcReceived", newInstance.leaderboard);
      }
      if (newInstance.savedTools) {
        this.game.eventEmitter.emit("SetToolRpcReceived", newInstance.savedTools);
      }

      // Handle death state
      if (newInstance.isDead) {
        this.game.eventEmitter.emit("DeadRpcReceived", newInstance.deadData);
      } else {
        this.game.eventEmitter.emit("RespawnedRpcReceived");
      }

      // Re-emit chat history
      for (const msg of newInstance.chatHistory) {
        this.game.eventEmitter.emit("ReceiveChatMessageRpcReceived", msg);
      }

      // Sync active/disabled spells
      if (oldInstance) {
        for (const spellName of Object.keys(oldInstance.disabledSpells)) {
          this.game.eventEmitter.emit("ClearActiveSpellRpcReceived", { name: spellName });
        }
      }
      for (const spell of Object.values(newInstance.disabledSpells)) {
        this.game.eventEmitter.emit("CastSpellResponseRpcReceived", spell);
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
    // throttling the unenforced broadcasts at 1s
    // unsure if i want to add an option for this in the future
    const now = Date.now();
    if (now - this.lastBroadcast < 1000 && !force) return;
    this.lastBroadcast = now;

    try {
      const appWindow = getCurrentWindow();
      const isHostVisible = await appWindow.isVisible();

      const serialized = Object.values(this.instances).map(inst => {
        const playerScore = inst.leaderboard?.find(p => p.uid === inst.enterWorldData?.uid)?.score;
        const scoreVal = playerScore ? (typeof playerScore.toNumber === "function" ? playerScore.toNumber() : Number(playerScore)) : 0;
        return {
          id: inst.id,
          name: inst.name,
          connected: inst.connected,
          connecting: inst.connecting,
          ping: inst.ping,
          serverData: inst.serverData,
          partyKey: inst.partyKey,
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
            score: scoreVal,
          } : null
        };
      });

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
