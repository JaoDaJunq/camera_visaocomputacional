import { VisionCore, HAND_CONNECTIONS } from "./vision.js";
import { GestureEngine, gestureLabel } from "./gesture-engine.js";
import { MotionEngine } from "./motion-engine.js";
import { AirDrawExperience } from "./experiences/air-draw.js";
import { EmojiPlaygroundExperience } from "./experiences/emoji-playground.js";
import { SpellCastingExperience } from "./experiences/spell-casting.js";
import { FaceLabExperience } from "./experiences/face-lab.js";
import { EyeTrackingExperience } from "./experiences/eye-tracking.js";
import { AbsoluteCinemaEffect } from "./experiences/absolute-cinema.js";
import { GestureGamesExperience } from "./experiences/gesture-games.js";
import { AirDJExperience } from "./experiences/air-dj.js";
import { PresentationControllerExperience } from "./experiences/presentation-controller.js";

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
const gestureGames=new GestureGamesExperience();
const airDJ=new AirDJExperience();
const presentation=new PresentationControllerExperience();

let running=false,currentExperience=null,lastFrameTime=performance.now(),lastHandSample=null,lastLandmarks=[],lastFaceResult=null,hand=emptyHand(),frames=0,fpsWindow=performance.now(),raf=null;
let comboSince=0,comboLatched=false,gameHandSamples=[];

const experienceMeta={
  draw:{title:"Air Draw",desc:"Desenhe no ar com o dedo indicador usando rastreamento em tempo real.",help:[["☝️ Indicador","Levante só o indicador para desenhar."],["✋ Parar","Abra a mão ou mude o gesto para interromper o traço."],["🧠 Gesture Engine","O gesto precisa permanecer estável antes de ser confirmado."],["🧽 Limpar","Use o botão para apagar o canvas sem desligar a câmera."]]},
  emoji:{title:"Emoji Playground",desc:"Pegue, arremesse e acerte emojis usando gestos e velocidade da mão.",help:[["🤏 Pinça","Faça pinça sobre um emoji para agarrar."],["💨 Arremesso","Mova rápido e solte a pinça para lançar."],["🥊 Pancada","Movimentos rápidos perto do emoji causam impacto."],["✌️ Paz","Dispara partículas quando o gesto é confirmado."]]},
  spell:{title:"Spell Casting",desc:"Desenhe trajetórias no ar e transforme movimento em efeitos mágicos.",help:[["⭕ Portal","Desenhe um círculo grande e finalize o gesto."],["⚡ Raio","Desenhe um Z amplo e finalize."],["🗡️ Corte","Faça um traço reto e rápido."],["☝️ Finalizar","O feitiço é analisado quando o indicador abaixa."]]},
  face:{title:"Face Lab",desc:"Rastreamento facial ao vivo com expressões e direção aproximada da cabeça.",help:[["😄 Sorriso","Leitura de sorriso pelos blendshapes."],["😉 Piscada","Blink independente de cada olho."],["😮 Boca","JawOpen em tempo real."],["🧠 Cabeça","Estimativa de yaw e pitch."]]},
  eye:{title:"Eye Tracking V2",desc:"Rastreamento ocular com calibração multiponto personalizada.",help:[["9️⃣ Calibração","Siga os 9 pontos roxos com os olhos."],["👁️ Cursor","Cursor verde calibrado para teus olhos."],["🎯 Teste","Olhe para o alvo roxo para marcar acerto."],["📊 Qualidade","Mostra a qualidade da calibração."]]},
  games:{title:"Gesture Games",desc:"Arcade controlado por mãos, movimento e olhar calibrado.",help:[["🥊 Boxe","Acerte alvos com socos rápidos."],["🧤 Goleiro","Use as palmas como luvas."],["🏀 Basquete","Pinça, move e solta a bola."],["👁️ Eye Aim","Mire apenas olhando após calibrar."]]},
  dj:{title:"Air DJ",desc:"Sintetizador e drum pads controlados pelas mãos em tempo real.",help:[["🤏 Synth","Faça pinça para tocar o synth. X controla pitch e Y controla volume."],["✋ Filtro","A altura da primeira mão controla o filtro."],["🥁 Pads","Bata a mão na área inferior para disparar os quatro pads."],["✊/✌️ Atalhos","Punho rápido toca kick e paz rápido dispara clap."]]},
  presentation:{title:"Presentation Controller",desc:"Controle slides, ponteiro e anotações sem tocar na tela.",help:[["👉 Swipe","Movimento rápido horizontal troca de slide."],["☝️ Ponteiro","O indicador vira um laser virtual."],["🤏 Anotar","Faça pinça e mova para desenhar sobre o slide."],["🧽 Limpar","Use o botão Limpar anotações quando quiser."]]}
};

function emptyHand(){return{gesture:"none",raw:"none",candidate:"none",point:null,pinch:null,palm:null,vx:0,vy:0,speed:0,progress:0}}
function setStatus(text,type=""){statusEl.textContent=text;statusEl.className=`pill ${type}`.trim()}
function showToast(text){toast.textContent=text;toast.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove("show"),1900)}
function needsFace(){return currentExperience==="face"||currentExperience==="eye"||(currentExperience==="games"&&gestureGames.game==="eyeaim")}

async function openExperience(name){
  const meta=experienceMeta[name];if(!meta)return;
  currentExperience=name;hubView.classList.remove("active");experienceView.classList.add("active");experienceName.textContent=meta.title;experienceDesc.textContent=meta.desc;modeEl.textContent=meta.title;paint.style.opacity=name==="draw"?"1":".12";hitBox.style.display=(name==="emoji"||name==="eye"||name==="games"||name==="dj"||name==="presentation")?"block":"none";hitsEl.textContent="0";airDraw.resetStroke();motionEngine.reset();moduleActions.innerHTML="";helpGrid.innerHTML=meta.help.map(([a,b])=>`<div class="helpCard"><b>${a}</b><span>${b}</span></div>`).join("");
  if(name==="draw")addAction("Limpar desenho",()=>airDraw.clear());
  if(name==="emoji"){addAction("+ Emoji",()=>emojiPlayground.spawn(overlay.width,overlay.height),true);addAction("Reset emojis",()=>{emojiPlayground.reset(overlay.width,overlay.height);hitsEl.textContent="0"});if(!emojiPlayground.emojis.length&&overlay.width)emojiPlayground.reset(overlay.width,overlay.height)}
  if(name==="spell"){addAction("Limpar trilha",()=>motionEngine.reset());addAction("Limpar efeitos",()=>{spellCasting.effects=[]},true)}
  if(name==="face"||name==="eye"){try{await vision.ensureFace()}catch(e){console.error(e);showToast("Falha ao carregar Face Tracking")}}
  if(name==="eye"){addAction("🎯 Calibrar 9 pontos",()=>{eyeTracking.startCalibration();showToast("Siga os pontos com os olhos 👁️")},true);addAction("Novo alvo",()=>eyeTracking.randomTarget());addAction("Recalibrar",()=>eyeTracking.startCalibration())}
  if(name==="games"){
    gestureGames.reset(overlay.width||960,overlay.height||540);gameHandSamples=[];
    const choose=(label,key,accent=false)=>addAction(label,async()=>{if(key==="eyeaim"){try{await vision.ensureFace()}catch(e){showToast("Falha ao carregar Face Tracking");return}if(!eyeTracking.calibrated){eyeTracking.startCalibration();showToast("Primeiro: calibração ocular de 9 pontos 👁️")}}gestureGames.setGame(key,overlay.width||960,overlay.height||540);modeEl.textContent=`Games • ${gestureGames.title()}`;showToast(`${gestureGames.title()} iniciado 🎮`)},accent);
    choose("🏓 Pong","pong",true);choose("🍉 Fruit Slice","fruit");choose("🧱 Brick Breaker","brick");choose("✊✋✌️ RPS","rps");choose("🥊 Boxe","boxing");choose("🧤 Goleiro","goalie");choose("🏀 Basquete","basket");choose("👁️ Eye Aim","eyeaim");addAction("🎯 Calibrar olhos",async()=>{try{await vision.ensureFace();eyeTracking.startCalibration()}catch(e){console.error(e)}});addAction("Reiniciar jogo",()=>gestureGames.reset(overlay.width||960,overlay.height||540));modeEl.textContent=`Games • ${gestureGames.title()}`;
  }
  if(name==="dj"){
    addAction("🔊 Ativar áudio",async()=>{try{await airDJ.enable();showToast("Air DJ ligado 🔊")}catch(e){showToast("WebAudio indisponível")}},true);
    addAction("BPM +",()=>airDJ.setBpm(airDJ.bpm+5));addAction("BPM -",()=>airDJ.setBpm(airDJ.bpm-5));
  }
  if(name==="presentation"){
    presentation.reset();addAction("← Slide",()=>presentation.prev());addAction("Slide →",()=>presentation.next(),true);addAction("Limpar anotações",()=>presentation.clear());
  }
}

function closeExperience(){currentExperience=null;experienceView.classList.remove("active");hubView.classList.add("active");airDraw.resetStroke();motionEngine.reset();gameHandSamples=[];airDJ.disableTone()}
function addAction(label,handler,accent=false){const btn=document.createElement("button");btn.className=`actionBtn${accent?" accent":""}`;btn.textContent=label;btn.onclick=handler;moduleActions.appendChild(btn)}
function resize(){const w=video.videoWidth||960,h=video.videoHeight||540,changed=overlay.width!==w||overlay.height!==h;if(changed){overlay.width=w;overlay.height=h;emojiPlayground.reset(w,h);if(currentExperience==="games")gestureGames.reset(w,h)}airDraw.resize(w,h)}

async function toggleCamera(){if(running){vision.stop();running=false;cancelAnimationFrame(raf);cameraBtn.textContent="Ligar câmera";hint.classList.remove("hidden");hint.innerHTML="<strong>Gesture Cam Hub 👋</strong><span>Ligue a câmera para iniciar o módulo.</span>";oc.clearRect(0,0,overlay.width,overlay.height);gestureEngine.reset();motionEngine.reset();hand=emptyHand();lastLandmarks=[];lastFaceResult=null;comboSince=0;comboLatched=false;gameHandSamples=[];airDJ.disableTone();return}try{if(needsFace())await vision.ensureFace();await vision.start();resize();running=true;cameraBtn.textContent="Desligar câmera";hint.classList.add("hidden");lastFrameTime=performance.now();loop()}catch(error){console.error(error);setStatus("Câmera bloqueada","err");hint.classList.remove("hidden");hint.innerHTML="<strong>Não consegui abrir a câmera 😭</strong><span>Libere a permissão no navegador e tente novamente.</span>"}}

function point(lm,i){return{x:lm[i].x*overlay.width,y:lm[i].y*overlay.height}}
function avg(...pts){return{x:pts.reduce((s,p)=>s+p.x,0)/pts.length,y:pts.reduce((s,p)=>s+p.y,0)/pts.length}}
function updateHand(landmarks,now){if(!landmarks){const snap=gestureEngine.update("none",now);hand={...emptyHand(),gesture:snap.active,raw:snap.raw,candidate:snap.candidate,progress:snap.progress};lastHandSample=null;return}const raw=gestureEngine.classify(landmarks,overlay.width,overlay.height),snap=gestureEngine.update(raw,now),index=gestureEngine.smoothPoint(point(landmarks,8)),thumb=point(landmarks,4),pinch=avg(index,thumb),palm=avg(point(landmarks,0),point(landmarks,5),point(landmarks,9),point(landmarks,13),point(landmarks,17));let vx=0,vy=0,speed=0;if(lastHandSample){const dt=Math.max((now-lastHandSample.t)/1000,.001);vx=(palm.x-lastHandSample.x)/dt;vy=(palm.y-lastHandSample.y)/dt;speed=Math.hypot(vx,vy)}lastHandSample={x:palm.x,y:palm.y,t:now};hand={gesture:snap.active,raw:snap.raw,candidate:snap.candidate,progress:snap.progress,point:index,pinch,palm,vx,vy,speed}}

function buildHands(now){const out=lastLandmarks.slice(0,2).map((lm,i)=>{const p=n=>point(lm,n),index=p(8),thumb=p(4),pinch=avg(index,thumb),palm=avg(p(0),p(5),p(9),p(13),p(17)),gesture=gestureEngine.classify(lm,overlay.width,overlay.height),prev=gameHandSamples[i];let vx=0,vy=0,speed=0;if(prev){const dt=Math.max((now-prev.t)/1000,.001);vx=(palm.x-prev.x)/dt;vy=(palm.y-prev.y)/dt;speed=Math.hypot(vx,vy)}gameHandSamples[i]={x:palm.x,y:palm.y,t:now};return{gesture,palm,index,pinch,pinching:gesture==="pinch",point:index,vx,vy,speed}});gameHandSamples.length=out.length;return out}

function updateAbsoluteCinemaCombo(now){if(lastLandmarks.length<2){comboSince=0;comboLatched=false;return}const gestures=lastLandmarks.slice(0,2).map(lm=>gestureEngine.classify(lm,overlay.width,overlay.height)),matched=gestures.includes("peace")&&gestures.includes("open");if(!matched){comboSince=0;comboLatched=false;return}if(!comboSince)comboSince=now;if(!comboLatched&&now-comboSince>=450){comboLatched=true;if(absoluteCinema.trigger(now))showToast("ABSOLUTE CINEMA 🎬")}}

function drawSkeleton(landmarks){if(!skeletonToggle.checked)return;oc.save();oc.strokeStyle="rgba(255,255,255,.62)";oc.lineWidth=Math.max(2,overlay.width/520);for(const[a,b]of HAND_CONNECTIONS){const p1=point(landmarks,a),p2=point(landmarks,b);oc.beginPath();oc.moveTo(p1.x,p1.y);oc.lineTo(p2.x,p2.y);oc.stroke()}for(let i=0;i<landmarks.length;i++){const p=point(landmarks,i);oc.beginPath();oc.arc(p.x,p.y,i===8?Math.max(7,overlay.width/110):Math.max(3,overlay.width/270),0,Math.PI*2);oc.fillStyle=i===8?"#72ffd5":"rgba(255,255,255,.9)";oc.fill()}oc.restore()}

function render(now){oc.clearRect(0,0,overlay.width,overlay.height);if(currentExperience==="emoji")emojiPlayground.render(oc,now);if(currentExperience==="spell")spellCasting.render(oc,motionEngine.trail);if(currentExperience==="face")faceLab.render(oc,overlay.width,overlay.height,{mesh:true});if(currentExperience==="eye")eyeTracking.render(oc,overlay.width,overlay.height,now);if(currentExperience==="games"){gestureGames.render(oc,overlay.width,overlay.height,now);if(gestureGames.game==="eyeaim"&&eyeTracking.calibrated)eyeTracking.render(oc,overlay.width,overlay.height,now,{practice:false,cursor:true});if(gestureGames.game==="eyeaim"&&eyeTracking.isCalibrating)eyeTracking.render(oc,overlay.width,overlay.height,now,{practice:false,cursor:false})}if(currentExperience==="dj")airDJ.render(oc,overlay.width,overlay.height);if(currentExperience==="presentation")presentation.render(oc,overlay.width,overlay.height);for(const lm of lastLandmarks)drawSkeleton(lm);if(hand.point&&!["eye","games","dj","presentation"].includes(currentExperience)){oc.save();oc.beginPath();oc.arc(hand.point.x,hand.point.y,Math.max(10,overlay.width/95),0,Math.PI*2);oc.fillStyle=hand.gesture==="point"?"#72ffd5":"#fff";oc.shadowBlur=18;oc.shadowColor=oc.fillStyle;oc.fill();oc.restore()}absoluteCinema.render(oc,overlay.width,overlay.height,now)}

function updateDebug(){gestureEl.textContent=gestureLabel(hand.gesture);handsEl.textContent=String(lastLandmarks.length);debugRaw.textContent=gestureLabel(hand.raw);debugCandidate.textContent=gestureLabel(hand.candidate);debugActive.textContent=gestureLabel(hand.gesture);debugSpeed.textContent=`${Math.round(hand.speed)} px/s`;dwellBar.style.width=`${Math.round(hand.progress*100)}%`;debugPanel.style.display=debugToggle.checked?"block":"none";if(currentExperience==="emoji")hitsEl.textContent=String(emojiPlayground.hits);if(currentExperience==="eye"){hitsEl.textContent=String(eyeTracking.hits);modeEl.textContent=eyeTracking.isCalibrating?`Calibrando ${eyeTracking.calibration.index+1}/9`:eyeTracking.calibrated?`Eye V2 • ${Math.round(eyeTracking.quality*100)}% qualidade`:"Eye Tracking • não calibrado"}if(currentExperience==="face"){const m=faceLab.metrics;modeEl.textContent=`🙂 ${Math.round(m.smile*100)}% • 😮 ${Math.round(m.mouth*100)}%`}if(currentExperience==="games"){hitsEl.textContent=gestureGames.hud();modeEl.textContent=`Games • ${gestureGames.title()}`}if(currentExperience==="dj"){hitsEl.textContent=airDJ.status();modeEl.textContent="Air DJ • WebAudio"}if(currentExperience==="presentation"){hitsEl.textContent=presentation.status();modeEl.textContent="Presentation Controller"}}
function tickFps(){frames++;const now=performance.now(),elapsed=now-fpsWindow;if(elapsed>=1000){fpsEl.textContent=`${Math.round(frames*1000/elapsed)} FPS`;frames=0;fpsWindow=now}}

function loop(now=performance.now()){if(!running)return;resize();const dt=Math.min((now-lastFrameTime)/1000,.04);lastFrameTime=now;const result=vision.detect(now,{face:needsFace()});if(result){lastLandmarks=result.landmarks||[];lastFaceResult=result.face||null;updateHand(lastLandmarks[0],now);updateAbsoluteCinemaCombo(now);if(currentExperience==="draw")airDraw.update({gesture:hand.gesture,point:hand.point});if(currentExperience==="emoji")emojiPlayground.update(hand,now,overlay.width);if(currentExperience==="spell"){const motion=motionEngine.update(hand.point,hand.gesture==="point",now,{width:overlay.width,height:overlay.height});if(motion){spellCasting.trigger(motion,now);showToast({circle:"Portal detectado ⭕",lightning:"Raio detectado ⚡",slash:"Corte detectado 🗡️"}[motion.type]||motion.type)}}if(currentExperience==="face")faceLab.update(lastFaceResult);if(currentExperience==="eye")eyeTracking.update(lastFaceResult,now,{practice:true});if(currentExperience==="games"&&gestureGames.game==="eyeaim")eyeTracking.update(lastFaceResult,now,{practice:false});tickFps()}if(currentExperience==="emoji")emojiPlayground.physics(dt,overlay.width,overlay.height);if(currentExperience==="spell")spellCasting.update(dt);const hands=buildHands(now);if(currentExperience==="games"){const eye=gestureGames.game==="eyeaim"?eyeTracking.cursor:null;gestureGames.update({hand,hands,eye},dt,now,overlay.width,overlay.height)}if(currentExperience==="dj")airDJ.update(hands,now,overlay.width,overlay.height);if(currentExperience==="presentation")presentation.update({...hand,pinch:hand.pinch,point:hand.point},now,overlay.width,overlay.height);render(now);updateDebug();raf=requestAnimationFrame(loop)}

$$('[data-experience]').forEach(card=>card.addEventListener("click",()=>openExperience(card.dataset.experience)));$$('[data-soon]').forEach(card=>card.addEventListener("click",()=>showToast(`${card.dataset.soon} entra nas próximas etapas 👀`)));backBtn.onclick=closeExperience;cameraBtn.onclick=toggleCamera;switchBtn.onclick=async()=>{try{await vision.switchCamera();resize()}catch(e){showToast("Não consegui trocar a câmera")}};debugToggle.onchange=updateDebug;
if(!navigator.mediaDevices?.getUserMedia)setStatus("Sem suporte à câmera","err");else vision.init().then(()=>cameraBtn.disabled=false).catch(error=>{console.error(error);setStatus("Erro ao carregar IA","err")});
