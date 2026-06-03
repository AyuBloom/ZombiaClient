<script>
    import { isMobile } from "pixi.js";

    let { game } = $props();

    let fps = $state(0);
    let frameTime = $state(undefined);
    let tickTimes = $state([]);
    let tps = $derived(tickTimes.length);
    let isWebGL = $state(null);
    let isWebGPU = $state(null);

    let isInputLocked = $derived(game.inputPacketManager.inputsLocked);

    game.eventEmitter.on("EntityUpdate", (e) => {
        frameTime = e.averageServerFrameTime;
        fps = game.renderer.replicator.getFps();

        let now = Date.now();
        tickTimes = [...tickTimes, now].filter(t => t > now - 1000);

        if (isWebGL === null || isWebGPU === null) {
            isWebGL = game.renderer.renderer.renderer instanceof PIXI.WebGLRenderer;
            isWebGPU = game.renderer.renderer.renderer instanceof PIXI.WebGPURenderer;
        }
    });
    /*
    game.eventEmitter.on("RendererUpdated", () => {
        fps = game.renderer.replicator.getFps();
    });
    */

    $effect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            tickTimes = tickTimes.filter(t => t > now - 1000);
        }, 100);
        return () => clearInterval(interval);
    });
</script>

<div class="absolute lg:bottom-28 bottom-24 left-2 text-white">
    {#if isInputLocked}
        <p class="text-accent-gold">Inputs Locked</p>
    {/if}
    {#if frameTime !== undefined}
        <p class={frameTime > 50 ? "overloaded" : frameTime > 30 ? "stressed" : ""}>
            {game.network.ping}ms / {frameTime}ms / {tps} TPS
        </p>
    {:else}
        <p>
            {game.network.ping}ms / {tps} TPS
        </p>
    {/if}
    {#if !isMobile.any}
        <p>
            {Math.round(fps)} FPS - {isWebGL ? "WebGL" : isWebGPU ? "WebGPU" : "Canvas"}
        </p>
    {/if}
</div>

<style lang="postcss">
    @reference "../../../app.css";

    div {
        font-family: "Hammersmith One", Arial, Helvetica, sans-serif;
    }
    .stressed {
        @apply text-orange-400;
    }
    .overloaded {
        @apply text-accent-red;
    }
</style>
