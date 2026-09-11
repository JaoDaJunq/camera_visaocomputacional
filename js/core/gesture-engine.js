export class GestureEngine {
  constructor({dwellMs=90,releaseGraceMs=150,smoothingAlpha=.38}={}){
    this.dwellMs=dwellMs;this.releaseGraceMs=releaseGraceMs;this.smoothingAlpha=smoothingAlpha;
    this.active='none';this.candidate='none';this.candidateAt=0;this.lastSeenAt=0;this.smoothIndex=null;this.lastPalm=null;
  }
  reset(){this.active='none';this.candidate='none';this.candidateAt=0;this.lastSeenAt=0;this.smoothIndex=null;this.lastPalm=null}
  point(l,w,h){return{x:l.x*w,y:l.y*h}}
  dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  avg(...p){return{x:p.reduce((s,v)=>s+v.x,0)/p.length,y:p.reduce((s,v)=>s+v.y,0)/p.length}}
  smooth(p){if(!this.smoothIndex)return this.smoothIndex=p;const a=this.smoothingAlpha;this.smoothIndex={x:this.smoothIndex.x+(p.x-this.smoothIndex.x)*a,y:this.smoothIndex.y+(p.y-this.smoothIndex.y)*a};return this.smoothIndex}
  fingerStates(l){return{index:l[8].y<l[6].y,middle:l[12].y<l[10].y,ring:l[16].y<l[14].y,pinky:l[20].y<l[18].y}}
  classify(l,w,h){const f=this.fingerStates(l),count=[f.index,f.middle,f.ring,f.pinky].filter(Boolean).length;const p=i=>this.point(l[i],w,h);const thumb=p(4),index=p(8),wrist=p(0),mid=p(9);const pinch=this.dist(thumb,index)/Math.max(this.dist(wrist,mid),1)<.34;if(pinch)return'pinch';if(f.index&&!f.middle&&!f.ring&&!f.pinky)return'point';if(f.index&&f.middle&&!f.ring&&!f.pinky)return'peace';if(count===4)return'open';if(count===0)return'fist';return'hand'}
  stabilize(raw,now){if(raw===this.active){this.candidate=raw;this.candidateAt=now;this.lastSeenAt=now;return this.active}
    if(raw==='none'){
      if(this.active!=='none'&&now-this.lastSeenAt<this.releaseGraceMs)return this.active;
      this.active='none';this.candidate='none';this.candidateAt=now;return this.active;
    }
    this.lastSeenAt=now;
    if(raw!==this.candidate){this.candidate=raw;this.candidateAt=now;return this.active}
    if(now-this.candidateAt>=this.dwellMs)this.active=raw;
    return this.active
  }
  update(landmarks,w,h,now=performance.now()){
    if(!landmarks){const active=this.stabilize('none',now);this.smoothIndex=null;this.lastPalm=null;return{raw:'none',active,index:null,pinch:null,palm:null,vx:0,vy:0,speed:0,confidence:0}}
    const p=i=>this.point(landmarks[i],w,h),raw=this.classify(landmarks,w,h),active=this.stabilize(raw,now);
    const index=this.smooth(p(8)),pinch=this.avg(index,p(4)),palm=this.avg(p(0),p(5),p(9),p(13),p(17));
    let vx=0,vy=0,speed=0;if(this.lastPalm){const dt=Math.max((now-this.lastPalm.t)/1000,.001);vx=(palm.x-this.lastPalm.x)/dt;vy=(palm.y-this.lastPalm.y)/dt;speed=Math.hypot(vx,vy)}this.lastPalm={...palm,t:now};
    const elapsed=this.candidate===raw?now-this.candidateAt:0,confidence=raw===active?1:Math.min(elapsed/this.dwellMs,1);
    return{raw,active,index,pinch,palm,vx,vy,speed,confidence}
  }
}

export const gestureLabel=g=>({point:'☝️ Indicador',pinch:'🤏 Pinça',peace:'✌️ Paz',open:'✋ Mão aberta',fist:'✊ Punho',hand:'🖐️ Mão',none:'Nenhuma mão'})[g]||g;