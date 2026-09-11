const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export class PresentationControllerExperience{
  constructor(){
    this.slide=0;this.slides=this.makeSlides();this.pointer=null;this.lastPalm=null;this.swipeCooldown=0;this.strokes=[];this.currentStroke=null;this.zoom=1;
  }

  makeSlides(){
    return[
      {title:"GESTURE CAM",sub:"Apresentação controlada sem tocar na tela",accent:"✋"},
      {title:"SWIPE",sub:"Mova a mão rapidamente para trocar de slide",accent:"👉"},
      {title:"POINTER",sub:"Use o indicador como ponteiro virtual",accent:"☝️"},
      {title:"ANNOTATE",sub:"Pinça + movimento desenha sobre o slide",accent:"🤏"},
      {title:"ABSOLUTE CINEMA",sub:"✌️ + ✋ continua funcionando aqui também",accent:"🎬"}
    ];
  }

  reset(){this.slide=0;this.pointer=null;this.lastPalm=null;this.swipeCooldown=0;this.strokes=[];this.currentStroke=null;this.zoom=1}
  next(){this.slide=(this.slide+1)%this.slides.length;this.currentStroke=null}
  prev(){this.slide=(this.slide-1+this.slides.length)%this.slides.length;this.currentStroke=null}
  clear(){this.strokes=[];this.currentStroke=null}

  update(hand,now,w,h){
    if(!hand)return;
    this.pointer=hand.point||hand.palm||null;
    if(hand.palm&&this.lastPalm){
      const dt=Math.max((now-this.lastPalm.t)/1000,.001),vx=(hand.palm.x-this.lastPalm.x)/dt;
      if(now>this.swipeCooldown&&Math.abs(vx)>Math.max(850,w*1.05)){
        vx>0?this.next():this.prev();this.swipeCooldown=now+650;
      }
    }
    if(hand.palm)this.lastPalm={x:hand.palm.x,y:hand.palm.y,t:now};

    if(hand.gesture==="pinch"&&hand.pinch){
      if(!this.currentStroke){this.currentStroke=[];this.strokes.push(this.currentStroke)}
      const last=this.currentStroke[this.currentStroke.length-1];
      if(!last||Math.hypot(hand.pinch.x-last.x,hand.pinch.y-last.y)>4)this.currentStroke.push({x:hand.pinch.x,y:hand.pinch.y});
    }else this.currentStroke=null;
  }

  render(ctx,w,h){
    const s=this.slides[this.slide];ctx.save();ctx.fillStyle="rgba(8,10,15,.82)";ctx.fillRect(0,0,w,h);
    ctx.translate(w/2,h/2);ctx.scale(this.zoom,this.zoom);ctx.translate(-w/2,-h/2);
    ctx.fillStyle="rgba(255,255,255,.04)";ctx.fillRect(w*.08,h*.08,w*.84,h*.84);ctx.strokeStyle="rgba(255,255,255,.12)";ctx.lineWidth=2;ctx.strokeRect(w*.08,h*.08,w*.84,h*.84);
    ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font=`${Math.max(70,w*.12)}px system-ui`;ctx.fillText(s.accent,w/2,h*.36);
    ctx.font=`900 ${Math.max(28,w*.05)}px system-ui`;ctx.fillText(s.title,w/2,h*.54);ctx.fillStyle="rgba(255,255,255,.64)";ctx.font=`500 ${Math.max(15,w*.021)}px system-ui`;ctx.fillText(s.sub,w/2,h*.61);
    ctx.fillStyle="rgba(255,255,255,.32)";ctx.font=`700 ${Math.max(11,w*.014)}px system-ui`;ctx.fillText(`${this.slide+1} / ${this.slides.length}`,w/2,h*.84);
    ctx.restore();

    ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#72ffd5";ctx.lineWidth=Math.max(5,w*.006);ctx.shadowBlur=16;ctx.shadowColor="#72ffd5";
    for(const stroke of this.strokes){if(stroke.length<2)continue;ctx.beginPath();ctx.moveTo(stroke[0].x,stroke[0].y);for(let i=1;i<stroke.length;i++)ctx.lineTo(stroke[i].x,stroke[i].y);ctx.stroke()}ctx.restore();

    if(this.pointer){ctx.save();ctx.beginPath();ctx.arc(this.pointer.x,this.pointer.y,Math.max(9,w*.011),0,Math.PI*2);ctx.fillStyle="#ff5d73";ctx.shadowBlur=22;ctx.shadowColor="#ff5d73";ctx.fill();ctx.restore()}
  }

  status(){return`Slide ${this.slide+1}/${this.slides.length}`}
}
