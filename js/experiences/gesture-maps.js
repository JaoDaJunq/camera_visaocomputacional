const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angleDiff=(a,b)=>{let d=a-b;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d};

export class GestureMapsExperience{
  constructor(){
    this.map=null;this.host=null;this.mapEl=null;this.ready=false;this.rotation=0;
    this.lastPalm=null;this.lastTwoDistance=null;this.lastTwoAngle=null;this.lastZoomAt=0;
    this.resetSince=0;this.lastAction="Aguardando gesto";this.home={lat:-14.235,lng:-51.925,zoom:4};
  }

  async ensure(stage){
    if(this.ready&&this.map)return;
    await this.loadLeaflet();
    this.host=document.createElement("div");
    Object.assign(this.host.style,{position:"absolute",inset:"0",zIndex:"1",overflow:"hidden",borderRadius:"24px",display:"none",background:"#10141b"});
    this.mapEl=document.createElement("div");
    Object.assign(this.mapEl.style,{position:"absolute",left:"-8%",top:"-8%",width:"116%",height:"116%",transformOrigin:"50% 50%",willChange:"transform"});
    this.host.appendChild(this.mapEl);stage.appendChild(this.host);
    this.map=window.L.map(this.mapEl,{zoomControl:false,attributionControl:true,dragging:false,touchZoom:false,doubleClickZoom:false,scrollWheelZoom:false,boxZoom:false,keyboard:false,zoomAnimation:true,fadeAnimation:true}).setView([this.home.lat,this.home.lng],this.home.zoom);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(this.map);
    this.ready=true;setTimeout(()=>this.map.invalidateSize(),80);
  }

  async loadLeaflet(){
    if(window.L)return;
    if(!document.querySelector('link[data-leaflet]')){const link=document.createElement("link");link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";link.dataset.leaflet="1";document.head.appendChild(link)}
    await new Promise((resolve,reject)=>{const existing=document.querySelector('script[data-leaflet]');if(existing){if(window.L)return resolve();existing.addEventListener("load",resolve,{once:true});existing.addEventListener("error",reject,{once:true});return}const s=document.createElement("script");s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";s.dataset.leaflet="1";s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  }

  show(){if(this.host){this.host.style.display="block";setTimeout(()=>this.map?.invalidateSize(),50)}}
  hide(){if(this.host)this.host.style.display="none";this.resetTracking()}
  resetTracking(){this.lastPalm=null;this.lastTwoDistance=null;this.lastTwoAngle=null;this.resetSince=0}

  resetView(){if(!this.map)return;this.map.setView([this.home.lat,this.home.lng],this.home.zoom,{animate:true});this.rotation=0;this.applyRotation();this.lastAction="Mapa resetado";this.resetTracking()}
  zoomIn(){if(!this.map)return;this.map.zoomIn(1);this.lastAction="Zoom +"}
  zoomOut(){if(!this.map)return;this.map.zoomOut(1);this.lastAction="Zoom -"}
  applyRotation(){if(this.mapEl)this.mapEl.style.transform=`rotate(${this.rotation}deg) scale(1.06)`}

  update(hands,now,w,h){
    if(!this.map||!this.ready)return;
    const list=(hands||[]).filter(x=>x?.palm);
    if(!list.length){this.resetTracking();this.lastAction="Mostre a mão";return}

    if(list.length>=2){
      const a=list[0],b=list[1],bothOpen=a.gesture==="open"&&b.gesture==="open";
      if(bothOpen){if(!this.resetSince)this.resetSince=now;if(now-this.resetSince>900){this.resetView();this.resetSince=now+99999}return}else this.resetSince=0;

      const dx=b.palm.x-a.palm.x,dy=b.palm.y-a.palm.y,dist=Math.hypot(dx,dy),ang=Math.atan2(dy,dx);
      if(this.lastTwoDistance){
        const ratio=dist/Math.max(this.lastTwoDistance,1);
        if(now-this.lastZoomAt>260&&ratio>1.12){this.map.zoomIn(1);this.lastZoomAt=now;this.lastAction="Duas mãos: zoom +"}
        else if(now-this.lastZoomAt>260&&ratio<.89){this.map.zoomOut(1);this.lastZoomAt=now;this.lastAction="Duas mãos: zoom -"}
      }
      if(this.lastTwoAngle!==null){const delta=angleDiff(ang,this.lastTwoAngle);if(Math.abs(delta)>.015){this.rotation+=delta*180/Math.PI*.75;this.rotation=((this.rotation%360)+360)%360;this.applyRotation();this.lastAction=`Rotação ${Math.round(this.rotation)}°`}}
      this.lastTwoDistance=dist;this.lastTwoAngle=ang;this.lastPalm=null;return;
    }

    this.lastTwoDistance=null;this.lastTwoAngle=null;this.resetSince=0;
    const a=list[0],active=a.gesture==="fist"||a.gesture==="pinch";
    if(!active){this.lastPalm=null;this.lastAction="✊ ou 🤏 para mover";return}
    if(this.lastPalm){
      const dx=a.palm.x-this.lastPalm.x,dy=a.palm.y-this.lastPalm.y;
      if(Math.hypot(dx,dy)>2){this.map.panBy([-dx*1.25,-dy*1.25],{animate:false});this.lastAction="Movendo mapa"}
    }
    this.lastPalm={...a.palm};
  }

  renderOverlay(ctx,w,h,hands=[]){
    ctx.save();ctx.fillStyle="rgba(7,10,15,.66)";ctx.fillRect(w*.02,h*.02,w*.34,h*.085);ctx.fillStyle="#fff";ctx.textBaseline="middle";ctx.font=`800 ${Math.max(12,w*.015)}px system-ui`;ctx.fillText(this.lastAction,w*.04,h*.062);
    const list=(hands||[]).filter(x=>x?.palm);for(let i=0;i<list.length;i++){const p=list[i].palm;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(12,w*.014),0,Math.PI*2);ctx.fillStyle=i?"#9b7bff":"#72ffd5";ctx.shadowBlur=18;ctx.shadowColor=ctx.fillStyle;ctx.fill()}ctx.restore();
  }

  status(){if(!this.map)return"Carregando mapa";return`Z${this.map.getZoom()} • ${Math.round(this.rotation)}°`}
}
