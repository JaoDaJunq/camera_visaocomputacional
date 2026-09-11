const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export class CameraFXExperience{
  constructor(){this.effect="neon";this.strength=.75;this.lastFace=null;this.lastHands=[]}
  setEffect(name){this.effect=name}
  cycle(){const all=["neon","matrix","comic","cinema","ghost","none"],i=all.indexOf(this.effect);this.effect=all[(i+1)%all.length];return this.effect}
  update(faceResult,hands){this.lastFace=faceResult;this.lastHands=hands||[]}
  render(ctx,w,h,video){
    ctx.save();
    if(this.effect==="none"){ctx.restore();return}
    if(this.effect==="cinema"){
      const bar=h*.09;ctx.fillStyle="rgba(0,0,0,.82)";ctx.fillRect(0,0,w,bar);ctx.fillRect(0,h-bar,w,bar);
      ctx.fillStyle="rgba(255,190,110,.08)";ctx.fillRect(0,0,w,h);
    }
    if(this.effect==="neon"){
      ctx.globalCompositeOperation="screen";ctx.strokeStyle="rgba(114,255,213,.85)";ctx.lineWidth=Math.max(2,w*.004);ctx.shadowBlur=22;ctx.shadowColor="#72ffd5";
      for(const hand of this.lastHands){if(!hand?.palm)continue;ctx.beginPath();ctx.arc(hand.palm.x,hand.palm.y,Math.max(35,w*.05),0,Math.PI*2);ctx.stroke()}
      ctx.shadowBlur=0;ctx.globalCompositeOperation="source-over";
    }
    if(this.effect==="matrix"){
      ctx.fillStyle="rgba(0,255,120,.055)";for(let x=0;x<w;x+=Math.max(14,w*.02))ctx.fillRect(x,0,1,h);
      ctx.fillStyle="rgba(0,255,120,.18)";ctx.font=`${Math.max(12,w*.018)}px monospace`;for(let i=0;i<45;i++){const x=(i*83)%w,y=(i*137)%h;ctx.fillText(String.fromCharCode(0x30A0+(i*7)%80),x,y)}
    }
    if(this.effect==="comic"){
      ctx.globalAlpha=.28;ctx.fillStyle="#fff";for(let y=0;y<h;y+=10)for(let x=(y/10)%2?5:0;x<w;x+=10){ctx.beginPath();ctx.arc(x,y,1.7,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
      ctx.strokeStyle="rgba(255,255,255,.55)";ctx.lineWidth=3;for(const hand of this.lastHands){if(hand?.palm){ctx.strokeRect(hand.palm.x-30,hand.palm.y-30,60,60)}}
    }
    if(this.effect==="ghost"){
      for(const hand of this.lastHands){if(!hand?.palm)continue;for(let i=1;i<=4;i++){ctx.globalAlpha=.12/i;ctx.fillStyle="#bca7ff";ctx.beginPath();ctx.arc(hand.palm.x-i*16,hand.palm.y,Math.max(30,w*.035),0,Math.PI*2);ctx.fill()}}ctx.globalAlpha=1;
    }
    ctx.fillStyle="rgba(0,0,0,.48)";ctx.fillRect(w*.02,h*.89,w*.34,h*.07);ctx.fillStyle="#fff";ctx.font=`800 ${Math.max(12,w*.016)}px system-ui`;ctx.textBaseline="middle";ctx.fillText(`FX: ${this.effect.toUpperCase()}`,w*.04,h*.925);
    ctx.restore();
  }
  status(){return this.effect.toUpperCase()}
}
