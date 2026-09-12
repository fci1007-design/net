(() => {
'use strict';
const canvas=document.getElementById('cubeCanvas');
const ctx=canvas.getContext('2d');
const stage=document.getElementById('stage');
const moveCountEl=document.getElementById('moveCount');
const stateTextEl=document.getElementById('stateText');
const speedRange=document.getElementById('speedRange');
const gapRange=document.getElementById('gapRange');
const autoSpinEl=document.getElementById('autoSpin');
const axisGuideEl=document.getElementById('axisGuide');
const childModeEl=document.getElementById('childMode');
const completionEl=document.getElementById('completion');
const completionTextEl=document.getElementById('completionText');
const confettiEl=document.getElementById('confetti');
const continueBtn=document.getElementById('continueBtn');

let W=1,H=1,DPR=1;
let yaw=-0.72,pitch=-0.48,distance=8.3;
let dragging=false,pointerId=null,lastX=0,lastY=0;
let spacing=1.06,cubies=[],queue=[],history=[],activeTurn=null,moveCount=0;
const SIZE=.91,HALF=SIZE/2,PI=Math.PI;

const faceThemes={
  px:{name:'紫羅蘭',colors:['#7C3AED','#C4B5FD','#4C1D95']},
  nx:{name:'靛紫',colors:['#4338CA','#A5B4FC','#1E1B4B']},
  py:{name:'薰衣草',colors:['#C4B5FD','#F5F3FF','#7C3AED']},
  ny:{name:'深梅紫',colors:['#701A75','#D8B4FE','#3B0764']},
  pz:{name:'桃紅紫',colors:['#C026D3','#F5D0FE','#86198F']},
  nz:{name:'莓紫',colors:['#BE185D','#F9A8D4','#831843']}
};
const faces=[
 {k:'px',n:[1,0,0],v:[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]]},
 {k:'nx',n:[-1,0,0],v:[[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]]},
 {k:'py',n:[0,1,0],v:[[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]]},
 {k:'ny',n:[0,-1,0],v:[[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]]},
 {k:'pz',n:[0,0,1],v:[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]},
 {k:'nz',n:[0,0,-1],v:[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]}
];

function setChildMode(on){
 document.body.classList.toggle('child-mode',on);
 try{localStorage.setItem('purpleCubeChildMode',on?'1':'0')}catch(e){}
}
try{childModeEl.checked=localStorage.getItem('purpleCubeChildMode')==='1'}catch(e){}
setChildMode(childModeEl.checked);
childModeEl.addEventListener('change',()=>setChildMode(childModeEl.checked));

function buildConfetti(){
 confettiEl.innerHTML='';
 for(let i=0;i<42;i++){
  const el=document.createElement('i');
  el.style.left=(Math.random()*100)+'%';
  el.style.setProperty('--d',(1.8+Math.random()*1.7)+'s');
  el.style.setProperty('--delay',(Math.random()*.35)+'s');
  el.style.setProperty('--x',((Math.random()-.5)*180)+'px');
  el.style.setProperty('--r',(Math.random()*180)+'deg');
  confettiEl.appendChild(el);
 }
}
function celebrate(){
 completionTextEl.textContent=`你用了 ${moveCount} 步把魔方復原，做得很好！`;
 buildConfetti();
 completionEl.classList.add('show');
 completionEl.setAttribute('aria-hidden','false');
}
function hideCelebration(){
 completionEl.classList.remove('show');
 completionEl.setAttribute('aria-hidden','true');
}
continueBtn.addEventListener('click',()=>{hideCelebration();document.getElementById('shuffleBtn').click()});
completionEl.addEventListener('click',e=>{if(e.target===completionEl)hideCelebration()});

const I=()=>[1,0,0,0,1,0,0,0,1];
const mul=(A,B)=>[
 A[0]*B[0]+A[1]*B[3]+A[2]*B[6],A[0]*B[1]+A[1]*B[4]+A[2]*B[7],A[0]*B[2]+A[1]*B[5]+A[2]*B[8],
 A[3]*B[0]+A[4]*B[3]+A[5]*B[6],A[3]*B[1]+A[4]*B[4]+A[5]*B[7],A[3]*B[2]+A[4]*B[5]+A[5]*B[8],
 A[6]*B[0]+A[7]*B[3]+A[8]*B[6],A[6]*B[1]+A[7]*B[4]+A[8]*B[7],A[6]*B[2]+A[7]*B[5]+A[8]*B[8]
];
const mv=(M,v)=>[M[0]*v[0]+M[1]*v[1]+M[2]*v[2],M[3]*v[0]+M[4]*v[1]+M[5]*v[2],M[6]*v[0]+M[7]*v[1]+M[8]*v[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scale=(v,s)=>[v[0]*s,v[1]*s,v[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function rot(axis,a){const c=Math.cos(a),s=Math.sin(a);return axis==='x'?[1,0,0,0,c,-s,0,s,c]:axis==='y'?[c,0,s,0,1,0,-s,0,c]:[c,-s,0,s,c,0,0,0,1]}
function roundMat(M){return M.map(v=>Math.abs(v)<1e-6?0:Math.round(v));}
function cameraMat(){return mul(rot('x',pitch),rot('y',yaw));}
function project(v,CM){const q=mv(CM,v),dep=distance-q[2],f=Math.min(W,H)*1.08;return{x:W/2+q[0]*f/dep,y:H/2-q[1]*f/dep,dep};}
function resize(){const r=stage.getBoundingClientRect();DPR=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,r.width);H=Math.max(1,r.height);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0)}
addEventListener('resize',resize);new ResizeObserver(resize).observe(stage);resize();

function buildCube(){
 hideCelebration();
 cubies=[];queue=[];history=[];activeTurn=null;moveCount=0;
 for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
  const stickers={};
  if(x===1)stickers.px=1;
  if(x===-1)stickers.nx=1;
  if(y===1)stickers.py=1;
  if(y===-1)stickers.ny=1;
  if(z===1)stickers.pz=1;
  if(z===-1)stickers.nz=1;
  cubies.push({coord:[x,y,z],R:I(),stickers});
 }
 updateStatus();
}
function isSolved(){
 for(const c of cubies){
  for(const k of Object.keys(c.stickers)){
   const f=faces.find(face=>face.k===k);
   const n=mv(c.R,f.n);
   if(Math.round(n[0])!==f.n[0]||Math.round(n[1])!==f.n[1]||Math.round(n[2])!==f.n[2]) return false;
   if(k==='px'&&c.coord[0]!==1)return false;if(k==='nx'&&c.coord[0]!==-1)return false;
   if(k==='py'&&c.coord[1]!==1)return false;if(k==='ny'&&c.coord[1]!==-1)return false;
   if(k==='pz'&&c.coord[2]!==1)return false;if(k==='nz'&&c.coord[2]!==-1)return false;
  }
 }
 return true;
}
function updateStatus(){moveCountEl.textContent=moveCount;stateTextEl.textContent=isSolved()?'已復原':'已操作'}
buildCube();

function cubieTransform(c,now){
 let pos=scale(c.coord,spacing),R=c.R;
 if(activeTurn&&activeTurn.set.has(c)){
  const t=Math.min(1,(now-activeTurn.start)/activeTurn.duration),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,A=rot(activeTurn.axis,activeTurn.dir*PI/2*e);
  pos=mv(A,pos);R=mul(A,R);
 }
 return{pos,R};
}
function world(local,T){return add(T.pos,mv(T.R,local));}
function insetVerts(face,T){
 const s=.80,off=.012;
 return face.v.map(v=>world(add(scale(v,HALF*s),scale(face.n,off)),T));
}
function drawAxes(CM){
 if(!axisGuideEl.checked)return;
 ctx.save();ctx.setLineDash([5,7]);ctx.lineWidth=1;
 [['x',[2.2,0,0]],['y',[0,2.2,0]],['z',[0,0,2.2]]].forEach(([,b],i)=>{const A=project([0,0,0],CM),B=project(b,CM);ctx.strokeStyle=['#bb6cff22','#e0baff22','#8b5cf622'][i];ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke()});
 ctx.restore();
}
function bodyGradient(pts){const g=ctx.createLinearGradient(pts[0].x,pts[0].y,pts[2].x,pts[2].y);g.addColorStop(0,'#241334');g.addColorStop(1,'#0d0714');return g}
function stickerGradient(pts,cs){const g=ctx.createLinearGradient(pts[0].x,pts[0].y,pts[2].x,pts[2].y);g.addColorStop(0,cs[1]);g.addColorStop(.55,cs[0]);g.addColorStop(1,cs[2]);return g}
function render(now){
 requestAnimationFrame(render);
 if(autoSpinEl.checked&&!dragging&&!activeTurn)yaw+=.0012;
 if(!activeTurn&&queue.length)startTurn(queue.shift());
 if(activeTurn&&now-activeTurn.start>=activeTurn.duration)finishTurn();
 ctx.clearRect(0,0,W,H);
 const CM=cameraMat();drawAxes(CM);const polys=[];
 for(const c of cubies){const T=cubieTransform(c,now);for(const f of faces){
  const nW=mv(T.R,f.n),center=world(scale(f.n,HALF),T),nV=mv(CM,nW),cV=mv(CM,center),toCam=[-cV[0],-cV[1],distance-cV[2]];
  if(dot(nV,toCam)<=0)continue;
  const body=f.v.map(v=>project(world(scale(v,HALF),T),CM));
  polys.push({kind:'body',pts:body,depth:body.reduce((s,p)=>s+p.dep,0)/4});
  if(c.stickers[f.k]){
    const st=insetVerts(f,T).map(v=>project(v,CM));
    polys.push({kind:'sticker',pts:st,depth:st.reduce((s,p)=>s+p.dep,0)/4-.001,theme:faceThemes[f.k]});
  }
 }}
 polys.sort((a,b)=>b.depth-a.depth);
 for(const p of polys){
  const a=p.pts;
  ctx.beginPath();ctx.moveTo(a[0].x,a[0].y);for(let i=1;i<a.length;i++)ctx.lineTo(a[i].x,a[i].y);ctx.closePath();
  if(p.kind==='body'){
    ctx.fillStyle=bodyGradient(a);ctx.fill();ctx.strokeStyle='rgba(206,153,245,.20)';ctx.lineWidth=1;ctx.stroke();
  }else{
    ctx.fillStyle=stickerGradient(a,p.theme.colors);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.52)';ctx.lineWidth=1.25;ctx.stroke();
  }
 }
 ctx.save();ctx.globalCompositeOperation='destination-over';const sh=ctx.createRadialGradient(W*.5,H*.74,1,W*.5,H*.74,Math.min(W,H)*.28);sh.addColorStop(0,'rgba(0,0,0,.38)');sh.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=sh;ctx.beginPath();ctx.ellipse(W*.5,H*.76,Math.min(W,H)*.25,Math.min(W,H)*.08,0,0,PI*2);ctx.fill();ctx.restore();
}
requestAnimationFrame(render);

const defs={U:['y',1,-1],D:['y',-1,1],L:['x',-1,1],R:['x',1,-1],F:['z',1,-1],B:['z',-1,1]};
function doMove(n,record=true){const prime=n.includes("'")||n.includes('′'),k=n[0].toUpperCase();if(!defs[k])return;const[a,l,d]=defs[k];queue.push({axis:a,layer:l,dir:prime?-d:d,label:n,record})}
function startTurn(m){const idx=m.axis==='x'?0:m.axis==='y'?1:2,set=new Set(cubies.filter(c=>c.coord[idx]===m.layer));activeTurn={...m,set,start:performance.now(),duration:Number(speedRange.value)}}
function finishTurn(){const a=activeTurn;if(!a)return;const A=rot(a.axis,a.dir*PI/2);a.set.forEach(c=>{c.coord=mv(A,c.coord).map(v=>Math.round(v));c.R=roundMat(mul(A,c.R))});if(a.record!==false){history.push({axis:a.axis,layer:a.layer,dir:a.dir});moveCount++}activeTurn=null;updateStatus();if(a.record!==false&&moveCount>0&&isSolved())celebrate()}

document.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>doMove(b.dataset.move)));
document.getElementById('shuffleBtn').addEventListener('click',()=>{hideCelebration();const ks=Object.keys(defs);let prev='';for(let i=0;i<20;i++){let k;do{k=ks[Math.floor(Math.random()*ks.length)]}while(k===prev);prev=k;doMove(k+(Math.random()<.5?"'":''))}});
document.getElementById('resetBtn').addEventListener('click',buildCube);
document.getElementById('undoBtn').addEventListener('click',()=>{if(activeTurn||queue.length||!history.length)return;const m=history.pop();moveCount=Math.max(0,moveCount-1);queue.push({axis:m.axis,layer:m.layer,dir:-m.dir,label:'undo',record:false});updateStatus()});
document.getElementById('cameraBtn').addEventListener('click',()=>{yaw=-.72;pitch=-.48;distance=8.3});
gapRange.addEventListener('input',()=>spacing=Number(gapRange.value)/100);

canvas.addEventListener('pointerdown',e=>{dragging=true;pointerId=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.classList.add('dragging');canvas.setPointerCapture(pointerId)});
canvas.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==pointerId)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;yaw+=dx*.008;pitch=Math.max(-1.3,Math.min(1.3,pitch+dy*.008));lastX=e.clientX;lastY=e.clientY});
canvas.addEventListener('pointerup',e=>{if(e.pointerId===pointerId){dragging=false;pointerId=null;canvas.classList.remove('dragging')}});
canvas.addEventListener('pointercancel',()=>{dragging=false;pointerId=null;canvas.classList.remove('dragging')});
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(5.7,Math.min(13,distance+Math.sign(e.deltaY)*.42))},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{if(e.repeat)return;const k=e.key.toUpperCase();if(defs[k]){doMove(k+(e.shiftKey?"'":''));e.preventDefault()}else if(k==='S')document.getElementById('shuffleBtn').click();else if(k==='Z')document.getElementById('undoBtn').click();else if(e.key==='0')buildCube()});
})();
