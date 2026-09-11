const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export class DesktopControlExperience{
  constructor(){
    this.ws=null;this.connected=false;this.armed=false;this.dragging=false;
    this.lastMoveAt=0;this.lastClickAt=0;this.lastRightClickAt=0;this.lastScrollAt=0;
    this.openSince=0;this.statusText="Companion desconectado";this.lastAction="Nenhuma";
    this.flipX=true;this.pointer={x:.5,y:.5};this.connectionTried=false;
  }

  get localMode(){return["localhost","127.0.0.1"].includes(location.hostname)}

  async connect(){
    this.connectionTried=true;
    if(!this.localMode){this.statusText="Abra pelo companion local";return false}
    if(this.ws&&this.ws.readyState===WebSocket.OPEN)return true;
    return new Promise(resolve=>{
      try{
        const proto=location.protocol==="https:"?"wss":"ws";
        const ws=new WebSocket(`${proto}://${location.host}/ws`);this.ws=ws;
        const timer=setTimeout(()=>{try{ws.close()}catch{};this.statusText="Companion não respondeu";resolve(false)},2200);
        ws.onopen=()=>{clearTimeout(timer);this.connected=true;this.statusText="Companion conectado";this.send({type:"hello",client:"gesture-cam"});resolve(true)};
        ws.onclose=()=>{this.connected=false;this.armed=false;this.dragging=false;this.statusText="Companion desconectado"};
        ws.onerror=()=>{this.connected=false;this.statusText="Erro de conexão"};
      }catch(e){this.statusText="Falha ao conectar";resolve(false)}
    })
  }

  send(payload){if(!this.connected||!this.ws||this.ws.readyState!==WebSocket.OPEN)return false;this.ws.send(JSON.stringify(payload));return true}

  async arm(){
    if(!this.connected){const ok=await this.connect();if(!ok)return false}
    this.armed=true;this.openSince=0;this.lastAction="Controle ATIVO";this.send({type:"release_all"});return true
  }

  disarm(reason="Desarmado"){
    if(this.dragging)this.send({type:"mouse_up",button:"left"});
    this.dragging=false;this.armed=false;this.openSince=0;this.lastAction=reason;this.send({type:"release_all"});
  }

  update(hand,now,w,h){
    if(!hand||!w||!h)return;
    if(!this.connected||!this.armed){if(hand.gesture!=="open")this.openSince=0;return}

    if(hand.gesture==="open"){
      if(!this.openSince)this.openSince=now;
      if(now-this.openSince>1100){this.disarm("✋ PANIC: controle desarmado");return}
    }else this.openSince=0;

    if(hand.point&&now-this.lastMoveAt>18){
      let x=clamp(hand.point.x/w,0,1),y=clamp(hand.point.y/h,0,1);if(this.flipX)x=1-x;
      this.pointer={x,y};this.send({type:"move",x,y});this.lastMoveAt=now;this.lastAction="Movendo cursor";
    }

    if(hand.gesture==="pinch"&&now-this.lastClickAt>520){this.send({type:"click",button:"left"});this.lastClickAt=now;this.lastAction="Clique esquerdo"}
    if(hand.gesture==="peace"&&now-this.lastRightClickAt>850){this.send({type:"click",button:"right"});this.lastRightClickAt=now;this.lastAction="Clique direito"}

    if(hand.gesture==="fist"){
      if(!this.dragging){this.send({type:"mouse_down",button:"left"});this.dragging=true;this.lastAction="Arrastando"}
    }else if(this.dragging){this.send({type:"mouse_up",button:"left"});this.dragging=false;this.lastAction="Soltou arraste"}

    if(hand.gesture==="open"&&Math.abs(hand.vy)>450&&now-this.lastScrollAt>100){const amount=clamp(Math.round(-hand.vy/180),-8,8);if(amount){this.send({type:"scroll",amount});this.lastScrollAt=now;this.lastAction=`Scroll ${amount>0?"↑":"↓"}`}}
  }

  key(key){if(!this.armed)return false;this.lastAction=`Tecla ${key}`;return this.send({type:"key",key})}

  render(ctx,w,h){
    ctx.save();ctx.fillStyle="rgba(0,0,0,.42)";ctx.fillRect(0,0,w,h);
    const ok=this.connected,armed=this.armed;
    ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font=`900 ${Math.max(28,w*.045)}px system-ui`;ctx.fillText("DESKTOP CONTROL",w/2,h*.17);
    ctx.font=`800 ${Math.max(16,w*.022)}px system-ui`;ctx.fillStyle=ok?"#72ffd5":"#ffcb6b";ctx.fillText(this.statusText,w/2,h*.25);
    ctx.fillStyle=armed?"#72ffd5":"#ff7d9d";ctx.font=`900 ${Math.max(24,w*.035)}px system-ui`;ctx.fillText(armed?"● ARMADO":"○ DESARMADO",w/2,h*.36);
    ctx.fillStyle="#fff";ctx.font=`700 ${Math.max(15,w*.019)}px system-ui`;ctx.fillText(this.lastAction,w/2,h*.44);
    const items=[["☝️","Mover"],["🤏","Clique"],["✌️","Clique direito"],["✊","Arrastar"],["✋","PANIC / scroll"]];
    items.forEach((it,i)=>{const x=w*(.12+i*.19),y=h*.68;ctx.font=`${Math.max(28,w*.04)}px system-ui`;ctx.fillText(it[0],x,y);ctx.font=`700 ${Math.max(11,w*.014)}px system-ui`;ctx.fillText(it[1],x,y+h*.07)});
    ctx.fillStyle="rgba(255,255,255,.7)";ctx.font=`600 ${Math.max(11,w*.014)}px system-ui`;ctx.fillText(this.localMode?"Rodando localmente via companion":"GitHub Pages não controla o sistema. Use o companion local.",w/2,h*.9);
    ctx.restore();
  }

  status(){return`${this.connected?"Conectado":"Offline"} • ${this.armed?"ARMADO":"seguro"}`}
}
