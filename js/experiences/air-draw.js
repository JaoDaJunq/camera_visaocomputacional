export class AirDrawExperience {
  constructor({ paintCanvas }) {
    this.canvas = paintCanvas;
    this.ctx = paintCanvas.getContext("2d");
    this.lastPoint = null;
  }

  resize(width, height) {
    if (this.canvas.width === width && this.canvas.height === height) return;
    const old = document.createElement("canvas");
    old.width = this.canvas.width || width;
    old.height = this.canvas.height || height;
    old.getContext("2d").drawImage(this.canvas, 0, 0);
    this.canvas.width = width;
    this.canvas.height = height;
    if (old.width && old.height) this.ctx.drawImage(old, 0, 0, width, height);
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.lastPoint = null;
  }

  resetStroke() {
    this.lastPoint = null;
  }

  update({ gesture, point }) {
    if (gesture !== "point" || !point) {
      this.lastPoint = null;
      return;
    }

    if (!this.lastPoint) {
      this.lastPoint = point;
      return;
    }

    this.ctx.save();
    this.ctx.strokeStyle = "#72ffd5";
    this.ctx.lineWidth = Math.max(6, this.canvas.width / 170);
    this.ctx.shadowBlur = 11;
    this.ctx.shadowColor = "rgba(114,255,213,.65)";
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();
    this.ctx.restore();
    this.lastPoint = point;
  }
}
