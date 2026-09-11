export class MotionEngine {
  constructor({ maxAgeMs = 1300, minPointDistance = 7 } = {}) {
    this.maxAgeMs = maxAgeMs;
    this.minPointDistance = minPointDistance;
    this.trail = [];
    this.lastDetectedAt = 0;
    this.cooldownMs = 700;
  }

  reset() {
    this.trail = [];
    this.lastDetectedAt = 0;
  }

  update(point, active, now = performance.now()) {
    if (!active || !point) {
      this.trail = this.trail.filter(p => now - p.t <= 240);
      return null;
    }

    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= this.minPointDistance) {
      this.trail.push({ x: point.x, y: point.y, t: now });
    }
    this.trail = this.trail.filter(p => now - p.t <= this.maxAgeMs);

    if (now - this.lastDetectedAt < this.cooldownMs) return null;
    const gesture = this.detect();
    if (gesture) {
      this.lastDetectedAt = now;
      this.trail = [];
      return gesture;
    }
    return null;
  }

  detect() {
    const p = this.trail;
    if (p.length < 8) return null;
    const stats = this.stats(p);

    if (stats.width > 110 && stats.height > 110 && stats.endDistance < Math.max(stats.width, stats.height) * .36 && stats.pathLength > (stats.width + stats.height) * 2.25) {
      const ratio = stats.width / Math.max(stats.height, 1);
      if (ratio > .55 && ratio < 1.8) return { type: "circle", ...stats };
    }

    if (p.length >= 12 && stats.width > 150 && stats.height > 80) {
      const third = Math.floor(p.length / 3);
      const a0 = p[0], a1 = p[third];
      const b0 = p[third], b1 = p[third * 2];
      const c0 = p[third * 2], c1 = p[p.length - 1];
      const v1 = { x: a1.x - a0.x, y: a1.y - a0.y };
      const v2 = { x: b1.x - b0.x, y: b1.y - b0.y };
      const v3 = { x: c1.x - c0.x, y: c1.y - c0.y };
      if (v1.x > 60 && v2.x < -45 && v2.y > 45 && v3.x > 60) return { type: "lightning", ...stats };
    }

    if (stats.displacement > 170 && stats.straightness > .84 && stats.duration < 800) {
      return { type: "slash", ...stats, dx: p[p.length - 1].x - p[0].x, dy: p[p.length - 1].y - p[0].y };
    }

    return null;
  }

  stats(points) {
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    let pathLength = 0;
    for (let i = 1; i < points.length; i++) pathLength += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
    const start = points[0], end = points[points.length - 1];
    const displacement = Math.hypot(end.x - start.x, end.y - start.y);
    return {
      start, end,
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      width: maxX - minX,
      height: maxY - minY,
      pathLength,
      displacement,
      endDistance: displacement,
      straightness: pathLength ? displacement / pathLength : 0,
      duration: end.t - start.t,
    };
  }
}
