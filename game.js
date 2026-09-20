const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const ui = {
  score: document.querySelector('#score'), mass: document.querySelector('#mass'), massFill: document.querySelector('#massFill'),
  orbCount: document.querySelector('#orbCount'), missionFill: document.querySelector('#missionFill'), board: document.querySelector('#leaderboard'),
  danger: document.querySelector('#danger'), start: document.querySelector('#startScreen'), over: document.querySelector('#gameOver'),
  final: document.querySelector('#finalScore'), joystick: document.querySelector('#joystick'), knob: document.querySelector('#joystickKnob')
};

let W, H, dpr, running = false, last = 0, time = 0, muted = false;
let camera = { x: 0, y: 0 }, input = { x: 0, y: 0 }, pointer = null;
let player, orbs, enemies, particles, score, eaten;
const world = { w: 2600, h: 1800 };
const names = ['NIBBLE', 'GLOOP', 'BYTEBOI', 'MOSS.EXE', 'CRUMB', 'VOIDLING'];
const palettes = [
  ['#ff6f81','#bb314e','#ffd0cf'], ['#f6c552','#c07829','#fff2a4'], ['#a877ef','#6139a4','#e3cfff'],
  ['#55d7ec','#2382aa','#c6fbff'], ['#ef719e','#a52e6b','#ffc3d8'], ['#8cdd62','#3d933c','#ddffb1']
];

function resize(){ dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; canvas.width = W*dpr; canvas.height = H*dpr; canvas.style.width=W+'px'; canvas.style.height=H+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); ctx.imageSmoothingEnabled=false; }
addEventListener('resize', resize); resize();

function rnd(a,b){ return Math.random()*(b-a)+a; }
function makeOrb(){ return { x:rnd(60,world.w-60), y:rnd(60,world.h-60), r:rnd(5,10), color: palettes[Math.floor(rnd(0,palettes.length))][0], pulse:rnd(0,6) }; }
function makeEnemy(i){
  const mass = rnd(14, 58);
  return { x:rnd(150,world.w-150), y:rnd(150,world.h-150), mass, r: 21+mass*.72, vx:rnd(-1,1), vy:rnd(-1,1), speed:rnd(30,52), name:names[i%names.length], colors:palettes[i%palettes.length], mood:i%3, turn:rnd(0,5), seed:i+2 };
}
function reset(){
  player={x:world.w/2,y:world.h/2,mass:24,r:39,colors:['#59f0c7','#159c90','#c0ffe8'],name:'YOU',seed:1}; score=240; eaten=4;
  orbs=Array.from({length:95},makeOrb); enemies=Array.from({length:10},(_,i)=>makeEnemy(i)); particles=[]; camera.x=player.x-W/2; camera.y=player.y-H/2; updateUI();
}
reset();

function pixelBlob(o, isPlayer=false){
  const x=Math.round(o.x-camera.x), y=Math.round(o.y-camera.y), r=Math.round(o.r), step=Math.max(4,Math.round(r/7));
  ctx.save(); ctx.translate(x,y);
  if(isPlayer){ ctx.globalAlpha=.16; ctx.fillStyle='#7affdf'; ctx.fillRect(-r-13,-r-13,(r+13)*2,(r+13)*2); ctx.globalAlpha=1; }
  ctx.fillStyle='#06182055'; ctx.fillRect(-r+5,-r+9,r*2,r*2-step);
  const points=[[-r+step,-r],[-step*2,-r-step],[step*2,-r],[r-step,-r+step],[r+step,-r+step*2],[r,r-step],[r-step,r],[step*2,r+step],[-step*2,r],[-r+step,r-step],[-r-step,r-step*2],[-r,-r+step*2]];
  ctx.beginPath(); points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p)); ctx.closePath(); ctx.fillStyle=o.colors[0]; ctx.fill();
  ctx.fillStyle=o.colors[1]; ctx.fillRect(-r+step,r-step*2,r*2-step*2,step*2); ctx.fillRect(r-step*2,-step,step*2,r-step); ctx.fillRect(-r,-r+step*2,step,step*3);
  ctx.fillStyle=o.colors[2]; ctx.globalAlpha=.75; ctx.fillRect(-r+step*2,-r+step,step*3,step); ctx.fillRect(-r+step,-r+step*2,step,step*2); ctx.globalAlpha=1;
  const eyeY=-Math.round(step*.4), eyeGap=Math.max(7,Math.round(r*.3)); ctx.fillStyle='#06202a'; ctx.fillRect(-eyeGap-step/2,eyeY,step,step*1.5); ctx.fillRect(eyeGap-step/2,eyeY,step,step*1.5);
  ctx.fillStyle='#dffff6'; ctx.fillRect(-eyeGap-step/2+2,eyeY+2,Math.max(2,step/3),Math.max(2,step/3)); ctx.fillRect(eyeGap-step/2+2,eyeY+2,Math.max(2,step/3),Math.max(2,step/3));
  ctx.fillStyle='#071b24'; if(o.mood===1) ctx.fillRect(-step,step*2,step*2,step); else { ctx.fillRect(-step*1.5,step*1.5,step*3,step); ctx.fillRect(-step*.5,step*2.5,step,step); }
  ctx.restore();
  ctx.textAlign='center'; ctx.font='bold 12px Share Tech Mono'; ctx.fillStyle=isPlayer?'#dffff4':'#e1f4f3'; ctx.fillText(o.name,x,y+r+22); if(!isPlayer){ctx.fillStyle='#759da3';ctx.font='11px Share Tech Mono';ctx.fillText(Math.round(o.mass),x,y+r+35)}
}

function drawOrb(o){ const x=Math.round(o.x-camera.x),y=Math.round(o.y-camera.y),s=Math.round(o.r); ctx.fillStyle='#06171d66';ctx.fillRect(x-s+3,y-s+4,s*2,s*2);ctx.fillStyle=o.color;ctx.fillRect(x-s,y-s,s*2,s*2);ctx.globalAlpha=.65;ctx.fillStyle='#eafff8';ctx.fillRect(x-s+2,y-s+2,Math.max(2,s/2),Math.max(2,s/2));ctx.globalAlpha=1; }
function background(){
  ctx.fillStyle='#082935';ctx.fillRect(0,0,W,H); const grid=48; ctx.strokeStyle='#174552';ctx.lineWidth=1;ctx.globalAlpha=.5;ctx.beginPath();
  for(let x=(-camera.x%grid);x<W;x+=grid){ctx.moveTo(x,0);ctx.lineTo(x,H)} for(let y=(-camera.y%grid);y<H;y+=grid){ctx.moveTo(0,y);ctx.lineTo(W,y)} ctx.stroke();ctx.globalAlpha=1;
  for(let i=0;i<30;i++){const x=((i*211-camera.x*.12)%W+W)%W,y=((i*137-camera.y*.12)%H+H)%H;ctx.fillStyle=i%3?'#1a526055':'#5cd2c433';ctx.fillRect(x,y,i%3+2,i%2+2)}
}
function update(dt){
  time+=dt; if(!running)return;
  const len=Math.hypot(input.x,input.y)||1, speed=Math.max(75,170-player.mass*1.1); player.x+=input.x/len*speed*dt;player.y+=input.y/len*speed*dt;player.x=Math.max(player.r,Math.min(world.w-player.r,player.x));player.y=Math.max(player.r,Math.min(world.h-player.r,player.y));
  enemies.forEach((e,i)=>{ e.turn-=dt;if(e.turn<0){const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy);const chase=e.mass>player.mass&&d<430; e.vx=chase?dx/d:rnd(-1,1);e.vy=chase?dy/d:rnd(-1,1);e.turn=rnd(.8,2.4)} e.x+=e.vx*e.speed*dt;e.y+=e.vy*e.speed*dt;if(e.x<e.r||e.x>world.w-e.r)e.vx*=-1;if(e.y<e.r||e.y>world.h-e.r)e.vy*=-1;e.x=Math.max(e.r,Math.min(world.w-e.r,e.x));e.y=Math.max(e.r,Math.min(world.h-e.r,e.y));
    const d=Math.hypot(player.x-e.x,player.y-e.y); if(d<(player.r+e.r)*.68){if(player.mass>e.mass*1.12){score+=Math.round(e.mass*35);player.mass+=e.mass*.28;player.r=24+player.mass*.63;burst(e.x,e.y,e.colors[0]);enemies[i]=makeEnemy(i)}else if(e.mass>player.mass*1.1){endGame()}}
  });
  for(let i=orbs.length-1;i>=0;i--){const o=orbs[i];if(Math.hypot(player.x-o.x,player.y-o.y)<player.r+o.r){score+=60;player.mass+=.65;player.r=24+player.mass*.63;eaten++;burst(o.x,o.y,o.color);orbs.splice(i,1);orbs.push(makeOrb());updateUI()}}
  particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt});particles=particles.filter(p=>p.life>0);
  camera.x+=(player.x-W/2-camera.x)*Math.min(1,dt*5);camera.y+=(player.y-H/2-camera.y)*Math.min(1,dt*5);
  const threat=enemies.some(e=>e.mass>player.mass*1.1&&Math.hypot(player.x-e.x,player.y-e.y)<390);ui.danger.classList.toggle('show',threat);updateUI();
}
function burst(x,y,color){for(let i=0;i<8;i++)particles.push({x,y,vx:rnd(-70,70),vy:rnd(-70,70),life:rnd(.3,.7),color})}
function draw(){ background();orbs.forEach(drawOrb);particles.forEach(p=>{ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x-camera.x,p.y-camera.y,5,5)});ctx.globalAlpha=1;enemies.forEach(e=>pixelBlob(e));pixelBlob(player,true); }
function loop(t){const dt=Math.min(.04,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);

function updateUI(){ui.score.textContent=String(score).padStart(6,'0');ui.mass.textContent=Math.floor(player.mass);ui.massFill.style.width=(player.mass%12)/12*100+'%';const remain=Math.max(0,10-eaten%10);ui.orbCount.textContent=remain;ui.missionFill.style.width=(eaten%10)*10+'%';const rows=enemies.map(e=>({name:e.name,score:Math.round(e.mass*110)})).concat({name:'YOU',score}).sort((a,b)=>b.score-a.score).slice(0,5);ui.board.innerHTML=rows.map(r=>`<li class="${r.name==='YOU'?'me':''}"><span>${r.name}</span><span>${r.score}</span></li>`).join('')}
function start(){reset();running=true;ui.start.classList.add('hidden');ui.over.classList.remove('show')}
function endGame(){running=false;ui.final.textContent=score;ui.over.classList.add('show')}
document.querySelector('#playButton').onclick=start;document.querySelector('#restartButton').onclick=start;document.querySelector('#soundButton').onclick=e=>{muted=!muted;e.currentTarget.textContent=muted?'×':'♪'};

function setInput(clientX,clientY){const rect=ui.joystick.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,dx=clientX-cx,dy=clientY-cy,d=Math.hypot(dx,dy),max=34,s=Math.min(max,d)/(d||1);input.x=dx/(d||1);input.y=dy/(d||1);ui.knob.style.transform=`translate(${dx*s}px,${dy*s}px)`}
addEventListener('pointerdown',e=>{if(!running)return;pointer=e.pointerId;setInput(e.clientX,e.clientY)});addEventListener('pointermove',e=>{if(e.pointerId===pointer)setInput(e.clientX,e.clientY)});addEventListener('pointerup',e=>{if(e.pointerId===pointer){pointer=null;input.x=input.y=0;ui.knob.style.transform=''}});
const keys={};addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;keyInput()});addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;keyInput()});function keyInput(){input.x=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);input.y=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)}
