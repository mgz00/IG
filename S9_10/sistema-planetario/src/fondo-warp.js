import fragmentShader from './warp-nebula';

// Se conserva el shader 2D: la composición se calcula en coordenadas de pantalla.
// Solo sustituye el material del antiguo fondo; no ilumina ni altera los astros.
export function crearFondoWarp(THREE) {
    const material = new THREE.ShaderMaterial({
        uniforms: {
            u_resolution: { value: new THREE.Vector2(1, 1) },
            u_time: { value: 0 }
        },
        vertexShader: `
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false
    });
    const fondo = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), material);
    fondo.name = 'Fondo Disformidad';
    fondo.renderOrder = -1000;
    fondo.frustumCulled = false;
    return fondo;
}

