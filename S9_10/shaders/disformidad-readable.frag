precision highp float;
uniform vec2 u_resolution;
uniform float u_time;

// Disformidad: gas y energía inspirados en los libros de Warhammer 40K.
// La estrategia de capas y acumulación luminosa toma como referencia
// el shader compartido por el usuario, atribuido a su amigo.
void main(){
 // Centrar el dibujo y conservar proporciones al cambiar la ventana.
 // La onda inicial rompe la regularidad antes de generar las capas.
 vec2 p=(2.*gl_FragCoord.xy-u_resolution)/u_resolution.y,q=p+.35*sin(p.yx*2.+u_time*.1);
 float t=u_time*.2;
 vec3 o=vec3(0);
 for(float i=0.;i<5.;i++){
  // La matriz rota el dominio; el seno lo repite de manera continua.
  // El factor 2.8 añade detalle en cada una de las cinco capas.
  q=sin(mat2(.8,-.6,.6,.8)*q*2.8);
  // Los ejes intercambiados y tiempos opuestos deforman los pliegues.
  q+=.3*sin(q.yx*3.+vec2(t,-t));
  // Distancia con signo a una curva radial de tres lóbulos.
  float d=length(q)-.8+.08*sin(atan(q.y,q.x)*3.+t+i);
  // La exponencial llena el interior; la inversa ilumina la frontera.
  // El denominador mínimo evita divisiones por cero.
  float v=.25*exp(-d*3.)+.015/(abs(d)+.05);
  // Acumular gas magenta y violeta con acentos turquesa localizados.
  o+=mix(vec3(.6,.025,.5),vec3(.02,.5,.4),smoothstep(.3,.9,sin(i*2.+q.x+p.y*.3-t*.2)))*v;
 }
 // Aumentar contraste y comprimir el brillo acumulado al intervalo 0..1.
 gl_FragColor=vec4(o*o/(1.+o*o),1.);
}
