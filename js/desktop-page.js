import { VisionCore } from "./vision.js";
import { GestureEngine } from "./gesture-engine.js";
import { DesktopControlExperience } from "./experiences/desktop-control.js";
const $=s=>document.querySelector(s),video=$("#cam"),canvas=$("#overlay"),ctx=canvas.getContext("2d"),hint=$("#hint");
const vision=new VisionCore({video,maxHands:1,onStatus:()=>{}}),gestures=new GestureEngine({dwellMs:90,releaseGraceMs:150,smoothingAlpha:.4}),desktop=new DesktopControlExperience();
let running=false,raf=0,last=null,hand={gesture:"none",point:null,palm:null,vx:0,vy:0,speed:0};
const point=(lm,i)=>({x:lm[i].x*canvas.width,y:lm[i].y*canvas.height});
const avg=(...p)=>({x:p.reduce((s,v)=>s+v.x,0)/p.length,y:p.reduce((s,v)=>s+v.y,0)/p.length});
function resize(){canvas.width=video.videoWidth||960;canvas.height=video.videoHeight||540}
function update(lm,now){if(!lm){hand={gesture:"none",point:null,palm:null,vx:0,vy:0,speed:0};last=null;return}const raw=gestures.classify(lm,canvas.width,canvas.height),snap=gestures.update(raw,now),index=gestures.smoothPoint(point(lm,8)),palm=avg(point(lm,0),point(lm,5),point(lm,9),point(lm,13),point(lm,17));let vx=0,vy=0,speed=0;if(last){const dt=Math.max((now-last.t)/1000,.001);vx=(palm.x-last.x)/dt;vy=(palm.y-last.y)/dt;speed=Math.hypot(vx,vy)}last={x:palm.x,y:palm.y,t:now};hand={gesture:snap.active,point:index,palm,vx,vy,speed}}
function render(){ctx.clearRect(0,0,canvas.width,canvas.height);desktop.render(ctx,canvas.width,canvas.height);if(hand.point){ctx.save();ctx.beginPath();ctx.arc(hand.point.x,hand.point.y,12,0,Math.PI*2);ctx.fillStyle="#72ffd5";ctx.fill();ctx.restore()}}
function loop(now=performance.now()){if(!running)return;const r=vision.detect(now);if(r)update(r.landmarks?.[0],now);desktop.update(hand,now,canvas.width,canvas.height);render();raf=requestAnimationFrame(loop)}
$("#camera").onclick=async()=>{if(running){vision.stop();running=false;cancelAnimationFrame(raf);hint.classList.remove("hidden");return}await vision.start();resize();running=true;hint.classList.add("hidden");loop()};
$("#connect").onclick=async()=>{await desktop.connect();render()};$("#arm").onclick=async()=>{desktop.armed?desktop.disarm():await desktop.arm();render()};$("#left").onclick=()=>desktop.key("left");$("#right").onclick=()=>desktop.key("right");$("#space").onclick=()=>desktop.key("space");
vision.init();