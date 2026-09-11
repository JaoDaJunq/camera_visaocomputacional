import { VisionCore, HAND_CONNECTIONS } from "./vision.js";
import { GestureEngine, gestureLabel } from "./gesture-engine.js";
import { MotionEngine } from "./motion-engine.js";
import { AirDrawExperience } from "./experiences/air-draw.js";
import { EmojiPlaygroundExperience } from "./experiences/emoji-playground.js";
import { SpellCastingExperience } from "./experiences/spell-casting.js";
import { FaceLabExperience } from "./experiences/face-lab.js";
import { EyeTrackingExperience } from "./experiences/eye-tracking.js";
import { AbsoluteCinemaEffect } from "./experiences/absolute-cinema.js";

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const hubView=$("#hubView"),experienceView=$("#experienceView"),experienceName=$("#experienceName"),experienceDesc=$("#experienceDesc"),backBtn=$("#backBtn"),cameraBtn=$("#cameraBtn"),switchBtn=$("#switchBtn"),skeletonToggle=$("#skeletonToggle"),debugToggle=$("#debugToggle"),statusEl=$("#status"),fpsEl=$("#fps"),gestureEl=$("#gesture"),handsEl=$("#hands"),modeEl=$("#mode"),hitBox=$("#hitBox"),hitsEl=$("#hits"),hint=$("#hint"),moduleActions=$("#moduleActions"),helpGrid=$("#helpGrid"),debugPanel=$("#debugPanel"),debugRaw=$("#debugRaw"),debugCandidate=$("#debugCandidate"),debugActive=$("#debugActive"),debugSpeed=$("#debugSpeed"),dwellBar=$("#dwellBar"),toast=$("#toast");
const video=$("#cam"),overlay=$("#overlay"),paint=$("#paint"),oc=overlay.getContext("2d");

const mobile=matchMedia("(pointer:coarse)").matches;
const vision=new VisionCore({video,maxHands:2,onStatus:setStatus});
const gestureEngine=new GestureEngine({dwellMs:90,releaseGraceMs:160,smoothingAlpha:.38});
const motionEngine=new MotionEngine({maxAgeMs:1800,minPointDistance:mobile?9:7,minPoints:7,cooldownMs:420});
const airDraw=new AirDrawExperience({paintCanvas:paint});
const emojiPlayground=new EmojiPlaygroundExperience();
const spellCasting=new SpellCastingExperience();
const faceLab=new FaceLabExperience();
const eyeTracking=new EyeTrackingExperience();
const absoluteCinema=new AbsoluteCinemaEffect();

let running=false,currentExperience=null,lastFrameTime=performance.now(),lastHandSample=null,lastLandmarks=[],lastFaceResult=null,hand=emptyHand(),frames=0,fpsWindow=performance.now(),raf=null;
let comboSince=0,comboLatched=false;

const experienceMeta={
  draw:{title:"Air Draw",desc:"Desenhe no ar com o dedo indicador usando rastreamento em tempo real.",help:[["☝️ Indicador","Levante só o indicador para desenhar."],["✋ Parar","Abra a mão ou mude o gesto para interromper o traço."],["🧠 Gesture Engine","O gesto precisa permanecer estável antes de ser confirmado."],["🧽 Limpar","Use o botão para apagar o canvas sem desligar a câmera."]]},
  emoji:{title:"Emoji Playground",desc:"Pegue, arremesse e acerte emojis usando gestos e velocidade da mão.",help:[["🤏 Pinça","Faça pinça sobre um emoji para agarrar."],["💨 Arremesso","Mova rápido e solte a pinça para lançar."],["🥊 Pancada","Movimentos rápidos perto do emoji causam impacto."],["✌️ Paz","Dispara partículas quando o gesto é confirmado."]]},
  spell:{title:"Spell Casting",desc:"Desenhe trajetórias no ar e transforme movimento em efeitos mágicos.",help:[["⭕ Portal","Com o indicador, desenhe um círculo grande e feche a forma. Depois abaixe o dedo."],["⚡ Raio","Desenhe um Z amplo e finalize o gesto."],["🗡️ Corte","Faça um traço reto e rápido."],["☝️ Finalizar","O feitiço só é analisado quando você abaixa o indicador."]]},
  face:{title:"Face Lab",desc:"Rastreamento facial ao vivo com expressões e direção aproximada da cabeça.",help:[["😄 Sorriso","A intensidade do sorriso vem dos blendshapes do rosto."],["😉 Piscada","Cada olho possui leitura de blink independente."],["😮 Boca","Abrir a boca altera o valor de jawOpen."],["🧠 Cabeça","Estimamos yaw e pitch usando a geometria do rosto."]]},
  eye:{title:"Eye Tracking",desc:"Rastreamento ocular experimental usando as íris do Face Landmarker.",help:[["🎯 Calibrar","Olhe para o centro da câmera e toque em Calibrar centro."],["👁️ Cursor","O ponto verde representa uma estimativa da direção do olhar."],["⏱️ Dwell","Olhe para o alvo roxo por um instante para selecioná-lo."],["🧪 Beta","Luz, distância e posição da cabeça ainda influenciam bastante a precisão."]]}
};

function emptyHand(){return{gesture:"none",raw:"none",candidate:"none",point:null,pinch:null,palm:null,vx:0,vy:0,speed:0,progress:0}}
function setStatus(text,type=""){statusEl.textContent=text;statusEl.className=`pill ${type}`.trim()}
function showToast(text){toast.textContent=text;toast.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove("show"),1800)}
function needsFace(){return currentExperience==="face"||currentExperience==="eye"}

async function openExperience(name){
  const meta=experienceMeta[name];if(!meta)return;
  currentExperience=name;hubView.classList.remove("active");experienceView.classList.add("active");experienceName.textContent=meta.title;experienceDesc.textContent=meta.desc;modeEl.textContent=meta.title;paint.style.opacity=name==="draw"?"1":".12";hitBox.style.display=(name==="emoji"||name==="eye")?"block":"none";hitsEl.textContent="0";airDraw.resetStroke();motionEngine.reset();moduleActions.innerHTML="";helpGrid.innerHTML=meta.help.map(([a,b])=>`<div class="helpCard"><b>${a}</b><span>${b}</span></div>`).join("");
  if(name==="draw")addAction("Limpar desenho",()=>airDraw.clear());
  if(name==="emoji"){addAction("+ Emoji",()=>emojiPlayground.spawn(overlay.width,overlay.height),true);addAction("Reset emojis",()=>{emojiPlayground.reset(overlay.width,overlay.height);hitsEl.textContent="0"});if(!emojiPlayground.emojis.length&&overlay.width)emojiPlayground.reset(overlay.width,overlay.height)}
  if(name==="spell"){addAction("Limpar trilha",()=>motionEngine.reset());addAction("Limpar efeitos",()=>{spellCasting.effects=[]},true)}
  if(name==="face"||name==="eye"){
    try{await vision.ensureFace()}catch(e){console.error(e);showToast("Falha ao carregar Face Tracking")}
  }
  if(name==="eye"){
    addAction("🎯 Calibrar centro",()=>{eyeTracking.startCalibration();showToast("Olhe para o centro 👁️")},true);
    addAction("Novo alvo",()=>eyeTracking.randomTarget());
  }
}

function closeExperience(){currentExperience=null;experienceView.classList.remove("active");hubView.classList.add("active");airDraw.resetStroke();motionEngine.reset()}
function addAction(label,handler,accent=false){const btn=document.createElement("button");btn.className=`actionBtn${accent?" accent":""}`;btn.textContent=label;btn.onclick=handler;moduleActions.appendChild(btn)}
function resize(){const w=video.videoWidth||960,h=video.videoHeight||540,changed=overlay.width!==w||overlay.height!==h;if(changed){overlay.width=w;overlay.height=h;emojiPlayground.reset(w,h)}airDraw.resize(w,h)}

async function toggleCamera(){
  if(running){vision.stop();running=false;cancelAnimationFrame(raf);cameraBtn.textContent="Ligar câmera";hint.classList.remove("hidden");hint.innerHTML="<strong>Gesture Cam Hub 👋</strong><span>Ligue a câmera para iniciar o módulo.</span>";oc.clearRect(0,0,overlay.width,overlay.height);gestureEngine.reset();motionEngine.reset();hand=emptyHand();lastLandmarks=[];lastFaceResult=null;comboSince=0;comboLatched=false;return}
  try{if(needsFace())await vision.ensureFace();await vision.start();resize();running=true;cameraBtn.textContent="Desligar câmera";hint.classList.add("hidden");lastFrameTime=performance.now();loop()}catch(error){console.error(error);setStatus("Câmera bloqueada","err");hint.classList.remove("hidden");hint.innerHTML="<strong>Não consegui abrir a câmera 😭</strong><span>Libere a permissão no navegador e tente novamente.</span>"}
}

function point(lm,i){return{x:lm[i].x*overlay.width,y:lm[i].y*overlay.height}}
function avg(...pts){return{x:pts.reduce((s,p)=>s+p.x,0)/pts.length,y:pts.reduce((s,p)=>s+p.y,0)/pts.length}}
function updateHand(landmarks,now){
  if(!landmarks){const snap=gestureEngine.update("none",now);hand={...emptyHand(),gesture:snap.active,raw:snap.raw,candidate:snap.candidate,progress:snap.progress};lastHandSample=null;return}
  const raw=gestureEngine.classify(landmarks,overlay.width,overlay.height),snap=gestureEngine.update(raw,now),index=gestureEngine.smoothPoint(point(landmarks,8)),thumb=point(landmarks,4),pinch=avg(index,thumb),palm=avg(point(landmarks,0),point(landmarks,5),point(landmarks,9),point(landmarks,13),point(landmarks,17));
  let vx=0,vy=0,speed=0;if(lastHandSample){const dt=Math.max((now-lastHandSample.t)/1000,.001);vx=(palm.x-lastHandSample.x)/dt;vy=(palm.y-lastHandSample.y)/dt;speed=Math.hypot(vx,vy)}lastHandSample={x:palm.x,y:palm.y,t:now};hand={gesture:snap.active,raw:snap.raw,candidate:snap.candidate,progress:snap.progress,point:index,pinch,palm,vx,vy,speed}
}

function updateAbsoluteCinemaCombo(now){
  if(lastLandmarks.length<2){comboSince=0;comboLatched=false;return}
  const gestures=lastLandmarks.slice(0,2).map(lm=>gestureEngine.classify(lm,overlay.width,overlay.height));
  const matched=gestures.includes("peace")&&gestures.includes("open");
  if(!matched){comboSince=0;comboLatched=false;return}
  if(!comboSince)comboSince=now;
  if(!comboLatched&&now-comboSince>=450){comboLatched=true;if(absoluteCinema.trigger(now)){showToast("ABSOLUTE CINEMA 🎬");}}
}

function drawSkeleton(landmarks){if(!skeletonToggle.checked)return;oc.save();oc.strokeStyle="rgba(255,255,255,.62)";oc.lineWidth=Math.max(2,overlay.width/520);for(const[a,b]of HAND_CONNECTIONS){const p1=point(landmarks,a),p2=point(landmarks,b);oc.beginPath();oc.moveTo(p1.x,p1.y);oc.lineTo(p2.x,p2.y);oc.stroke()}for(let i=0;i<landmarks.length;i++){const p=point(landmarks,i);oc.beginPath();oc.arc(p.x,p.y,i===8?Math.max(7,overlay.width/110):Math.max(3,overlay.width/270),0,Math.PI*2);oc.fillStyle=i===8?"#72ffd5":"rgba(255,255,255,.9)";oc.fill()}oc.restore()}

function render(now){
  oc.clearRect(0,0,overlay.width,overlay.height);
  if(currentExperience==="emoji")emojiPlayground.render(oc,now);
  if(currentExperience==="spell")spellCasting.render(oc,motionEngine.trail);
  if(currentExperience==="face")faceLab.render(oc,overlay.width,overlay.height,{mesh:true});
  if(currentExperience==="eye")eyeTracking.render(oc,overlay.width,overlay.height,now);
  for(const lm of lastLandmarks)drawSkeleton(lm);
  if(hand.point&&currentExperience!=="eye"){oc.save();oc.beginPath();oc.arc(hand.point.x,hand.point.y,Math.max(10,overlay.width/95),0,Math.PI*2);oc.fillStyle=hand.gesture==="point"?"#72ffd5":"#fff";oc.shadowBlur=18;oc.shadowColor=oc.fillStyle;oc.fill();oc.restore()}
  absoluteCinema.render(oc,overlay.width,overlay.height,now);
}

function updateDebug(){
  gestureEl.textContent=gestureLabel(hand.gesture);handsEl.textContent=String(lastLandmarks.length);debugRaw.textContent=gestureLabel(hand.raw);debugCandidate.textContent=gestureLabel(hand.candidate);debugActive.textContent=gestureLabel(hand.gesture);debugSpeed.textContent=`${Math.round(hand.speed)} px/s`;dwellBar.style.width=`${Math.round(hand.progress*100)}%`;debugPanel.style.display=debugToggle.checked?"block":"none";
  if(currentExperience==="emoji")hitsEl.textContent=String(emojiPlayground.hits);
  if(currentExperience==="eye"){hitsEl.textContent=String(eyeTracking.hits);modeEl.textContent=eyeTracking.calibrated?"Eye Tracking • calibrado":"Eye Tracking • calibre o centro"}
  if(currentExperience==="face"){
    const m=faceLab.metrics;modeEl.textContent=`🙂 ${Math.round(m.smile*100)}% • 😮 ${Math.round(m.mouth*100)}% • 👁 ${Math.round(Math.max(m.blinkL,m.blinkR)*100)}%`;
  }
}

function tickFps(){frames++;const now=performance.now(),elapsed=now-fpsWindow;if(elapsed>=1000){fpsEl.textContent=`${Math.round(frames*1000/elapsed)} FPS`;frames=0;fpsWindow=now}}
function loop(now=performance.now()){
  if(!running)return;resize();const dt=Math.min((now-lastFrameTime)/1000,.04);lastFrameTime=now;
  const result=vision.detect(now,{face:needsFace()});
  if(result){
    lastLandmarks=result.landmarks||[];lastFaceResult=result.face||null;updateHand(lastLandmarks[0],now);updateAbsoluteCinemaCombo(now);
    if(currentExperience==="draw")airDraw.update({gesture:hand.gesture,point:hand.point});
    if(currentExperience==="emoji")emojiPlayground.update(hand,now,overlay.width);
    if(currentExperience==="spell"){const motion=motionEngine.update(hand.point,hand.gesture==="point",now,{width:overlay.width,height:overlay.height});if(motion){spellCasting.trigger(motion,now);const pct=Math.round((motion.confidence??1)*100),names={circle:`Portal detectado ⭕ • ${pct}%`,lightning:`Raio detectado ⚡ • ${pct}%`,slash:`Corte detectado 🗡️ • ${pct}%`};showToast(names[motion.type]||motion.type)}}
    if(currentExperience==="face")faceLab.update(lastFaceResult);
    if(currentExperience==="eye")eyeTracking.update(lastFaceResult,now);
    tickFps();
  }
  if(currentExperience==="emoji")emojiPlayground.physics(dt,overlay.width,overlay.height);
  if(currentExperience==="spell")spellCasting.update(dt);
  render(now);updateDebug();raf=requestAnimationFrame(loop);
}

$$('[data-experience]').forEach(card=>card.addEventListener("click",()=>openExperience(card.dataset.experience)));
$$('[data-soon]').forEach(card=>card.addEventListener("click",()=>showToast(`${card.dataset.soon} entra nas próximas etapas 👀`)));
backBtn.onclick=closeExperience;cameraBtn.onclick=toggleCamera;
switchBtn.onclick=async()=>{try{await vision.switchCamera();resize()}catch(e){console.error(e);showToast("Não consegui trocar a câmera")}};
debugToggle.onchange=updateDebug;

if(!navigator.mediaDevices?.getUserMedia)setStatus("Sem suporte à câmera","err");
else vision.init().then(()=>cameraBtn.disabled=false).catch(error=>{console.error(error);setStatus("Erro ao carregar IA","err")});
