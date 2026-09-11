const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const FRUITS=["🍉","🍊","🍎","🍋","🥝","🍓","🍍","🍑"];
const RPS_ICON={rock:"✊",paper:"✋",scissors:"✌️"};
const RPS_LABEL={rock:"Pedra",paper:"Papel",scissors:"Tesoura"};

export class GestureGamesExperience{
  constructor(){this.game="pong";this.particles=[];this.lastSize={w:0,h:0};this.reset(960,540)}
  setGame(name,w,h){this.game=name;this.reset(w,h)}
  reset(w,h){
    this.lastSize={w,h};this.particles=[];
    this.pong=this.makePong(w,h);
    this.fruit={score:0,items:[],spawnAt:0,lastPoint:null,lastT:0};
    this.brick=this.makeBrick(w,h);
    this.rps={wins:0,losses:0,ties:0,lastGesture:"none",gestureSince:0,latched:false,player:null,cpu:null,result:"Mostre ✊, ✋ ou ✌️"};
    this.boxing={score:0,misses:0,target:null,spawnAt:0,combo:0,lastHit:0};
    this.goalie={saves:0,goals:0,ball:null,spawnAt:0};
    this.basket={score:0,shots:0,ball:this.makeBasketBall(w,h),grabbed:false,scoredShot:false};
    this.eyeAim={score:0,target:this.randomAimTarget(),dwell:0,timeLeft:30000,started:false};
  }

  makePong(w,h){const dir=Math.random()<.5?-1:1;return{player:0,ai:0,playerY:h/2,aiY:h/2,ball:{x:w/2,y:h/2,vx:dir*w*.38,vy:(Math.random()-.5)*h*.35,r:Math.max(10,w*.012)}}}
  resetPongBall(w,h,dir=1){this.pong.ball={x:w/2,y:h/2,vx:dir*w*(.34+Math.random()*.08),vy:(Math.random()-.5)*h*.38,r:Math.max(10,w*.012)}}
  makeBrick(w,h){
    const cols=7,rows=5,gap=Math.max(5,w*.006),margin=w*.09,top=h*.13,bw=(w-margin*2-gap*(cols-1))/cols,bh=Math.max(20,h*.045),bricks=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)bricks.push({x:margin+c*(bw+gap),y:top+r*(bh+gap),w:bw,h:bh,alive:true,row:r});
    return{score:0,lives:3,paddleX:w/2,paddleW:w*.2,paddleH:Math.max(14,h*.024),bricks,ball:{x:w/2,y:h*.72,vx:w*.26,vy:-h*.42,r:Math.max(9,w*.01)}};
  }
  makeBasketBall(w,h){return{x:w*.22,y:h*.78,vx:0,vy:0,r:Math.max(20,w*.025)}}
  randomAimTarget(){return{x:.16+Math.random()*.68,y:.18+Math.random()*.64,r:.05}}

  update(input,dt,now,w,h){
    if(!w||!h)return;
    if(Math.abs(w-this.lastSize.w)>2||Math.abs(h-this.lastSize.h)>2)this.reset(w,h);
    const hand=input?.hand||input||null,hands=input?.hands||[],eye=input?.eye||null;
    if(this.game==="pong")this.updatePong(hand,dt,w,h);
    if(this.game==="fruit")this.updateFruit(hand,dt,now,w,h);
    if(this.game==="brick")this.updateBrick(hand,dt,w,h);
    if(this.game==="rps")this.updateRps(hand,now);
    if(this.game==="boxing")this.updateBoxing(hands,now,w,h);
    if(this.game==="goalie")this.updateGoalie(hands,dt,now,w,h);
    if(this.game==="basket")this.updateBasket(hands,dt,w,h);
    if(this.game==="eyeaim")this.updateEyeAim(eye,dt,w,h);
    this.updateParticles(dt,h);
  }

  updatePong(hand,dt,w,h){
    const p=this.pong,padH=h*.22,padW=Math.max(15,w*.018),leftX=w*.07,rightX=w*.93;
    if(hand?.palm)p.playerY=clamp(hand.palm.y,padH/2,h-padH/2);
    const aiMax=h*.62*dt;p.aiY+=clamp(p.ball.y-p.aiY,-aiMax,aiMax);p.aiY=clamp(p.aiY,padH/2,h-padH/2);
    const b=p.ball;b.x+=b.vx*dt;b.y+=b.vy*dt;
    if(b.y-b.r<0){b.y=b.r;b.vy=Math.abs(b.vy)}if(b.y+b.r>h){b.y=h-b.r;b.vy=-Math.abs(b.vy)}
    const hitPad=(px,py,isLeft)=>{const inX=isLeft?(b.x-b.r<=px+padW/2&&b.x>px):(b.x+b.r>=px-padW/2&&b.x<px),inY=Math.abs(b.y-py)<=padH/2+b.r;if(inX&&inY){b.x=isLeft?px+padW/2+b.r:px-padW/2-b.r;b.vx=(isLeft?1:-1)*Math.min(Math.abs(b.vx)*1.045,w*.72);b.vy+=((b.y-py)/(padH/2))*h*.22;this.burst(b.x,b.y,["✨","💫"],6)}};
    if(b.vx<0)hitPad(leftX,p.playerY,true);else hitPad(rightX,p.aiY,false);
    if(b.x<-b.r){p.ai++;this.resetPongBall(w,h,1)}if(b.x>w+b.r){p.player++;this.resetPongBall(w,h,-1)}
  }

  updateFruit(hand,dt,now,w,h){
    const f=this.fruit;
    if(now>=f.spawnAt){const bomb=Math.random()<.13,r=Math.max(25,w*(.025+Math.random()*.012));f.items.push({emoji:bomb?"💣":FRUITS[Math.floor(Math.random()*FRUITS.length)],bomb,x:w*(.14+Math.random()*.72),y:h+r,vx:(Math.random()-.5)*w*.24,vy:-h*(.82+Math.random()*.28),r,rot:0,spin:(Math.random()-.5)*5,dead:false});f.spawnAt=now+520+Math.random()*430}
    const g=h*1.45;for(const item of f.items){item.vy+=g*dt;item.x+=item.vx*dt;item.y+=item.vy*dt;item.rot+=item.spin*dt}f.items=f.items.filter(x=>x.y<h+x.r*2&&!x.dead);
    if(hand?.point&&hand.gesture==="point"){
      const p=hand.point;if(f.lastPoint&&f.lastT){const frameDt=Math.max((now-f.lastT)/1000,.001),speed=Math.hypot(p.x-f.lastPoint.x,p.y-f.lastPoint.y)/frameDt;if(speed>Math.max(330,w*.38))for(const item of f.items)if(!item.dead&&this.segmentDistance(item,f.lastPoint,p)<item.r*.88){item.dead=true;if(item.bomb){f.score=Math.max(0,f.score-3);this.burst(item.x,item.y,["💥","💣","🔥"],16)}else{f.score++;this.burst(item.x,item.y,["✨","💦","⭐"],12)}}}f.lastPoint={...p};f.lastT=now;
    }else{f.lastPoint=null;f.lastT=0}
  }

  updateBrick(hand,dt,w,h){
    const s=this.brick;if(hand?.palm)s.paddleX=clamp(hand.palm.x,s.paddleW/2,w-s.paddleW/2);const b=s.ball;b.x+=b.vx*dt;b.y+=b.vy*dt;
    if(b.x-b.r<0){b.x=b.r;b.vx=Math.abs(b.vx)}if(b.x+b.r>w){b.x=w-b.r;b.vx=-Math.abs(b.vx)}if(b.y-b.r<0){b.y=b.r;b.vy=Math.abs(b.vy)}
    const py=h*.9;if(b.vy>0&&b.y+b.r>=py-s.paddleH/2&&b.y-b.r<=py+s.paddleH/2&&Math.abs(b.x-s.paddleX)<=s.paddleW/2+b.r){b.y=py-s.paddleH/2-b.r;b.vy=-Math.abs(b.vy);b.vx+=((b.x-s.paddleX)/(s.paddleW/2))*w*.16;this.burst(b.x,b.y,["✨"],5)}
    for(const br of s.bricks){if(!br.alive)continue;const nx=clamp(b.x,br.x,br.x+br.w),ny=clamp(b.y,br.y,br.y+br.h);if(Math.hypot(b.x-nx,b.y-ny)<=b.r){br.alive=false;s.score++;b.vy*=-1;this.burst(b.x,b.y,["✨","💥"],7);break}}
    if(b.y-b.r>h){s.lives--;if(s.lives<=0){this.brick=this.makeBrick(w,h);this.burst(w/2,h/2,["💀"],10);return}s.ball={x:w/2,y:h*.72,vx:(Math.random()<.5?-1:1)*w*.26,vy:-h*.42,r:Math.max(9,w*.01)}}
    if(s.bricks.every(br=>!br.alive)){const lives=s.lives;this.brick=this.makeBrick(w,h);this.brick.lives=lives;this.burst(w/2,h*.45,["🏆","✨","🎉"],22)}
  }

  updateRps(hand,now){
    const map={fist:"rock",open:"paper",peace:"scissors"},choice=map[hand?.gesture]||null,r=this.rps;if(!choice){r.lastGesture="none";r.gestureSince=0;r.latched=false;return}if(choice!==r.lastGesture){r.lastGesture=choice;r.gestureSince=now;r.latched=false;return}if(r.latched||now-r.gestureSince<620)return;
    r.latched=true;r.player=choice;const all=["rock","paper","scissors"];r.cpu=all[Math.floor(Math.random()*all.length)];
    if(r.player===r.cpu){r.ties++;r.result="EMPATE 😐"}else if((r.player==="rock"&&r.cpu==="scissors")||(r.player==="paper"&&r.cpu==="rock")||(r.player==="scissors"&&r.cpu==="paper")){r.wins++;r.result="TU GANHOU 🔥";this.burst(this.lastSize.w/2,this.lastSize.h*.45,["🏆","✨","🔥"],18)}else{r.losses++;r.result="CPU GANHOU 🤖"}
  }

  updateBoxing(hands,now,w,h){
    const b=this.boxing;if(!b.target&&now>=b.spawnAt){b.target={x:w*(.18+Math.random()*.64),y:h*(.2+Math.random()*.5),r:Math.max(34,w*.045),born:now,life:1250};b.spawnAt=now+250}
    if(!b.target)return;
    if(now-b.target.born>b.target.life){b.misses++;b.combo=0;b.target=null;b.spawnAt=now+280;return}
    for(const hd of hands){if(!hd?.palm)continue;const punch=hd.speed>Math.max(650,w*.72);if(punch&&Math.hypot(hd.palm.x-b.target.x,hd.palm.y-b.target.y)<b.target.r+Math.max(45,w*.045)){b.score++;b.combo=now-b.lastHit<1100?b.combo+1:1;b.lastHit=now;this.burst(b.target.x,b.target.y,["💥","🥊","⚡"],16);b.target=null;b.spawnAt=now+260;break}}
  }

  updateGoalie(hands,dt,now,w,h){
    const g=this.goalie;if(!g.ball&&now>=g.spawnAt){g.ball={x:w*(.2+Math.random()*.6),y:h*.14,vx:(Math.random()-.5)*w*.12,vy:h*(.32+Math.random()*.12),r:Math.max(15,w*.018)};g.spawnAt=now+400}
    if(!g.ball)return;const b=g.ball;b.x+=b.vx*dt;b.y+=b.vy*dt;b.r+=Math.min(w,h)*.02*dt;
    for(const hd of hands){if(!hd?.palm)continue;const gloveR=Math.max(52,w*.055);if(Math.hypot(hd.palm.x-b.x,hd.palm.y-b.y)<gloveR+b.r){g.saves++;this.burst(b.x,b.y,["🧤","✨","💥"],13);g.ball=null;g.spawnAt=now+520;return}}
    if(b.y>h*.88){g.goals++;this.burst(b.x,b.y,["⚽","💀"],8);g.ball=null;g.spawnAt=now+650}
  }

  updateBasket(hands,dt,w,h){
    const s=this.basket,b=s.ball,main=hands[0]||null,hoop={x:w*.76,y:h*.34,r:w*.055};
    if(main?.pinching&&main.pinch&&!s.grabbed&&Math.hypot(main.pinch.x-b.x,main.pinch.y-b.y)<b.r+55){s.grabbed=true;s.scoredShot=false}
    if(s.grabbed&&main?.pinching&&main.pinch){b.x=main.pinch.x;b.y=main.pinch.y;b.vx=main.vx;b.vy=main.vy;return}
    if(s.grabbed&&!main?.pinching){s.grabbed=false;s.shots++;b.vx=(main?.vx||0)*.72;b.vy=(main?.vy||0)*.72}
    if(!s.grabbed){b.vy+=h*1.15*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.vx*=Math.pow(.995,dt*60)}
    if(!s.scoredShot&&b.vy>0&&Math.abs(b.x-hoop.x)<hoop.r*.72&&b.y-b.r<hoop.y&&b.y+b.r>=hoop.y){s.score++;s.scoredShot=true;this.burst(hoop.x,hoop.y,["🏀","🔥","✨"],18)}
    if(b.x<-b.r||b.x>w+b.r||b.y>h+b.r||b.y<-h*.35){s.ball=this.makeBasketBall(w,h);s.grabbed=false;s.scoredShot=false}
  }

  updateEyeAim(eye,dt,w,h){
    const e=this.eyeAim;if(!e.started){e.started=true;e.timeLeft=30000}e.timeLeft=Math.max(0,e.timeLeft-dt*1000);if(e.timeLeft<=0)return;
    if(!eye?.calibrated){e.dwell=0;return}
    const d=Math.hypot(eye.x-e.target.x,eye.y-e.target.y);
    if(d<e.target.r){e.dwell+=dt*1000;if(e.dwell>380){e.score++;this.burst(e.target.x*w,e.target.y*h,["🎯","✨","⚡"],12);e.target=this.randomAimTarget();e.dwell=0}}else e.dwell=Math.max(0,e.dwell-dt*1800);
  }

  updateParticles(dt,h){for(const p of this.particles){p.life-=dt;p.vy+=h*.35*dt;p.x+=p.vx*dt;p.y+=p.vy*dt}this.particles=this.particles.filter(p=>p.life>0)}
  burst(x,y,chars=["✨"],count=10){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=70+Math.random()*230;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-60,life:.45+Math.random()*.55,max:1,char:chars[Math.floor(Math.random()*chars.length)],size:15+Math.random()*18})}}
  segmentDistance(c,a,b){const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;if(!len)return Math.hypot(c.x-a.x,c.y-a.y);const t=clamp(((c.x-a.x)*dx+(c.y-a.y)*dy)/len,0,1),x=a.x+t*dx,y=a.y+t*dy;return Math.hypot(c.x-x,c.y-y)}

  hud(){
    if(this.game==="pong")return`${this.pong.player} x ${this.pong.ai}`;
    if(this.game==="fruit")return`${this.fruit.score} pts`;
    if(this.game==="brick")return`${this.brick.score} • ❤️ ${this.brick.lives}`;
    if(this.game==="rps")return`${this.rps.wins}V ${this.rps.losses}D ${this.rps.ties}E`;
    if(this.game==="boxing")return`${this.boxing.score} • x${Math.max(1,this.boxing.combo)}`;
    if(this.game==="goalie")return`${this.goalie.saves} defesas • ${this.goalie.goals} gols`;
    if(this.game==="basket")return`${this.basket.score}/${this.basket.shots}`;
    return`${this.eyeAim.score} • ${Math.ceil(this.eyeAim.timeLeft/1000)}s`;
  }
  title(){return({pong:"Pong",fruit:"Fruit Slice",brick:"Brick Breaker",rps:"Pedra Papel Tesoura",boxing:"Shadow Boxing",goalie:"Goleiro",basket:"Air Basketball",eyeaim:"Eye Aim"})[this.game]}

  render(ctx,w,h,now=performance.now()){
    if(this.game==="pong")this.renderPong(ctx,w,h);if(this.game==="fruit")this.renderFruit(ctx,w,h);if(this.game==="brick")this.renderBrick(ctx,w,h);if(this.game==="rps")this.renderRps(ctx,w,h);if(this.game==="boxing")this.renderBoxing(ctx,w,h,now);if(this.game==="goalie")this.renderGoalie(ctx,w,h);if(this.game==="basket")this.renderBasket(ctx,w,h);if(this.game==="eyeaim")this.renderEyeAim(ctx,w,h);
    for(const p of this.particles){ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`${p.size}px system-ui`;ctx.fillText(p.char,p.x,p.y);ctx.restore()}
  }

  renderPong(ctx,w,h){const p=this.pong,padH=h*.22,padW=Math.max(15,w*.018),leftX=w*.07,rightX=w*.93,b=p.ball;ctx.save();ctx.fillStyle="rgba(0,0,0,.28)";ctx.fillRect(0,0,w,h);ctx.setLineDash([12,14]);ctx.strokeStyle="rgba(255,255,255,.22)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#72ffd5";ctx.shadowBlur=20;ctx.shadowColor="#72ffd5";ctx.fillRect(leftX-padW/2,p.playerY-padH/2,padW,padH);ctx.fillStyle="#9b7bff";ctx.shadowColor="#9b7bff";ctx.fillRect(rightX-padW/2,p.aiY-padH/2,padW,padH);ctx.fillStyle="#fff";ctx.shadowColor="#fff";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.font=`900 ${Math.max(28,w*.045)}px system-ui`;ctx.textAlign="center";ctx.fillText(`${p.player}   ${p.ai}`,w/2,h*.1);ctx.restore()}
  renderFruit(ctx,w,h){ctx.save();ctx.fillStyle="rgba(0,0,0,.18)";ctx.fillRect(0,0,w,h);for(const item of this.fruit.items){if(item.dead)continue;ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.rot);ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`${item.r*1.75}px system-ui`;ctx.fillText(item.emoji,0,0);ctx.restore()}if(this.fruit.lastPoint){ctx.beginPath();ctx.arc(this.fruit.lastPoint.x,this.fruit.lastPoint.y,12,0,Math.PI*2);ctx.fillStyle="#72ffd5";ctx.shadowBlur=20;ctx.shadowColor="#72ffd5";ctx.fill()}ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font=`900 ${Math.max(22,w*.034)}px system-ui`;ctx.fillText(`${this.fruit.score} PONTOS`,w/2,h*.09);ctx.restore()}
  renderBrick(ctx,w,h){const s=this.brick,py=h*.9,b=s.ball,hues=["#72ffd5","#9b7bff","#ffcb6b","#ff7d9d","#7dd3fc"];ctx.save();ctx.fillStyle="rgba(0,0,0,.22)";ctx.fillRect(0,0,w,h);for(const br of s.bricks){if(!br.alive)continue;ctx.fillStyle=hues[br.row%hues.length];ctx.globalAlpha=.84;ctx.fillRect(br.x,br.y,br.w,br.h)}ctx.globalAlpha=1;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#72ffd5";ctx.fillRect(s.paddleX-s.paddleW/2,py-s.paddleH/2,s.paddleW,s.paddleH);ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font=`800 ${Math.max(20,w*.03)}px system-ui`;ctx.fillText(`${s.score} • ${"❤️".repeat(s.lives)}`,w/2,h*.07);ctx.restore()}
  renderRps(ctx,w,h){const r=this.rps;ctx.save();ctx.fillStyle="rgba(0,0,0,.34)";ctx.fillRect(0,0,w,h);ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font=`900 ${Math.max(28,w*.045)}px system-ui`;ctx.fillText(r.result,w/2,h*.18);ctx.font=`${Math.max(64,w*.12)}px system-ui`;ctx.fillText(r.player?RPS_ICON[r.player]:"❔",w*.3,h*.5);ctx.fillText(r.cpu?RPS_ICON[r.cpu]:"🤖",w*.7,h*.5);ctx.font=`700 ${Math.max(16,w*.024)}px system-ui`;ctx.fillText(r.player?`TU: ${RPS_LABEL[r.player]}`:"Segure um gesto",w*.3,h*.66);ctx.fillText(r.cpu?`CPU: ${RPS_LABEL[r.cpu]}`:"CPU",w*.7,h*.66);ctx.fillText(`${r.wins} vitórias • ${r.losses} derrotas • ${r.ties} empates`,w/2,h*.82);ctx.restore()}
  renderBoxing(ctx,w,h,now){const b=this.boxing;ctx.save();ctx.fillStyle="rgba(0,0,0,.18)";ctx.fillRect(0,0,w,h);if(b.target){const pulse=1+Math.sin((now-b.target.born)/80)*.08;ctx.beginPath();ctx.arc(b.target.x,b.target.y,b.target.r*pulse,0,Math.PI*2);ctx.fillStyle="#ff5c74";ctx.shadowBlur=30;ctx.shadowColor="#ff5c74";ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`${b.target.r}px system-ui`;ctx.fillText("🥊",b.target.x,b.target.y)}ctx.fillStyle="#fff";ctx.font=`900 ${Math.max(24,w*.035)}px system-ui`;ctx.textAlign="center";ctx.fillText(`${b.score} HITS • COMBO x${Math.max(1,b.combo)}`,w/2,h*.09);ctx.restore()}
  renderGoalie(ctx,w,h){const g=this.goalie;ctx.save();ctx.fillStyle="rgba(0,40,10,.2)";ctx.fillRect(0,0,w,h);ctx.strokeStyle="rgba(255,255,255,.7)";ctx.lineWidth=5;ctx.strokeRect(w*.12,h*.55,w*.76,h*.35);for(let i=1;i<6;i++){ctx.globalAlpha=.22;ctx.beginPath();ctx.moveTo(w*.12+i*w*.76/6,h*.55);ctx.lineTo(w*.12+i*w*.76/6,h*.9);ctx.stroke()}ctx.globalAlpha=1;if(g.ball){ctx.font=`${g.ball.r*2.2}px system-ui`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("⚽",g.ball.x,g.ball.y)}ctx.fillStyle="#fff";ctx.font=`900 ${Math.max(22,w*.032)}px system-ui`;ctx.fillText(`${g.saves} DEFESAS • ${g.goals} GOLS`,w/2,h*.09);ctx.restore()}
  renderBasket(ctx,w,h){const s=this.basket,b=s.ball,hx=w*.76,hy=h*.34,hr=w*.055;ctx.save();ctx.fillStyle="rgba(0,0,0,.16)";ctx.fillRect(0,0,w,h);ctx.strokeStyle="#ff7043";ctx.lineWidth=Math.max(7,w*.008);ctx.beginPath();ctx.ellipse(hx,hy,hr,hr*.28,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle="rgba(255,255,255,.55)";ctx.lineWidth=3;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(hx+i*hr*.35,hy+5);ctx.lineTo(hx+i*hr*.18,hy+hr*.9);ctx.stroke()}ctx.font=`${b.r*2.15}px system-ui`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("🏀",b.x,b.y);ctx.fillStyle="#fff";ctx.font=`900 ${Math.max(22,w*.032)}px system-ui`;ctx.fillText(`${s.score} CESTAS / ${s.shots} ARREMESSOS`,w/2,h*.09);ctx.restore()}
  renderEyeAim(ctx,w,h){const e=this.eyeAim,t=e.target;ctx.save();ctx.fillStyle="rgba(0,0,0,.22)";ctx.fillRect(0,0,w,h);const x=t.x*w,y=t.y*h,r=t.r*Math.min(w,h);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle="#ff5c74";ctx.shadowBlur=30;ctx.shadowColor="#ff5c74";ctx.fill();ctx.beginPath();ctx.arc(x,y,r*.55,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();ctx.beginPath();ctx.arc(x,y,r*.22,0,Math.PI*2);ctx.fillStyle="#ff5c74";ctx.fill();if(e.dwell>0){ctx.beginPath();ctx.arc(x,y,r+12,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(e.dwell/380,1));ctx.strokeStyle="#72ffd5";ctx.lineWidth=7;ctx.stroke()}ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font=`900 ${Math.max(22,w*.032)}px system-ui`;ctx.fillText(`${e.score} ALVOS • ${Math.ceil(e.timeLeft/1000)}s`,w/2,h*.09);if(e.timeLeft<=0){ctx.font=`900 ${Math.max(42,w*.065)}px system-ui`;ctx.fillText("FIM DE JOGO",w/2,h*.5)}ctx.restore()}
}
