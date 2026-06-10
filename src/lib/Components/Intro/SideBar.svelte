<script>
    import servers from "$lib/Assets/servers.json";
    import { gameOptions, psk } from "$lib/Engine/shared.svelte.js";

    const descriptionForModes = {
        standard:
            "Collect resources to build a base to defend against neverending zombies!",
        scarcity:
            "Start with a huge number of resources without being able to earn any more. PvP is disabled. Survive as long as you can!",
    };

    const sortedServers = {};
    for (const server of servers) {
        sortedServers[server.gameMode] ||= {};
        sortedServers[server.gameMode][server.country] ||= {};
        sortedServers[server.gameMode][server.country][server.id] = server;
    }

    $effect(() => {
        let mode = gameOptions.state.mode;
        if (!sortedServers[mode]) {
            mode = Object.keys(sortedServers)[0] || "standard";
            gameOptions.state.mode = mode;
        }
        const regionObj = sortedServers[mode];
        if (regionObj) {
            const firstRegion = Object.keys(regionObj)[0];
            if (firstRegion) {
                const firstId = Object.keys(regionObj[firstRegion])[0];
                gameOptions.state.selectedServer = firstId;
            }
        }
    });
</script>

<div
    class="flex flex-col justify-between items-start hud-intro-sidebar max-w-48 bg-black/40 p-3"
>
    <div class="hud-intro-modes">
        <h2>Game Modes</h2>
        <div class="relative flex flex-row w-full h-fit mb-2">
            <select
                class="hud-intro-gamemode flex-1 h-10 appearance-none p-2 pr-10 text-white text-xs bg-black/30 rounded-sm placeholder:text-white/30"
                bind:value={gameOptions.state.mode}
            >
                {#each Object.keys(sortedServers) as mode}
                    <option value={mode}
                        >{mode.charAt(0).toUpperCase() + mode.slice(1)}</option
                    >
                {/each}
            </select>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-4 h-4 absolute bottom-3 right-3 text-white/40 pointer-events-none">
                <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
        </div>
        <span class="hidden md:block text-white/50 text-xs"
            >{descriptionForModes[gameOptions.state.mode]}</span
        >
    </div>
    <div class="hud-intro-main">
        <h2>Game Options</h2>
        <div class="flex flex-row w-full mb-2">
            <input
                type="text"
                class="hud-intro-name flex-1 min-w-0 h-10 appearance-none p-2 text-white text-xs bg-black/30 rounded-l-sm placeholder:text-white/30"
                autocomplete="username"
                placeholder="Player name..."
                bind:value={gameOptions.state.playerName}
            />
            <div class="relative w-10! h-10">
                <select
                    bind:value={gameOptions.state.playerName}
                    class="border-l-2 border-l-white/10 w-10 h-10 text-transparent bg-black/30 rounded-r-sm appearance-none"
                >
                    {#each Object.keys(gameOptions.state.savedNames) as i}
                        {@const name = gameOptions.state.savedNames[i]}
                        <option selected={name === gameOptions.state.playerName} value={name}>{name}</option>
                    {:else}
                        <option disabled value="">No saved names found...</option>
                    {/each}
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-4 h-4 absolute bottom-3 right-3 text-white/40 pointer-events-none">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
            </div>
        </div>
        <div class="relative flex flex-row w-full h-fit mb-2">
            <select
                class="hud-intro-servers flex-1 h-10 appearance-none p-2 pr-10 text-white text-xs bg-black/30 rounded-sm placeholder:text-white/30"
                bind:value={gameOptions.state.selectedServer}
            >
                {#each Object.entries(sortedServers) as [mode, countries]}
                    {#if gameOptions.state.mode == mode}
                        {#each Object.entries(countries) as [country, servers]}
                            <optgroup label={country}>
                                {#each Object.entries(servers) as [id, server], index}
                                    <option value={id}
                                        >{server.city} #{index + 1}</option
                                    >
                                {/each}
                            </optgroup>
                        {/each}
                    {/if}
                {/each}
            </select>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-4 h-4 absolute bottom-3 right-3 text-white/40 pointer-events-none">
                <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
        </div>
        <input
            type="text"
            class="hud-intro-invite w-full h-10 appearance-none mb-2 p-2 text-white text-xs bg-black/30 rounded-sm placeholder:text-white/30"
            placeholder="Invite link..."
            bind:value={psk.value}
        />
    </div>
    <div class="hud-intro-settings">
        <h2>Settings</h2>
        {#each Object.keys(gameOptions.state.needsRestart) as setting}
            <div class="relative first:-mt-2">
                <input
                    type="checkbox"
                    onchange={() => { location.reload(); }}
                    bind:checked={gameOptions.state.needsRestart[setting]}
                />
                <span class="text-white ml-1 text-xs">{setting}</span>
            </div>
        {/each}
    </div>
</div>

<style lang="postcss">
    @reference "tailwindcss/theme";

    @media only screen and (hover: none) {
    }

    div {
        @apply w-full;
    }
    h2 {
        @apply first:mb-4 relative text-xl font-bold text-white after:absolute after:-bottom-1 after:left-0 after:border after:border-white/30 after:w-12;
    }
</style>
