import { EventEmitter } from "events";
// import DiscordRichPresence from "discord-rich-presence";

import { check } from "@tauri-apps/plugin-updater";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";

// import { DISCORD_APP_ID } from "$lib/id.json";
import UI from "$lib/Components/UI/UI.svelte.js";
import Renderer from "./Renderer/Renderer.svelte.js";
import Network from "./Network/Network.svelte.js";
import Util from "./Util.svelte.js";
import InputPacketManager from "./InputPacketManager.svelte.js";
import EntityModels from "$lib/Models/EntityModels.js";

export default new (class {
  constructor() {
    this.ui = new UI(this);
    this.network = new Network(this);
    this.renderer = new Renderer(this);

    this.util = new Util(this);

    this.inputPacketManager = new InputPacketManager(this);

    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(100);

    // this.discord = DiscordRichPresence(DISCORD_APP_ID);
    this.pools = new Map();
  }
  async checkForAppUpdates() {
    const update = await check();

    if (update) {
      const yes = await ask(`
          ${update.version} now is available!
          Release notes: ${update.body}
        `,
        {
          title: "New Update",
          kind: "info",
          okLabel: "Update",
          cancelLabel: "Cancel",
        }
      );

      if (yes) {
        await update.downloadAndInstall();
        await relaunch();
      }
    }
  }
  async init() {
    await this.checkForAppUpdates();

    await this.renderer.init();
    this.ui.init();
    this.network.init();

    this.inputPacketManager.init();

    /*
    this.discord.updatePresence({
      state: "zamb bee ahh dot eye ohh",
      details: "on a tauri client",
      startTimestamp: Date.now(),
      instance: true,
    });
    */
  }
  getInWorld() {
    return this.network.connected;
  }
  getPool(ModelClass, args) {
    if (!this.pools.has(ModelClass)) {
      this.pools.set(ModelClass, new Map());
    }
    const subMap = this.pools.get(ModelClass);
    const variantKey = args?.projectileKind || "default";
    if (!subMap.has(variantKey)) {
      subMap.set(variantKey, []);
    }
    return subMap.get(variantKey);
  }
  poolModel(ModelClass, args, amount) {
    const pool = this.getPool(ModelClass, args);
    for (let i = 0; i < amount; i++) {
      const instance = new ModelClass(this, args);
      instance.savedAttachments = instance.attachments;
      instance.attachments = [];
      pool.push(instance);
    }
    console.log(`Initialized dynamic projectile pool for ${ModelClass.name} (${amount} instances).`);
  }
  initializePools() {
    const kinds = ["Mage", "Arrow", "Cannon"];
    for (const kind of kinds) {
      this.poolModel(EntityModels.Projectile, { projectileKind: kind }, 50);
    }
    this.poolModel(EntityModels.RocketProjectile, { tier: 1 }, 50);
  }
})();
