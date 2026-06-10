<script>
    import { fade } from "svelte/transition";

    let { game } = $props();

    let isReconnecting = $state(false);

    game.eventEmitter.on("SocketClosed", () => {
      isReconnecting = true;
    })

    game.eventEmitter.on("SocketOpened", () => {
      isReconnecting = false;
    })
</script>

{#if isReconnecting}
    <div
        transition:fade={{ duration: 200 }}
        class="absolute flex justify-center items-center w-full h-full backdrop-blur-xs z-50"
    >
        <span class="inline-block w-4 h-4 rounded-full border-[0.4em] border-white/20 border-l-[#eee] animate-spin mr-2"></span>
        <p class="text-white text-xs">Reconnecting...</p>
    </div>
{/if}

