const meanPoint=(lm,ids)=>({x:ids.reduce((s,i)=>s+lm[i].x,0)/ids.length,y:ids.reduce((s,i)=>s+lm[i].y,0)/ids.length});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const median=values=>{const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};

export class EyeTrackingExperience{
  constructor(){
    this.landmarks=null;
    this.raw={x:.5,y:.5};
    this.smoothed={x:.5,y:.5};
    this.calibrated=false;
    this.coeffX=null;
    this.coeffY=null;
    this.quality=0;
    this.rmse=null;
    this.calibrationPoints=[
      {x:.5,y:.5,label:"CENTRO"},{x:.16,y:.16,label:"SUPERIOR ESQ."},{x:.84,y:.16,label:"SUPERIOR DIR."},
      {x:.84,y:.84,label:"INFERIOR DIR."},{x:.16,y:.84,label:"INFERIOR ESQ."},{x:.5,y:.16,label:"CIMA"},
      {x:.84,y:.5,label:"DIREITA"},{x:.5,y:.84,label:"BAIXO"},{x:.16,y:.5,label:"ESQUERDA"}
    ];
    this.calibration={active:false,index:0,phaseStart:0,samples:[],dataset:[],settleMs:320,sampleMs:720};
    this.target={x:.72,y:.35,r:.055};
    this.dwell=0;
    this.hits=0;
    this.lastUpdateAt=0;
  }

  startCalibration(now=performance.now()){
    this.calibration={...this.calibration,active:true,index:0,phaseStart:now,samples:[],dataset:[]};
    this.calibrated=false;this.coeffX=null;this.coeffY=null;this.quality=0;this.rmse=null;this.dwell=0;
  }

  cancelCalibration(){this.calibration.active=false;this.calibration.samples=[]}
  get isCalibrating(){return this.calibration.active}
  get calibrationPoint(){return this.calibrationPoints[this.calibration.index]||null}
  get calibrationProgress(){return this.calibration.active?this.calibration.index/this.calibrationPoints.length:(this.calibrated?1:0)}
  get cursor(){return{...this.smoothed,calibrated:this.calibrated,quality:this.quality}}

  extractRaw(faceResult){
    const lm=faceResult?.faceLandmarks?.[0]||null;
    this.landmarks=lm;
    if(!lm)return null;
    const leftIris=meanPoint(lm,[468,469,470,471,472]),rightIris=meanPoint(lm,[473,474,475,476,477]);
    const leftA=lm[33],leftB=lm[133],rightA=lm[362],rightB=lm[263];
    const leftTop=lm[159],leftBottom=lm[145],rightTop=lm[386],rightBottom=lm[374];
    const ratio=(p,a,b)=>Math.abs(b-a)<1e-5?.5:clamp((p-a)/(b-a),-.25,1.25);
    return{x:(ratio(leftIris.x,leftA.x,leftB.x)+ratio(rightIris.x,rightA.x,rightB.x))/2,y:(ratio(leftIris.y,leftTop.y,leftBottom.y)+ratio(rightIris.y,rightTop.y,rightBottom.y))/2};
  }

  update(faceResult,now=performance.now(),{practice=true}={}){
    const raw=this.extractRaw(faceResult);
    const dt=this.lastUpdateAt?Math.min((now-this.lastUpdateAt)/1000,.08):.016;this.lastUpdateAt=now;
    if(!raw){this.dwell=Math.max(0,this.dwell-dt*1.8);return null}
    this.raw=raw;
    if(this.calibration.active)this.collectCalibration(raw,now);

    const mapped=this.calibrated&&this.coeffX&&this.coeffY?this.mapCalibrated(raw):this.mapFallback(raw);
    const jump=Math.hypot(mapped.x-this.smoothed.x,mapped.y-this.smoothed.y);
    const alpha=jump>.18?.32:.18;
    this.smoothed.x+=clamp(mapped.x-this.smoothed.x,-.22,.22)*alpha;
    this.smoothed.y+=clamp(mapped.y-this.smoothed.y,-.22,.22)*alpha;
    this.smoothed.x=clamp(this.smoothed.x,0,1);this.smoothed.y=clamp(this.smoothed.y,0,1);

    if(practice&&this.calibrated&&!this.calibration.active){
      const d=Math.hypot(this.smoothed.x-this.target.x,this.smoothed.y-this.target.y);
      if(d<this.target.r){this.dwell+=dt*1000;if(this.dwell>620){this.hits++;this.randomTarget();this.dwell=0}}
      else this.dwell=Math.max(0,this.dwell-dt*1500);
    }else if(!practice)this.dwell=0;
    return this.smoothed;
  }

  collectCalibration(raw,now){
    const c=this.calibration,point=this.calibrationPoint;if(!point)return;
    const elapsed=now-c.phaseStart;
    if(elapsed>=c.settleMs)c.samples.push({...raw});
    if(elapsed<c.settleMs+c.sampleMs)return;
    if(c.samples.length>=4){
      c.dataset.push({raw:{x:median(c.samples.map(s=>s.x)),y:median(c.samples.map(s=>s.y))},target:{x:point.x,y:point.y}});
    }
    c.index++;c.phaseStart=now;c.samples=[];
    if(c.index>=this.calibrationPoints.length){
      c.active=false;
      const ok=this.fitCalibration(c.dataset);
      this.calibrated=ok;
      this.smoothed={x:.5,y:.5};
    }
  }

  features(p){return[1,p.x,p.y,p.x*p.y,p.x*p.x,p.y*p.y]}

  fitCalibration(dataset){
    if(dataset.length<6)return false;
    const rows=dataset.map(d=>this.features(d.raw));
    this.coeffX=this.leastSquares(rows,dataset.map(d=>d.target.x));
    this.coeffY=this.leastSquares(rows,dataset.map(d=>d.target.y));
    if(!this.coeffX||!this.coeffY)return false;
    let err=0;
    for(const d of dataset){const p=this.mapCalibrated(d.raw),dx=p.x-d.target.x,dy=p.y-d.target.y;err+=dx*dx+dy*dy}
    this.rmse=Math.sqrt(err/dataset.length);
    this.quality=clamp(1-this.rmse/.22,0,1);
    return Number.isFinite(this.rmse)&&this.quality>.08;
  }

  leastSquares(rows,targets){
    const n=rows[0].length,A=Array.from({length:n},()=>Array(n).fill(0)),b=Array(n).fill(0);
    for(let r=0;r<rows.length;r++)for(let i=0;i<n;i++){b[i]+=rows[r][i]*targets[r];for(let j=0;j<n;j++)A[i][j]+=rows[r][i]*rows[r][j]}
    for(let i=0;i<n;i++)A[i][i]+=1e-5;
    return this.solve(A,b);
  }

  solve(A,b){
    const n=b.length,M=A.map((row,i)=>[...row,b[i]]);
    for(let col=0;col<n;col++){
      let pivot=col;for(let r=col+1;r<n;r++)if(Math.abs(M[r][col])>Math.abs(M[pivot][col]))pivot=r;
      if(Math.abs(M[pivot][col])<1e-9)return null;
      [M[col],M[pivot]]=[M[pivot],M[col]];
      const div=M[col][col];for(let j=col;j<=n;j++)M[col][j]/=div;
      for(let r=0;r<n;r++){if(r===col)continue;const f=M[r][col];for(let j=col;j<=n;j++)M[r][j]-=f*M[col][j]}
    }
    return M.map(row=>row[n]);
  }

  mapCalibrated(raw){const f=this.features(raw),dot=c=>c.reduce((s,v,i)=>s+v*f[i],0);return{x:clamp(dot(this.coeffX),0,1),y:clamp(dot(this.coeffY),0,1)}}
  mapFallback(raw){return{x:clamp(.5+(raw.x-.5)*3.1,0,1),y:clamp(.5+(raw.y-.5)*3.8,0,1)}}
  randomTarget(){this.target={x:.14+Math.random()*.72,y:.16+Math.random()*.68,r:.055}}

  render(ctx,w,h,now=performance.now(),{practice=true,cursor=true}={}){
    if(this.calibration.active){this.renderCalibration(ctx,w,h,now);return}
    if(!this.landmarks)return;
    if(practice&&this.calibrated){
      const tx=this.target.x*w,ty=this.target.y*h,tr=this.target.r*Math.min(w,h);
      ctx.save();ctx.beginPath();ctx.arc(tx,ty,tr,0,Math.PI*2);ctx.strokeStyle='rgba(155,123,255,.9)';ctx.lineWidth=5;ctx.stroke();
      if(this.dwell>0){ctx.beginPath();ctx.arc(tx,ty,tr+8,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(this.dwell/620,1));ctx.strokeStyle='#72ffd5';ctx.lineWidth=6;ctx.stroke()}ctx.restore();
    }
    if(cursor){const x=this.smoothed.x*w,y=this.smoothed.y*h;ctx.save();ctx.beginPath();ctx.arc(x,y,Math.max(10,w/90),0,Math.PI*2);ctx.fillStyle=this.calibrated?'#72ffd5':'#ffcb6b';ctx.shadowBlur=24;ctx.shadowColor=ctx.fillStyle;ctx.fill();ctx.restore()}
    this.renderQuality(ctx,w,h);
  }

  renderCalibration(ctx,w,h,now){
    const p=this.calibrationPoint;if(!p)return;
    const elapsed=now-this.calibration.phaseStart,total=this.calibration.settleMs+this.calibration.sampleMs,progress=clamp(elapsed/total,0,1),x=p.x*w,y=p.y*h,r=Math.max(20,Math.min(w,h)*.035);
    ctx.save();ctx.fillStyle='rgba(0,0,0,.34)';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r*1.75,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle='#9b7bff';ctx.shadowBlur=30;ctx.shadowColor='#9b7bff';ctx.fill();ctx.shadowBlur=0;
    ctx.beginPath();ctx.arc(x,y,r*1.55,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.strokeStyle='#72ffd5';ctx.lineWidth=7;ctx.stroke();
    const barW=w*.62,barH=Math.max(8,h*.012),bx=(w-barW)/2,by=h*.92;ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(bx,by,barW,barH);ctx.fillStyle='#72ffd5';ctx.fillRect(bx,by,barW*((this.calibration.index+progress)/this.calibrationPoints.length),barH);
    ctx.restore();
  }

  renderQuality(ctx,w,h){
    if(!this.calibrated)return;
    ctx.save();ctx.fillStyle='rgba(0,0,0,.48)';ctx.fillRect(w*.02,h*.91,w*.28,h*.055);ctx.fillStyle='#fff';ctx.textBaseline='middle';ctx.font=`700 ${Math.max(11,w*.014)}px system-ui`;ctx.fillText(`CALIBRAÇÃO ${Math.round(this.quality*100)}%`,w*.035,h*.937);ctx.restore();
  }
}
