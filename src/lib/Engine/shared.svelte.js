import { RuneStore } from "@tauri-store/svelte";

export let gameOptions = new RuneStore(
  "intro-config",
  {
    mode: "standard",
    psk: "",
    playerName: "",
    selectedServer: "v01001",

    savedNames: [],

    needsRestart: {
      "Enable Antialiasing": true,
      "Enable Low Resolution": false,
    },
  },
  { saveOnChange: true },
);

export let gameSettings = new RuneStore(
  "game-settings",
  {
    deleteOldChat: false,
    specialEffects: true,
  },
  { saveOnChange: true },
);

export let psk = $state({ value: "" });
