<script>
    import { onMount } from "svelte";
    import { emit, listen } from "@tauri-apps/api/event";
    import servers from "$lib/Assets/servers.json";

    const sortedServers = {};
    for (const server of servers) {
        sortedServers[server.gameMode] ||= {};
        sortedServers[server.gameMode][server.country] ||= {};
        sortedServers[server.gameMode][server.country][server.id] = server;
    }

    let instances = $state([]);
    let activeInstanceId = $state(null);
    let partyShareKey = $state("");
    let isHostVisible = $state(true);

    let customName = $state("");
    let isEditingName = $state(false);
    let isEditingPsk = $state(false);
    let isPskModified = $state(false);
    let selectedMode = $state("standard");
    let selectedServerId = $state(servers[0]?.id || "");
    let hasInitializedServer = false;

    // Automatically align selected server with mode changes
    $effect(() => {
        const regionObj = sortedServers[selectedMode];
        if (regionObj) {
            const currentSelectedServer = servers.find(s => s.id === selectedServerId);
            if (!currentSelectedServer || currentSelectedServer.gameMode !== selectedMode) {
                const firstRegion = Object.keys(regionObj)[0];
                if (firstRegion) {
                    const firstId = Object.keys(regionObj[firstRegion])[0];
                    selectedServerId = firstId;
                }
            }
        }
    });

    let defaultInstanceName = $derived(instances.find(i => i.id === activeInstanceId)?.name || 'Player');
    let displayName = $derived(customName.trim() || defaultInstanceName);

    onMount(() => {
        // Request initial state from host
        emit("client-ready");

        // Listen for updates from host
        const unlistenPromise = listen("host-instances-update", (event) => {
            const payload = event.payload;
            instances = payload.instances || [];
            activeInstanceId = payload.activeInstanceId;

            const mainInstance = instances.find(i => i.id === "main");
            const mainPsk = mainInstance?.partyKey || "";
            if (!isPskModified) {
                partyShareKey = mainPsk;
            }

            isHostVisible = payload.isHostVisible !== false;

            if (!hasInitializedServer && instances.length > 0) {
                const activeInst = instances.find(i => i.id === activeInstanceId);
                if (activeInst && activeInst.serverData) {
                    selectedMode = activeInst.serverData.gameMode || "standard";
                    selectedServerId = activeInst.serverData.id;
                    hasInitializedServer = true;
                }
            }
        });

        return () => {
            unlistenPromise.then((unlisten) => unlisten());
        };
    });

    function toggleClientVisibility() {
        emit("client-toggle-visibility");
    }

    function spawnAlt() {
        const selectedServer = servers.find(s => s.id === selectedServerId);
        emit("client-spawn-alt", {
            name: displayName,
            partyKey: partyShareKey,
            serverData: selectedServer
        });
    }

    function switchControl(id) {
        emit("client-switch-control", { id });
    }

    function disconnectInstance(id) {
        if (instances.length <= 1) return;
        emit("client-disconnect-alt", { id });
    }

    function focusInput(node) {
        node.focus();
        node.select();
    }

    function startEditing() {
        if (!customName) {
            customName = defaultInstanceName;
        }
        isEditingName = true;
    }

    function saveName() {
        isEditingName = false;
        customName = customName.trim();
    }

    function cancelEditing() {
        isEditingName = false;
    }

    function handleKeyDown(event) {
        if (event.key === "Enter") {
            saveName();
        } else if (event.key === "Escape") {
            cancelEditing();
        }
    }

    function startEditingPsk() {
        isEditingPsk = true;
    }

    function savePsk() {
        isEditingPsk = false;
        partyShareKey = partyShareKey.trim();
    }

    function cancelEditingPsk() {
        isEditingPsk = false;
    }

    function handlePskKeyDown(event) {
        if (event.key === "Enter") {
            savePsk();
        } else if (event.key === "Escape") {
            cancelEditingPsk();
        }
    }

    function truncate(t, e) {
      const r = ["K", "M", "B", "T", "q", "Q", "s", "S", "O", "N", "D"];
      e = Math.pow(10, e);
      for (let n = r.length - 1; n >= 0; n--) {
        const i = Math.pow(10, 3 * (n + 1));
        if (i <= t) {
          if (1e3 == (t = Math.round((t * e) / i) / e) && n < r.length - 1) {
            t = 1;
            n++;
          }
          t += r[n];
          break;
        }
      }
      return t;
    }
</script>

<div class="flex flex-col overflow-hidden select-none w-screen h-screen">
    <!-- Header -->
    <div class="flex flex-row justify-between items-center w-full bg-black/40 p-4 shrink-0">
        <div class="flex flex-col">
            <h2 class="text-base font-bold text-white">Instances</h2>
            <span class="text-xs text-white/50">{instances.length} active connection{instances.length === 1 ? '' : 's'}</span>
        </div>
        <button
            onclick={toggleClientVisibility}
            class="p-1.5 px-3 rounded text-[10px] text-white transition cursor-pointer hover:brightness-125 {isHostVisible ? 'bg-accent-red' : 'bg-accent-green'}"
        >
            {isHostVisible ? "Hide" : "Show"} Main Window
        </button>
    </div>
    <div class="instances-container flex-1 min-h-0 flex flex-col p-4 text-white font-sans">
        <!-- Alt Spawner Form -->
        <div class="flex flex-row items-center justify-between p-3 rounded bg-black/40 mb-4 shrink-0">
            <div class="flex flex-col gap-0.5 max-w-[65%]">
                <span class="text-[10px] text-white/50 uppercase font-semibold">Configuration</span>
                <div class="flex items-center gap-1.5 mt-0.5 group w-max">
                    {#if isEditingName}
                        <input
                            type="text"
                            bind:value={customName}
                            use:focusInput
                            onkeydown={handleKeyDown}
                            onblur={saveName}
                            class="border border-white/20 rounded px-2 py-0.5 text-xs text-white focus:outline-none max-w-37.5 transition-colors"
                            placeholder={defaultInstanceName}
                        />
                        <button
                            onclick={saveName}
                            class="p-1 rounded text-accent-green hover:bg-white/5 transition cursor-pointer"
                            title="Save name"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                        </button>
                    {:else}
                        <strong class="text-xs text-white truncate max-w-40">
                            {displayName}
                        </strong>
                        <button
                            onclick={startEditing}
                            class="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 transition opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                            title="Edit instance name"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.013a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                            </svg>
                        </button>
                    {/if}
                </div>
                <div class="flex items-center gap-1.5 group w-max">
                    {#if isEditingPsk}
                        <input
                            type="text"
                            bind:value={partyShareKey}
                            oninput={() => isPskModified = true}
                            use:focusInput
                            onkeydown={handlePskKeyDown}
                            onblur={savePsk}
                            class="border border-white/20 rounded px-2 py-0.5 text-xs text-white focus:outline-none max-w-37.5 transition-colors"
                            placeholder="Party PSK"
                        />
                        <button
                            onclick={savePsk}
                            class="p-1 rounded text-accent-green hover:bg-white/5 transition cursor-pointer"
                            title="Save party key"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                        </button>
                    {:else}
                        <span class="text-xs text-white/70 truncate max-w-40 font-medium {partyShareKey ? '' : 'italic text-white/40'}">
                            {partyShareKey || "No Party Key"}
                        </span>

                        <button
                            onclick={startEditingPsk}
                            class="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 transition opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                            title="Edit party key"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.013a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                            </svg>
                        </button>

                        {#if isPskModified && partyShareKey !== (instances.find(i => i.id === 'main')?.partyKey || '')}
                            <button
                                onclick={() => {
                                    const mainInst = instances.find(i => i.id === 'main');
                                    partyShareKey = mainInst?.partyKey || '';
                                    isPskModified = false;
                                }}
                                class="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 transition cursor-pointer"
                                title="Reset to main window's PSK"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            </button>
                        {/if}
                    {/if}
                </div>
                <div class="flex flex-row flex-wrap gap-1.5 mt-1">
                    <div class="relative w-max flex items-center select-none">
                        <select
                            bind:value={selectedMode}
                            class="text-xs pl-2 pr-5 py-1 rounded-sm w-max transition cursor-pointer hover:brightness-125 bg-white/10 text-white/70 focus:outline-none appearance-none"
                            title="Select game mode"
                        >
                            {#each Object.keys(sortedServers) as mode}
                                <option value={mode} class="bg-zinc-950 text-white text-[10px]">
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </option>
                            {/each}
                        </select>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-2 h-2 absolute right-1.5 text-white/40 pointer-events-none">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                    </div>

                    <div class="relative w-max flex items-center select-none">
                        <select
                            bind:value={selectedServerId}
                            class="text-xs pl-2 pr-5 py-1 rounded-sm w-max transition cursor-pointer hover:brightness-125 bg-white/10 text-white/70 focus:outline-none appearance-none"
                            title="Select server for new instance"
                        >
                            {#each Object.entries(sortedServers) as [mode, countries]}
                                {#if selectedMode === mode}
                                    {#each Object.entries(countries) as [country, servers]}
                                        <optgroup label={country} class="bg-zinc-950 text-white/50 text-[9px] font-bold">
                                            {#each Object.entries(servers) as [id, server], index}
                                                <option value={id} class="bg-zinc-950 text-white text-[10px]">
                                                    {country} - {server.city} #{index + 1}
                                                </option>
                                            {/each}
                                        </optgroup>
                                    {/each}
                                {/if}
                            {/each}
                        </select>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-2 h-2 absolute right-1.5 text-white/40 pointer-events-none">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                    </div>
                </div>
            </div>
            <button
                onclick={spawnAlt}
                class="p-2 pl-4 pr-4 rounded text-white text-xs bg-accent-green transition hover:brightness-125 cursor-pointer"
            >
                New Instance
            </button>
        </div>

        <!-- Instances List -->
        <div class="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
            {#each instances as inst (inst.id)}
                {@const isCurrent = activeInstanceId === inst.id}
                {@const stats = inst.stats || {}}
                <div
                    class="{isCurrent ? 'border-l-2 border-l-accent-green rounded-tr-sm rounded-br-sm' : 'rounded-sm'} flex flex-col gap-2.5 p-3 bg-black/20 transition"
                >
                    <div class="flex flex-row justify-between items-center">
                        <div class="flex items-center gap-2">
                            <!--
                            <span class="relative flex h-2.5 w-2.5">
                                {#if inst.connected}
                                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                {:else if inst.connecting}
                                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                {:else}
                                    <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                                {/if}
                            </span>
                            -->
                            <strong class="text-xs text-white font-bold">{inst.name}</strong>
                            <span class="text-[10px] text-white/50">{inst.serverData?.country || 'Country'} - {inst.serverData?.gameMode || 'mode'} ({inst.serverData?.id || 'ID'})</span>
                        </div>
                        <div class="flex items-center gap-2">
                            {#if inst.connected}
                                <span class="text-[10px] text-white/60">{inst.ping !== undefined ? `${inst.ping}ms` : 'Calculating ping...'}</span>
                            {/if}
                        </div>
                    </div>

                    <!-- Stats Row -->
                    {#if inst.connected}
                        {#if stats.health !== undefined}
                            <div class="flex flex-row gap-3 w-full text-[11px] text-white/80">
                                <!-- Left Card: Health, Wave, Score -->
                                <div class="flex-1 bg-black/20 border border-white/5 rounded-sm p-3 flex flex-col justify-between min-h-[105px]">
                                    <!-- Health Section -->
                                    <div class="flex flex-col gap-1 w-full">
                                        <span class="text-[9px] text-white/40 font-bold uppercase">Health</span>
                                        <div class="w-full h-1.5 bg-black/45 rounded-sm overflow-hidden border border-white/5 shadow-inner">
                                            <div class="bg-accent-green h-full rounded-sm transition-all duration-300" style="width: {(stats.health / stats.maxHealth) * 100}%"></div>
                                        </div>

                                        <!-- Shield Bar (if active) -->
                                        {#if stats.zombieShieldHealth}
                                            <div class="w-full h-1 bg-black/45 rounded-sm overflow-hidden border border-white/5 shadow-inner mt-1">
                                                <div class="bg-accent-blue h-full rounded-sm transition-all duration-300" style="width: {(stats.zombieShieldHealth / stats.zombieShieldMaxHealth) * 100}%"></div>
                                            </div>
                                        {/if}
                                    </div>

                                    <!-- Wave & Score section -->
                                    <div class="flex flex-row justify-between items-center mt-3 pt-2 border-t border-white/5">
                                        <div class="flex flex-col">
                                            <span class="text-[8px] text-white/40 font-bold uppercase">Wave</span>
                                            <span class="text-sm font-bold text-white">{stats.wave}</span>
                                        </div>
                                        <div class="flex flex-col items-end">
                                            <span class="text-[8px] text-white/40 font-bold uppercase">Score</span>
                                            <span class="text-sm font-bold text-white">{stats.score.toLocaleString() || 0}</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Right Column: Resources & Buttons -->
                                <div class="flex-1 flex flex-col gap-2">
                                    <!-- Resources Card -->
                                    <div class="flex-1 bg-black/20 border border-white/5 rounded-sm p-3 flex items-center justify-center min-h-[70px]">
                                        <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 w-full">
                                            <!-- Wood -->
                                            <div class="flex items-center gap-1.5">
                                                <img src="/images/Ui/Icons/Resources/Tree1.svg" alt="Wood" class="w-4 h-4 object-contain" />
                                                <span class="font-bold text-[11px] text-white/95">{stats.wood >= 1e4 ? truncate(stats.wood, 2) : stats.wood || 0}</span>
                                            </div>
                                            <!-- Stone -->
                                            <div class="flex items-center gap-1.5">
                                                <img src="/images/Ui/Icons/Resources/Stone1.svg" alt="Stone" class="w-4 h-4 object-contain" />
                                                <span class="font-bold text-[11px] text-white/95">{stats.stone >= 1e4 ? truncate(stats.stone, 2) : stats.stone || 0}</span>
                                            </div>
                                            <!-- Gold -->
                                            <div class="flex items-center gap-1.5">
                                                <img src="/images/Ui/Icons/Resources/Gold1.svg" alt="Gold" class="w-4 h-4 object-contain" />
                                                <span class="font-bold text-[11px] text-white/95">{stats.gold >= 1e4 ? truncate(stats.gold, 2) : stats.gold || 0}</span>
                                            </div>
                                            <!-- Tokens -->
                                            <div class="flex items-center gap-1.5">
                                                <img src="/images/Ui/Icons/Resources/Token1.svg" alt="Tokens" class="w-4 h-4 object-contain" />
                                                <span class="font-bold text-[11px] text-white/95">{stats.tokens >= 1e4 ? truncate(stats.tokens, 2) : stats.tokens || 0}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Actions Row -->
                                    <div class="flex flex-row gap-2 shrink-0">
                                        <button
                                            disabled={instances.length <= 1}
                                            onclick={() => disconnectInstance(inst.id)}
                                            class="flex-1 py-1.5 rounded-sm text-xs font-bold text-white text-center cursor-pointer transition bg-accent-red hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                                        >
                                            Disconnect
                                        </button>
                                        {#if !isCurrent}
                                            <button
                                                onclick={() => switchControl(inst.id)}
                                                class="flex-1 py-1.5 rounded-sm text-xs font-bold text-white text-center cursor-pointer transition bg-accent-green hover:brightness-125"
                                            >
                                                Control
                                            </button>
                                        {:else}
                                            <button
                                                disabled
                                                class="flex-1 py-1.5 rounded-sm text-xs font-bold text-white text-center transition bg-accent-green opacity-50"
                                            >
                                                Active
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div class="text-xs p-3 bg-black/20 rounded-sm border border-white/5 text-center">
                                Syncing player data...
                            </div>
                        {/if}
                    {:else if inst.connecting}
                        <div class="text-xs text-white/60 p-3 bg-black/20 rounded-sm border border-white/5 text-center">
                            Connecting to game server...
                        </div>
                    {:else}
                        <div class="text-xs text-accent-red p-3 bg-black/20 rounded-sm border border-white/5 text-center">
                            Connection offline.
                        </div>
                    {/if}

                    <!-- Actions Row (Fallback/Syncing/Offline only) -->
                    {#if !inst.connected || stats.health === undefined}
                        <div class="flex flex-row gap-2 justify-end shrink-0">
                            {#if !isCurrent}
                                <button
                                    onclick={() => switchControl(inst.id)}
                                    class="text-[10px] p-1 px-3 rounded bg-accent-green hover:brightness-125 text-white transition cursor-pointer"
                                >
                                    Control
                                </button>
                            {/if}
                            <button
                                disabled={instances.length <= 1}
                                onclick={() => disconnectInstance(inst.id)}
                                class="text-[10px] p-1 px-3 rounded bg-accent-red hover:brightness-125 text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100"
                            >
                                Disconnect
                            </button>
                        </div>
                    {/if}
                </div>
            {:else}
                <div class="flex-1 flex items-center justify-center rounded-sm bg-black/20 p-4 text-center text-xs text-white/70 italic">
                    No active connection sessions.
                </div>
            {/each}
        </div>
    </div>
</div>

<style lang="postcss">
    @reference "../../app.css";

    :global(body) {
        margin: 0;
        overflow: hidden;
    }

    button {
        font-family: "Hammersmith One", sans-serif;
    }

    @keyframes moveBackground {
        0% {
            background-position: 0 0;
        }
        100% {
            background-position: 0 -24px;
        }
    }

    .instances-container {
        position: relative;
    }

    .instances-container::before {
        content: " ";
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        background-image: url("/images/Map/Grass.svg");
        background-repeat: repeat;
        background-size: 24px;
        z-index: -10;
        animation: moveBackground 1s linear infinite;
    }

    .instances-container::after {
        content: " ";
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        background-color: rgba(9, 9, 11, 0.6);
        z-index: -9;
    }
</style>
