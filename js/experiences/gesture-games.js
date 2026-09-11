const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const FRUITS=["🍉","🍊","🍎","🍋","🥝","🍓","🍍","🍑"];
const RPS_ICON={rock:"✊",paper:"✋",scissors:"✌️"};
const RPS_LABEL={rock:"Pedra",paper:"Papel",scissors:"Tesoura"};

export class GestureGamesExperience{
  constructor(){
    this.game="pong";
    this.particles=[];
    this.lastSize={w:0,h:0};
    this.reset(960,540);
  }

  setGame(name,w,h){
    this.game=name;
    this.reset(w,h);
  }

  reset(w,h){
    this.lastSize={w,h};
    this.particles=[];
    this.pong=this.makePong(w,h);
    this.fruit={score:0,items:[],spawnAt:0,lastPoint:null,lastT:0};
    this.brick=this.makeBrick(w,h);
    this.rps={wins:0,losses:0,ties:0,lastGesture:"none",gestureSince:0,latched:false,player:null,cpu:null,result:"Mostre ✊, ✋ ou ✌️"};
  }

  makePong(w,h){
    const dir=Math.random()<.5?-1:1;
    return{player:0,ai:0,playerY:h/2,aiY:h/2,ball:{x:w/2,y:h/2,vx:dir*w*.38,vy:(Math.random()-.5)*h*.35,r:Math.max(10,w*.012)}};
  }

  resetPongBall(w,h,dir=1){
    this.pong.ball={x:w/2,y:h/2,vx:dir*w*(.34+Math.random()*.08),vy:(Math.random()-.5)*h*.38,r:Math.max(10,w*.012)};
  }

  makeBrick(w,h){
    const cols=7,rows=5,gap=Math.max(5,w*.006),margin=w*.09,top=h*.13;
    const bw=(w-margin*2-gap*(cols-1))/cols,bh=Math.max(20,h*.045);
    const bricks=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)bricks.push({x:margin+c*(bw+gap),y:top+r*(bh+gap),w:bw,h:bh,alive:true,row:r});
    return{score:0,lives:3,paddleX:w/2,paddleW:w*.2,paddleH:Math.max(14,h*.024),bricks,ball:{x:w/2,y:h*.72,vx:w*.26,vy:-h*.42,r:Math.max(9,w*.01)}};
  }

  update(hand,dt,now,w,h){
    if(!w||!h)return;
    if(Math.abs(w-this.lastSize.w)>2||Math.abs(h-this.lastSize.h)>2)this.reset(w,h);
    if(this.game==="pong")this.updatePong(hand,dt,w,h);
    if(this.game==="fruit")this.updateFruit(hand,dt,now,w,h);
    if(this.game==="brick")this.updateBrick(hand,dt,w,h);
    if(this.game==="rps")this.updateRps(hand,now);
    this.updateParticles(dt,h);
  }

  updatePong(hand,dt,w,h){
    const p=this.pong,padH=h*.22,padW=Math.max(15,w*.018),leftX=w*.07,rightX=w*.93;
    if(hand?.palm)p.playerY=clamp(hand.palm.y,padH/2,h-padH/2);
    const aiMax=h*.62*dt;
    p.aiY+=clamp(p.ball.y-p.aiY,-aiMax,aiMax);
    p.aiY=clamp(p.aiY,padH/2,h-padH/2);
    const b=p.ball;b.x+=b.vx*dt;b.y+=b.vy*dt;
    if(b.y-b.r<0){b.y=b.r;b.vy=Math.abs(b.vy)}
    if(b.y+b.r>h){b.y=h-b.r;b.vy=-Math.abs(b.vy)}
    const hitPad=(px,py,isLeft)=>{
      const inX=isLeft?(b.x-b.r<=px+padW/2&&b.x>px):(b.x+b.r>=px-padW/2&&b.x<px);
      const inY=Math.abs(b.y-py)<=padH/2+b.r;
      if(inX&&inY){
        b.x=isLeft?px+padW/2+b.r:px-padW/2-b.r;
        b.vx=(isLeft?1:-1)*Math.min(Math.abs(b.vx)*1.045,w*.72);
        b.vy+=((b.y-py)/(padH/2))*h*.22;
        this.burst(b.x,b.y,["✨","💫"],6);
      }
    };
    if(b.vx<0)hitPad(leftX,p.playerY,true);else hitPad(rightX,p.aiY,false);
    if(b.x<-b.r){p.ai++;this.resetPongBall(w,h,1)}
    if(b.x>w+b.r){p.player++;this.resetPongBall(w,h,-1)}
  }

  updateFruit(hand,dt,now,w,h){
    const f=this.fruit;
    if(now>=f.spawnAt){
      const bomb=Math.random()<.13,r=Math.max(25,w*(.025+Math.random()*.012));
      f.items.push({emoji:bomb?"💣":FRUITS[Math.floor(Math.random()*FRUITS.length)],bomb,x:w*(.14+Math.random()*.72),y:h+r,vx:(Math.random()-.5)*w*.24,vy:-h*(.82+Math.random()*.28),r,rot:0,spin:(Math.random()-.5)*5,dead:false});
      f.spawnAt=now+520+Math.random()*430;
    }
    const g=h*1.45;
    for(const item of f.items){item.vy+=g*dt;item.x+=item.vx*dt;item.y+=item.vy*dt;item.rot+=item.spin*dt}
    f.items=f.items.filter(x=>x.y<h+x.r*2&&!x.dead);

    if(hand?.point&&hand.gesture==="point"){
      const p=hand.point;
      if(f.lastPoint&&f.lastT){
        const frameDt=Math.max((now-f.lastT)/1000,.001),speed=Math.hypot(p.x-f.lastPoint.x,p.y-f.lastPoint.y)/frameDt;
        if(speed>Math.max(330,w*.38)){
          for(const item of f.items){
            if(!item.dead&&this.segmentDistance(item,f.lastPoint,p)<item.r*.88){
              item.dead=true;
              if(item.bomb){f.score=Math.max(0,f.score-3);this.burst(item.x,item.y,["💥","💣","🔥"],16)}
              else{f.score++;this.burst(item.x,item.y,["✨","💦","⭐"],12)}
            }
          }
        }
      }
      f.lastPoint={...p};f.lastT=now;
    }else{f.lastPoint=null;f.lastT=0}
  }

  updateBrick(hand,dt,w,h){
    const s=this.brick;
    if(hand?.palm)s.paddleX=clamp(hand.palm.x,s.paddleW/2,w-s.paddleW/2);
    const b=s.ball;b.x+=b.vx*dt;b.y+=b.vy*dt;
    if(b.x-b.r<0){b.x=b.r;b.vx=Math.abs(b.vx)}
    if(b.x+b.r>w){b.x=w-b.r;b.vx=-Math.abs(b.vx)}
    if(b.y-b.r<0){b.y=b.r;b.vy=Math.abs(b.vy)}
    const py=h*.9;
    if(b.vy>0&&b.y+b.r>=py-s.paddleH/2&&b.y-b.r<=py+s.paddleH/2&&Math.abs(b.x-s.paddleX)<=s.paddleW/2+b.r){
      b.y=py-s.paddleH/2-b.r;b.vy=-Math.abs(b.vy);b.vx+=((b.x-s.paddleX)/(s.paddleW/2))*w*.16;this.burst(b.x,b.y,["✨"],5)
    }
    for(const br of s.bricks){
      if(!br.alive)continue;
      const nx=clamp(b.x,br.x,br.x+br.w),ny=clamp(b.y,br.y,br.y+br.h);
      if(Math.hypot(b.x-nx,b.y-ny)<=b.r){
        br.alive=false;s.score++;b.vy*=-1;this.burst(b.x,b.y,["✨","💥"],7);break;
      }
    }
    if(b.y-b.r>h){
      s.lives--;
      if(s.lives<=0){const oldScore=s.score;this.brick=this.makeBrick(w,h);this.brick.score=0;this.burst(w/2,h/2,["💀"],10);return oldScore}
      s.ball={x:w/2,y:h*.72,vx:(Math.random()<.5?-1:1)*w*.26,vy:-h*.42,r:Math.max(9,w*.01)};
    }
    if(s.bricks.every(br=>!br.alive)){const lives=s.lives;this.brick=this.makeBrick(w,h);this.brick.lives=lives;this.burst(w/2,h*.45,["🏆","✨","🎉"],22)}
  }

  updateRps(hand,now){
    const map={fist:"rock",open:"paper",peace:"scissors"},choice=map[hand?.gesture]||null,r=this.rps;
    if(!choice){r.lastGesture="none";r.gestureSince=0;r.latched=false;return}
    if(choice!==r.lastGesture){r.lastGesture=choice;r.gestureSince=now;r.latched=false;return}
    if(r.latched||now-r.gestureSince<620)return;
    r.latched=true;r.player=choice;
    const all=["rock","paper","scissors"];r.cpu=all[Math.floor(Math.random()*all.length)];
    if(r.player===r.cpu){r.ties++;r.result="EMPATE 😐"}
    else if((r.player==="rock"&&r.cpu==="scissors")||(r.player==="paper"&&r.cpu==="rock")||(r.player==="scissors"&&r.cpu==="paper")){r.wins++;r.result="TU GANHOU 🔥";this.burst(this.lastSize.w/2,this.lastSize.h*.45,["🏆","✨","🔥"],18)}
    else{r.losses++;r.result="CPU GANHOU 🤖"}
  }

  updateParticles(dt,h){
    for(const p of this.particles){p.life-=dt;p.vy+=h*.35*dt;p.x+=p.vx*dt;p.y+=p.vy*dt}
    this.particles=this.particles.filter(p=>p.life>0);
  }

  burst(x,y,chars=["✨"],count=10){
    for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=70+Math.random()*230;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-60,life:.45+Math.random()*.55,max:1,char:chars[Math.floor(Math.random()*chars.length)],size:15+Math.random()*18})}
  }

  segmentDistance(c,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
    if(!len)return Math.hypot(c.x-a.x,c.y-a.y);
    const t=clamp(((c.x-a.x)*dx+(c.y-a.y)*dy)/len,0,1),x=a.x+t*dx,y=a.y+t*dy;
    return Math.hypot(c.x-x,c.y-y);
  }

  hud(){
    if(this.game==="pong")return`${this.pong.player} x ${this.pong.ai}`;
    if(this.game==="fruit")return`${this.fruit.score} pts`;
    if(this.game==="brick")return`${this.brick.score} • ❤️ ${this.brick.lives}`;
    return`${this.rps.wins}V ${this.rps.losses}D ${this.rps.ties}E`;
  }

  title(){return({pong:"Pong",fruit:"Fruit Slice",brick:"Brick Breaker",rps:"Pedra Papel Tesoura"})[this.game]}

  render(ctx,w,h,now=performance.now()){
    if(this.game==="pong")this.renderPong(ctx,w,h);
    if(this.game==="fruit")this.renderFruit(ctx,w,h);
    if(this.game==="brick")this.renderBrick(ctx,w,h);
    if(this.game==="rps")this.renderRps(ctx,w,h,now);
    for(const p of this.particles){ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`${p.size}px system-ui`;ctx.fillText(p.char,p.x,p.y);ctx.restore()}
  }

  renderPong(ctx,w,h){
    const p=this.pong,padH=h*.22,padW=Math.max(15,w*.018),leftX=w*.07,rightX=w*.93,b=p.ball;
    ctx.save();ctx.fillStyle="rgba(0,0,0,.28)";ctx.fillRect(0,0,w,h);ctx.setLineDash([12,14]);ctx.strokeStyle="rgba(255,255,255,.22)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="#72ffd5";ctx.shadowBlur=20;ctx.shadowColor="#72ffd5";ctx.fillRect(leftX-padW/2,p.playerY-padH/2,padW,padH);
    ctx.fillStyle="#9b7bff";ctx.shadowColor="#9b7bff";ctx.fillRect(rightX-padW/2,p.aiY-padH/2,padW,padH);
    ctx.fillStyle="#fff";ctx.shadowColor="#fff";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.font=`900 ${Math.max(28,w*.045)}px system-ui`;ctx.textAlign="center";ctx.fillText(`${p.player}   ${p.ai}`,w/2,h*.1);ctx.restore();
  }

  renderFruit(ctx,w,h){
    ctx.save();ctx.fillStyle="rgba(0,0,0,.18)";ctx.fillRect(0,0,w,h);for(const item of this.fruit.items){if(item.dead)continue;ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.rot);ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`${item.r*1.75}px system-ui`;ctx.fillText(item.emoji,0,0);ctx.restore()}if(this.fruit.lastPoint){ctx.beginPath();ctx.arc(this.fruit.lastPoint.x,this.fruit.lastPoint.y,12,0,Math.PI*2);ctx.fillStyle="#72ffd5";ctx.shadowBlur=20;ctx.shadowColor="#72ffd5";ctx.fill()}ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font=`900 ${Math.max(22,w*.034)}px system-ui`;ctx.fillText(`${this.fruit.score} PONTOS`,w/2,h*.09);ctx.restore();
  }

  renderBrick(ctx,w,h){
    const s=this.brick,py=h*.9,b=s.ball;ctx.save();ctx.fillStyle="rgba(0,0,0,.22)";ctx.fillRect(0,0,w,h);
    const hues=["#72ffd5","#9b7bff","#ffcb6b","#ff7d9d","#7dd3fc"];
    for(const br of s.bricks){if(!br.alive)continue;ctx.fillStyle=hues[br.row%hues.length];ctx.globalAlpha=.84;ctx.fillRect(br.x,br.y,br.w,br.h)}ctx.globalAlpha=1;ctx.fillStyle="#fff";ctx.shadowBlur=18;ctx.shadowColor="#fff";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#72ffd5";ctx.shadowColor="#72ffd5";ctx.fillRect(s.paddleX-s.paddleW/2,py-s.paddleH/2,s.paddleW,s.paddleH);ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font=`800 ${Math.max(20,w*.03)}px system-ui`;ctx.fillText(`${s.score} • ${"❤️".repeat(s.lives)}`,w/2,h*.07);ctx.restore();
  }

  renderRps(ctx,w,h){
    const r=this.rps;ctx.save();ctx.fillStyle="rgba(0,0,0,.34)";ctx.fillRect(0,0,w,h);ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font=`900 ${Math.max(28,w*.045)}px system-ui`;ctx.fillText(r.result,w/2,h*.18);
    ctx.font=`${Math.max(64,w*.12)}px system-ui`;ctx.fillText(r.player?RPS_ICON[r.player]:"❔",w*.3,h*.5);ctx.fillText(r.cpu?RPS_ICON[r.cpu]:"🤖",w*.7,h*.5);
    ctx.font=`700 ${Math.max(16,w*.024)}px system-ui`;ctx.fillText(r.player?`TU: ${RPS_LABEL[r.player]}`:"Segure um gesto",w*.3,h*.66);ctx.fillText(r.cpu?`CPU: ${RPS_LABEL[r.cpu]}`:"CPU",w*.7,h*.66);ctx.fillText(`${r.wins} vitórias • ${r.losses} derrotas • ${r.ties} empates`,w/2,h*.82);ctx.restore();
  }
}
