export class GestureEngine {
  constructor({ dwellMs = 90, releaseGraceMs = 160, smoothingAlpha = 0.38 } = {}) {
    this.dwellMs = dwellMs;
    this.releaseGraceMs = releaseGraceMs;
    this.smoothingAlpha = smoothingAlpha;
    this.active = "none";
    this.candidate = "none";
    this.candidateSince = 0;
    this.lastSeenActive = 0;
    this.smoothed = null;
  }

  reset() {
    this.active = "none";
    this.candidate = "none";
    this.candidateSince = 0;
    this.lastSeenActive = 0;
    this.smoothed = null;
  }

  smoothPoint(point) {
    if (!point) return null;
    if (!this.smoothed) return (this.smoothed = { ...point });
    const a = this.smoothingAlpha;
    this.smoothed.x += (point.x - this.smoothed.x) * a;
    this.smoothed.y += (point.y - this.smoothed.y) * a;
    return { ...this.smoothed };
  }

  classify(landmarks, width, height) {
    if (!landmarks?.length) return "none";
    const pt = i => ({ x: landmarks[i].x * width, y: landmarks[i].y * height });
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const wrist = pt(0), middleBase = pt(9), thumbTip = pt(4), indexTip = pt(8);
    const handScale = Math.max(d(wrist, middleBase), 1);
    const pinching = d(thumbTip, indexTip) / handScale < 0.34;

    const index = landmarks[8].y < landmarks[6].y;
    const middle = landmarks[12].y < landmarks[10].y;
    const ring = landmarks[16].y < landmarks[14].y;
    const pinky = landmarks[20].y < landmarks[18].y;
    const upCount = [index, middle, ring, pinky].filter(Boolean).length;

    if (pinching) return "pinch";
    if (index && !middle && !ring && !pinky) return "point";
    if (index && middle && !ring && !pinky) return "peace";
    if (upCount === 4) return "open";
    if (upCount === 0) return "fist";
    return "hand";
  }

  update(rawGesture, now = performance.now()) {
    if (rawGesture === this.active) {
      this.lastSeenActive = now;
      this.candidate = rawGesture;
      this.candidateSince = now;
      return this.snapshot(rawGesture, now);
    }

    if (rawGesture === "none" && this.active !== "none") {
      if (now - this.lastSeenActive <= this.releaseGraceMs) {
        return this.snapshot(rawGesture, now);
      }
    }

    if (rawGesture !== this.candidate) {
      this.candidate = rawGesture;
      this.candidateSince = now;
      return this.snapshot(rawGesture, now);
    }

    if (now - this.candidateSince >= this.dwellMs) {
      this.active = rawGesture;
      this.lastSeenActive = now;
    }

    return this.snapshot(rawGesture, now);
  }

  snapshot(raw, now) {
    const progress = this.active === this.candidate
      ? 1
      : Math.max(0, Math.min(1, (now - this.candidateSince) / this.dwellMs));
    return {
      raw,
      candidate: this.candidate,
      active: this.active,
      progress,
      dwellMs: this.dwellMs,
      releaseGraceMs: this.releaseGraceMs,
    };
  }
}

export function gestureLabel(g) {
  return ({
    none: "Nenhuma mão",
    hand: "🖐️ Mão",
    open: "✋ Mão aberta",
    fist: "✊ Punho",
    point: "☝️ Indicador",
    pinch: "🤏 Pinça",
    peace: "✌️ Paz",
  })[g] || g;
}
