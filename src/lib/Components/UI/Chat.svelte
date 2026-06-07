<script>
    import { tick } from "svelte";
    import tippy from "tippy.js";
    import { gameSettings } from "$lib/Engine/shared.svelte";

    let { game } = $props();

    const MESSAGE_LIMIT = 2;

    let isTyping = $state(false);

    let chatBox;
    let inputBox;

    let msgs = $state([]);
    let channels = ["All", "Party"];

    let msg = $state("");
    let channel = $state(0);

    // Keep track of active message contents
    const seenMessages = new Set();

    game.eventEmitter.on("ReceiveChatMessageRpcReceived", async (t) => {
        if (seenMessages.has(t.message)) return;

        seenMessages.add(t.message);
        msgs.push({ ...t, date: Date.now() });
        // Limit to 500 if the toggle is enabled
        if (gameSettings.state.deleteOldChat && msgs.length > MESSAGE_LIMIT) {
            const removed = msgs.shift();
            removed && seenMessages.delete(removed.message);
        }
        await tick();
        if (chatBox) {
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });
    game.eventEmitter.on("13Up", () => {
        if (isTyping) {
            msg.trim().length > 0 &&
                game.network.sendRpc({
                    name: "SendChatMessage",
                    message: msg.trim(),
                    channel: channels[channel],
                });
            msg = "";
            inputBox.blur();
            isTyping = false;
        } else {
            isTyping = true;
            setTimeout(() => {
                inputBox.focus();
            });
        }
    });
    game.eventEmitter.on("27Up", () => {
        1 == isTyping && (isTyping = false);
    });
    game.eventEmitter.on("mouseDown", () => {
        1 == isTyping && (isTyping = false);
    });

    $effect(() => {
        if (gameSettings.state.deleteOldChat && msgs.length > MESSAGE_LIMIT) {
            // keep only the latest 500 messages
            msgs = msgs.slice(-MESSAGE_LIMIT);
            // rebuild so it only contains active message contents
            seenMessages.clear();
            for (const m of msgs) {
                seenMessages.add(m.message);
            }
        }
    });

    function tooltip(node, fn) {
        $effect(() => {
            const tooltip = tippy(node, fn());

            return tooltip.destroy;
        });
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
    class="{isTyping
        ? 'focused'
        : ''} absolute top-0 left-0 h-60 w-80 p-2 rounded-br-md text-white transition"
>
    <div class="min-w-78 w-78 h-48 overflow-x-hidden overflow-y-auto" bind:this={chatBox}>
        {#each msgs as { channel, message, name, date }}
            <!--
            <div
                class="flex flex-row items-start gap-1 relative mb-1 text-xs"
            >
                <strong
                    class="{channel == 'All'
                        ? 'text-accent-red'
                        : 'text-accent-green'} font-bold whitespace-nowrap">[{channel}]</strong
                >
                <span class="font-bold whitespace-nowrap">{name}:</span>
                <p class="break-all min-w-0 flex-1">{message}</p>
            </div>
            -->
            <!-- <span class="absolute opacity-70">{new Date(date).toLocaleDateString()}</span> -->
            <div
                onselectstart={(t) => {
                    t.stopPropagation();
                }}
                onmousedown={(t) => {
                    t.stopPropagation();
                }}
                onmouseup={(t) => {
                    t.stopPropagation();
                }}
                use:tooltip={() => {
                    return {
                        content: `<strong>${new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</strong>`,
                        allowHTML: true,
                        animation: false,
                    };
                }}
                class="mb-1 text-xs break-all">
                <strong
                    class="{channel == 'All'
                        ? 'text-accent-red'
                        : 'text-accent-green'} font-bold whitespace-nowrap"
                >
                    [{channel}]
                </strong>
                <span class="font-bold whitespace-nowrap">{name}:</span>
                {message}
            </div>
        {/each}
    </div>
    <div
        onmouseup={(t) => {
            t.stopPropagation();
        }}
        onmousedown={(t) => {
            t.stopPropagation();
        }}
        class="{isTyping
            ? 'block'
            : 'hidden'} flex flex-row absolute -ml-2 bottom-0 h-10 w-full border-t-2 border-white/20 z-999"
    >
        <input
            class="relative basis-7/8 pl-2 pr-2 text-xs"
            onkeyup={(t) => {
                ["Enter", "Escape"].includes(t.code) || t.stopPropagation();
            }}
            onkeydown={(t) => {
                ["Enter", "Escape"].includes(t.code) || t.stopPropagation();
            }}
            placeholder="Typing on channel [{channels[channel]}]"
            bind:this={inputBox}
            bind:value={msg}
        />
        <button
            aria-label="Change channel"
            class="relative basis-1/8"
            onclick={() => {
                channel = (channel + 1) % channels.length;
                inputBox.focus();
            }}
        >
            <img
                class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 z-40"
                alt="Change channel"
                src="/images/Ui/Icons/RefreshToggle.svg"
            />
        </button>
    </div>
</div>

<style lang="postcss">
    @reference "tailwindcss/theme";

    .focused {
        @apply bg-black/40;
    }
</style>
