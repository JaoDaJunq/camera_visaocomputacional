export class SpellCastingExperience {
  constructor() {
    this.effects = [];
    this.lastSpell = "Nenhum";
  }

  trigger(gesture, now = performance.now()) {
    if (!gesture) return;
    this.lastSpell = gesture.type;
    const c = gesture.center || gesture.end || { x: 0, y: 0 };

    if (gesture.type === "circle") {
      this.effects.push({ type: "portal", x: c.x, y: c.y, life: 1.3, max: 1.3, r: Math.max(60, Math.max(gesture.width, gesture.height) / 2) });
    } else if (gesture.type === "lightning") {
      this.effects.push({ type: "lightning", x1: gesture.start.x, y1: gesture.start.y, x2: gesture.end.x, y2: gesture.end.y, life: .65, max: .65 });
    } else if (gesture.type === "slash") {
      this.effects.push({ type: "slash", x1: gesture.start.x, y1: gesture.start.y, x2: gesture.end.x, y2: gesture.end.y, life: .55, max: .55 });
    }
  }

  update(dt) {
    for (const fx of this.effects) fx.life -= dt;
    this.effects = this.effects.filter(fx => fx.life > 0);
  }

  render(ctx, trail = []) {
    if (trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = "rgba(155,123,255,.78)";
      ctx.lineWidth = 5;
      ctx.shadowBlur = 18;
      ctx.shadowColor = "rgba(155,123,255,.8)";
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
      ctx.restore();
    }

    for (const fx of this.effects) {
      const a = Math.max(0, fx.life / fx.max);
      if (fx.type === "portal") {
        ctx.save();
        ctx.translate(fx.x, fx.y);
        ctx.rotate((1 - a) * Math.PI * 2);
        ctx.globalAlpha = a;
        ctx.strokeStyle = "#9b7bff";
        ctx.lineWidth = 8;
        ctx.shadowBlur = 28;
        ctx.shadowColor = "#9b7bff";
        ctx.beginPath();
        ctx.arc(0, 0, fx.r * (1 + (1 - a) * .12), 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#72ffd5";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, fx.r * .72, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 18; i++) {
          const ang = i / 18 * Math.PI * 2;
          const r = fx.r * (.65 + .25 * Math.sin(i * 2.1 + (1-a)*8));
          ctx.fillStyle = i % 2 ? "#72ffd5" : "#9b7bff";
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r, 4 + (i % 3), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (fx.type === "lightning") {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = "#f8f36d";
        ctx.lineWidth = 7;
        ctx.shadowBlur = 25;
        ctx.shadowColor = "#f8f36d";
        ctx.beginPath();
        ctx.moveTo(fx.x1, fx.y1);
        const seg = 7;
        for (let i = 1; i < seg; i++) {
          const t = i / seg;
          const x = fx.x1 + (fx.x2 - fx.x1) * t + (Math.random() - .5) * 38;
          const y = fx.y1 + (fx.y2 - fx.y1) * t + (Math.random() - .5) * 38;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(fx.x2, fx.y2);
        ctx.stroke();
        ctx.restore();
      }

      if (fx.type === "slash") {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = "#72ffd5";
        ctx.lineWidth = 10;
        ctx.shadowBlur = 30;
        ctx.shadowColor = "#72ffd5";
        ctx.beginPath();
        ctx.moveTo(fx.x1, fx.y1);
        ctx.lineTo(fx.x2, fx.y2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}
