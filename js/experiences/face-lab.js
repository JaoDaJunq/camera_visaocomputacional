const FACE_CONNECTIONS = [
  [33,133],[133,159],[159,145],[145,33],[362,263],[263,386],[386,374],[374,362],
  [61,291],[61,13],[13,291],[61,14],[14,291],[70,63],[63,105],[105,66],[66,107],
  [336,296],[296,334],[334,293],[293,300],[10,152],[234,454],[93,323]
];

const avg = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
const categoryMap = result => {
  const cats = result?.faceBlendshapes?.[0]?.categories || [];
  return Object.fromEntries(cats.map(c => [c.categoryName, c.score]));
};

export class FaceLabExperience {
  constructor(){
    this.metrics = { smile:0, mouth:0, blinkL:0, blinkR:0, brow:0, yaw:0, pitch:0 };
    this.landmarks = null;
  }

  update(faceResult){
    this.landmarks = faceResult?.faceLandmarks?.[0] || null;
    if (!this.landmarks) {
      this.metrics = { smile:0, mouth:0, blinkL:0, blinkR:0, brow:0, yaw:0, pitch:0 };
      return this.metrics;
    }

    const b = categoryMap(faceResult);
    const smile = avg([b.mouthSmileLeft||0,b.mouthSmileRight||0]);
    const mouth = b.jawOpen || 0;
    const blinkL = b.eyeBlinkLeft || 0;
    const blinkR = b.eyeBlinkRight || 0;
    const brow = avg([b.browInnerUp||0,b.browOuterUpLeft||0,b.browOuterUpRight||0]);

    const lm = this.landmarks;
    const nose = lm[1], leftCheek = lm[234], rightCheek = lm[454], forehead = lm[10], chin = lm[152];
    const faceMidX = (leftCheek.x + rightCheek.x) / 2;
    const faceMidY = (forehead.y + chin.y) / 2;
    const faceW = Math.max(Math.abs(rightCheek.x-leftCheek.x), .001);
    const faceH = Math.max(Math.abs(chin.y-forehead.y), .001);
    const yaw = Math.max(-1,Math.min(1,(nose.x-faceMidX)/faceW*3.2));
    const pitch = Math.max(-1,Math.min(1,(nose.y-faceMidY)/faceH*3.2));

    this.metrics = { smile, mouth, blinkL, blinkR, brow, yaw, pitch };
    return this.metrics;
  }

  render(ctx,width,height,{mesh=true}={}){
    if (!this.landmarks) return;
    const p=i=>({x:this.landmarks[i].x*width,y:this.landmarks[i].y*height});
    if (mesh){
      ctx.save();
      ctx.strokeStyle='rgba(155,123,255,.65)';
      ctx.fillStyle='rgba(114,255,213,.9)';
      ctx.lineWidth=Math.max(1.5,width/700);
      for(const [a,b] of FACE_CONNECTIONS){const p1=p(a),p2=p(b);ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke()}
      const points=[1,33,133,362,263,61,291,13,14,10,152,234,454,468,473];
      for(const i of points){const q=p(i);ctx.beginPath();ctx.arc(q.x,q.y,Math.max(2,width/350),0,Math.PI*2);ctx.fill()}
      ctx.restore();
    }

    const m=this.metrics;
    if(m.mouth>.45){
      const q=p(13);ctx.save();ctx.font=`${Math.max(30,width/18)}px system-ui`;ctx.textAlign='center';ctx.fillText('😮',q.x,q.y+height*.08);ctx.restore();
    }
    if(m.smile>.55){
      ctx.save();ctx.globalAlpha=Math.min(1,(m.smile-.5)*2);ctx.font=`${Math.max(28,width/22)}px system-ui`;ctx.fillText('✨',width*.16,height*.2);ctx.fillText('✨',width*.78,height*.22);ctx.restore();
    }
  }
}
