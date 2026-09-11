import { HandLandmarker, FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const HAND_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const FACE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm";

export class VisionCore {
  constructor({ video, maxHands = 2, onStatus = () => {} } = {}) {
    this.video = video;
    this.maxHands = maxHands;
    this.onStatus = onStatus;
    this.visionFiles = null;
    this.landmarker = null;
    this.faceLandmarker = null;
    this.faceLoading = null;
    this.stream = null;
    this.running = false;
    this.facingMode = "user";
    this.lastVideoTime = -1;
    this.frameCounter = 0;
    this.lastFaceResult = null;
    this.mobile = matchMedia("(pointer:coarse)").matches;
  }

  async init() {
    this.onStatus("Carregando MediaPipe...", "");
    this.visionFiles = await FilesetResolver.forVisionTasks(WASM_URL);
    const common = {
      baseOptions: { modelAssetPath: HAND_MODEL_URL },
      runningMode: "VIDEO",
      numHands: this.maxHands,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    };

    try {
      this.landmarker = await HandLandmarker.createFromOptions(this.visionFiles, {
        ...common,
        baseOptions: { ...common.baseOptions, delegate: "GPU" },
      });
      this.onStatus("Pronto • mãos GPU", "ok");
    } catch (error) {
      console.warn("GPU indisponível para mãos, usando CPU", error);
      this.landmarker = await HandLandmarker.createFromOptions(this.visionFiles, common);
      this.onStatus("Pronto • mãos CPU", "ok");
    }
  }

  async ensureFace() {
    if (this.faceLandmarker) return this.faceLandmarker;
    if (this.faceLoading) return this.faceLoading;
    if (!this.visionFiles) this.visionFiles = await FilesetResolver.forVisionTasks(WASM_URL);

    this.onStatus("Carregando Face Tracking...", "");
    const common = {
      baseOptions: { modelAssetPath: FACE_MODEL_URL },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };

    this.faceLoading = (async () => {
      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(this.visionFiles, {
          ...common,
          baseOptions: { ...common.baseOptions, delegate: "GPU" },
        });
        this.onStatus("Pronto • mãos + rosto GPU", "ok");
      } catch (error) {
        console.warn("GPU indisponível para rosto, usando CPU", error);
        this.faceLandmarker = await FaceLandmarker.createFromOptions(this.visionFiles, common);
        this.onStatus("Pronto • mãos + rosto CPU", "ok");
      } finally {
        this.faceLoading = null;
      }
      return this.faceLandmarker;
    })();

    return this.faceLoading;
  }

  async start() {
    if (!this.landmarker) throw new Error("VisionCore ainda não inicializado");
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: this.mobile ? 720 : 1280 },
        height: { ideal: this.mobile ? 960 : 720 },
      },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.running = true;
    this.lastVideoTime = -1;
    this.frameCounter = 0;
    this.lastFaceResult = null;
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.lastFaceResult = null;
  }

  async switchCamera() {
    this.facingMode = this.facingMode === "user" ? "environment" : "user";
    const wasRunning = this.running;
    if (wasRunning) this.stop();
    if (wasRunning) await this.start();
  }

  detect(now = performance.now(), { face = false } = {}) {
    if (!this.running || !this.landmarker || this.video.readyState < 2) return null;
    if (this.video.currentTime === this.lastVideoTime) return null;
    this.lastVideoTime = this.video.currentTime;
    this.frameCounter++;

    const handResult = this.landmarker.detectForVideo(this.video, now);
    let faceResult = null;

    if (face && this.faceLandmarker) {
      const shouldRunFace = !this.mobile || this.frameCounter % 2 === 0 || !this.lastFaceResult;
      if (shouldRunFace) {
        this.lastFaceResult = this.faceLandmarker.detectForVideo(this.video, now);
      }
      faceResult = this.lastFaceResult;
    }

    return {
      landmarks: handResult.landmarks || [],
      handedness: handResult.handedness || [],
      face: faceResult,
    };
  }
}

export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],[0,17]
];
