const FACES = ["😂","😎","🥴","🤡","👽","😡","😵‍💫","🥸","🐸","💀","🗿","😈"];

export class EmojiPlaygroundExperience {
  constructor() {
    this.emojis = [];
    this.particles = [];
    this.grabbed = null;
    this.hits = 0;
    this.peaceCooldown = 0;
  }

  reset(width, height) {
    this.emojis = [];
    this.particles = [];
    this.grabbed = null;
    this.hits = 0;
    if (!width || !height) return;
    for (let i = 0; i < 5; i++) this.spawn(width, height);
  }

  spawn(width, height, x = width * (.2 + Math.random() * .6), y = height * (.18 + Math.random() * .45)) {
    this.emojis.push({
      face: FACES[Math.floor(Math.random() * FACES.length)],
      x, y,
      vx: (Math.random() - .5) * 70,
      vy: 0,
      r: Math.max(34, width / 24),
      hitAt: 0,
      spin: 0,
      rot: 0,
    });
  }

  distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  nearest(point) {
    let best = null, bestD = Infinity;
    for (const e of this.emojis) {
      const d = this.distance(point, e);
      if (d < e.r + 42 && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  burst(x, y, type = "hit") {
    const chars = type === "peace" ? ["✨","💖","⭐","✨"] : ["💥","✨","⚡","💫"];
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 100 + Math.random() * 260;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 70,
        life: .55 + Math.random() * .35,
        max: .9,
        char: chars[Math.floor(Math.random() * chars.length)],
        size: 18 + Math.random() * 18,
      });
    }
  }

  update(hand, now, width) {
    if (!hand?.palm) {
      this.grabbed = null;
      return;
    }

    if (hand.gesture === "pinch" && hand.pinch) {
      if (!this.grabbed) this.grabbed = this.nearest(hand.pinch);
      if (this.grabbed) {
        this.grabbed.x = hand.pinch.x;
        this.grabbed.y = hand.pinch.y;
        this.grabbed.vx = hand.vx;
        this.grabbed.vy = hand.vy;
        this.grabbed.spin = hand.vx * .002;
      }
    } else if (this.grabbed) {
      this.grabbed.vx = hand.vx * .75;
      this.grabbed.vy = hand.vy * .75;
      this.grabbed.spin = hand.vx * .0025;
      this.grabbed = null;
    }

    const threshold = Math.max(700, width * .85);
    if (hand.speed > threshold) {
      for (const e of this.emojis) {
        if (e === this.grabbed || now - e.hitAt < 280) continue;
        if (this.distance(hand.palm, e) < e.r + Math.max(60, width / 14)) {
          const power = Math.min(hand.speed / threshold, 2.8);
          e.vx += hand.vx * .62 * power;
          e.vy += hand.vy * .62 * power;
          e.spin += (hand.vx > 0 ? 1 : -1) * power * 4;
          e.hitAt = now;
          this.hits++;
          this.burst(e.x, e.y, "hit");
        }
      }
    }

    if (hand.gesture === "peace" && now > this.peaceCooldown) {
      this.burst(hand.palm.x, hand.palm.y, "peace");
      this.peaceCooldown = now + 900;
    }
  }

  physics(dt, width, height) {
    const g = height * .85;
    for (const e of this.emojis) {
      if (e === this.grabbed) continue;
      e.vy += g * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.rot += e.spin * dt;
      e.vx *= Math.pow(.985, dt * 60);
      e.vy *= Math.pow(.995, dt * 60);
      e.spin *= Math.pow(.97, dt * 60);
      const r = e.r;
      if (e.x < r) { e.x = r; e.vx = Math.abs(e.vx) * .72; }
      if (e.x > width - r) { e.x = width - r; e.vx = -Math.abs(e.vx) * .72; }
      if (e.y < r) { e.y = r; e.vy = Math.abs(e.vy) * .65; }
      if (e.y > height - r) {
        e.y = height - r;
        e.vy = -Math.abs(e.vy) * .62;
        e.vx *= .93;
        if (Math.abs(e.vy) < 35) e.vy = 0;
      }
    }

    for (let i = 0; i < this.emojis.length; i++) {
      for (let j = i + 1; j < this.emojis.length; j++) {
        const a = this.emojis[i], b = this.emojis[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy), min = a.r + b.r;
        if (d > 0 && d < min) {
          const nx = dx / d, ny = dy / d, over = (min - d) / 2;
          if (a !== this.grabbed) { a.x -= nx * over; a.y -= ny * over; }
          if (b !== this.grabbed) { b.x += nx * over; b.y += ny * over; }
          const sep = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (sep < 0) {
            const impulse = -sep * .72;
            if (a !== this.grabbed) { a.vx -= impulse * nx; a.vy -= impulse * ny; }
            if (b !== this.grabbed) { b.vx += impulse * nx; b.vy += impulse * ny; }
          }
        }
      }
    }

    for (const p of this.particles) {
      p.vy += g * .35 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  render(ctx, now) {
    for (const e of this.emojis) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.rot);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${e.r * 1.55}px system-ui`;
      if (e === this.grabbed) {
        ctx.shadowBlur = 28;
        ctx.shadowColor = "rgba(114,255,213,.9)";
      } else if (now - e.hitAt < 180) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = "rgba(255,235,90,.9)";
      }
      ctx.fillText(e.face, 0, 0);
      ctx.restore();
    }

    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${p.size}px system-ui`;
      ctx.fillText(p.char, p.x, p.y);
      ctx.restore();
    }
  }
}
