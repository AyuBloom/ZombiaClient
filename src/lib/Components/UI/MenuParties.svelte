<script>
    let { game } = $props();

    let tabs = ["Your Party", "Open Parties", "Your Instances"];
    let currentTab = $state(tabs[0]);

    let parties = $state({});
    let currentParty = $state({});

    let partyMembers = $state({}); // $derived(game.ui.playerPartyMembers);
    let partyName = $state("");
    let partyShareKey = $state("");
    let partyLeader = $derived(partyMembers.find((t) => true === t.isLeader).uid);

    let isPlayerLeader = $derived(partyLeader == game.ui.playerTick?.uid);
    let isRequesting = $state(null);

    $effect(() => {
        game.network?.connected &&
            game.network.sendRpc({ name: "SetPartyName", partyName: partyName });
    });

    game.eventEmitter.on("UpdatePartyRpcReceived", (t) => {
        let currentParties = {};
        for (let r in t) {
            currentParties[t[r].partyId] = t[r];
        }
        parties = currentParties;
        currentParty = currentParties[game.ui.playerTick?.partyId];
    });
    game.eventEmitter.on("PartyMembersUpdatedRpcReceived", (t) => {
        partyMembers = t;
    });
    game.eventEmitter.on("PartyRequestMetRpcReceived", () => {
        isRequesting = null;
    });
    game.eventEmitter.on("PartyKeyRpcReceived", (t) => {
        partyShareKey = t.partyKey;
    });
</script>

{#snippet Tabs()}
    <div>
        {#each tabs as tab}
            <button
                class="{currentTab == tab
                    ? 'active'
                    : ''} bg-black/40 text-white/70 text-xs text-center p-2 pl-3 pr-3 transition first:rounded-tl-md last:rounded-tr-md hover:bg-black/20"
                onclick={() => (currentTab = tab)}>{tab}</button
            >
        {/each}
    </div>
{/snippet}

{#snippet Party()}
    {#if currentTab == "Your Party"}
        <div class="flex flex-col w-full h-full gap-2">
            {#each partyMembers as member}
                <div
                    class="party-member flex flex-row justify-between w-full h-12 p-2 rounded-br-sm rounded-tr-sm bg-white/10 text-xs text-white"
                >
                    <div class="flex flex-col">
                        <strong>{member.name}</strong>
                        <span class="opacity-70"
                            >{member.uid == partyLeader ? "Leader" : "Member"}</span
                        >
                    </div>
                    <div class="flex flex-row gap-2">
                        <div
                            class="{isPlayerLeader && member.uid !== partyLeader
                                ? ''
                                : 'disabled'} flex flex-row gap-2 items-center rounded-sm bg-black/30 pl-2 pr-2"
                        >
                            <input
                                type="checkbox"
                                bind:checked={member.canPlace}
                                onchange={() => {
                                    game.network.sendRpc({
                                        name: "TogglePartyPermission",
                                        permission: "Place",
                                        uid: parseInt(member.uid),
                                    });
                                }}
                            />
                            <p>Can build</p>
                        </div>
                        <div
                            class="{isPlayerLeader && member.uid !== partyLeader
                                ? ''
                                : 'disabled'} flex flex-row gap-2 items-center rounded-sm bg-black/30 pl-2 pr-2"
                        >
                            <input
                                type="checkbox"
                                bind:checked={member.canSell}
                                onchange={() => {
                                    game.network.sendRpc({
                                        name: "TogglePartyPermission",
                                        permission: "Sell",
                                        uid: parseInt(member.uid),
                                    });
                                }}
                            />
                            <p>Can sell</p>
                        </div>
                        <button
                            onclick={() => {
                                game.ui.pendingPopups.push({
                                    type: "confirmation",
                                    message: `Are you sure you want to kick <b>${member.name}</b> from your party?`,
                                    callback: () => {
                                        game.network.sendRpc({
                                            name: "KickMember",
                                            uid: parseInt(member.uid),
                                        });
                                    },
                                });
                            }}
                            class="{isPlayerLeader && member.uid !== partyLeader
                                ? ''
                                : 'disabled'} rounded-sm pl-2 pr-2 transition bg-accent-red hover:brightness-125"
                            >Kick</button
                        >
                    </div>
                </div>
            {/each}
        </div>
    {/if}
{/snippet}

{#snippet Parties()}
    {#if currentTab == "Open Parties"}
        {#if isRequesting}
            <div
                class="flex flex-col gap-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40"
            >
                <p class="text-white">Requesting to join...</p>
                <button
                    onclick={() => {
                        game.network.sendRpc({
                            name: "CancelPartyRequest",
                        });
                    }}
                    class="p-2 rounded-sm text-white transition bg-accent-red hover:brightness-125"
                    >Cancel Request</button
                >
            </div>
        {/if}
        <div
            class="{isRequesting
                ? 'disabled'
                : ''} flex flex-row flex-wrap justify-between content-start w-full h-full transition"
        >
            {#if Object.keys(parties).length > 1 || currentParty.isOpen}
                {#each Object.values(parties) as party}
                    {@const isPlayersParty = game.ui.playerTick?.partyId == party.partyId}
                    {@const isFull = party.memberCount >= party.memberLimit}
                    {#if party.isOpen === true || party.isOpen === undefined}
                        <button
                            onclick={() => {
                                if (isPlayersParty) return;
                                isRequesting = party.partyId;
                                game.network.sendRpc({
                                    name: "JoinParty",
                                    partyId: party.partyId,
                                });
                            }}
                            class="{isPlayersParty ? 'focused' : ''} {isFull
                                ? 'disabled'
                                : ''} flex flex-col items-start basis-49/100 h-16 mb-2 p-2 text-white rounded-sm transition bg-white/10 hover:bg-white/30"
                        >
                            <strong>{party.partyName}</strong>
                            <span class="opacity-70"
                                >{party.memberCount}/{party.memberLimit}</span
                            >
                        </button>
                    {/if}
                {/each}
                <!--
            {#if Object.keys(parties).length > 1 || currentParty.isOpen}
                <hr class="ml-auto mr-auto mt-2 mb-2 border-dashed w-full" />
            {/if}
            -->
            {:else if !currentParty.isOpen}
                <p
                    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/70"
                >
                    No open parties
                </p>
            {/if}

            <!--
            <input
                onkeyup={(t) => {
                    t.stopPropagation();
                }}
                onkeydown={(t) => {
                    t.stopPropagation();
                }}
                class="relative w-full h-10 rounded-sm p-2 mt-2 text-center bg-white/10 text-white placeholder:text-white/50"
                placeholder="Join by party share key..."
            />
            -->
        </div>
    {/if}
{/snippet}

{#snippet AltManagement()}
    {#if currentTab == "Your Instances"}
        <div class="flex flex-col w-full h-full p-2 gap-4">
            <!-- Alt Spawner Form -->
            <div class="flex flex-row items-center justify-between p-3 rounded bg-white/5 border border-white/10">
                <div class="flex flex-col gap-0.5">
                    <span class="text-xs text-white/50">Create an alternate session</span>
                    <strong class="text-sm text-white">Name: {game.network.activeInstance?.name || 'Player'}</strong>
                    {#if partyShareKey}
                        <span class="text-[10px] text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded-full w-max mt-1 font-semibold">Auto-joins Party</span>
                    {/if}
                </div>
                <button
                    onclick={() => {
                        const name = game.network.activeInstance?.name || "Player";
                        const activeServer = game.network.activeInstance?.serverData;
                        if (!activeServer) return;

                        game.network.createInstance(name, partyShareKey, activeServer);
                    }}
                    class="p-2 pl-4 pr-4 rounded text-white text-xs font-semibold bg-accent-green transition hover:brightness-125 cursor-pointer"
                >
                    + Spawn Alt
                </button>
            </div>

            <!-- Instances List -->
            <div class="flex flex-col gap-2 overflow-y-auto max-h-[35vh]">
                {#each Object.values(game.network.instances) as inst (inst.id)}
                    {@const isCurrent = game.network.activeInstanceId === inst.id}
                    {@const stats = inst.playerTick || {}}
                    <div
                        class="{isCurrent ? 'border-accent-green bg-white/15' : 'border-white/5 bg-white/10'} flex flex-col gap-2 p-3 rounded border shadow transition hover:bg-white/15"
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
                                <strong class="text-xs text-white">{inst.name}</strong>
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
                                <div class="grid grid-cols-2 gap-2 text-[11px] text-white/80 bg-black/20 p-2 rounded">
                                    <!-- Health Bar -->
                                    <div class="col-span-2 flex flex-col gap-1">
                                        <div class="flex justify-between text-[9px] text-white/70">
                                            <span>HP: {stats.health} / {stats.maxHealth}</span>
                                            {#if stats.zombieShieldHealth}
                                                <span>Shield: {stats.zombieShieldHealth}</span>
                                            {/if}
                                        </div>
                                        <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden flex">
                                            <div class="bg-red-500 h-full transition-all" style="width: {(stats.health / stats.maxHealth) * 100}%"></div>
                                            {#if stats.zombieShieldHealth}
                                                <div class="bg-blue-400 h-full transition-all" style="width: {(stats.zombieShieldHealth / stats.zombieShieldMaxHealth) * 100}%"></div>
                                            {/if}
                                        </div>
                                    </div>

                                    <!-- Resources -->
                                    <div class="flex items-center gap-1">
                                        <span>🪵 Wood:</span>
                                        <span class="font-semibold text-amber-200">{stats.wood || 0}</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <span>🪨 Stone:</span>
                                        <span class="font-semibold text-slate-300">{stats.stone || 0}</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <span>🪙 Gold:</span>
                                        <span class="font-semibold text-yellow-300">{stats.gold || 0}</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <span>💎 Tokens:</span>
                                        <span class="font-semibold text-teal-300">{stats.tokens || 0}</span>
                                    </div>
                                    {#if stats.wave !== undefined}
                                        <div class="col-span-2 text-[9px] opacity-70">
                                            🌊 Wave {stats.wave}
                                        </div>
                                    {/if}
                                </div>
                            {:else}
                                <div class="text-[11px] text-emerald-400 italic p-2 bg-black/10 rounded text-center">
                                    Syncing player data...
                                </div>
                            {/if}
                        {:else if inst.connecting}
                            <div class="text-[11px] text-white/60 italic p-2 bg-black/10 rounded text-center">
                                Connecting to game server...
                            </div>
                        {:else}
                            <div class="text-[11px] text-rose-400 italic p-2 bg-black/10 rounded text-center">
                                Connection offline.
                            </div>
                        {/if}

                        <!-- Actions Row -->
                        <div class="flex flex-row gap-2 mt-1 justify-end">
                            {#if !isCurrent}
                                <button
                                    onclick={() => game.network.switchInstance(inst.id)}
                                    class="text-[10px] p-1 px-2.5 rounded bg-accent-green hover:brightness-125 text-white transition font-medium cursor-pointer"
                                >
                                    Control
                                </button>
                            {/if}
                            <button
                                onclick={() => game.network.removeInstance(inst.id)}
                                class="text-[10px] p-1 px-2.5 rounded bg-accent-red hover:brightness-125 text-white transition font-medium cursor-pointer"
                            >
                                {inst.id === 'main' ? 'Leave' : 'Disconnect'}
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
{/snippet}

{#snippet PartyManagement()}
    <div class="flex flex-col basis-1/4 w-full pt-2 gap-2">
        <div class="relative flex flex-row basis-1/2 gap-2">
            <input
                class="{isPlayerLeader
                    ? ''
                    : 'disabled'} w-40 h-full rounded bg-white pl-2 pr-2 shadow"
                type="text"
                placeholder={currentParty?.partyName || "verycoolpartyname"}
                bind:value={partyName}
            />
            <div class="flex flex-1 flex-row grow h-full rounded bg-white pl-2 shadow">
                <input
                    class="grow pr-2 border-r-2 text-sm border-gray/10"
                    type="text"
                    maxlength="0"
                    placeholder="zombia.io/#/{game.network.options.serverData
                        .id}/lmao"
                    value="https://zombia.io/#/{game.network.options.serverData
                        .id}/{partyShareKey}"
                    onfocus={({ target: _this }) => {
                        _this.select();
                    }}
                />
                <button
                    aria-label="Randomise party key"
                    class="relative w-10 h-10"
                    onclick={() => {
                        game.network.sendRpc({
                            name: "RandomisePartyKey",
                        });
                    }}
                >
                    <img
                        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 invert-100"
                        alt="Randomise party key"
                        src="/images/Ui/Icons/RefreshToggle.svg"
                    />
                </button>
            </div>
        </div>
        <div
            class="relative flex flex-1 flex-row w-full basis-1/2 gap-2 text-white *:rounded-sm *:h-full *:basis-1/2 *:transition *:bg-accent-red *:hover:brightness-125"
        >
            <button
                class={currentParty?.memberCount == 1 ? "disabled" : ""}
                onclick={() => {
                    game.ui.pendingPopups.push({
                        type: "confirmation",
                        message: "Are you sure you want to abandon your base?",
                        callback: () => {
                            game.network.sendRpc({
                                name: "LeaveParty",
                            });
                        },
                    });
                }}>Leave Party</button
            >
            <button
                class="{currentParty?.isOpen ? 'focused' : ''} {isPlayerLeader
                    ? ''
                    : 'disabled'}"
                onclick={() => {
                    game.network.sendRpc({
                        name: "TogglePartyVisibility",
                    });
                }}>{currentParty?.isOpen ? "Public" : "Private"}</button
            >
        </div>
    </div>
{/snippet}

{#if game.ui.isDisplayingMenu == "Parties"}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
        onmouseup={(t) => {
            t.stopPropagation();
        }}
        onmousedown={(t) => {
            t.stopPropagation();
        }}
        class="absolute flex flex-col top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm w-[70vw] min-w-116 max-w-140 h-100 p-4 bg-black/30"
    >
        <button
            class="absolute text-white text-2xl top-2 right-4 rotate-45 transition opacity-70 hover:opacity-100"
            onclick={() => game.ui.hideMenu()}>+</button
        >
        <div class="basis-1/6">
            <h2 class="text-white mb-2">Parties</h2>
            {@render Tabs()}
        </div>
        <div
            class="relative basis-7/12 w-full bg-black/20 rounded-sm rounded-tl-none p-2 overflow-y-auto"
        >
            {@render Party()}
            {@render Parties()}
            {@render AltManagement()}
        </div>
        {@render PartyManagement()}
    </div>
{/if}

<style lang="postcss">
    @reference "../../../app.css";

    .active {
        @apply bg-black/20;
    }
    .focused {
        @apply bg-accent-green;
    }
    .disabled {
        pointer-events: none;
        opacity: 0.5 !important;
    }

    .party-member {
        border-left: 2px solid #EEE;
    }
    .party-member:nth-child(1) {
        border-left-color: #0096FF;
    }
    .party-member:nth-child(2) {
        border-left-color: #8473d4;
    }
    .party-member:nth-child(3) {
        border-left-color: #2ee322;
    }
    .party-member:nth-child(4) {
        border-left-color: #e69050;
    }

    hr {
        text-align: center;
    }
</style>
