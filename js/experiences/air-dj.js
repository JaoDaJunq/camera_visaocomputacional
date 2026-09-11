const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export class AirDJExperience{
  constructor(){
    this.ctx=null;this.master=null;this.filter=null;this.osc=null;this.oscGain=null;this.enabled=false;
    this.lastTriggers={};this.pitch=220;this.volume=.35;this.cutoff=2400;this.bpm=108;this.beatAt=0;this.beat=0;
    this.pads=[
      {id:"kick",label:"KICK",emoji:"🥁"},{id:"snare",label:"SNARE",emoji:"💥"},{id:"hat",label:"HAT",emoji:"✨"},{id:"clap",label:"CLAP",emoji:"👏"}
    ];
  }

  async enable(){
    if(this.enabled){if(this.ctx?.state==="suspended")await this.ctx.resume();return}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error("WebAudio sem suporte");
    this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=.55;this.filter=this.ctx.createBiquadFilter();this.filter.type="lowpass";this.filter.frequency.value=this.cutoff;this.filter.Q.value=4;this.filter.connect(this.master);this.master.connect(this.ctx.destination);this.enabled=true;
  }

  disableTone(){if(this.oscGain){const t=this.ctx.currentTime;this.oscGain.gain.cancelScheduledValues(t);this.oscGain.gain.setTargetAtTime(0,t,.025)}if(this.osc){const o=this.osc;setTimeout(()=>{try{o.stop()}catch{}},90)}this.osc=null;this.oscGain=null}

  ensureTone(freq,vol){
    if(!this.enabled)return;
    const t=this.ctx.currentTime;
    if(!this.osc){this.osc=this.ctx.createOscillator();this.osc.type="sawtooth";this.oscGain=this.ctx.createGain();this.oscGain.gain.value=0;this.osc.connect(this.oscGain);this.oscGain.connect(this.filter);this.osc.start()}
    this.osc.frequency.setTargetAtTime(freq,t,.025);this.oscGain.gain.setTargetAtTime(vol,t,.03);
  }

  trigger(id,now=performance.now()){
    if(!this.enabled||now-(this.lastTriggers[id]||0)<110)return;this.lastTriggers[id]=now;
    if(id==="kick")this.kick();if(id==="snare")this.snare();if(id==="hat")this.hat();if(id==="clap")this.clap();
  }

  kick(){const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type="sine";o.frequency.setValueAtTime(155,t);o.frequency.exponentialRampToValueAtTime(48,t+.16);g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.2)}
  noiseBuffer(seconds=.16){const n=Math.floor(this.ctx.sampleRate*seconds),b=this.ctx.createBuffer(1,n,this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return b}
  snare(){const t=this.ctx.currentTime,s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();s.buffer=this.noiseBuffer(.18);f.type="highpass";f.frequency.value=900;g.gain.setValueAtTime(.55,t);g.gain.exponentialRampToValueAtTime(.001,t+.17);s.connect(f);f.connect(g);g.connect(this.master);s.start(t)}
  hat(){const t=this.ctx.currentTime,s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();s.buffer=this.noiseBuffer(.07);f.type="highpass";f.frequency.value=5200;g.gain.setValueAtTime(.28,t);g.gain.exponentialRampToValueAtTime(.001,t+.065);s.connect(f);f.connect(g);g.connect(this.master);s.start(t)}
  clap(){const t=this.ctx.currentTime;[0,.025,.05].forEach(off=>{const s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();s.buffer=this.noiseBuffer(.09);f.type="bandpass";f.frequency.value=1700;g.gain.setValueAtTime(.28,t+off);g.gain.exponentialRampToValueAtTime(.001,t+off+.08);s.connect(f);f.connect(g);g.connect(this.master);s.start(t+off)})}

  setBpm(v){this.bpm=clamp(v,60,180)}

  update(hands,now,w,h){
    if(!this.enabled||!w||!h)return;
    const list=hands||[];
    const a=list[0],b=list[1];
    if(a?.palm){this.cutoff=300+clamp(1-a.palm.y/h,0,1)*7600;this.filter.frequency.setTargetAtTime(this.cutoff,this.ctx.currentTime,.05)}
    const toneHand=b||a;
    if(toneHand?.palm){
      this.pitch=110*Math.pow(2,clamp(toneHand.palm.x/w,0,1)*3);
      this.volume=.12+clamp(1-toneHand.palm.y/h,0,1)*.35;
      if(toneHand.gesture==="pinch")this.ensureTone(this.pitch,this.volume);else this.disableTone();
    }else this.disableTone();

    for(const hand of list){
      if(!hand?.palm)continue;
      if(hand.gesture==="fist"&&hand.speed>420)this.trigger("kick",now);
      if(hand.gesture==="peace"&&hand.speed>260)this.trigger("clap",now);
      const padY=h*.72,padH=h*.22,padW=w/4;
      if(hand.palm.y>=padY&&hand.speed>330){const idx=clamp(Math.floor(hand.palm.x/padW),0,3);this.trigger(this.pads[idx].id,now)}
    }

    const beatMs=60000/this.bpm;if(now>=this.beatAt){this.beat=(this.beat+1)%4;this.beatAt=now+beatMs;if(this.beat===0)this.trigger("hat",now)}
  }

  render(ctx,w,h){
    ctx.save();ctx.fillStyle="rgba(0,0,0,.28)";ctx.fillRect(0,0,w,h);
    const cx=w*.5,cy=h*.33,r=Math.min(w,h)*.16;ctx.strokeStyle="#72ffd5";ctx.lineWidth=6;ctx.shadowBlur=24;ctx.shadowColor="#72ffd5";ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
    const angle=(this.pitch-110)/(880-110)*Math.PI*2-Math.PI/2;ctx.strokeStyle="#9b7bff";ctx.lineWidth=10;ctx.beginPath();ctx.arc(cx,cy,r*.78,-Math.PI/2,angle);ctx.stroke();
    ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font=`900 ${Math.max(24,w*.035)}px system-ui`;ctx.fillText(`${Math.round(this.pitch)} Hz`,cx,cy);ctx.font=`700 ${Math.max(13,w*.018)}px system-ui`;ctx.fillText(`FILTER ${Math.round(this.cutoff)} Hz • ${this.bpm} BPM`,cx,cy+r*.38);
    const y=h*.72,pw=w/4,ph=h*.22;this.pads.forEach((p,i)=>{ctx.fillStyle=i===this.beat?"rgba(114,255,213,.2)":"rgba(255,255,255,.07)";ctx.strokeStyle="rgba(255,255,255,.18)";ctx.lineWidth=2;ctx.fillRect(i*pw+5,y,pw-10,ph);ctx.strokeRect(i*pw+5,y,pw-10,ph);ctx.font=`${Math.max(26,w*.04)}px system-ui`;ctx.fillStyle="#fff";ctx.fillText(p.emoji,i*pw+pw/2,y+ph*.43);ctx.font=`800 ${Math.max(11,w*.015)}px system-ui`;ctx.fillText(p.label,i*pw+pw/2,y+ph*.75)});
    if(!this.enabled){ctx.fillStyle="rgba(0,0,0,.58)";ctx.fillRect(w*.17,h*.42,w*.66,h*.12);ctx.fillStyle="#fff";ctx.font=`800 ${Math.max(18,w*.026)}px system-ui`;ctx.fillText("ATIVE O ÁUDIO PARA COMEÇAR",w/2,h*.49)}
    ctx.restore();
  }

  status(){return this.enabled?`${Math.round(this.pitch)}Hz • ${this.bpm} BPM`:"Áudio desligado"}
}
