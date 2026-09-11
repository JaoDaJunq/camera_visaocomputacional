export class MotionEngine {
  constructor({ maxAgeMs = 1800, minPointDistance = 7, minPoints = 7, cooldownMs = 420 } = {}) {
    this.maxAgeMs = maxAgeMs;
    this.minPointDistance = minPointDistance;
    this.minPoints = minPoints;
    this.cooldownMs = cooldownMs;
    this.trail = [];
    this.recording = false;
    this.lastDetectedAt = 0;
    this.lastResult = null;
  }

  reset({ keepCooldown = false } = {}) {
    this.trail = [];
    this.recording = false;
    this.lastResult = null;
    if (!keepCooldown) this.lastDetectedAt = 0;
  }

  update(point, active, now = performance.now(), bounds = {}) {
    if (active && point) {
      if (!this.recording) {
        this.recording = true;
        this.trail = [];
      }

      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= this.minPointDistance) {
        this.trail.push({ x: point.x, y: point.y, t: now });
      }

      this.trail = this.trail.filter(p => now - p.t <= this.maxAgeMs);
      return null;
    }

    if (!this.recording) return null;

    this.recording = false;
    const points = [...this.trail];
    this.trail = [];

    if (points.length < this.minPoints || now - this.lastDetectedAt < this.cooldownMs) return null;

    const result = this.detect(points, bounds);
    if (result) {
      this.lastDetectedAt = now;
      this.lastResult = result;
    }
    return result;
  }

  detect(points = this.trail, bounds = {}) {
    if (!points || points.length < this.minPoints) return null;

    const stats = this.stats(points);
    const screenW = bounds.width || Math.max(stats.width * 3, 640);
    const screenH = bounds.height || Math.max(stats.height * 3, 480);
    const minDim = Math.max(Math.min(screenW, screenH), 1);
    const diag = Math.hypot(screenW, screenH);
    const resampled = this.resample(points, 31);

    const circle = this.detectCircle(points, stats, minDim);
    if (circle) return { type: "circle", ...stats, ...circle };

    const lightning = this.detectLightning(resampled, stats, minDim);
    if (lightning) return { type: "lightning", ...stats, ...lightning };

    const slash = this.detectSlash(stats, minDim, diag);
    if (slash) return { type: "slash", ...stats, ...slash };

    return null;
  }

  detectCircle(points, stats, minDim) {
    const minSize = minDim * 0.15;
    if (stats.width < minSize || stats.height < minSize) return null;

    const ratio = stats.width / Math.max(stats.height, 1);
    if (ratio < 0.5 || ratio > 1.95) return null;

    const diameter = (stats.width + stats.height) / 2;
    if (stats.endDistance > diameter * 0.48) return null;
    if (stats.pathLength < Math.PI * diameter * 0.68) return null;

    const turning = this.turningStats(points);
    if (turning.totalAbs < Math.PI * 1.55) return null;
    if (turning.dominance < 0.58) return null;

    return {
      confidence: this.clamp(
        0.35 * (1 - stats.endDistance / Math.max(diameter * 0.48, 1)) +
        0.35 * Math.min(turning.totalAbs / (Math.PI * 2), 1) +
        0.30 * turning.dominance,
        0,
        1
      ),
      clockwise: turning.signed > 0,
    };
  }

  detectLightning(points, stats, minDim) {
    if (points.length < 20) return null;
    if (stats.width < minDim * 0.2 || stats.height < minDim * 0.11) return null;

    const a = points[0];
    const b = points[10];
    const c = points[20];
    const d = points[30];
    const s1 = { dx: b.x - a.x, dy: b.y - a.y };
    const s2 = { dx: c.x - b.x, dy: c.y - b.y };
    const s3 = { dx: d.x - c.x, dy: d.y - c.y };

    const sign1 = Math.sign(s1.dx);
    const sign2 = Math.sign(s2.dx);
    const sign3 = Math.sign(s3.dx);
    if (!sign1 || !sign2 || !sign3) return null;

    const alternating = sign1 === sign3 && sign1 === -sign2;
    if (!alternating) return null;

    const horizontalEnough =
      Math.abs(s1.dx) > stats.width * 0.42 &&
      Math.abs(s2.dx) > stats.width * 0.32 &&
      Math.abs(s3.dx) > stats.width * 0.42;
    if (!horizontalEnough) return null;

    const diagonalDown = s2.dy > stats.height * 0.28;
    const topAndBottomFlat = Math.abs(s1.dy) < stats.height * 0.45 && Math.abs(s3.dy) < stats.height * 0.45;
    if (!diagonalDown || !topAndBottomFlat) return null;

    const zigzagLength = Math.hypot(s1.dx, s1.dy) + Math.hypot(s2.dx, s2.dy) + Math.hypot(s3.dx, s3.dy);
    const efficiency = stats.pathLength ? zigzagLength / stats.pathLength : 0;
    if (efficiency < 0.72) return null;

    return {
      confidence: this.clamp(0.55 + efficiency * 0.35, 0, 1),
      mirrored: sign1 < 0,
    };
  }

  detectSlash(stats, minDim, diag) {
    if (stats.duration <= 0 || stats.duration > 900) return null;
    if (stats.displacement < Math.max(minDim * 0.18, 105)) return null;
    if (stats.straightness < 0.91) return null;

    const seconds = Math.max(stats.duration / 1000, 0.001);
    const averageSpeed = stats.pathLength / seconds;
    if (averageSpeed < Math.max(minDim * 0.72, 430)) return null;

    const dx = stats.end.x - stats.start.x;
    const dy = stats.end.y - stats.start.y;
    const strength = this.clamp((averageSpeed / Math.max(diag, 1)) * 1.5, 0.35, 1);

    return {
      dx,
      dy,
      averageSpeed,
      confidence: this.clamp(0.55 * stats.straightness + 0.45 * strength, 0, 1),
    };
  }

  resample(points, count = 31) {
    if (!points?.length) return [];
    if (points.length === 1 || count <= 1) return [points[0]];

    const cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    }
    const total = cumulative[cumulative.length - 1];
    if (total === 0) return Array.from({ length: count }, () => ({ ...points[0] }));

    const out = [];
    let segment = 1;
    for (let i = 0; i < count; i++) {
      const target = total * (i / (count - 1));
      while (segment < cumulative.length - 1 && cumulative[segment] < target) segment++;
      const prev = Math.max(segment - 1, 0);
      const span = Math.max(cumulative[segment] - cumulative[prev], 0.0001);
      const t = (target - cumulative[prev]) / span;
      out.push({
        x: points[prev].x + (points[segment].x - points[prev].x) * t,
        y: points[prev].y + (points[segment].y - points[prev].y) * t,
        t: points[prev].t + ((points[segment].t ?? points[prev].t) - points[prev].t) * t,
      });
    }
    return out;
  }

  turningStats(points) {
    let signed = 0;
    let totalAbs = 0;
    let positive = 0;
    let negative = 0;

    for (let i = 2; i < points.length; i++) {
      const a1 = Math.atan2(points[i - 1].y - points[i - 2].y, points[i - 1].x - points[i - 2].x);
      const a2 = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x);
      let delta = a2 - a1;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      if (Math.abs(delta) < 0.035) continue;
      signed += delta;
      totalAbs += Math.abs(delta);
      if (delta > 0) positive += Math.abs(delta);
      else negative += Math.abs(delta);
    }

    const dominant = Math.max(positive, negative);
    return {
      signed,
      totalAbs,
      dominance: totalAbs ? dominant / totalAbs : 0,
    };
  }

  stats(points) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    let pathLength = 0;
    for (let i = 1; i < points.length; i++) {
      pathLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }

    const start = points[0];
    const end = points[points.length - 1];
    const displacement = Math.hypot(end.x - start.x, end.y - start.y);

    return {
      start,
      end,
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      width: maxX - minX,
      height: maxY - minY,
      pathLength,
      displacement,
      endDistance: displacement,
      straightness: pathLength ? displacement / pathLength : 0,
      duration: Math.max((end.t ?? 0) - (start.t ?? 0), 0),
      points: points.length,
    };
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}
