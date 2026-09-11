const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export class GestureControllerExperience{
  constructor(){
    this.actions=["Nenhuma","Próximo","Anterior","Toggle","Reset","Disparar efeito"];
    this.bindings={fist:"Toggle",open:"Reset",peace:"Próximo",point:"Anterior",pinch:"Disparar efeito"};
    this.lastGesture="none";this.gestureSince=0;this.latched=false;this.cooldownUntil=0;
    this.state={toggle:false,count:0,lastAction:"Nenhuma",events:[]};
  }

  setBinding(gesture,action){if(this.actions.includes(action))this.bindings[gesture]=action}
  cycleBinding(gesture){const cur=this.bindings[gesture]||"Nenhuma",idx=this.actions.indexOf(cur);this.bindings[gesture]=this.actions[(idx+1)%this.actions.length];return this.bindings[gesture]}
  reset(){this.state={toggle:false,count:0,lastAction:"Nenhuma",events:[]};this.lastGesture="none";this.gestureSince=0;this.latched=false;this.cooldownUntil=0}

  update(hand,now=performance.now()){
    const g=hand?.gesture||"none";
    if(g==="none"||g==="hand"){this.lastGesture=g;this.gestureSince=0;this.latched=false;return null}
    if(g!==this.lastGesture){this.lastGesture=g;this.gestureSince=now;this.latched=false;return null}
    if(this.latched||now<this.cooldownUntil||now-this.gestureSince<380)return null;
    this.latched=true;this.cooldownUntil=now+650;
    const action=this.bindings[g]||"Nenhuma";
    if(action==="Nenhuma")return null;
    this.fire(action,g,now);return{action,gesture:g};
  }

  fire(action,gesture,now){
    if(action==="Toggle")this.state.toggle=!this.state.toggle;
    if(action==="Próximo")this.state.count++;
    if(action==="Anterior")this.state.count--;
    if(action==="Reset"){this.state.count=0;this.state.toggle=false}
    this.state.lastAction=action;
    this.state.events.unshift({action,gesture,t:now});
    this.state.events=this.state.events.slice(0,6);
  }

  render(ctx,w,h,hand){
    ctx.save();ctx.fillStyle="rgba(0,0,0,.28)";ctx.fillRect(0,0,w,h);
    const gestures=[["fist","✊ Punho"],["open","✋ Aberta"],["peace","✌️ Paz"],["point","☝️ Indicador"],["pinch","🤏 Pinça"]];
    const cols=2,cardW=w*.4,cardH=h*.12,startX=w*.08,startY=h*.18,gapX=w*.04,gapY=h*.025;
    gestures.forEach(([g,label],i)=>{const c=i%cols,r=Math.floor(i/cols),x=startX+c*(cardW+gapX),y=startY+r*(cardH+gapY),active=hand?.gesture===g;ctx.fillStyle=active?"rgba(114,255,213,.16)":"rgba(255,255,255,.06)";ctx.strokeStyle=active?"#72ffd5":"rgba(255,255,255,.14)";ctx.lineWidth=active?4:2;ctx.fillRect(x,y,cardW,cardH);ctx.strokeRect(x,y,cardW,cardH);ctx.fillStyle="#fff";ctx.font=`800 ${Math.max(14,w*.018)}px system-ui`;ctx.fillText(label,x+16,y+cardH*.38);ctx.fillStyle="rgba(255,255,255,.65)";ctx.font=`700 ${Math.max(12,w*.015)}px system-ui`;ctx.fillText(`→ ${this.bindings[g]}`,x+16,y+cardH*.72)});
    ctx.fillStyle="#fff";ctx.font=`900 ${Math.max(28,w*.038)}px system-ui`;ctx.fillText(`AÇÃO: ${this.state.lastAction}`,w*.08,h*.67);
    ctx.font=`800 ${Math.max(18,w*.024)}px system-ui`;ctx.fillText(`COUNT ${this.state.count} • TOGGLE ${this.state.toggle?"ON":"OFF"}`,w*.08,h*.74);
    ctx.font=`700 ${Math.max(12,w*.015)}px system-ui`;ctx.fillStyle="rgba(255,255,255,.58)";ctx.fillText("Use os botões abaixo para trocar a ação de cada gesto.",w*.08,h*.82);
    if(hand?.palm){ctx.beginPath();ctx.arc(hand.palm.x,hand.palm.y,Math.max(12,w*.014),0,Math.PI*2);ctx.fillStyle="#72ffd5";ctx.shadowBlur=18;ctx.shadowColor="#72ffd5";ctx.fill()}
    ctx.restore();
  }

  status(){return`${this.state.lastAction} • ${this.state.count}`}
}
