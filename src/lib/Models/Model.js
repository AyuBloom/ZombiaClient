import Node from "./Node";

export default class extends Node {
  static isPoolable = false;

  static getOrCreate(game, t) {
    const pool = game.getPool(this, t);
    if (pool && pool.length > 0) {
      const instance = pool.pop();
      instance.resetForReuse(t);
      return instance;
    }
    return new this(game, t);
  }

  constructor(game) {
    super(game);
    this.hasDeathFadeEffect = false;
    this.deathFadeEffect = {
      inUse: !1,
      id: 0,
      diedTick: 0,
      lastFramePosition: {
        x: 0,
        y: 0,
      },
      lastFrameVelocity: {
        x: 0,
        y: 0,
      },
      shouldUpdatePosition: !0,
      fadeOutTime: 0,
      maxScaleIncreasePercent: 0,
    };
  }
  reset() {
    this.setParent(null);
  }
  setParent(t) {
    if (null == t && this.constructor.isPoolable) {
      this.parent = null;
      this.removedParentFunction();
      this.recycle();
    } else {
      super.setParent(t);
    }
  }
  removedParentFunction() {
    if (this.constructor.isPoolable) {
      this.savedAttachments = this.attachments;
      this.attachments = [];
    }
  }
  recycle() {
    const args = {};
    if (this.projectileKind) args.projectileKind = this.projectileKind;
    const pool = this.game.getPool(this.constructor, args);
    if (pool && !pool.includes(this)) {
      pool.push(this);
    }
  }
  resetForReuse(t) {
    if (this.savedAttachments) {
      this.attachments = this.savedAttachments;
      this.savedAttachments = null;
    }
    this.setAlpha(1);
    this.setScale(1);
    this.setVisible(true);
    this.deathFadeEffect.inUse = false;
    this.setRotation(0);
    if (t && void 0 !== t.tier) {
      this.tier = t.tier;
    }
    this.currentRotation = 0;
    if (this.base) {
      this.base.setRotation(0);
      this.base.setTint(16777215);
    }
  }
  updateDeathFadeEffect(t, e) {
    const r =
        this.game.renderer.replicator.currentTick.tick -
        this.deathFadeEffect.diedTick,
      n =
        this.deathFadeEffect.fadeOutTime /
        this.game.renderer.replicator.msPerTick,
      i = 1 - r / n;
    if (i <= 0)
      return void this.game.renderer.deleteFadingAttachment(
        this.deathFadeEffect.id,
      );
    this.setAlpha(i);
    const o = 1 + (r / n) * this.deathFadeEffect.maxScaleIncreasePercent;
    (this.setScale(o),
      1 == this.deathFadeEffect.shouldUpdatePosition &&
        (this.parent.setPositionX(this.deathFadePosition || this.deathFadeEffect.lastFramePosition.x),
        this.parent.setPositionY(this.deathFadePosition || this.deathFadeEffect.lastFramePosition.y),
        (this.deathFadeEffect.lastFramePosition.x +=
          (this.deathFadeEffect.lastFrameVelocity.x /
            2 /
            this.game.renderer.replicator.msPerTick) *
          t),
        (this.deathFadeEffect.lastFramePosition.y +=
          (this.deathFadeEffect.lastFrameVelocity.y /
            2 /
            this.game.renderer.replicator.msPerTick) *
          t)));
  }
  update(t, e) {
    (super.update(t, e),
      1 == this.hasDeathFadeEffect &&
        1 == this.deathFadeEffect?.inUse &&
        this.updateDeathFadeEffect(t, e));
  }
}
