const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl',{alpha:false,preserveDrawingBuffer:true});
let time=0,last=0;
try{
 if(!gl)throw Error('WebGL no disponible');
 const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,WARP.shader));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const loc=gl.getAttribLocation(p,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
 const resolution=gl.getUniformLocation(p,'u_resolution'),clock=gl.getUniformLocation(p,'u_time');
 function resize(){const ratio=Math.min(devicePixelRatio,1.5);canvas.width=Math.round(innerWidth*ratio);canvas.height=Math.round(innerHeight*ratio);gl.viewport(0,0,canvas.width,canvas.height);}
 window.addEventListener('resize',resize);resize();
 function draw(now){if(last&&!document.hidden)time+=Math.min((now-last)/1000,.1);last=now;gl.uniform2f(resolution,canvas.width,canvas.height);gl.uniform1f(clock,time);gl.drawArrays(gl.TRIANGLES,0,3);requestAnimationFrame(draw);}requestAnimationFrame(draw);
}catch(e){console.error(e);}
