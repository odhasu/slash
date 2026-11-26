(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,85594,e=>{"use strict";var t=e.i(76091);let r=`
attribute vec2 aPos;
varying vec2 vBoard;
void main() {
  // Board px, y down.
  vBoard = vec2((aPos.x + 1.0) * 0.5 * 1920.0, (1.0 - aPos.y) * 0.5 * 2800.0);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`,i=`
precision highp float;
varying vec2 vBoard;
uniform sampler2D uOuter, uInner, uTint;
uniform float uSpinO, uSpinI, uHueO, uHueI, uTime;
uniform vec4 uTrail[32];
uniform float uWeight[32];

const vec4 OUTER = vec4(-925.8, -604.07, 4084.089, 0.0);
const vec2 OUTER_PIVOT = vec2(${1384.57}, ${1930.12});
const vec4 INNER = vec4(-785.44, -214.07, 3490.879, 0.0);
const vec2 INNER_PIVOT = vec2(${-785.44+1965.37}, ${-214.07+2148.65});
const vec3 BASE = vec3(${[1,239/255,202/255].map(e=>e.toFixed(4)).join(", ")});
const vec3 TINT = vec3(${[71/255,94/255,100/255].map(e=>e.toFixed(4)).join(", ")});
const float R = 120.0;

// CSS hue-rotate(), as the filter spec defines it.
vec3 hueRotate(vec3 c, float a) {
  float co = cos(a), si = sin(a);
  mat3 m = mat3(
    0.213 + co * 0.787 - si * 0.213, 0.213 - co * 0.213 + si * 0.143, 0.213 - co * 0.213 - si * 0.787,
    0.715 - co * 0.715 - si * 0.715, 0.715 + co * 0.285 + si * 0.140, 0.715 - co * 0.715 + si * 0.715,
    0.072 - co * 0.072 + si * 0.928, 0.072 - co * 0.072 - si * 0.283, 0.072 + co * 0.928 + si * 0.072);
  return clamp(m * c, 0.0, 1.0);
}

// Compositing blend modes (non-separable "hue" included), per the spec.
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipColor(vec3 c) {
  float l = lum(c), n = min(min(c.r, c.g), c.b), x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = l + (c - l) * l / (l - n);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / (x - l);
  return c;
}
vec3 setLum(vec3 c, float l) { return clipColor(c + (l - lum(c))); }
float sat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
vec3 setSat(vec3 c, float s) {
  float mx = max(max(c.r, c.g), c.b), mn = min(min(c.r, c.g), c.b);
  return mx > mn ? (c - mn) * s / (mx - mn) : vec3(0.0);
}
vec3 blendHue(vec3 b, vec3 s) { return setLum(setSat(s, sat(b)), lum(b)); }
vec3 softLight(vec3 b, vec3 s) {
  vec3 d = mix(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, step(b, vec3(0.25)));
  return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(0.5, s));
}

// Smooth value noise, for the brush's ragged, drifting edge.
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

// A ribbon: the board point, turned back by the ribbon's spin about its pivot, in its layer's texture.
vec4 ribbon(sampler2D t, vec2 p, vec4 box, vec2 pivot, float spin) {
  vec2 q = rot(p - pivot, -spin) + pivot;
  vec2 uv = (q - box.xy) / box.z;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(t, uv);
}

void main() {
  // Liquid: each trail sample drags the picture along its velocity and
  // twists it around itself, both falling off with distance and age.
  // Overlapping samples are averaged, not summed — a fast sweep lays down
  // dozens, and summed they dragged a whole band of the hero along.
  vec2 disp = vec2(0.0);
  float total = 0.0;
  // Each sample's reach is warped by slow noise across the board, so what
  // it moves is an irregular, drifting patch — not a round brush.
  vec2 warp = (vec2(noise(vBoard * 0.008 + uTime * 0.15), noise(vBoard * 0.008 + 7.3 - uTime * 0.12)) - 0.5) * R * 0.9;
  float reach = R * (0.75 + 0.5 * noise(vBoard * 0.004 - uTime * 0.08));
  for (int i = 0; i < 32; i++) {
    float w = uWeight[i];
    if (w < 0.002) continue;
    vec2 d = vBoard - uTrail[i].xy;
    vec2 dw = d + warp;
    float f = exp(-dot(dw, dw) / (reach * reach)) * w;
    vec2 v = uTrail[i].zw;
    disp += v * 0.05 * f;
    // The twist turns opposite ways on either side of the path. A hard
    // sign() there flipped it across the line of motion and cut straight
    // seams through the picture; this soft sign fades through zero instead.
    float side = v.x * d.y - v.y * d.x;
    float speed = length(v);
    disp += vec2(-d.y, d.x) * min(speed, 2400.0) * 0.00012 * f * side / (abs(side) + 0.35 * R * speed + 1.0);
    total += f;
  }
  disp /= max(1.0, total);
  float dl = length(disp);
  if (dl > 80.0) disp *= 80.0 / dl;
  vec2 p = vBoard - disp;

  // Textures are premultiplied (as the browser holds a rasterised SVG).
  // Unpremultiplying the faint, blurred edges — a few levels of colour at a
  // couple of percent alpha — turned smooth falloffs into visible steps, so
  // the blends work on premultiplied colour where they can:
  // - multiply: mix(c, c\xb7s, a) = c\xb7(1 − a + a\xb7s) = c\xb7(1 − a + S), S = a\xb7s,
  //   and hue-rotate is linear, so it applies to S directly;
  // - the tints are one flat colour: only their coverage is read;
  // - soft-light needs straight colour, but its error is scaled by alpha.
  vec3 c = BASE;
  vec4 o = ribbon(uOuter, p, OUTER, OUTER_PIVOT, uSpinO);
  c *= 1.0 - o.a + hueRotate(o.rgb, uHueO);
  float t = texture2D(uTint, clamp(p / vec2(1920.0, 2800.0), 0.0, 1.0)).a;
  c = mix(c, blendHue(c, TINT), t);
  vec4 i = ribbon(uInner, p, INNER, INNER_PIVOT, uSpinI);
  c = mix(c, softLight(c, hueRotate(i.rgb / max(i.a, 0.001), uHueI)), i.a);
  // The bend catches light like a lens: lighter on the side it is pulled
  // from, darker on the other, and a faint shadow overall — so it reads on
  // flat cream as well as on the colour.
  float lens = dot(disp, vec2(-0.6, -0.8)) / 80.0;
  // Kept faint: a stronger shadow traced the brush's outline.
  c *= 1.0 + 0.035 * lens - 0.025 * smoothstep(0.0, 80.0, dl);
  // Dither by under one 8-bit step, so the long, soft gradients don't band.
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;async function o(e,r){r.throwIfAborted();let i=await fetch((0,t.x)(`/decoration/swirl-texture-${e}.webp`),{signal:r});if(!i.ok)throw Error(`Cannot load swirl ${e} texture: ${i.status}`);let o=await i.blob();r.throwIfAborted();let n=URL.createObjectURL(o),a=new Image,l=()=>{a.src=""};r.addEventListener("abort",l,{once:!0});try{return a.src=n,await a.decode(),r.throwIfAborted(),a}finally{r.removeEventListener("abort",l),URL.revokeObjectURL(n)}}let n=e=>{let t;return(-34+60*((t=e<.5?2*e:2-2*e)*t*(3-2*t)))*Math.PI/180};async function a(e,{signal:t,visibilityTarget:l=e.parentElement??e}={}){if(t?.aborted||!e.isConnected)return null;let s=e.querySelector('[data-layer="dots"]');if(!s)return null;let c=document.createElement("canvas");c.width=Math.round(960),c.height=Math.round(1400),c.setAttribute("aria-hidden","true"),Object.assign(c.style,{position:"absolute",inset:"0",width:"100%",height:"100%",opacity:"0",transition:"opacity 300ms ease-out"});let u=c.getContext("webgl",{alpha:!0,antialias:!1,premultipliedAlpha:!1});if(!u)return null;let d=[],h=[],v=null,f=null,m=!1,p=()=>{},g=new AbortController,b=e=>{e.preventDefault(),x()};function x(){if(!m){for(let r of(m=!0,g.abort(),p(),t?.removeEventListener("abort",x),c.removeEventListener("webglcontextlost",b),e.removeAttribute("data-liquid"),c.remove(),h))u.deleteTexture(r);for(let e of(f&&u.deleteBuffer(f),v&&u.deleteProgram(v),d))u.deleteShader(e);u.getExtension("WEBGL_lose_context")?.loseContext()}}t?.addEventListener("abort",x,{once:!0}),c.addEventListener("webglcontextlost",b);try{let t,a=u.getExtension("WEBGL_debug_renderer_info"),b=a?String(u.getParameter(a.UNMASKED_RENDERER_WEBGL)):"";if(/swiftshader|llvmpipe|softpipe|software|microsoft basic render driver/i.test(b))return x(),null;let E=(e,t)=>{let r=u.createShader(e);if(!r)throw Error("Cannot allocate swirl shader");if(d.push(r),u.shaderSource(r,t),u.compileShader(r),!u.getShaderParameter(r,u.COMPILE_STATUS))throw Error(u.getShaderInfoLog(r)??"shader");return r};if(!(v=u.createProgram()))throw Error("Cannot allocate swirl program");if(u.attachShader(v,E(u.VERTEX_SHADER,r)),u.attachShader(v,E(u.FRAGMENT_SHADER,i)),u.linkProgram(v),!u.getProgramParameter(v,u.LINK_STATUS))throw Error("Cannot link swirl program");if(u.useProgram(v),!(f=u.createBuffer()))throw Error("Cannot allocate swirl buffer");u.bindBuffer(u.ARRAY_BUFFER,f),u.bufferData(u.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),u.STATIC_DRAW);let w=u.getAttribLocation(v,"aPos");u.enableVertexAttribArray(w),u.vertexAttribPointer(w,2,u.FLOAT,!1,0,0),u.pixelStorei(u.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0);let T=(e,t,r)=>{let i=u.createTexture();if(!i)throw Error("Cannot allocate swirl texture");h.push(i),u.activeTexture(u.TEXTURE0+e),u.bindTexture(u.TEXTURE_2D,i),u.texImage2D(u.TEXTURE_2D,0,u.RGBA,u.RGBA,u.UNSIGNED_BYTE,r),u.texParameteri(u.TEXTURE_2D,u.TEXTURE_MIN_FILTER,u.LINEAR),u.texParameteri(u.TEXTURE_2D,u.TEXTURE_MAG_FILTER,u.LINEAR),u.texParameteri(u.TEXTURE_2D,u.TEXTURE_WRAP_S,u.CLAMP_TO_EDGE),u.texParameteri(u.TEXTURE_2D,u.TEXTURE_WRAP_T,u.CLAMP_TO_EDGE),u.uniform1i(u.getUniformLocation(v,t),e)},[y,R,A]=await Promise.all([o("outer",g.signal),o("inner",g.signal),o("tint",g.signal)]);if(g.signal.throwIfAborted(),!e.isConnected)throw Error("Swirl unmounted during setup");T(0,"uOuter",y),T(1,"uInner",R),T(2,"uTint",A);let I=u.getUniformLocation(v,"uSpinO"),L=u.getUniformLocation(v,"uSpinI"),S=u.getUniformLocation(v,"uHueO"),_=u.getUniformLocation(v,"uHueI"),P=u.getUniformLocation(v,"uTime"),U=u.getUniformLocation(v,"uTrail"),O=u.getUniformLocation(v,"uWeight"),C={spinO:0,spinI:0,hueO:0,hueI:0},B=null,M=!1,D=null,N=null,F=0,X=[],G=new Float32Array(128),H=new Float32Array(32),W=e=>{if("mouse"!==e.pointerType&&"pen"!==e.pointerType)return;let t=l.getBoundingClientRect();B=e.clientX>=t.left&&e.clientX<=t.right&&e.clientY>=t.top&&e.clientY<=t.bottom?{x:e.clientX,y:e.clientY}:null,M=!0},q=()=>{B=null},$=!1,k=0,V=performance.now(),Y=!1,j=null,K=0,z=r=>{if(k=0,m||!$||document.hidden)return;if(!e.isConnected)return void x();let i=Math.min((r-V)/1e3,.1);V=r;let o=r/1e3;C.spinO=o/48%1,C.spinI=o/34%1,C.hueO=o/26%1,C.hueI=(o- -13)/31%1,u.uniform1f(I,C.spinO*Math.PI*2),u.uniform1f(L,C.spinI*Math.PI*2),u.uniform1f(S,n(C.hueO)),u.uniform1f(_,n(C.hueI)),u.uniform1f(P,r/1e3%1e3);let a=c.getBoundingClientRect();if(!a.width||!a.height)return;((e,t,r)=>{let i=B?{x:(B.x-r.left)/r.width*1920,y:(B.y-r.top)/r.height*2800}:null;if(D&&i&&N&&!M&&(D.x+=i.x-N.x,D.y+=i.y-N.y),N=i,M=!1,D){let r=N?220*(N.x-D.x):0,i=N?220*(N.y-D.y):0;D.vx+=(r-24*D.vx)*e,D.vy+=(i-24*D.vy)*e,D.x+=D.vx*e,D.y+=D.vy*e,(F+=e)>=.025&&(F=0,Math.hypot(D.vx,D.vy)>40&&(X.push({...D,t}),X.length>32&&X.shift()),!N&&1>Math.hypot(D.vx,D.vy)&&(D=null))}else N&&(D={...N,vx:0,vy:0});for(let e=0;e<32;e++){let r=X[e],i=r?t-r.t:.8,o=Math.min(i/.8,1);H[e]=i>=.8?0:Math.exp(-i/.45)*(1-o*o*(3-2*o)),r&&G.set([r.x,r.y,r.vx,r.vy],4*e)}})(i,r/1e3,a),u.uniform4fv(U,G),u.uniform1fv(O,H);let l=c.width/a.width,s=Math.max(0,-a.top-200),d=Math.min(a.height,innerHeight-a.top+200),h=Math.max(0,-a.left),v=Math.min(a.width,innerWidth-a.left);if(u.viewport(0,0,c.width,c.height),d>s&&v>h){if(null!==j&&(K=r-j>150?K+1:0)>=2)return void x();u.enable(u.SCISSOR_TEST),u.scissor(Math.floor(h*l),Math.floor(c.height-d*l),Math.ceil((v-h)*l),Math.ceil((d-s)*l)),u.drawArrays(u.TRIANGLES,0,3),j=r}Y||(Y=!0,c.style.opacity="1",t=setTimeout(()=>{!m&&e.isConnected&&e.setAttribute("data-liquid","")},350)),$&&!document.hidden&&(k=requestAnimationFrame(z))},J=()=>{m||k||!$||document.hidden||(V=performance.now(),k=requestAnimationFrame(z))},Q=()=>{cancelAnimationFrame(k),k=0,j=null,K=0},Z=new IntersectionObserver(([e])=>{($=e.isIntersecting&&e.intersectionRect.width>0&&e.intersectionRect.height>0)?J():Q()}),ee=()=>{document.hidden?Q():J()};return p=()=>{Q(),clearTimeout(t),Z.disconnect(),window.removeEventListener("pointermove",W),document.documentElement.removeEventListener("pointerleave",q),document.removeEventListener("visibilitychange",ee)},e.insertBefore(c,s),window.addEventListener("pointermove",W,{passive:!0}),document.documentElement.addEventListener("pointerleave",q),document.addEventListener("visibilitychange",ee),Z.observe(l),x}catch{return x(),null}}e.s(["liquidSwirl",0,a])}]);