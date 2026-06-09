<script>
    let { game } = $props();

    let resourceGains = $state({});
    let damages = $state({});

    /** Tracks how many active indicators exist per entity uid for vertical stacking */
    const activeResourceCountByUid = {};

    function showDamage(x, y, damage, duration, isScore = null) {
        const uuid = game.util.uuidv4();

        const position = game.renderer.worldToScreen(x, y);

        damages[uuid] = {
            damage,
            position: {
                x: position.x,
                y: position.y,
            },
            isScore,
        };

        setTimeout(() => {
            delete damages[uuid];
        }, duration);
    }

    function showResourceGain(uid, type, delta) {
        if (Math.abs(delta) < 0.5) return;
        delta = Math.round(delta);

        const entity = game.renderer.world.entities[uid];
        if (!entity) return;

        const position = game.renderer.worldToScreen(
            entity.getPositionX(),
            entity.getPositionY(),
        );

        // Assign a stable vertical offset based on how many indicators
        // are already active for this entity
        if (!activeResourceCountByUid[uid]) activeResourceCountByUid[uid] = 0;
        const stackIndex = activeResourceCountByUid[uid];
        activeResourceCountByUid[uid]++;

        const uuid = game.util.uuidv4();

        resourceGains[uuid] = {
            gain: delta,
            type,
            position: {
                x: position.x,
                y: position.y,
            },
            stackOffset: stackIndex,
        };

        setTimeout(() => {
            delete resourceGains[uuid];
            activeResourceCountByUid[uid]--;
            if (activeResourceCountByUid[uid] <= 0) {
                delete activeResourceCountByUid[uid];
            }
        }, 250);
    }

    game.eventEmitter.on("DamageDealtRpcReceived", (t) => {
        let e = t.damage.toLocaleString(),
            i = 500;
        if (2147483647 == t.damage) {
            e = "KILLED";
            i = 1000;
        }
        showDamage(t.x, t.y, e, i);
    });

    game.eventEmitter.on("EntityKilledRpcReceived", (t) => {
        const e = game.renderer.world.entities[t.uid];
        if (!e) return;
        const isScore = Number.isInteger(t.score) && t.score >= 0 && t.score <= 4294967295
          , s = isScore ? `+${t.score.toLocaleString()}` : "KILLED";

        showDamage(e.getPositionX(), e.getPositionY(), s, 500, isScore)
    });

    game.eventEmitter.on("PlayerTickUpdated", () => {
        const t = game.ui.playerTick,
            e = game.ui.lastPlayerTick;

        if (!t || !e) return;

        if (
            game.renderer.replicator.getMsSinceTick(
                game.renderer.replicator.currentTick.tick,
            ) > 500
        )
            return;

        const r = ["gold", "wood", "stone", "tokens"];
        for (let n of r) {
            if ("gold" == n && t[n] > e[n]) continue;
            if (t[n] == e[n]) continue;

            const r = t[n] - e[n];
            showResourceGain(t.uid, n, r);
        }
    });
</script>

<div>
    {#each Object.entries(resourceGains) as [uuid, { gain, type, position, stackOffset }] (uuid)}
        <p
            class="pip -translate-x-1/2 -translate-y-full text-white"
            style="left: {position.x}px; top: {position.y - 65 + 16 * stackOffset}px"
        >
            {gain > 0 ? "+" + gain.toLocaleString() : gain.toLocaleString()}
            {type}
        </p>
    {/each}

    {#each Object.entries(damages) as [uuid, { damage, position, isScore }] (uuid)}
        <p
            class="pip -translate-x-1/2 -translate-y-full {isScore ? "text-accent-gold" : "text-accent-red"}"
            style="left: {position.x}px; top: {position.y - 10}px"
        >
            {damage}
        </p>
    {/each}
</div>

<style lang="postcss">
    @reference "tailwindcss/theme";

    @keyframes pip-ascend {
        from {
            margin-top: 0;
            opacity: 1;
        }
        to {
            margin-top: -1.25rem;
            opacity: 0;
        }
    }
    .pip {
        @apply absolute text-xs;
        font-family: "Hammersmith One", sans-serif;
        text-shadow:
            1px 1px #333,
            -1px 1px #333,
            1px -1px #333,
            -1px -1px #333;
        opacity: 1;
        animation-name: pip-ascend;
        animation-duration: 500ms;
        animation-iteration-count: 1;
        animation-fill-mode: forwards;
    }
</style>
