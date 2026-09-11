import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm";

export class VisionCore {
  constructor({ video, maxHands = 2, onStatus = () => {} } = {}) {
    this.video = video;
    this.maxHands = maxHands;
    this.onStatus = onStatus;
    this.landmarker = null;
    this.stream = null;
    this.running = false;
    this.facingMode = "user";
    this.lastVideoTime = -1;
  }

  async init() {
    this.onStatus("Carregando MediaPipe...", "");
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    const common = {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: "VIDEO",
      numHands: this.maxHands,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    };

    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        ...common,
        baseOptions: { ...common.baseOptions, delegate: "GPU" },
      });
      this.onStatus("Pronto • GPU", "ok");
    } catch (error) {
      console.warn("GPU indisponível, usando CPU", error);
      this.landmarker = await HandLandmarker.createFromOptions(vision, common);
      this.onStatus("Pronto • CPU", "ok");
    }
  }

  async start() {
    if (!this.landmarker) throw new Error("VisionCore ainda não inicializado");
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: matchMedia("(pointer:coarse)").matches ? 720 : 1280 },
        height: { ideal: matchMedia("(pointer:coarse)").matches ? 960 : 720 },
      },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.running = true;
    this.lastVideoTime = -1;
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  async switchCamera() {
    this.facingMode = this.facingMode === "user" ? "environment" : "user";
    const wasRunning = this.running;
    if (wasRunning) this.stop();
    if (wasRunning) await this.start();
  }

  detect(now = performance.now()) {
    if (!this.running || !this.landmarker || this.video.readyState < 2) return null;
    if (this.video.currentTime === this.lastVideoTime) return null;
    this.lastVideoTime = this.video.currentTime;
    return this.landmarker.detectForVideo(this.video, now);
  }
}

export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],[0,17]
];
