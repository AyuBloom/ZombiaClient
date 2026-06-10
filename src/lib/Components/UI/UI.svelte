<script>
    import Debug from "./Debug.svelte";
    import BuildingBar from "./BuildingBar.svelte";
    import Leaderboard from "./Leaderboard.svelte";
    import DayNightTicker from "./DayNightTicker.svelte";
    import MiniMap from "./MiniMap.svelte";
    import ToolBar from "./ToolBar.svelte";
    import DayNightOverlay from "./DayNightOverlay.svelte";
    import Respawn from "./Respawn.svelte";
    import Resources from "./Resources.svelte";
    import BuildingOverlay from "./BuildingOverlay.svelte";
    import MenuIcons from "./MenuIcons.svelte";
    import MenuShop from "./MenuShop.svelte";
    import Consumables from "./Consumables.svelte";
    import Chat from "./Chat.svelte";
    import MenuParties from "./MenuParties.svelte";
    import PipOverlay from "./PipOverlay.svelte";
    import AnnouncementOverlay from "./AnnouncementOverlay.svelte";
    import PopupOverlay from "./PopupOverlay.svelte";
    import Reconnect from "./Reconnect.svelte";

    import { gameSettings } from "$lib/Engine/shared.svelte";
    import MenuSettings from "./MenuSettings.svelte";

    let { game } = $props();

    gameSettings.start();
    window.gameSettings = gameSettings;

    let screenshotMode = $state(false);

    game.eventEmitter.on("191Up", (e) => {
        const isInputField = e.target && (
            e.target.tagName === "INPUT" ||
            e.target.tagName === "TEXTAREA" ||
            e.target.tagName === "SELECT" ||
            e.target.isContentEditable
        );
        if (isInputField) return;

        if (e.shiftKey) {
            e.preventDefault();
            screenshotMode = !screenshotMode;
        }
    });

</script>

<div class="hud absolute w-full h-full z-20 {screenshotMode ? 'hidden' : ''}">
    <!-- Top -->
    <Chat {game} />
    <MenuIcons {game} />
    <Leaderboard {game} />
    <AnnouncementOverlay {game} />

    <!-- Bottom -->
    <Debug {game} />
    <MiniMap {game} />
    <Consumables {game} />
    <ToolBar {game} />
    <BuildingBar {game} />

    <!-- Left -->

    <DayNightTicker {game} />

    <!-- Right -->
    <Resources {game} />

    <!-- Center -->
    <MenuShop {game} />
    <MenuParties {game} />
    <MenuSettings {game} />

    <!-- Dynamic -->
    <PipOverlay {game} />
    <PopupOverlay {game} />
    <BuildingOverlay {game} />

    <DayNightOverlay {game} />
    <Respawn {game} />
    <Reconnect {game} />
</div>
