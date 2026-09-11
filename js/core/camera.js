export class CameraManager{
  constructor(video,{mobile=false}={}){this.video=video;this.mobile=mobile;this.stream=null;this.facing='user'}
  get running(){return!!this.stream}
  async start(){await this.stop();this.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:this.facing},width:{ideal:this.mobile?720:1280},height:{ideal:this.mobile?960:720}},audio:false});this.video.srcObject=this.stream;await this.video.play();return this.stream}
  async stop(){this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null}
  async toggleFacing(){this.facing=this.facing==='user'?'environment':'user';if(this.running)return this.start()}
}
