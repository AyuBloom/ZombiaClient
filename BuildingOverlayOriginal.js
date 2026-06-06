const me = 4294967295;
class ge extends s {
    constructor() {
        let t = document.createElement("div");
        t.className = "hud-building-overlay hud-tooltip hud-tooltip-top",
        document.getElementById("hud").appendChild(t),
        super(t),
        this.element.innerHTML = '\n        <div class="hud-tooltip-building">\n            <h2 class="hud-building-name"></h2>\n            <h3 class="harvester-drone-count"></h3>\n            <h3>Tier <span id="hud-building-tier" class="hud-building-tier"></span></h3>\n            <div class="hud-tooltip-body">\n                <div id="hud-building-stats" class="hud-building-stats"></div>\n                <p class="hud-building-actions">\n                    <a class="btn hud-building-aggro"></a>\n                    <span class="hud-building-dual-btn">\n                        <a class="btn hud-building-harvester-drone">Buy Drone</a>\n                        <a class="btn hud-building-harvester-set-target">Set Target</a>\n                    </span>\n                    <a class="btn btn-green hud-building-upgrade"></a>\n                    <a class="btn btn-red hud-building-sell">Sell</a>\n                </p>\n            </div>\n        </div>\n        ',
        this.nameElem = this.element.querySelector(".hud-building-name"),
        this.tierElem = this.element.querySelector(".hud-building-tier"),
        this.statsElem = this.element.querySelector(".hud-building-stats"),
        this.harvesterDroneCountElem = this.element.querySelector(".harvester-drone-count"),
        this.aggroElem = this.element.querySelector(".hud-building-aggro"),
        this.dualBtnElem = this.element.querySelector(".hud-building-dual-btn"),
        this.harvesterSetTargetElem = this.element.querySelector(".hud-building-harvester-set-target"),
        this.harvesterPurchaseDroneElem = this.element.querySelector(".hud-building-harvester-drone"),
        this.upgradeElem = this.element.querySelector(".hud-building-upgrade"),
        this.sellElem = this.element.querySelector(".hud-building-sell"),
        this.upgradeElem.addEventListener("mouseup", this.upgradeBuilding.bind(this)),
        this.sellElem.addEventListener("mouseup", this.sellBuilding.bind(this)),
        this.aggroElem.addEventListener("mouseup", this.togglePrimaryAggro.bind(this)),
        this.harvesterSetTargetElem.addEventListener("mouseup", this.toggleHarvesterTargetDisplay.bind(this)),
        this.harvesterPurchaseDroneElem.addEventListener("mouseup", this.purchaseHarvesterDrone.bind(this)),
        this.element.addEventListener("mousedown", this.onMouseDown.bind(this)),
        this.element.addEventListener("mouseup", this.onMouseUp.bind(this)),
        this.hasInitialised = !1
    }
    init() {
        if (1 == this.hasInitialised)
            return;
        this.hasInitialised = !0,
        mi.eventEmitter.on("EnterWorldResponse", this.onEnterWorld.bind(this)),
        mi.eventEmitter.on("EntityUpdate", this.onEntityUpdate.bind(this)),
        mi.eventEmitter.on("PlayerTickUpdated", this.updateText.bind(this)),
        mi.eventEmitter.on("CameraUpdate", ( () => {
            this.shouldUpdateRanges = !0,
            this.update()
        }
        )),
        mi.eventEmitter.on("BuildingsUpdated", ( () => {
            this.shouldUpdateRanges = !0,
            this.update(),
            this.updateText()
        }
        )),
        mi.eventEmitter.on("16Down", this.updateText.bind(this)),
        mi.eventEmitter.on("16Up", this.updateText.bind(this)),
        mi.eventEmitter.on("69Up", this.upgradeBuilding.bind(this)),
        mi.eventEmitter.on("84Up", this.sellBuilding.bind(this)),
        mi.eventEmitter.on("27Up", this.stopWatching.bind(this)),
        this.shiftDown = !1,
        this.displayingHarvesterRange = !1;
        const t = t => {
            this.shouldUpdateRanges = !0,
            "Up" == t ? 1 == this.shiftDown && (this.shiftDown = !1,
            this.update()) : "Down" == t && 0 == this.shiftDown && (this.shiftDown = !0,
            this.update())
        }
        ;
        mi.eventEmitter.on("16Down", t.bind(this, "Down")),
        mi.eventEmitter.on("16Up", t.bind(this, "Up")),
        this.harvesterSelectorModel = new fe({
            radius: 120
        }),
        mi.renderer.groundLayer.addAttachment(this.harvesterSelectorModel, 10),
        this.harvesterSelectorModel.setVisible(!1),
        this.draw = new se,
        mi.renderer.groundLayer.addAttachment(this.draw, 10),
        this.numberOfRangesToDraw = 0,
        this.shouldUpdateRanges = !0,
        this.lastRangeDrawTick = 0,
        this.draw.setAlpha(.1)
    }
    onEnterWorld(t) {
        this.stopWatching(),
        this.maxFactoryDistance = t.maxFactoryBuildDistance
    }
    onEntityUpdate(t) {
        null != this.buildingUid && void 0 !== t.entities[this.buildingUid] && this.update()
    }
    onMouseDown(t) {
        t.stopPropagation()
    }
    onMouseUp(t) {
        "Harvester" != this.buildingId && t.stopPropagation()
    }
    onWorldMouseUp(t) {
        if ("Harvester" != this.buildingId)
            return this.stopWatching();
        if (0 == this.displayingHarvesterRange)
            return this.stopWatching();
        if (0 == this.displayingHarvesterRange)
            return;
        const e = mi.renderer.world.entities[this.buildingUid]
          , i = mi.ui.buildingData[this.buildingId].harvestRange[mi.ui.buildings[this.buildingUid].tier - 1]
          , s = mi.renderer.scenery
          , n = []
          , r = mi.renderer.screenToWorld(mi.ui.mousePosition.x, mi.ui.mousePosition.y);
        for (const t of s.attachments)
            if ("Resource" == t.entityClass) {
                const s = Math.sqrt(d.measureDistance(t.getPosition(), r))
                  , a = Math.sqrt(d.measureDistance(t.getPosition(), e.getPosition())) + t.targetTick.radius;
                s <= 120 && a <= i && n.push(t)
            }
        0 != n.length && (n.sort(( (t, e) => {
            const i = d.measureDistance(r, t.getPosition())
              , s = d.measureDistance(r, e.getPosition());
            return i < s ? -1 : i > s ? 1 : 0
        }
        )),
        mi.network.sendRpc({
            name: "UpdateHarvesterTarget",
            harvesterUid: this.buildingUid,
            targetUid: n[0].uid
        }),
        this.show(),
        this.displayingHarvesterRange = !1)
    }
    upgradeBuilding(t) {
        if (1 !== t.which && 69 !== t.which)
            return;
        if (t.stopPropagation(),
        null == this.buildingUid)
            return;
        let e = new Set;
        if (e.add(this.buildingUid),
        mi.network.inputPacketManager.shiftDown)
            for (const t in mi.ui.buildings) {
                const i = mi.ui.buildings[t];
                i.type == this.buildingId && i.tier == this.buildingTier && t !== this.buildingUid && e.add(i.uid)
            }
        mi.network.sendRpc({
            name: "UpgradeBuilding",
            uids: Array.from(e)
        })
    }
    sellBuilding(t) {
        if (1 !== t.which && 84 !== t.which)
            return;
        if (null == this.buildingUid || !mi.ui.playerPartyCanSell)
            return;
        let e = new Set;
        if (e.add(this.buildingUid),
        mi.network.inputPacketManager.shiftDown)
            for (const t in mi.ui.buildings) {
                const i = mi.ui.buildings[t];
                i.type == this.buildingId && i.tier == this.buildingTier && e.add(i.uid)
            }
        e.size > 1 ? mi.ui.components.uiPopupOverlay.showConfirmation(`Are you sure you want to sell all <b>${this.buildingId}</b>s?`, 5e3, ( () => {
            mi.network.sendRpc({
                name: "SellBuilding",
                uids: Array.from(e)
            })
        }
        )) : mi.network.sendRpc({
            name: "SellBuilding",
            uids: Array.from(e)
        })
    }
    togglePrimaryAggro(t) {
        if (1 !== t.which)
            return t.stopPropagation();
        null != this.buildingUid && mi.renderer.world.entities[this.buildingUid] && mi.ui.playerPartyLeader == mi.renderer.world.localPlayer && mi.network.sendRpc({
            name: "TogglePrimaryAggro"
        })
    }
    update() {
        if (null == this.buildingUid)
            return;
        const t = mi.renderer.world.entities[this.buildingUid];
        if (!t)
            return this.stopWatching();
        const e = mi.renderer.worldToScreen(t.getPositionX(), t.getPositionY())
          , i = mi.ui.buildingData[this.buildingId]
          , s = mi.ui.buildings[this.buildingUid];
        if (!s)
            return this.stopWatching();
        if (this.isVisible()) {
            const t = i.gridHeight / 2 * 48 * (mi.renderer.scale / window.devicePixelRatio);
            this.element.style.left = e.x - this.element.offsetWidth / 2 + "px",
            this.element.style.top = e.y - t - this.element.offsetHeight - 20 + "px"
        }
        if (1 == this.shouldUpdateRanges && this.lastRangeDrawTick !== mi.renderer.replicator.currentTick.tick)
            if (this.shouldUpdateRanges = !1,
            this.lastRangeDrawTick = mi.renderer.replicator.currentTick.tick,
            this.draw.clear(),
            this.numberOfRangesToDraw = 0,
            "Harvester" == i.name) {
                t.targetTick.targetResourceUid == me ? this.harvesterSetTargetElem.innerHTML = "Set Target" : this.harvesterSetTargetElem.innerHTML = "Clear Target";
                const e = i.harvestRange[s.tier - 1];
                this.draw.drawCircle(s.x, s.y, e, {
                    r: 200,
                    g: 160,
                    b: 0
                }, {
                    r: 255,
                    g: 200,
                    b: 0
                }, 8),
                this.harvesterSelectorModel.setVisible(!0);
                const n = mi.renderer.world.entities[t.targetTick.targetResourceUid];
                if (null == n ? this.harvesterSelectorModel.setPosition(t.getPositionX(), t.getPositionY()) : this.harvesterSelectorModel.setPosition(n.getPositionX(), n.getPositionY()),
                this.displayingHarvesterRange) {
                    const t = mi.renderer.scenery;
                    for (const i of t.attachments) {
                        if ("Resource" !== i.entityClass)
                            continue;
                        const t = i.targetTick;
                        Math.sqrt(d.measureDistance(s, t.position)) + t.radius <= e && this.draw.drawCircle(t.position.x, t.position.y, 100, {
                            r: 0,
                            g: 0,
                            b: 0
                        }, {
                            r: 255,
                            g: 0,
                            b: 0
                        }, 8)
                    }
                }
            } else if (this.harvesterSelectorModel.setVisible(!1),
            this.drawRange(this.buildingUid),
            mi.network.inputPacketManager.shiftDown)
                for (let t in mi.ui.buildings)
                    mi.ui.buildings[t].type == this.buildingId && mi.ui.buildings[t].uid !== this.buildingUid && this.drawRange(t)
    }
    updateText() {
        if (!this.isActive())
            return;
        if (!mi.ui.buildings[this.buildingUid])
            return this.stopWatching();
        const t = mi.ui.buildingData[this.buildingId];
        this.buildingId = mi.ui.buildings[this.buildingUid].type,
        this.buildingTier = mi.ui.buildings[this.buildingUid].tier;
        const e = mi.renderer.world.entities[this.buildingUid];
        if (!e)
            return this.stopWatching();
        if ("Factory" == this.buildingId && "scarcity" !== mi.network.options.serverData.gameMode ? (1 == e.targetTick.aggroEnabled ? (this.aggroElem.classList.add("btn-red"),
        this.aggroElem.classList.remove("btn-green"),
        this.aggroElem.innerHTML = "Attack all enemies") : (this.aggroElem.classList.add("btn-green"),
        this.aggroElem.classList.remove("btn-red"),
        this.aggroElem.innerHTML = "Attack aggressive enemies"),
        this.aggroElem.style.display = "block",
        mi.ui.playerPartyLeader == mi.renderer.world.localPlayer ? this.aggroElem.classList.remove("is-disabled") : this.aggroElem.classList.add("is-disabled")) : this.aggroElem.style.display = "none",
        "Harvester" == this.buildingId)
            if (this.dualBtnElem.style.display = "block",
            this.harvesterDroneCountElem.style.display = "block",
            this.harvesterDroneCountElem.innerHTML = `${e.targetTick.droneCount}/${t.maxDrones[e.targetTick.tier - 1]} Drones`,
            "scarcity" == mi.network.options.serverData.gameMode)
                this.harvesterPurchaseDroneElem.classList.add("is-disabled"),
                this.harvesterPurchaseDroneElem.innerHTML = "Buy Drone";
            else if (e.targetTick.droneCount >= t.maxDrones[e.targetTick.tier - 1])
                this.harvesterPurchaseDroneElem.classList.add("is-disabled"),
                this.harvesterPurchaseDroneElem.innerHTML = "Buy Drone";
            else {
                this.harvesterPurchaseDroneElem.classList.remove("is-disabled");
                const e = d.createResourceCostString({
                    goldCosts: t.droneGoldCosts
                }, this.buildingTier, 1, !0);
                this.harvesterPurchaseDroneElem.innerHTML = `Buy Drone (${e.elem})`
            }
        else
            this.dualBtnElem.style.display = "none",
            this.harvesterDroneCountElem.style.display = "none";
        const i = this.buildingTier >= 8 || "Factory" !== this.buildingId && this.buildingTier >= mi.ui.getFactory().tier;
        this.nameElem.innerHTML = this.buildingId,
        this.tierElem.innerHTML = this.buildingTier;
        let s = 1;
        if (mi.network.inputPacketManager.shiftDown)
            for (const t in mi.ui.buildings) {
                const e = mi.ui.buildings[t];
                e.type == this.buildingId && e.tier == this.buildingTier && e.uid !== this.buildingUid && s++
            }
        i && this.upgradeElem.classList.add("is-disabled");
        const n = d.createResourceRefundString(t, this.buildingTier, s);
        ["Factory"].includes(this.buildingId) ? (this.sellElem.classList.add("is-disabled"),
        this.sellElem.innerHTML = "<span>Can't sell</span>") : mi.ui.playerPartyCanSell ? (this.sellElem.classList.remove("is-disabled"),
        this.sellElem.innerHTML = `<span>Sell${mi.network.inputPacketManager.shiftDown ? " All" : ""} (${n})</span>`) : (this.sellElem.classList.add("is-disabled"),
        this.sellElem.innerHTML = "<span>Need permission to sell</span>");
        const r = d.createResourceCostString(t, i ? this.buildingTier : this.buildingTier + 1, s, !0)
          , a = mi.ui.getFactory();
        i ? ["Factory"].includes(this.buildingId) || a.tier == this.buildingTier && a.tier >= 8 ? this.upgradeElem.innerHTML = "<span>Maximum tier!</span>" : this.upgradeElem.innerHTML = "<span>Upgrade your Factory</span>" : this.upgradeElem.innerHTML = `<span>Upgrade ${mi.network.inputPacketManager.shiftDown ? "All " : ""} (${r.elem})</span>`;
        const o = {
            "Max Health": "health",
            Range: "towerRadius",
            "Harvest Range": "harvestRange",
            "Gold/Second": "goldPerSecond",
            "Firing Rate": "msBetweenFires",
            "Projectile Speed": "projectileSpeed",
            "Damage to Zombies": "damageToZombies",
            "Target Limit": "attackTargetLimit",
            "Max Drone Count": "maxDrones",
            Knockback: "projectileEntityKnockback",
            "Splash KB Radius": "projectileKnockbackRadius"
        };
        let h = ""
          , l = "";
        for (let e in o)
            t[o[e]] && (h += `<p>${e}: <strong class="hud-stats-current">${t[o[e]][this.buildingTier - 1]}</strong></p>`,
            l += `<p>${e}: <strong class="hud-stats-next">${t[o[e]][this.buildingTier - (this.buildingTier >= 8 ? 1 : 0)]}</strong></p>`);
        this.statsElem.innerHTML = `<div class="hud-stats-current hud-stats-values">${h}</div>\n        <div class="hud-stats-next hud-stats-values">${l}</div>`
    }
    drawRange(t) {
        const e = mi.ui.buildings[t]
          , i = mi.renderer.world.entities[t];
        if (this.numberOfRangesToDraw++,
        null == e || null == i)
            return;
        const s = mi.ui.buildingData[e.type];
        if ("Factory" == e.type) {
            const t = mi.renderer.world.entityGrid.cellSize;
            this.draw.drawRect(e.x - this.maxFactoryDistance * t, e.y - this.maxFactoryDistance * t, e.x + this.maxFactoryDistance * t, e.y + this.maxFactoryDistance * t, {
                r: 0,
                b: 0,
                g: 0
            }, {
                r: 255,
                b: 0,
                g: 0
            }, 12)
        } else if (void 0 !== s.towerRadius)
            this.draw.drawCircle(e.x, e.y, s.towerRadius[e.tier - 1], 1 == this.numberOfRangesToDraw ? {
                r: 200,
                g: 160,
                b: 0
            } : {
                r: 0,
                g: 0,
                b: 0,
                a: 0
            }, {
                r: 255,
                g: 200,
                b: 0
            }, 8);
        else if (void 0 !== s.range && "SawTower" == e.type) {
            const t = s.range[e.tier - 1]
              , i = 48
              , n = 48;
            let r, a, o, h;
            0 == e.yaw ? (r = e.x - i,
            a = e.y - t,
            o = e.x + i,
            h = e.y - n) : 90 == e.yaw ? (r = e.x + n,
            a = e.y - i,
            o = e.x + t,
            h = e.y + i) : 180 == e.yaw ? (r = e.x - i,
            a = e.y + n,
            o = e.x + i,
            h = e.y + t) : 270 == e.yaw && (r = e.x - t,
            a = e.y - i,
            o = e.x - n,
            h = e.y + i),
            this.draw.drawRect(r, a, o, h, {
                r: 200,
                g: 160,
                b: 0
            }, {
                r: 255,
                g: 200,
                b: 0
            }, 8)
        }
    }
    stopWatching() {
        null != this.buildingUid && (this.harvesterSelectorModel.setVisible(!1),
        this.draw.clear(),
        this.element.style.left = "-1000px",
        this.element.style.top = "-1000px",
        this.upgradeElem.classList.remove("is-disabled"),
        this.buildingUid = null,
        this.buildingId = null,
        this.buildingTier = null,
        this.displayingHarvesterRange = !1,
        this.hide())
    }
    startWatching(t) {
        if (null !== this.buildingUid && this.stopWatching(),
        mi.ui.components.uiPlacementOverlay.cancelPlacing(),
        this.buildingUid = t,
        mi.ui.buildings[t])
            return mi.renderer.world.entities[this.buildingUid] ? (this.buildingId = mi.ui.buildings[t].type,
            this.buildingTier = mi.ui.buildings[t].tier,
            this.shouldUpdateRanges = !0,
            this.updateText(),
            this.show(),
            void this.update()) : this.stopWatching()
    }
    isActive() {
        return null != this.buildingUid
    }
    onRightMouseUp(t) {
        if ("Harvester" == this.buildingId && 1 == this.displayingHarvesterRange)
            return this.displayingHarvesterRange = !1,
            this.show(),
            this.shouldUpdateRanges = !0,
            void this.update();
        this.stopWatching()
    }
    toggleHarvesterTargetDisplay(t) {
        t.stopPropagation(),
        1 === t.which && (mi.renderer.world.entities[this.buildingUid].targetTick.targetResourceUid == me ? (this.displayingHarvesterRange = !0,
        this.hide()) : mi.network.sendRpc({
            name: "UpdateHarvesterTarget",
            harvesterUid: this.buildingUid,
            targetUid: me
        }),
        this.shouldUpdateRanges = !0,
        this.update())
    }
    purchaseHarvesterDrone(t) {
        1 === t.which && (t.stopPropagation(),
        mi.network.sendRpc({
            name: "BuyHarvesterDrone",
            harvesterUid: this.buildingUid
        }))
    }
}
