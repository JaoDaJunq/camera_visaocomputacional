export class SpellCastingExperience {
  constructor() {
    this.effects = [];
    this.lastSpell = "Nenhum";
    this.castCount = 0;
  }

  trigger(gesture, now = performance.now()) {
    if (!gesture) return;
    this.lastSpell = gesture.type;
    this.castCount++;
    const c = gesture.center || gesture.end || { x: 0, y: 0 };

    if (gesture.type === "circle") {
      const radius = Math.max(64, Math.max(gesture.width, gesture.height) / 2);
      this.effects.push({
        type: "portal",
        x: c.x,
        y: c.y,
        life: 1.8,
        max: 1.8,
        r: radius,
        spin: gesture.clockwise ? 1 : -1,
        confidence: gesture.confidence ?? 1,
      });
      this.sparkBurst(c.x, c.y, 26, ["#9b7bff", "#72ffd5", "#ffffff"], radius * .75);
    }

    if (gesture.type === "lightning") {
      this.effects.push({
        type: "lightning",
        x1: gesture.start.x,
        y1: gesture.start.y,
        x2: gesture.end.x,
        y2: gesture.end.y,
        life: .95,
        max: .95,
        seed: Math.random() * 1000,
        confidence: gesture.confidence ?? 1,
      });
      this.sparkBurst(gesture.end.x, gesture.end.y, 20, ["#fff86b", "#ffffff", "#8cc8ff"], 90);
    }

    if (gesture.type === "slash") {
      const strength = Math.max(.35, gesture.confidence ?? .7);
      this.effects.push({
        type: "slash",
        x1: gesture.start.x,
        y1: gesture.start.y,
        x2: gesture.end.x,
        y2: gesture.end.y,
        life: .72,
        max: .72,
        strength,
      });
      this.effects.push({
        type: "shockwave",
        x: gesture.end.x,
        y: gesture.end.y,
        life: .5,
        max: .5,
        r: 18,
      });
    }
  }

  sparkBurst(x, y, count, colors, speed = 120) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (.35 + Math.random() * .9);
      this.effects.push({
        type: "spark",
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: .45 + Math.random() * .55,
        max: 1,
        size: 2 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  update(dt) {
    for (const fx of this.effects) {
      fx.life -= dt;
      if (fx.type === "spark") {
        fx.x += fx.vx * dt;
        fx.y += fx.vy * dt;
        fx.vx *= Math.pow(.985, dt * 60);
        fx.vy *= Math.pow(.985, dt * 60);
      }
      if (fx.type === "shockwave") fx.r += 260 * dt;
    }
    this.effects = this.effects.filter(fx => fx.life > 0);
  }

  render(ctx, trail = []) {
    this.renderTrail(ctx, trail);
    for (const fx of this.effects) {
      if (fx.type === "portal") this.renderPortal(ctx, fx);
      if (fx.type === "lightning") this.renderLightning(ctx, fx);
      if (fx.type === "slash") this.renderSlash(ctx, fx);
      if (fx.type === "spark") this.renderSpark(ctx, fx);
      if (fx.type === "shockwave") this.renderShockwave(ctx, fx);
    }
  }

  renderTrail(ctx, trail) {
    if (trail.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "rgba(155,123,255,.8)";
    ctx.strokeStyle = "rgba(155,123,255,.82)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(114,255,213,.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  renderPortal(ctx, fx) {
    const a = Math.max(0, fx.life / fx.max);
    const phase = (1 - a) * Math.PI * 5 * fx.spin;
    ctx.save();
    ctx.translate(fx.x, fx.y);
    ctx.globalAlpha = Math.min(1, a * 1.35);
    ctx.globalCompositeOperation = "screen";

    const gradient = ctx.createRadialGradient(0, 0, fx.r * .15, 0, 0, fx.r * 1.05);
    gradient.addColorStop(0, "rgba(10,10,30,0)");
    gradient.addColorStop(.5, "rgba(114,255,213,.13)");
    gradient.addColorStop(.72, "rgba(155,123,255,.5)");
    gradient.addColorStop(1, "rgba(155,123,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, fx.r * 1.1, 0, Math.PI * 2);
    ctx.fill();

    for (let ring = 0; ring < 3; ring++) {
      ctx.save();
      ctx.rotate(phase * (ring % 2 ? -1 : 1) + ring * .7);
      ctx.strokeStyle = ring === 1 ? "#72ffd5" : "#9b7bff";
      ctx.lineWidth = ring === 1 ? 3 : 6;
      ctx.shadowBlur = 28;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath();
      const radius = fx.r * (1 - ring * .13);
      ctx.arc(0, 0, radius, ring * .3, Math.PI * 1.58 + ring * .45);
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < 22; i++) {
      const ang = phase * .8 + (i / 22) * Math.PI * 2;
      const wobble = .72 + .16 * Math.sin(i * 1.7 + phase * 2);
      const r = fx.r * wobble;
      ctx.fillStyle = i % 2 ? "#72ffd5" : "#c7b6ff";
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r, 2.5 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderLightning(ctx, fx) {
    const a = Math.max(0, fx.life / fx.max);
    const segments = 9;
    const dx = fx.x2 - fx.x1;
    const dy = fx.y2 - fx.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const points = [{ x: fx.x1, y: fx.y1 }];
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const wobble = Math.sin((i * 12.9898 + fx.seed) * 2.1) * 26 * a;
      points.push({ x: fx.x1 + dx * t + nx * wobble, y: fx.y1 + dy * t + ny * wobble });
    }
    points.push({ x: fx.x2, y: fx.y2 });

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = Math.min(1, a * 1.45);
    for (const layer of [
      { width: 18, color: "rgba(120,180,255,.25)", blur: 34 },
      { width: 8, color: "#fff86b", blur: 24 },
      { width: 3, color: "#ffffff", blur: 12 },
    ]) {
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = layer.width;
      ctx.shadowBlur = layer.blur;
      ctx.shadowColor = layer.color;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderSlash(ctx, fx) {
    const a = Math.max(0, fx.life / fx.max);
    const dx = fx.x2 - fx.x1;
    const dy = fx.y2 - fx.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const width = 18 + 18 * fx.strength;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = Math.min(1, a * 1.5);
    const grad = ctx.createLinearGradient(fx.x1, fx.y1, fx.x2, fx.y2);
    grad.addColorStop(0, "rgba(114,255,213,0)");
    grad.addColorStop(.48, "#72ffd5");
    grad.addColorStop(.7, "#ffffff");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = grad;
    ctx.lineCap = "round";
    ctx.shadowBlur = 32;
    ctx.shadowColor = "#72ffd5";
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(fx.x1 - nx * 8, fx.y1 - ny * 8);
    ctx.quadraticCurveTo((fx.x1 + fx.x2) / 2 + nx * 18, (fx.y1 + fx.y2) / 2 + ny * 18, fx.x2 + nx * 8, fx.y2 + ny * 8);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.restore();
  }

  renderSpark(ctx, fx) {
    const a = Math.max(0, fx.life / Math.max(fx.max, .001));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = fx.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = fx.color;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, fx.size * a, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderShockwave(ctx, fx) {
    const a = Math.max(0, fx.life / fx.max);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = "rgba(114,255,213,.9)";
    ctx.lineWidth = 5;
    ctx.shadowBlur = 24;
    ctx.shadowColor = "#72ffd5";
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
