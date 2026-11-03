import * as THREE from 'three';

// Coordinates follow the drawing: right and down are positive.
const step = 0.82;
export const sizeFactor = step;
const clearance = 1.1 - 2 * step ** 4; // Original level's size-5 opening.
const gap = n => 2 * step ** (n-1) + clearance;
const green = new THREE.MeshStandardMaterial({color: '#39ae86'});
export function buildLevel(number, scene, material) {
  const objects = [], solids = [], rotors = [], gates = [];
  let plate, spawn = [0,0], extent = [5,5], switched = false, wasOn = false;
  function add(geometry, mat) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh); objects.push(mesh); return mesh;
  }
  function addWall(width, depth, x, y, mat = material) {
    const mesh = add(new THREE.BoxGeometry(width,2,depth), mat);
    mesh.position.set(-x,0,-y);
    const a=width/2,b=depth/2;
    const solid={mesh,x,y,angle:0,points:[[-a,-b],[a,-b],[a,b],[-a,b]]};
    solids.push(solid); return solid;
  }
  function line(horizontal, fixed, start, end, mat) {
    const middle=(start+end)/2;
    return horizontal ? addWall(end-start,.2,middle,fixed,mat) : addWall(.2,end-start,fixed,middle,mat);
  }
  function split(horizontal,fixed,start,end,center,n,gate) {
    const half=gap(n)/2;
    line(horizontal,fixed,start,center-half);
    line(horizontal,fixed,center+half,end);
    if(gate) gates.push({solid:line(horizontal,fixed,center-half,center+half,green),openInitially:gate==='open'});
  }
  function frame(a,b,side,c,n,gate) {
    extent=[a,b];
    for(const [h,f,s,e,key] of [[true,-b,-a-.1,a+.1,'top'],[true,b,-a-.1,a+.1,'bottom'],[false,-a,-b,b,'left'],[false,a,-b,b,'right']]) {
      if(key===side) split(h,f,s,e,c,n,gate); else line(h,f,s,e);
    }
  }
  function block(points) {
    const shape=new THREE.Shape();
    points.forEach(([x,y],i)=>i ? shape.lineTo(-x,y) : shape.moveTo(-x,y));
    shape.closePath();
    const mesh=add(new THREE.ExtrudeGeometry(shape,{depth:2,bevelEnabled:false}),material);
    mesh.rotation.x=-Math.PI/2; mesh.position.y=-1;
    solids.push({mesh,x:0,y:0,angle:0,points});
  }
  function pressure(x,y) {
    plate=add(new THREE.CylinderGeometry(1,1.08,.14,48),green);
    plate.position.set(-x,-.91,-y);
  }
  function syncGates() {
    for(const {solid,openInitially} of gates) solid.mesh.visible = switched === openInitially;
    if(plate) plate.position.y=switched ? -.98 : -.91;
  }
  if(number===1) frame(5,5,'top',0,5);
  if(number===2) {
    frame(6,7,'left',3.5,5); spawn=[3,3.5];
    split(true,0,0,6,3,2); split(false,0,-7,0,-3.6,3);
    split(true,0,-6,0,-3,4); line(false,0,0,7);
  }
  if(number===3) {
    frame(6,6,'top',.9,5); spawn=[2.2,4.45];
    const left=[], right=[];
    // Sample the sloped passage across its normal, so its usable width
    // tapers even where the screen-space slope changes.
    const bendY=-.35, bendX=-1.95;
    for(let i=0;i<=32;i++) {
      const t=i/32; // exit to bend
      const y=-6+(bendY+6)*t;
      const x=.9+(bendX-.9)*t*t*(3-2*t);
      const slope=(bendX-.9)*6*t*(1-t)/(bendY+6);
      const half=(gap(5)+(gap(3)-gap(5))*t)*Math.sqrt(1+slope*slope)/2;
      left.push([x-half,y]); right.push([x+half,y]);
    }
    // Continue from the bend with a vertical tangent into the wide starting bay.
    for(let i=1;i<=32;i++) {
      const t=i/32, y=bendY+(6-bendY)*t;
      const x=bendX+(2.725-bendX)*t*t*(3-2*t);
      const slope=(2.725-bendX)*6*t*(1-t)/(6-bendY);
      const half=(gap(3)+(5.75-gap(3))*t*t)*Math.sqrt(1+slope*slope)/2;
      left.push([x-half,y]); right.push([x+half,y]);
    }
    block([[-6,-6],...left,[-6,6]]);
    block([[6,-6],...right,[6,6]]);
  }
  if(number===4) {
    // Only the starting chamber extends beyond the square rotor footprint.
    frame(4.5,15.75,'top',0,5); spawn=[0,14.15];
    split(true,2.25,-4.5,4.5,0,1); split(true,-6.75,-4.5,4.5,0,3);
    for(const [y,angle,speed] of [[6.75,1.05,.66],[-2.25,.18,-.73],[-11.25,-.85,.79]]) {
      const s=addWall(8.52,.22,0,y); s.angle=angle; s.mesh.rotation.y=-angle;
      s.speed=speed; rotors.push(s);
    }
  }
  if(number===5) {
    frame(5,6.5,'top',1.8,2,'closed'); spawn=[2,3.35];
    split(true,0,-5,5,1.8,4); pressure(-2.45,3.35);
  }
  if(number===6) {
    frame(6,7,'top',3.1,5,'closed'); spawn=[3.2,3.5];
    split(true,0,-6,0,-3,1,'open'); split(true,0,0,6,3,1);
    split(false,0,0,7,3.7,4); pressure(-3,3.5);
  }
  syncGates();
  return {spawn,extent,
    advance(dt) {
      for(const s of rotors) {s.angle+=s.speed*dt; s.mesh.rotation.y=-s.angle;}
    },
    press(ball,hits) {
      if(!plate) return '';
      const on=Math.hypot(ball.position.x-plate.position.x,ball.position.z-plate.position.z)<.95;
      if(on && !wasOn && hits===0) {switched=number===5 || !switched; syncGates();}
      wasOn=on;
      return on && hits>0 ? 'Too light' : '';
    },
    collide(ball,velocity) {
      let hit=false;
      for(const s of solids) {
        if(!s.mesh.visible) continue;
        const c=Math.cos(s.angle),d=Math.sin(s.angle);
        const dx=-ball.position.x-s.x,dy=-ball.position.z-s.y;
        const x=c*dx+d*dy,y=-d*dx+c*dy;
        let best=Infinity,bx=0,by=0,inside=false;
        for(let i=0,j=s.points.length-1;i<s.points.length;j=i++) {
          const [a,b]=s.points[j],[e,f]=s.points[i],u=e-a,v=f-b;
          if((b>y)!==(f>y) && x<a+(y-b)*u/v) inside=!inside;
          const k=Math.max(0,Math.min(1,((x-a)*u+(y-b)*v)/(u*u+v*v)));
          const px=x-a-k*u,py=y-b-k*v,dist=px*px+py*py;
          if(dist<best){best=dist;bx=px;by=py;}
        }
        const dist=Math.sqrt(best),radius=ball.scale.x;
        if(!inside && dist>=radius) continue;
        const scale=(inside?-1:1)/Math.max(dist,1e-10);
        const nx=-(c*bx-d*by)*scale,nz=-(d*bx+c*by)*scale;
        const push=radius+(inside?dist:-dist)+.0001;
        ball.position.x+=nx*push;ball.position.z+=nz*push;
        const rel=(velocity.x-(s.speed||0)*dy)*nx+(velocity.y+(s.speed||0)*dx)*nz;
        if(rel<0){velocity.x-=1.35*rel*nx;velocity.y-=1.35*rel*nz;}
        hit=true;
      }
      return hit;
    },
    escaped(ball) {
      const margin=ball.scale.x+.1;
      return number===2 ? ball.position.x>extent[0]+margin : ball.position.z>extent[1]+margin;
    },
    dispose(){for(const obj of objects){scene.remove(obj);obj.geometry.dispose();}}
  };
}
