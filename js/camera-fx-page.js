import { VisionCore } from "./vision.js";
import { CameraFXExperience } from "./experiences/camera-fx.js";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],video=$("#cam"),canvas=$("#overlay"),ctx=canvas.getContext("2d"),hint=$("#hint");
const vision=new VisionCore({video,maxHands:2,onStatus:()=>{}}),fx=new CameraFXExperience();
let running=false,raf=0,lastHands=[];
function resize(){canvas.width=video.videoWidth||960;canvas.height=video.videoHeight||540}
function point(lm,i){return{x:lm[i].x*canvas.width,y:lm[i].y*canvas.height}}
function avg(...pts){return{x:pts.reduce((s,p)=>s+p.x,0)/pts.length,y:pts.reduce((s,p)=>s+p.y,0)/pts.length}}
function buildHands(list){return(list||[]).slice(0,2).map(lm=>({palm:avg(point(lm,0),point(lm,5),point(lm,9),point(lm,13),point(lm,17))}))}
function loop(now=performance.now()){if(!running)return;resize();const result=vision.detect(now,{face:true});if(result){lastHands=buildHands(result.landmarks);fx.update(result.face,lastHands)}ctx.clearRect(0,0,canvas.width,canvas.height);fx.render(ctx,canvas.width,canvas.height,video);raf=requestAnimationFrame(loop)}
$("#camera").onclick=async()=>{if(running){vision.stop();running=false;cancelAnimationFrame(raf);hint.classList.remove("hidden");return}await vision.ensureFace();await vision.start();resize();running=true;hint.classList.add("hidden");loop()};
$("#nextFx").onclick=()=>fx.cycle();$$('[data-fx]').forEach(b=>b.onclick=()=>fx.setEffect(b.dataset.fx));vision.init();