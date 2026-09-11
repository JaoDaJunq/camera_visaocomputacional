const meanPoint=(lm,ids)=>({x:ids.reduce((s,i)=>s+lm[i].x,0)/ids.length,y:ids.reduce((s,i)=>s+lm[i].y,0)/ids.length});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export class EyeTrackingExperience{
  constructor(){
    this.landmarks=null;
    this.raw={x:.5,y:.5};
    this.smoothed={x:.5,y:.5};
    this.center={x:.5,y:.5};
    this.calibrated=false;
    this.samples=[];
    this.calibratingUntil=0;
    this.target={x:.72,y:.35,r:.055};
    this.dwell=0;
    this.hits=0;
  }

  startCalibration(now=performance.now()){
    this.samples=[];
    this.calibratingUntil=now+1400;
    this.calibrated=false;
  }

  update(faceResult,now=performance.now()){
    const lm=faceResult?.faceLandmarks?.[0]||null;
    this.landmarks=lm;
    if(!lm)return null;

    const leftIris=meanPoint(lm,[468,469,470,471,472]);
    const rightIris=meanPoint(lm,[473,474,475,476,477]);
    const leftA=lm[33],leftB=lm[133],rightA=lm[362],rightB=lm[263];
    const leftTop=lm[159],leftBottom=lm[145],rightTop=lm[386],rightBottom=lm[374];

    const ratio=(p,a,b)=>Math.abs(b-a)<1e-5?.5:clamp((p-a)/(b-a),0,1);
    const lx=ratio(leftIris.x,leftA.x,leftB.x),rx=ratio(rightIris.x,rightA.x,rightB.x);
    const ly=ratio(leftIris.y,leftTop.y,leftBottom.y),ry=ratio(rightIris.y,rightTop.y,rightBottom.y);
    const raw={x:(lx+rx)/2,y:(ly+ry)/2};
    this.raw=raw;

    if(now<this.calibratingUntil){
      this.samples.push(raw);
      if(this.samples.length>50)this.samples.shift();
    }else if(this.calibratingUntil){
      if(this.samples.length){
        this.center={x:this.samples.reduce((s,p)=>s+p.x,0)/this.samples.length,y:this.samples.reduce((s,p)=>s+p.y,0)/this.samples.length};
        this.calibrated=true;
      }
      this.calibratingUntil=0;
    }

    const gainX=3.4,gainY=4.3;
    const mapped={
      x:clamp(.5+(raw.x-this.center.x)*gainX,0,1),
      y:clamp(.5+(raw.y-this.center.y)*gainY,0,1)
    };
    const a=.22;
    this.smoothed.x+=(mapped.x-this.smoothed.x)*a;
    this.smoothed.y+=(mapped.y-this.smoothed.y)*a;

    const d=Math.hypot(this.smoothed.x-this.target.x,this.smoothed.y-this.target.y);
    if(d<this.target.r){this.dwell+=16;if(this.dwell>650){this.hits++;this.randomTarget();this.dwell=0}}else this.dwell=Math.max(0,this.dwell-28);

    return this.smoothed;
  }

  randomTarget(){
    this.target={x:.14+Math.random()*.72,y:.16+Math.random()*.68,r:.055};
  }

  render(ctx,w,h,now=performance.now()){
    if(!this.landmarks)return;
    const tx=this.target.x*w,ty=this.target.y*h,tr=this.target.r*Math.min(w,h);
    ctx.save();
    ctx.beginPath();ctx.arc(tx,ty,tr,0,Math.PI*2);ctx.strokeStyle='rgba(155,123,255,.8)';ctx.lineWidth=5;ctx.stroke();
    if(this.dwell>0){ctx.beginPath();ctx.arc(tx,ty,tr+8,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(this.dwell/650,1));ctx.strokeStyle='#72ffd5';ctx.lineWidth=6;ctx.stroke()}
    const x=this.smoothed.x*w,y=this.smoothed.y*h;
    ctx.beginPath();ctx.arc(x,y,Math.max(10,w/90),0,Math.PI*2);ctx.fillStyle='#72ffd5';ctx.shadowBlur=24;ctx.shadowColor='#72ffd5';ctx.fill();
    if(now<this.calibratingUntil){ctx.shadowBlur=0;ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(w*.2,h*.42,w*.6,h*.16);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font=`700 ${Math.max(22,w/28)}px system-ui`;ctx.fillText('OLHE PARA O CENTRO',w/2,h*.5)}
    ctx.restore();
  }
}
