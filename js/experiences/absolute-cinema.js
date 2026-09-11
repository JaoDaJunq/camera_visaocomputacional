export class AbsoluteCinemaEffect{
  constructor(){this.until=0;this.started=0;this.cooldownUntil=0}
  canTrigger(now=performance.now()){return now>=this.cooldownUntil}
  trigger(now=performance.now()){
    if(!this.canTrigger(now))return false;
    this.started=now;this.until=now+2200;this.cooldownUntil=now+5000;return true;
  }
  get active(){return performance.now()<this.until}
  render(ctx,w,h,now=performance.now()){
    if(now>=this.until)return;
    const total=2200,elapsed=now-this.started,p=Math.max(0,Math.min(1,elapsed/total));
    const fadeIn=Math.min(1,elapsed/220),fadeOut=Math.min(1,(this.until-now)/350),a=Math.min(fadeIn,fadeOut);
    ctx.save();
    ctx.globalAlpha=.5*a;ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
    ctx.globalAlpha=.9*a;
    const bar=Math.max(28,h*.07);ctx.fillStyle='#000';ctx.fillRect(0,0,w,bar);ctx.fillRect(0,h-bar,w,bar);
    ctx.translate(w/2,h*.53);
    const scale=1+Math.sin(Math.min(p,1)*Math.PI)*.035;
    ctx.scale(-scale,scale);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowBlur=28;ctx.shadowColor='rgba(255,255,255,.45)';
    ctx.fillStyle='#fff';ctx.font=`900 ${Math.max(34,w*.072)}px Georgia,serif`;ctx.fillText('ABSOLUTE',0,-Math.max(24,h*.045));
    ctx.font=`900 ${Math.max(42,w*.092)}px Georgia,serif`;ctx.fillText('CINEMA',0,Math.max(26,h*.045));
    ctx.font=`600 ${Math.max(14,w*.022)}px system-ui`;ctx.shadowBlur=0;ctx.globalAlpha=.72*a;ctx.fillText('✌️  +  ✋',0,Math.max(92,h*.14));
    ctx.restore();
  }
}
