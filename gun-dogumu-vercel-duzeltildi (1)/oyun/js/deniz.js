'use strict';
// Görsel deniz. Oynanışın SEA_Y/isSea/yüzme/kayıt sınırını değiştirmez.
// uc.js buildWorld deniz mesh'ini oluşturduktan sonra denizInit(U3) çağırır.
const DENIZ = { depth:null, world:0, mode:'', builds:0 };
function denizDepthTexture() {
  if(DENIZ.depth)DENIZ.depth.dispose();
  const n=256,data=new Uint8Array(n*n*4);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++) {
    const depth=Math.max(0,-groundH((i+.5)*WORLD/n,(j+.5)*WORLD/n)),k=(j*n+i)*4;
    data[k]=Math.min(255,Math.round(depth/190*255));data[k+1]=data[k+2]=data[k];data[k+3]=255;
  }
  const t=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);t.minFilter=t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;
  DENIZ.depth=t;DENIZ.world=WORLD;return t;
}
function denizHeight(x,z,t,depth,low=false) {
  if(low||depth<=2)return 0;
  const d=Math.max(0,Math.min(1,(depth-2)/58)),q=d*d*(3-2*d);
  return q*(7*Math.sin(x*.008+z*.003+t*.8)+3*Math.sin(-x*.005+z*.011-t*1.1));
}
function denizInit(u) {
  if(!u||!u.sea||typeof THREE==='undefined')return false;
  const low=(typeof REAL!=='undefined'&&REAL.low)||!(u.r&&u.r.capabilities.maxVertexTextures>0);
  const depth=denizDepthTexture(),mesh=u.sea;
  // Var olan tek deniz draw-call'ı kalır. Yakına sık, ufka seyrek örnekleme.
  if(!low) {
    const g=new THREE.PlaneGeometry(1,1,80,80),p=g.attributes.position;
    for(let i=0;i<p.count;i++)for(const axis of [0,1]) {
      const v=p.array[i*3+axis]*2,a=Math.abs(v),r=a<=.65?a/.65*1500:1500+Math.pow((a-.65)/.35,2)*13500;
      p.array[i*3+axis]=Math.sign(v)*r/30000;
    }
    p.needsUpdate=true;g.computeBoundingSphere();mesh.geometry.dispose();mesh.geometry=g;
  }
  // Küresel MAT.sea'yı değiştirme: göller, arazi ve diğer malzemeler etkilenmez.
  const m=new THREE.MeshPhongMaterial({color:0x20596a,specular:0xb6d5dc,shininess:90,transparent:true,opacity:.9,emissive:0x020a10});
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,{denizTime:u.uTime,denizSky:u.seaSky,denizDepth:{value:depth},denizWorld:{value:WORLD}});
    const common=`uniform float denizTime;uniform float denizWorld;uniform sampler2D denizDepth;varying vec3 denizWP;
      float seaDepth(vec2 p){vec2 uv=p/denizWorld;if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return 190.;return texture2D(denizDepth,uv).r*190.;}
      float seaAmp(float d){return smoothstep(2.,60.,d);}
    `;
    sh.vertexShader=common+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 wp=(modelMatrix*vec4(transformed,1.)).xyz;
      ${low?'':'float da=seaAmp(seaDepth(wp.xz));transformed.z+=da*(7.*sin(wp.x*.008+wp.z*.003+denizTime*.8)+3.*sin(-wp.x*.005+wp.z*.011-denizTime*1.1));'}
    `).replace('#include <project_vertex>','#include <project_vertex>\ndenizWP=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader=common+'uniform vec3 denizSky;\n'+sh.fragmentShader
      .replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
        float dd=seaDepth(denizWP.xz),da=seaAmp(dd);vec2 p=denizWP.xz;float t=denizTime;
        float a=p.x*.008+p.y*.003+t*.8,b=-p.x*.005+p.y*.011-t*1.1;
        vec2 slope=da*vec2(.056*cos(a)-.015*cos(b),.021*cos(a)+.033*cos(b));
        slope+=vec2(.045*sin(p.x*.08+p.y*.03+t*1.8),.035*cos(p.y*.095-p.x*.02-t*1.5));
        vec3 wn=normalize(vec3(-slope.x,1.,-slope.y));normal=normalize((viewMatrix*vec4(wn,0.)).xyz);
      `)
      .replace('#include <output_fragment>',`vec3 vd=normalize(cameraPosition-denizWP);float fres=pow(1.-max(0.,dot(vd,wn)),4.);
        outgoingLight=mix(outgoingLight,denizSky,.38*fres);
        float band=(1.-smoothstep(4.,15.,dd))*smoothstep(.6,2.,dd);
        float foam=band*smoothstep(.62,.92,.5+.5*sin(dd*.9-t*1.3+sin(p.x*.055+p.y*.04)));
        outgoingLight=mix(outgoingLight,vec3(.75,.83,.8),foam*.65);
        diffuseColor.a=mix(.62,.98,smoothstep(1.,45.,dd));
        #include <output_fragment>`);
  };
  m.customProgramCacheKey=()=>low?'deniz-low-v1':'deniz-wave-v1';mesh.material=m;
  // Her build kendi materyalini alır; yeni dünyaya geçerken disposeTree bırakır.
  DENIZ.mode=low?'low-flat':'desktop-waves';DENIZ.builds++;return true;
}
