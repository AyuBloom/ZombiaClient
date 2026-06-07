import { RuneStore } from "@tauri-store/svelte";

export let gameOptions = new RuneStore("intro-config", {
  mode: "standard",
  psk: "",
  playerName: "",
  selectedServer: "v01001",

  needsRestart: {
    "Enable Antialiasing": true,
    "Enable Low Resolution": false,
  },
});

export let gameSettings = new RuneStore("game-settings", {
  deleteOldChat: false,
  specialEffects: true,
});

export let psk = $state({ value: "" });
