<script>
    import { onMount } from "svelte";
    import { emit, listen } from "@tauri-apps/api/event";

    let instances = $state([]);
    let activeInstanceId = $state(null);
    let partyShareKey = $state("");
    let isHostVisible = $state(true);

    onMount(() => {
        // Request initial state from host
        emit("client-ready");

        // Listen for updates from host
        const unlistenPromise = listen("host-instances-update", (event) => {
            const payload = event.payload;
            instances = payload.instances || [];
            activeInstanceId = payload.activeInstanceId;
            partyShareKey = payload.partyShareKey || "";
            isHostVisible = payload.isHostVisible !== false;
        });

        return () => {
            unlistenPromise.then((unlisten) => unlisten());
        };
    });

    function toggleClientVisibility() {
        emit("client-toggle-visibility");
    }

    function spawnAlt() {
        emit("client-spawn-alt");
    }

    function switchControl(id) {
        emit("client-switch-control", { id });
    }

    function disconnectInstance(id) {
        emit("client-disconnect-alt", { id });
    }
</script>

<div class="flex flex-col w-screen h-screen p-4 bg-zinc-950 text-white select-none overflow-hidden font-sans">
    <!-- Header -->
    <div class="flex flex-row justify-between items-center border-b border-white/10 pb-3 mb-4 shrink-0">
        <div class="flex flex-col">
            <h2 class="text-base font-bold tracking-tight text-white">Your Session Instances</h2>
            <span class="text-[10px] text-white/50">{instances.length} active connection{instances.length === 1 ? '' : 's'}</span>
        </div>
        <button
            onclick={toggleClientVisibility}
            class="p-1.5 px-3 rounded text-[10px] font-semibold text-white transition cursor-pointer {isHostVisible ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-emerald-600 hover:bg-emerald-500 animate-pulse'}"
        >
            {isHostVisible ? "🔌 Hide Client (Save GPU)" : "🔌 Show Client Window"}
        </button>
    </div>

    <!-- Alt Spawner Form -->
    <div class="flex flex-row items-center justify-between p-3 rounded bg-white/5 border border-white/10 mb-4 shrink-0">
        <div class="flex flex-col gap-0.5">
            <span class="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Create an alternate session</span>
            <strong class="text-xs text-white">
                Name: {instances.find(i => i.id === activeInstanceId)?.name || 'Player'}
            </strong>
            {#if partyShareKey}
                <span class="text-[9px] text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded-full w-max mt-1 font-bold tracking-wide">Auto-joins Party</span>
            {/if}
        </div>
        <button
            onclick={spawnAlt}
            class="p-2 pl-4 pr-4 rounded text-white text-xs font-semibold bg-accent-green transition hover:brightness-125 cursor-pointer"
        >
            + Spawn Alt
        </button>
    </div>

    <!-- Instances List -->
    <div class="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
        {#each instances as inst (inst.id)}
            {@const isCurrent = activeInstanceId === inst.id}
            {@const stats = inst.stats || {}}
            <div
                class="{isCurrent ? 'border-accent-green bg-white/15' : 'border-white/5 bg-white/10'} flex flex-col gap-2.5 p-3 rounded border shadow-md transition hover:bg-white/15"
            >
                <div class="flex flex-row justify-between items-center">
                    <div class="flex items-center gap-2">
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
                        <strong class="text-xs text-white font-bold">{inst.name}</strong>
                        <span class="text-[10px] text-white/50">({inst.serverData?.country || 'Server'} - {inst.serverData?.gameMode || 'mode'})</span>
                    </div>
                    <div class="flex items-center gap-2">
                        {#if inst.connected}
                            <span class="text-[10px] text-white/60">{inst.ping !== undefined ? `${inst.ping}ms` : 'Calculating ping...'}</span>
                        {/if}
                        {#if isCurrent}
                            <span class="text-[9px] bg-accent-green/20 text-accent-green px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Control</span>
                        {/if}
                    </div>
                </div>

                <!-- Stats Row -->
                {#if inst.connected}
                    {#if stats.health !== undefined}
                        <div class="grid grid-cols-2 gap-2 text-[11px] text-white/80 bg-black/35 p-2.5 rounded border border-white/5">
                            <!-- Health Bar -->
                            <div class="col-span-2 flex flex-col gap-1 mb-1">
                                <div class="flex justify-between text-[9px] text-white/70">
                                    <span class="font-medium">HP: {stats.health} / {stats.maxHealth}</span>
                                    {#if stats.zombieShieldHealth}
                                        <span class="text-blue-300 font-medium">Shield: {stats.zombieShieldHealth}</span>
                                    {/if}
                                </div>
                                <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden flex">
                                    <div class="bg-red-500 h-full transition-all duration-300" style="width: {(stats.health / stats.maxHealth) * 100}%"></div>
                                    {#if stats.zombieShieldHealth}
                                        <div class="bg-blue-400 h-full transition-all duration-300" style="width: {(stats.zombieShieldHealth / stats.zombieShieldMaxHealth) * 100}%"></div>
                                    {/if}
                                </div>
                            </div>

                            <!-- Resources -->
                            <div class="flex items-center gap-1.5">
                                <span class="text-[10px] opacity-75">🪵 Wood:</span>
                                <span class="font-bold text-amber-200">{stats.wood || 0}</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <span class="text-[10px] opacity-75">🪨 Stone:</span>
                                <span class="font-bold text-slate-300">{stats.stone || 0}</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <span class="text-[10px] opacity-75">🪙 Gold:</span>
                                <span class="font-bold text-yellow-300">{stats.gold || 0}</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <span class="text-[10px] opacity-75">💎 Tokens:</span>
                                <span class="font-bold text-teal-300">{stats.tokens || 0}</span>
                            </div>
                            {#if stats.wave !== undefined}
                                <div class="col-span-2 text-[9px] opacity-60 mt-1 flex items-center gap-1">
                                    <span>🌊</span>
                                    <span>Wave {stats.wave}</span>
                                </div>
                            {/if}
                        </div>
                    {:else}
                        <div class="text-[11px] text-emerald-400 italic p-3 bg-black/25 rounded border border-white/5 text-center font-medium">
                            Syncing player data...
                        </div>
                    {/if}
                {:else if inst.connecting}
                    <div class="text-[11px] text-white/60 italic p-3 bg-black/25 rounded border border-white/5 text-center font-medium">
                        Connecting to game server...
                    </div>
                {:else}
                    <div class="text-[11px] text-rose-400 italic p-3 bg-black/25 rounded border border-white/5 text-center font-medium">
                        Connection offline.
                    </div>
                {/if}

                <!-- Actions Row -->
                <div class="flex flex-row gap-2 justify-end shrink-0">
                    {#if !isCurrent}
                        <button
                            onclick={() => switchControl(inst.id)}
                            class="text-[10px] p-1 px-3 rounded bg-accent-green hover:brightness-125 text-white transition font-semibold cursor-pointer"
                        >
                            Control
                        </button>
                    {/if}
                    <button
                        onclick={() => disconnectInstance(inst.id)}
                        class="text-[10px] p-1 px-3 rounded bg-accent-red hover:brightness-125 text-white transition font-semibold cursor-pointer"
                    >
                        {inst.id === 'main' ? 'Leave' : 'Disconnect'}
                    </button>
                </div>
            </div>
        {:else}
            <div class="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded bg-white/5 p-4 text-center text-xs text-white/40 italic">
                No active connection sessions.
            </div>
        {/each}
    </div>
</div>

<style lang="postcss">
    @reference "../../app.css";

    :global(body) {
        margin: 0;
        background-color: #09090b;
        overflow: hidden;
    }
</style>
