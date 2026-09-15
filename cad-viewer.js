import * as THREE from 'three';
import { GLTFLoader } from './assets/three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from './assets/three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from './assets/three/addons/environments/RoomEnvironment.js';

const names = {'motor-2':'Motor','motor-3':'Motor','motor-4':'Motor','servo_motor-1':'Servo Motor','arduino_uno-1':'Arduino UNO Board','breadboard-1':'Breadboard'};
let modelPromise;
const loadModel = () => modelPromise ||= new GLTFLoader().loadAsync(new URL('./assets/Eg1311_robot_cad.glb', import.meta.url).href).catch(e=>{modelPromise=null;throw e;});

export function mount(host) {
  host.innerHTML = `<div class="cad-top"><span>INTERACTIVE CAD</span><button class="cad-reset" type="button">RESET VIEW ↺</button></div><div class="cad-stage" data-lenis-prevent><div class="cad-loading" role="status">Loading robot model…</div><span class="cad-label" aria-hidden="true"></span><aside class="cad-detail" aria-live="polite" hidden><div><span class="cad-meta">COMPONENT</span><button class="cad-deselect" type="button" aria-label="Close component information">×</button></div><h4></h4><div class="cad-description"></div></aside></div><div class="cad-bottom"><p>Drag to rotate · Pinch to zoom · Select a component</p><button type="button" class="cad-spin" aria-pressed="false">PAUSE ROTATION</button></div><div class="cad-components" aria-label="Robot components"><button data-part="motor-2">Motor</button><button data-part="servo_motor-1">Servo Motor</button><button data-part="arduino_uno-1">Arduino UNO Board</button><button data-part="breadboard-1">Breadboard</button></div>`;
  const stage=host.querySelector('.cad-stage'), label=host.querySelector('.cad-label'), detail=host.querySelector('.cad-detail');
  const loading=host.querySelector('.cad-loading'), spinButton=host.querySelector('.cad-spin');
  let renderer,disposed=false,scene,camera,controls,model,frame=0,visible=false,dragging=false,hover=null,selected=null,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,resumeAt=0,lastTime=0,down=null,moved=false,multiTouch=false;
  const pointers=new Set(),meshes=[],components=new Map(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),hoverAnchor=new THREE.Vector3(),projected=new THREE.Vector3();
  const abort=new AbortController(),events={signal:abort.signal},highlights=[];
  let homePosition,homeTarget,modelSize=1,framingDistance=0,environmentTarget,observer,resizeObserver;
  const listen=(el,type,handler)=>el.addEventListener(type,handler,events);
  const delay=()=>{resumeAt=performance.now()+2200;};
  function spinState(){spinButton.textContent=paused?'RESUME ROTATION':'PAUSE ROTATION';spinButton.setAttribute('aria-pressed',String(paused));}
  spinState();
  function deselect(){selected=null;host.dataset.selected='';detail.hidden=true;host.querySelectorAll('[data-part]').forEach(b=>b.setAttribute('aria-pressed','false'));delay();}
  function select(component){selected=component;hover=null;label.classList.remove('is-visible');host.dataset.selected=component.name;detail.querySelector('h4').textContent=names[component.name];detail.hidden=false;host.querySelectorAll('[data-part]').forEach(b=>b.setAttribute('aria-pressed',String(names[b.dataset.part]===names[component.name])));delay();}
  function hit(event){if(!model)return null;const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const first=raycaster.intersectObjects(meshes,false)[0];return first?.object.userData.cadComponent?{component:first.object.userData.cadComponent,point:first.point}:null;}
  function clearHover(){pendingMove=null;hover=null;host.dataset.hovered='';label.classList.remove('is-visible');if(renderer)renderer.domElement.style.cursor=dragging?'grabbing':'grab';delay();}
  let pendingMove=null;
  function updateHover(event){const target=hit(event);hover=target?.component||null;host.dataset.hovered=hover?.name||'';if(hover){hoverAnchor.copy(target.point);hover.worldToLocal(hoverAnchor);label.textContent=names[hover.name];label.classList.add('is-visible');renderer.domElement.style.cursor='pointer';}else{label.classList.remove('is-visible');renderer.domElement.style.cursor='grab';delay();}}
  function resize(){if(!renderer||!camera)return;const {width,height}=stage.getBoundingClientRect();if(!width||!height)return;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);if(model&&homeTarget){const halfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.min(1,camera.aspect));const nextDistance=modelSize/(2*Math.sin(halfFov))*.88;if(framingDistance)camera.position.sub(controls.target).multiplyScalar(nextDistance/framingDistance).add(controls.target);framingDistance=nextDistance;homePosition.copy(homeTarget).add(new THREE.Vector3(1,.35,1).normalize().multiplyScalar(nextDistance));controls.maxDistance=nextDistance*2.3;}}
  function reset(){if(!controls||!homePosition)return;deselect();clearHover();camera.position.copy(homePosition);controls.target.copy(homeTarget);controls.update();delay();}
  listen(host.querySelector('.cad-deselect'),'click',()=>{deselect();renderer?.domElement.focus({preventScroll:true});});
  listen(host.querySelector('.cad-reset'),'click',reset);
  listen(spinButton,'click',()=>{paused=!paused;spinState();delay();});
  host.querySelectorAll('[data-part]').forEach(b=>{b.disabled=true;listen(b,'click',()=>{const component=components.get(b.dataset.part);if(component)select(component);});});
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer: coarse)').matches?1.25:1.5));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=.85;
    renderer.domElement.setAttribute('aria-label','Arduino robot 3D model. Drag to rotate. Use arrow keys to orbit, plus and minus to zoom.');
    renderer.domElement.tabIndex=0;stage.prepend(renderer.domElement);
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,.001,100);
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
    environmentTarget=pmrem.fromScene(room,.04);scene.environment=environmentTarget.texture;scene.environmentIntensity=.45;room.dispose();pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff,0xd8d2c8,.65));
    const key=new THREE.DirectionalLight(0xffffff,1.3);key.position.set(3,5,4);scene.add(key);
    const fill=new THREE.DirectionalLight(0xffffff,.5);fill.position.set(-3,2,-3);scene.add(fill);
    controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.075;controls.rotateSpeed=.65;controls.zoomSpeed=.7;controls.autoRotateSpeed=.18;controls.minPolarAngle=Math.PI*.18;controls.maxPolarAngle=Math.PI*.62;
    controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
    controls.addEventListener('start',()=>{dragging=true;clearHover();});controls.addEventListener('end',()=>{dragging=false;delay();});
    listen(renderer.domElement,'pointerdown',e=>{pointers.add(e.pointerId);if(pointers.size>1)multiTouch=true;else{down={x:e.clientX,y:e.clientY,id:e.pointerId};moved=false;multiTouch=false;}delay();});
    listen(renderer.domElement,'pointermove',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)moved=true;if(!pointers.size&&e.pointerType!=='touch')pendingMove=e;});
    listen(renderer.domElement,'pointerup',e=>{pointers.delete(e.pointerId);if(down?.id===e.pointerId&&!moved&&!multiTouch){const target=hit(e);target?select(target.component):deselect();}if(!pointers.size){down=null;dragging=false;delay();}});
    listen(renderer.domElement,'pointercancel',()=>{pointers.clear();down=null;dragging=false;clearHover();});
    listen(renderer.domElement,'pointerleave',clearHover);
    listen(renderer.domElement,'keydown',e=>{if(e.key==='Escape'&&(selected||hover)){e.preventDefault();e.stopPropagation();deselect();clearHover();return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key)){e.preventDefault();clearHover();const offset=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(offset);if(e.key==='ArrowLeft')spherical.theta-=.12;if(e.key==='ArrowRight')spherical.theta+=.12;if(e.key==='ArrowUp')spherical.phi=Math.max(controls.minPolarAngle,spherical.phi-.1);if(e.key==='ArrowDown')spherical.phi=Math.min(controls.maxPolarAngle,spherical.phi+.1);if(e.key==='+'||e.key==='=')spherical.radius=Math.max(controls.minDistance,spherical.radius*.9);if(e.key==='-')spherical.radius=Math.min(controls.maxDistance,spherical.radius*1.1);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();delay();}});
    resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);
    observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;},{threshold:.05});observer.observe(stage);
    loadModel().then(gltf=>{
      if(disposed)return;
      // Clone the scene hierarchy only: original geometry, materials and local transforms remain intact.
      model=gltf.scene.clone(true);scene.add(model);model.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());modelSize=size.length();
      homeTarget=center.clone();const distance=modelSize/(2*Math.sin(THREE.MathUtils.degToRad(camera.fov/2)))*.88;
      framingDistance=distance;homePosition=center.clone().add(new THREE.Vector3(1,.35,1).normalize().multiplyScalar(distance));camera.position.copy(homePosition);camera.near=modelSize/1000;camera.far=modelSize*100;camera.updateProjectionMatrix();controls.target.copy(center);controls.minDistance=modelSize*.65;controls.maxDistance=distance*2.3;
      for(const name of Object.keys(names)){const component=model.getObjectByName(name);if(!component)throw new Error('Missing named component: '+name);components.set(name,component);}
      model.traverse(object=>{if(!object.isMesh)return;meshes.push(object);let parent=object;while(parent&&!names[parent.name])parent=parent.parent;if(parent)object.userData.cadComponent=parent;});
      // Separate translucent overlays highlight only the exact named component; source materials are untouched.
      meshes.forEach(mesh=>{if(!mesh.userData.cadComponent)return;const material=new THREE.MeshBasicMaterial({color:0x72dbdf,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,toneMapped:false});const overlay=new THREE.Mesh(mesh.geometry,material);overlay.renderOrder=2;overlay.raycast=()=>{};mesh.add(overlay);highlights.push({component:mesh.userData.cadComponent,overlay,material});});
      host.querySelectorAll('[data-part]').forEach(b=>b.disabled=false);host.dataset.ready='true';host.dataset.componentNames=Array.from(components.keys()).join(',');loading.remove();resize();controls.update();
    }).catch(error=>{if(!disposed){loading.textContent='The 3D model could not load. Please reopen this project to try again.';console.error('CAD viewer:',error);}});
    function tick(time){if(disposed)return;frame=requestAnimationFrame(tick);const delta=Math.min((time-lastTime)/1000,.05)||0;lastTime=time;if(!visible||document.hidden||!model)return;
      if(pendingMove&&!dragging){updateHover(pendingMove);pendingMove=null;}
      controls.autoRotate=!paused&&!dragging&&!pointers.size&&!hover&&!selected&&time>resumeAt;controls.update(delta);host.dataset.rotating=String(controls.autoRotate);
      for(const h of highlights){const target=(h.component===selected||h.component===hover)?.22:0;h.material.opacity=THREE.MathUtils.damp(h.material.opacity,target,14,delta);h.overlay.visible=h.material.opacity>.002;}
      if(hover){projected.copy(hoverAnchor);hover.localToWorld(projected);projected.project(camera);const x=(projected.x*.5+.5)*stage.clientWidth,y=(-projected.y*.5+.5)*stage.clientHeight;label.style.left=Math.max(12,Math.min(stage.clientWidth-label.offsetWidth-12,x+15))+'px';label.style.top=Math.max(12,Math.min(stage.clientHeight-40,y-38))+'px';}
      renderer.render(scene,camera);
    }
    frame=requestAnimationFrame(tick);
  } catch(error){loading.textContent='Interactive 3D is unavailable in this browser.';console.error('CAD viewer:',error);}
  return ()=>{disposed=true;cancelAnimationFrame(frame);abort.abort();observer?.disconnect();resizeObserver?.disconnect();controls?.dispose();highlights.forEach(h=>{h.overlay.removeFromParent();h.material.dispose();});environmentTarget?.dispose();renderer?.dispose();renderer?.forceContextLoss();};
}
