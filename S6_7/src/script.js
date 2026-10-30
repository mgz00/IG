
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { FlyControls } from "three/examples/jsm/controls/FlyControls";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import GUI from "lil-gui";

// Texturas
import texSol from "./textures/8k_sun.jpg";
import texMercurio from "./textures/8k_mercury.jpg";
import texVenus from "./textures/8k_venus_surface.jpg";
import texTierra from "./textures/8k_earth_daymap.jpg";
import texNubes from "./textures/8k_earth_clouds.jpg";
import texSpecular from "./textures/8k_earth_specular_map.tif";
import texMarte from "./textures/8k_mars.jpg";
import texJupiter from "./textures/8k_jupiter.jpg";
import texSaturno from "./textures/8k_saturn.jpg";
import texUrano from "./textures/2k_uranus.jpg";
import texNeptuno from "./textures/2k_neptune.jpg";
import texLuna from "./textures/8k_moon.jpg";
import texCeres from "./textures/4k_ceres_fictional.jpg";
import texEris from "./textures/4k_eris_fictional.jpg";
import texMakemake from "./textures/4k_makemake_fictional.jpg";
import texFondo from "./textures/8k_stars_milky_way.jpg";
import texAnillos from "./textures/8k_saturn_ring_alpha.png";

// Variables generales
let scene, renderer, camera, cameraNave;
let controls, flyControls, transformControls;
let sol, luzSolar, gui, carpetaEdicion, carpetaGestion, controlPlanetas;
let ficha, panelNave, selectorDestino, botonPausa, raycaster, mouse;
let posicionRaton, planetaSeleccionado = null;

let planetas = [], lunas = [], etiquetas = [];
let vistaActual = "general";
let naveIniciada = false, pausado = false;
let arrastrando = false, pulsacionGizmo = false;
let timestamp = 0, contadorPlanetas = 0, contadorLunas = 0;

const reloj = new THREE.Clock();
const loader = new THREE.TextureLoader();

const parametros = {
    velocidad: 1,
    orbitas: true,
    etiquetas: true,
    intensidadSol: 2.5,
    planetaEditable: "",
    crear: () => crearPlanetaAleatorio(),
    eliminar: () => eliminarPlanetaSeleccionado(),
    desactivarEdicion: () => desactivarTransformControls()
};

// Información didáctica
const informacion = {
    Sol: {
        descripcion: "Estrella situada en el centro del sistema solar. Su gravedad mantiene a los planetas en sus órbitas.",
        distancia: "0 km",
        dia: "Rotación diferencial: unos 25 días en el ecuador",
        anio: "Unos 230 millones de años alrededor del centro galáctico",
        satelites: "Los planetas y muchos otros cuerpos orbitan a su alrededor.",
        detalle: "Contiene aproximadamente el 99,86 % de la masa del sistema solar.",
        extra: "Su superficie visible alcanza unos 5.500 °C."
    },
    Mercurio: {
        descripcion: "Es el planeta más cercano al Sol y el más pequeño del sistema solar.",
        distancia: 57.9,
        dia: "176 días terrestres",
        anio: "88 días terrestres",
        satelites: "0 lunas",
        detalle: "Su superficie presenta numerosos cráteres.",
        extra: "Tiene un núcleo metálico de gran tamaño."
    },
    Venus: {
        descripcion: "Planeta rocoso con una atmósfera extremadamente densa.",
        distancia: 108.2,
        dia: "117 días terrestres",
        anio: "225 días terrestres",
        satelites: "0 lunas",
        detalle: "Es el planeta más caliente del sistema solar.",
        extra: "Su rotación es retrógrada."
    },
    Tierra: {
        descripcion: "Nuestro planeta y el único donde se conoce la existencia de vida.",
        distancia: 149.6,
        dia: "24 horas",
        anio: "365,25 días",
        satelites: "1 luna: la Luna",
        detalle: "Tiene abundante agua líquida en su superficie.",
        extra: "Su atmósfera ayuda a mantener temperaturas habitables."
    },
    Marte: {
        descripcion: "Conocido como el planeta rojo por los óxidos de hierro.",
        distancia: 228,
        dia: "24,7 horas",
        anio: "687 días terrestres",
        satelites: "2 lunas: Fobos y Deimos",
        detalle: "Tiene el enorme volcán Olympus Mons.",
        extra: "Existen evidencias de agua líquida en su pasado."
    },
    "Júpiter": {
        descripcion: "Es el planeta más grande del sistema solar y un gigante gaseoso.",
        distancia: 778.5,
        dia: "9,9 horas",
        anio: "11,9 años terrestres",
        satelites: "Entre sus numerosas lunas destacan Ío, Europa, Ganímedes y Calisto.",
        detalle: "La Gran Mancha Roja es una gigantesca tormenta.",
        extra: "Está formado principalmente por hidrógeno y helio."
    },
    Saturno: {
        descripcion: "Gigante gaseoso famoso por sus espectaculares anillos.",
        distancia: 1432,
        dia: "10,7 horas",
        anio: "29,4 años terrestres",
        satelites: "Entre sus lunas destacan Titán y Encélado.",
        detalle: "Sus anillos están formados principalmente por partículas de hielo.",
        extra: "Su densidad media es inferior a la del agua."
    },
    Urano: {
        descripcion: "Gigante helado de color azul verdoso.",
        distancia: 2867,
        dia: "17,2 horas",
        anio: "84 años terrestres",
        satelites: "Destacan Titania, Oberón y Miranda.",
        detalle: "Su eje de rotación está inclinado unos 98°.",
        extra: "Parece girar casi tumbado."
    },
    Neptuno: {
        descripcion: "Es el planeta más lejano del Sol y un gigante helado.",
        distancia: 4515,
        dia: "16,1 horas",
        anio: "165 años terrestres",
        satelites: "Entre sus lunas destaca Tritón.",
        detalle: "Presenta vientos extraordinariamente rápidos.",
        extra: "Fue descubierto en 1846."
    }
};

init();
animate();

// Inicialización
function init() {
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    crearFondo();

    camera = new THREE.PerspectiveCamera(
        60, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    camera.position.set(0, 25, 35);
    camera.lookAt(0, 0, 0);

    cameraNave = new THREE.PerspectiveCamera(
        75, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    cameraNave.position.set(0, 3, 10);
    cameraNave.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    flyControls = new FlyControls(cameraNave, renderer.domElement);
    flyControls.dragToLook = true;
    flyControls.movementSpeed = 5;
    flyControls.rollSpeed = 0.5;
    flyControls.enabled = false;

    crearTransformControls();

    scene.add(new THREE.AmbientLight(0xffffff, 0.12));

    luzSolar = new THREE.PointLight(
        0xffffff, parametros.intensidadSol, 0, 0
    );
    luzSolar.castShadow = true;
    luzSolar.shadow.mapSize.set(1024, 1024);
    scene.add(luzSolar);

    crearSol();

    // Planetas
    crearPlaneta("Mercurio", 0.2, 3, 0x999999, 1.6, texMercurio);
    crearPlaneta("Venus", 0.35, 5, 0xffcc66, 1.2, texVenus);
    crearPlaneta("Tierra", 0.4, 7, 0x2266ff, 1.0, texTierra);
    crearPlaneta("Marte", 0.3, 9, 0xff3300, 0.8, texMarte);
    crearPlaneta("Júpiter", 0.9, 12, 0xddaa77, 0.5, texJupiter);
    crearPlaneta("Saturno", 0.75, 15, 0xeedd99, 0.35, texSaturno);
    crearPlaneta("Urano", 0.55, 18, 0x66ccff, 0.25, texUrano);
    crearPlaneta("Neptuno", 0.5, 21, 0x2244dd, 0.2, texNeptuno);

    configurarSuperficieTierra();
    crearNubesTierra();
    crearAnillos(planetas[5]);

    // Lunas
    crearLuna(planetas[2], "Luna", 0.12, 0.8, 2.5, 0xaaaaaa, texLuna);
    crearLuna(planetas[4], "Ganímedes", 0.16, 1.5, 1.6, 0xaaaa88, texCeres);
    crearLuna(planetas[5], "Encélado", 0.10, 1.2, 2.0, 0xeeeeee, texEris);
    crearLuna(planetas[7], "Tritón", 0.13, 1, -1.8, 0x9999cc, texMakemake);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    crearInterfaz();
    crearGUI();
    actualizarDestinos();

    renderer.domElement.addEventListener("pointerdown", event => {
        pulsacionGizmo = vistaActual === "general" &&
            !!transformControls.object &&
            transformControls.axis !== null;

        posicionRaton = { x: event.clientX, y: event.clientY };
    });

    renderer.domElement.addEventListener("pointerup", seleccionarPlaneta);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onWindowResize);
}

// TransformControls
function crearTransformControls() {
    transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode("translate");
    transformControls.setSpace("world");
    transformControls.showY = false;
    transformControls.showXY = false;
    transformControls.showYZ = false;
    transformControls.showXZ = true;
    transformControls.setSize(0.8);

    scene.add(transformControls);

    transformControls.addEventListener("mouseDown", () => {
        pulsacionGizmo = true;
        posicionRaton = null;
    });

    transformControls.addEventListener("dragging-changed", event => {
        arrastrando = event.value;
        controls.enabled = vistaActual === "general" && !arrastrando;
    });

    // Sincronizar posición y órbita
    transformControls.addEventListener("objectChange", () => {
        const planeta = transformControls.object;
        if (!planeta || !planeta.userData.extra) return;

        planeta.position.y = 0;

        const x = planeta.position.x;
        const z = planeta.position.z;
        const distancia = Math.max(2.5, Math.hypot(x, z));
        const angulo = Math.atan2(z, x);

        planeta.userData.distancia = distancia;
        planeta.userData.fase =
            angulo - timestamp * planeta.userData.velocidad;
    });

    transformControls.addEventListener("mouseUp", () => {
        const planeta = transformControls.object;

        if (planeta && planeta.userData.extra) {
            posicionarPlaneta(planeta);
            actualizarOrbita(planeta);
            actualizarContenidoFicha(planeta);
        }
    });

    transformControls.detach();
}

function activarTransformControls(planeta) {
    if (!planeta || !planeta.userData.extra || vistaActual !== "general") return;
    transformControls.attach(planeta);
    transformControls.enabled = true;
}

function desactivarTransformControls() {
    transformControls.detach();
    arrastrando = false;
    controls.enabled = vistaActual === "general";
}

// Texturas y astros
function cargarTextura(ruta, esColor = true) {
    const textura = loader.load(ruta);
    if (esColor) textura.colorSpace = THREE.SRGBColorSpace;
    return textura;
}

function crearFondo() {
    const geometria = new THREE.SphereGeometry(500, 64, 64);
    const material = new THREE.MeshBasicMaterial({
        map: cargarTextura(texFondo),
        side: THREE.BackSide,
        depthWrite: false
    });
    scene.add(new THREE.Mesh(geometria, material));
}

function crearSol() {
    const geometria = new THREE.SphereGeometry(1.5, 40, 40);
    const material = new THREE.MeshBasicMaterial({
        map: cargarTextura(texSol)
    });

    sol = new THREE.Mesh(geometria, material);
    sol.name = "Sol";
    scene.add(sol);
    crearEtiqueta(sol, "Sol", 1.7);
}

// Specular Map de la Tierra
function configurarSuperficieTierra() {
    const tierra = planetas[2];
    const material = tierra.userData.cuerpo.material;

    material.specularMap = cargarTextura(texSpecular, false);
    material.specular = new THREE.Color(0x888888);
    material.shininess = 25;

    material.needsUpdate = true;
}

// Capa independiente de nubes
function crearNubesTierra() {
    const tierra = planetas[2];
    const radio = tierra.userData.radio;

    const geometria = new THREE.SphereGeometry(
        radio * 1.035, 64, 64
    );

    const material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        alphaMap: cargarTextura(texNubes, false),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        side: THREE.FrontSide
    });

    const nubes = new THREE.Mesh(geometria, material);
    nubes.name = "Nubes de la Tierra";

    tierra.userData.cuerpo.add(nubes);
    tierra.userData.nubes = nubes;
}

function crearPlaneta(nombre, radio, distancia, color, velocidad, textura, extra = false) {
    const grupo = new THREE.Group();
    grupo.name = nombre;

    const geometria = new THREE.SphereGeometry(radio, 96, 96);
    const material = new THREE.MeshPhongMaterial({ color, shininess: 10 });

    if (textura !== undefined) {
        material.map = cargarTextura(textura);
        material.color.set(0xffffff);
    }

    const cuerpo = new THREE.Mesh(geometria, material);
    cuerpo.castShadow = true;
    cuerpo.receiveShadow = true;
    grupo.add(cuerpo);

    grupo.userData = {
        distancia, velocidad, rotacion: 0.6,
        cuerpo, radio, radioVisual: radio,
        extra, fase: 0, orbita: null,
        ficha: extra ? {
            descripcion: "Planeta ficticio creado durante la simulación.",
            distanciaReal: "No aplicable: planeta ficticio",
            dia: "No definido",
            anio: "No definido",
            detalle: "Puedes personalizar su información y añadir lunas."
        } : null
    };

    crearOrbita(grupo);
    posicionarPlaneta(grupo);

    planetas.push(grupo);
    scene.add(grupo);
    crearEtiqueta(grupo, nombre, radio + 0.3);

    return grupo;
}

function crearOrbita(planeta) {
    const distancia = planeta.userData.distancia;
    const curva = new THREE.EllipseCurve(
        0, 0, distancia, distancia, 0, Math.PI * 2, false, 0
    );

    const geometria = new THREE.BufferGeometry()
        .setFromPoints(curva.getPoints(128));
    geometria.rotateX(-Math.PI / 2);

    const orbita = new THREE.Line(
        geometria,
        new THREE.LineBasicMaterial({ color: 0x555555 })
    );

    orbita.visible = parametros.orbitas && planeta.visible;
    planeta.userData.orbita = orbita;
    scene.add(orbita);
}

function actualizarOrbita(planeta) {
    const anterior = planeta.userData.orbita;

    if (anterior) {
        scene.remove(anterior);
        anterior.geometry.dispose();
        anterior.material.dispose();
    }

    crearOrbita(planeta);
}

function posicionarPlaneta(planeta) {
    const datos = planeta.userData;
    const angulo = timestamp * datos.velocidad + datos.fase;

    planeta.position.set(
        Math.cos(angulo) * datos.distancia,
        0,
        Math.sin(angulo) * datos.distancia
    );
}

function crearLuna(planeta, nombre, radio, distancia, velocidad, color, textura) {
    const geometria = new THREE.SphereGeometry(radio, 24, 24);
    const material = new THREE.MeshPhongMaterial({ color, shininess: 5 });

    if (textura !== undefined) {
        material.map = cargarTextura(textura);
        material.color.set(0xffffff);
    }

    const luna = new THREE.Mesh(geometria, material);
    luna.name = nombre;
    luna.castShadow = true;
    luna.receiveShadow = true;

    luna.userData = {
        distancia, velocidad, fase: 0,
        radioOriginal: radio,
        radioVisual: radio,
        planeta
    };

    planeta.add(luna);
    lunas.push(luna);
    crearEtiqueta(luna, nombre, radio + 0.18);
    posicionarLuna(luna);

    return luna;
}

function posicionarLuna(luna) {
    const datos = luna.userData;
    const angulo = timestamp * datos.velocidad + datos.fase;

    luna.position.set(
        Math.cos(angulo) * datos.distancia,
        0,
        Math.sin(angulo) * datos.distancia
    );
}

function crearAnillos(planeta) {
    const interior = 0.95, exterior = 1.7;
    const geometria = new THREE.RingGeometry(interior, exterior, 128);
    const posiciones = geometria.attributes.position;
    const uv = geometria.attributes.uv;
    const vertice = new THREE.Vector3();

    // Coordenadas de textura radiales
    for (let i = 0; i < posiciones.count; i++) {
        vertice.fromBufferAttribute(posiciones, i);
        uv.setXY(i, (vertice.length() - interior) / (exterior - interior), 0.5);
    }

    const material = new THREE.MeshPhongMaterial({
        map: cargarTextura(texAnillos),
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.1,
        depthWrite: false
    });

    const anillos = new THREE.Mesh(geometria, material);
    anillos.rotation.x = -Math.PI / 2;
    anillos.rotation.y = 0.25;
    anillos.castShadow = true;
    anillos.receiveShadow = true;
    planeta.userData.cuerpo.add(anillos);
}

// Etiquetas
function crearEtiqueta(objeto, nombre, altura) {
    const elemento = document.createElement("div");
    elemento.textContent = nombre;

    Object.assign(elemento.style, {
        position: "fixed",
        zIndex: "2",
        pointerEvents: "none",
        color: "white",
        font: "12px Arial",
        textShadow: "0 1px 4px black",
        background: "rgba(0,0,0,0.45)",
        borderRadius: "5px",
        padding: "3px 6px",
        transform: "translate(-50%,-100%)",
        whiteSpace: "nowrap",
        display: "none"
    });

    document.body.appendChild(elemento);
    etiquetas.push({ objeto, elemento, altura });
}

function esVisibleEnJerarquia(objeto) {
    let actual = objeto;
    while (actual) {
        if (!actual.visible) return false;
        actual = actual.parent;
    }
    return true;
}

function actualizarEtiquetas() {
    const camara = vistaActual === "general" ? camera : cameraNave;
    const posicion = new THREE.Vector3();
    const pantalla = new THREE.Vector3();
    const adelante = new THREE.Vector3();

    camara.getWorldDirection(adelante);

    for (const etiqueta of etiquetas) {
        const elemento = etiqueta.elemento;

        if (!parametros.etiquetas || !esVisibleEnJerarquia(etiqueta.objeto)) {
            elemento.style.display = "none";
            continue;
        }

        etiqueta.objeto.getWorldPosition(posicion);
        posicion.y += etiqueta.altura;

        if (posicion.clone().sub(camara.position).dot(adelante) <= 0) {
            elemento.style.display = "none";
            continue;
        }

        pantalla.copy(posicion).project(camara);

        if (
            Math.abs(pantalla.x) > 1 ||
            Math.abs(pantalla.y) > 1 ||
            pantalla.z < -1 ||
            pantalla.z > 1
        ) {
            elemento.style.display = "none";
            continue;
        }

        elemento.style.display = "block";
        elemento.style.left = ((pantalla.x + 1) * 0.5 * window.innerWidth) + "px";
        elemento.style.top = ((1 - pantalla.y) * 0.5 * window.innerHeight) + "px";
    }
}

// Gestión de planetas ficticios
function actualizarSelectorEditables() {
    if (!carpetaGestion) return;

    const extras = planetas.filter(p => p.userData.extra);
    const opciones = { Ninguno: "" };

    for (const planeta of extras) opciones[planeta.name] = planeta.uuid;

    if (!extras.some(p => p.uuid === parametros.planetaEditable)) {
        parametros.planetaEditable = "";
    }

    if (controlPlanetas) controlPlanetas.destroy();

    controlPlanetas = carpetaGestion
        .add(parametros, "planetaEditable", opciones)
        .name("Planeta a editar")
        .onChange(seleccionarPlanetaEditable);
}

function seleccionarPlanetaEditable() {
    const planeta = planetas.find(
        p => p.uuid === parametros.planetaEditable && p.userData.extra
    );

    if (!planeta) {
        planetaSeleccionado = null;
        ficha.style.display = "none";
        desactivarTransformControls();
        actualizarEdicion();
        return;
    }

    if (vistaActual !== "general") cambiarVista();

    mostrarInformacion(planeta);
    controls.target.copy(planeta.position);
    camera.position.copy(planeta.position).add(new THREE.Vector3(4, 6, 9));
    controls.update();
}

function crearPlanetaAleatorio() {
    if (planetas.length >= 15) {
        alert("Máximo de 15 planetas.");
        return;
    }

    contadorPlanetas++;
    const nombre = "Planeta nuevo " + contadorPlanetas;
    const color = new THREE.Color().setHSL(Math.random(), 0.65, 0.5);

    let distancia = 24;
    while (planetas.some(p => Math.abs(p.userData.distancia - distancia) < 1.5)) {
        distancia += 2;
    }

    const planeta = crearPlaneta(
        nombre, THREE.MathUtils.randFloat(0.3, 0.7),
        distancia, color.getHex(),
        THREE.MathUtils.randFloat(0.15, 0.5),
        undefined, true
    );

    parametros.planetaEditable = planeta.uuid;
    actualizarSelectorEditables();
    actualizarDestinos();
    seleccionarPlanetaEditable();
}

function eliminarPlanetaSeleccionado() {
    const planeta = planetaSeleccionado;

    if (!planeta) {
        alert("Selecciona primero un planeta.");
        return;
    }

    if (!planeta.userData.extra) {
        alert("Los planetas originales no se pueden eliminar.");
        return;
    }

    if (transformControls.object === planeta) desactivarTransformControls();

    scene.remove(planeta, planeta.userData.orbita);
    planetas = planetas.filter(p => p !== planeta);
    lunas = lunas.filter(l => l.userData.planeta !== planeta);

    for (const etiqueta of [...etiquetas]) {
        const pertenece = etiqueta.objeto === planeta ||
            etiqueta.objeto.userData.planeta === planeta;

        if (pertenece) {
            etiqueta.elemento.remove();
            etiquetas.splice(etiquetas.indexOf(etiqueta), 1);
        }
    }

    planeta.traverse(objeto => {
        if (objeto.geometry) objeto.geometry.dispose();
        if (objeto.material) objeto.material.dispose();
    });

    planeta.userData.orbita.geometry.dispose();
    planeta.userData.orbita.material.dispose();

    planetaSeleccionado = null;
    parametros.planetaEditable = "";
    ficha.style.display = "none";

    actualizarEdicion();
    actualizarSelectorEditables();
    actualizarDestinos();
}

function cambiarVisibilidad(planeta, visible) {
    planeta.visible = visible;
    planeta.userData.orbita.visible = visible && parametros.orbitas;

    if (!visible && transformControls.object === planeta) {
        desactivarTransformControls();
    }

    if (!visible && planetaSeleccionado === planeta) {
        planetaSeleccionado = null;
        ficha.style.display = "none";
        actualizarEdicion();
    }
}

// Edición de lunas
function crearEditorLunas(planeta, carpeta) {
    const lunasPlaneta = lunas.filter(l => l.userData.planeta === planeta);
    if (!lunasPlaneta.length) return;

    const carpetaLunas = carpeta.addFolder("Editar lunas existentes");

    for (const luna of lunasPlaneta) {
        const datos = {
            nombre: luna.name,
            radio: luna.userData.radioVisual,
            distancia: luna.userData.distancia,
            velocidad: luna.userData.velocidad,
            color: "#" + luna.material.color.getHexString()
        };

        const editor = carpetaLunas.addFolder(luna.name);

        editor.add(datos, "nombre").name("Nombre").onFinishChange(valor => {
            const nombre = String(valor).trim().slice(0, 60);
            if (!nombre) return;

            luna.name = nombre;
            editor.title(nombre);

            const etiqueta = etiquetas.find(e => e.objeto === luna);
            if (etiqueta) etiqueta.elemento.textContent = nombre;
        });

        editor.add(datos, "radio", 0.05, 0.4, 0.01)
            .name("Tamaño")
            .onChange(valor => {
                luna.userData.radioVisual = valor;
                luna.scale.setScalar(valor / luna.userData.radioOriginal);

                const etiqueta = etiquetas.find(e => e.objeto === luna);
                if (etiqueta) etiqueta.altura = valor + 0.18;
            });

        editor.add(datos, "distancia", 0.5, 5, 0.1)
            .name("Distancia")
            .onChange(valor => {
                luna.userData.distancia = valor;
                posicionarLuna(luna);
            });

        editor.add(datos, "velocidad", -5, 5, 0.1)
            .name("Velocidad")
            .onChange(valor => {
                const angulo = Math.atan2(luna.position.z, luna.position.x);
                luna.userData.velocidad = valor;
                luna.userData.fase = angulo - timestamp * valor;
            });

        editor.addColor(datos, "color").name("Color")
            .onChange(valor => luna.material.color.set(valor));

        editor.close();
    }

    carpetaLunas.open();
}

// Edición de planetas
function actualizarEdicion() {
    if (carpetaEdicion) {
        carpetaEdicion.destroy();
        carpetaEdicion = null;
    }

    if (!planetaSeleccionado || !planetaSeleccionado.userData.extra) return;

    const planeta = planetaSeleccionado;
    const p = planeta.userData;
    const info = p.ficha;

    carpetaEdicion = gui.addFolder("Editar planeta seleccionado");

    const datos = {
        nombre: planeta.name,
        descripcion: info.descripcion,
        distanciaReal: info.distanciaReal,
        dia: info.dia,
        anio: info.anio,
        detalle: info.detalle,
        velocidad: p.velocidad,
        radio: p.radioVisual,
        lunaNombre: "Luna nueva",
        lunaColor: "#dddddd",
        lunaRadio: 0.12,
        lunaDistancia: 1,
        lunaVelocidad: 2,

        anadirLuna: () => {
            contadorLunas++;
            const nombre = datos.lunaNombre.trim() || "Luna " + contadorLunas;

            crearLuna(
                planeta, nombre, datos.lunaRadio,
                datos.lunaDistancia, datos.lunaVelocidad,
                new THREE.Color(datos.lunaColor).getHex()
            );

            actualizarContenidoFicha(planeta);
            actualizarEdicion();
        }
    };

    carpetaEdicion.add(datos, "nombre").name("Nombre").onFinishChange(valor => {
        const nombre = String(valor).trim().slice(0, 60);
        if (!nombre) return;

        planeta.name = nombre;
        const etiqueta = etiquetas.find(e => e.objeto === planeta);
        if (etiqueta) etiqueta.elemento.textContent = nombre;

        actualizarDestinos();
        actualizarSelectorEditables();
        actualizarContenidoFicha(planeta);
    });

    const campos = [
        ["descripcion", "Descripción"],
        ["distanciaReal", "Distancia real (texto)"],
        ["dia", "Duración del día"],
        ["anio", "Duración del año"],
        ["detalle", "Curiosidad"]
    ];

    for (const [campo, titulo] of campos) {
        carpetaEdicion.add(datos, campo).name(titulo).onFinishChange(valor => {
            info[campo] = String(valor);
            actualizarContenidoFicha(planeta);
        });
    }

    carpetaEdicion.add(datos, "velocidad", -2, 2, 0.05)
        .name("Velocidad orbital")
        .onChange(valor => {
            const angulo = Math.atan2(planeta.position.z, planeta.position.x);
            p.velocidad = valor;
            p.fase = angulo - timestamp * valor;
        });

    carpetaEdicion.add(datos, "radio", 0.15, 1.2, 0.05)
        .name("Tamaño")
        .onChange(valor => {
            p.radioVisual = valor;
            p.cuerpo.scale.setScalar(valor / p.radio);
            const etiqueta = etiquetas.find(e => e.objeto === planeta);
            if (etiqueta) etiqueta.altura = valor + 0.3;
        });

    carpetaEdicion.add(parametros, "desactivarEdicion")
        .name("Desactivar edición 3D");

    const lunaGUI = carpetaEdicion.addFolder("Añadir luna");
    lunaGUI.add(datos, "lunaNombre").name("Nombre");
    lunaGUI.addColor(datos, "lunaColor").name("Color");
    lunaGUI.add(datos, "lunaRadio", 0.05, 0.4, 0.01).name("Tamaño");
    lunaGUI.add(datos, "lunaDistancia", 0.6, 3, 0.1).name("Distancia");
    lunaGUI.add(datos, "lunaVelocidad", -5, 5, 0.1).name("Velocidad");
    lunaGUI.add(datos, "anadirLuna").name("Crear luna");

    crearEditorLunas(planeta, carpetaEdicion);
    carpetaEdicion.open();
}

// Raycaster
function seleccionarPlaneta(event) {
    if (!posicionRaton || arrastrando || pulsacionGizmo) {
        posicionRaton = null;
        pulsacionGizmo = false;
        return;
    }

    const movimiento = Math.hypot(
        event.clientX - posicionRaton.x,
        event.clientY - posicionRaton.y
    );

    posicionRaton = null;
    if (movimiento > 5) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const camara = vistaActual === "general" ? camera : cameraNave;
    raycaster.setFromCamera(mouse, camara);

    const cuerpos = [
        sol,
        ...planetas.filter(p => p.visible).map(p => p.userData.cuerpo)
    ];

    const intersecciones = raycaster.intersectObjects(cuerpos, false);

    if (!intersecciones.length) {
        planetaSeleccionado = null;
        parametros.planetaEditable = "";
        ficha.style.display = "none";
        desactivarTransformControls();
        actualizarEdicion();
        if (controlPlanetas) controlPlanetas.updateDisplay();
        return;
    }

    const cuerpo = intersecciones[0].object;
    if (cuerpo === sol) mostrarInformacionSol();
    else mostrarInformacion(cuerpo.parent);
}

// Fichas informativas
function filaFicha(titulo, valor) {
    const fila = document.createElement("p");
    fila.style.margin = "7px 0";

    const negrita = document.createElement("strong");
    negrita.textContent = titulo + ": ";
    fila.append(negrita, document.createTextNode(String(valor)));
    return fila;
}

function crearTituloFicha(nombre) {
    const titulo = document.createElement("h3");
    titulo.textContent = nombre;
    titulo.style.margin = "0 0 8px";
    ficha.appendChild(titulo);
}

function agregarDescripcion(descripcion) {
    const texto = document.createElement("p");
    texto.textContent = descripcion;
    ficha.appendChild(texto);
}

function mostrarInformacionSol() {
    planetaSeleccionado = null;
    parametros.planetaEditable = "";
    desactivarTransformControls();
    actualizarEdicion();
    if (controlPlanetas) controlPlanetas.updateDisplay();

    const info = informacion.Sol;
    ficha.replaceChildren();

    crearTituloFicha("Sol");
    agregarDescripcion(info.descripcion);
    ficha.appendChild(filaFicha("Tipo de astro", "Estrella G2V"));
    ficha.appendChild(filaFicha("Distancia al centro", info.distancia));
    ficha.appendChild(filaFicha("Rotación", info.dia));
    ficha.appendChild(filaFicha("Órbita galáctica", info.anio));
    ficha.appendChild(filaFicha("Cuerpos que lo orbitan", info.satelites));
    ficha.appendChild(filaFicha("Curiosidad", info.detalle));
    ficha.appendChild(filaFicha("Otro dato", info.extra));
    ficha.style.display = "block";
}

function mostrarInformacion(planeta) {
    planetaSeleccionado = planeta;

    if (planeta.userData.extra) {
        parametros.planetaEditable = planeta.uuid;
        if (controlPlanetas) controlPlanetas.updateDisplay();

        if (vistaActual === "general") activarTransformControls(planeta);
        else desactivarTransformControls();
    } else {
        parametros.planetaEditable = "";
        if (controlPlanetas) controlPlanetas.updateDisplay();
        desactivarTransformControls();
    }

    actualizarContenidoFicha(planeta);
    actualizarEdicion();
}

function actualizarContenidoFicha(planeta) {
    ficha.replaceChildren();
    crearTituloFicha(planeta.name);

    if (planeta.userData.extra) {
        const info = planeta.userData.ficha;
        agregarDescripcion(info.descripcion);

        ficha.appendChild(filaFicha("Distancia real al Sol", info.distanciaReal));
        ficha.appendChild(filaFicha("Día ficticio", info.dia));
        ficha.appendChild(filaFicha("Año ficticio", info.anio));

        const numeroLunas = lunas.filter(l => l.userData.planeta === planeta).length;
        ficha.appendChild(filaFicha("Lunas añadidas", numeroLunas));
        ficha.appendChild(filaFicha("Curiosidad", info.detalle));
        ficha.appendChild(filaFicha(
            "Distancia orbital simulada",
            planeta.userData.distancia.toFixed(1) + " unidades"
        ));

        const nota = document.createElement("small");
        nota.textContent = "Planeta ficticio. Puedes moverlo con las flechas de edición 3D.";
        ficha.appendChild(nota);
    } else {
        const info = informacion[planeta.name];
        agregarDescripcion(info.descripcion);

        ficha.appendChild(filaFicha(
            "Distancia media real al Sol",
            info.distancia.toLocaleString("es-ES") + " millones de km"
        ));
        ficha.appendChild(filaFicha("Duración del día", info.dia));
        ficha.appendChild(filaFicha("Duración del año", info.anio));
        ficha.appendChild(filaFicha("Satélites", info.satelites));
        ficha.appendChild(filaFicha("Curiosidad", info.detalle));
        ficha.appendChild(filaFicha("Otro dato", info.extra));

        const nota = document.createElement("small");
        nota.textContent = "Los tamaños y distancias de la escena no están a escala real.";
        ficha.appendChild(nota);
    }

    ficha.style.display = "block";
}

// Interfaz
function crearInterfaz() {
    const panel = document.createElement("div");

    Object.assign(panel.style, {
        position: "fixed", top: "16px", left: "16px",
        zIndex: "10", width: "225px", padding: "13px",
        borderRadius: "9px", background: "rgba(0,0,0,0.72)",
        color: "white", font: "13px Arial"
    });

    panel.innerHTML = `
        <strong>Sistema Planetario</strong>
        <p id="vistaInfo">Vista actual: General</p>
        <button id="cambiarVista">Cambiar vista (V)</button>
        <button id="pausar">Pausar (P)</button>
        <p id="controlesInfo" style="line-height:1.5">
            Ratón: girar y zoom<br>
            Clic en astro: ficha<br>
            Planetas nuevos: mover con flechas
        </p>
        <div id="panelNave" style="display:none">
            <label for="destinoNave">Destino de la nave</label>
            <select id="destinoNave" style="width:100%;margin:7px 0"></select>
            <button id="saltarNave" style="width:100%">Saltar al planeta</button>
        </div>
    `;

    document.body.appendChild(panel);

    panelNave = document.getElementById("panelNave");
    selectorDestino = document.getElementById("destinoNave");
    botonPausa = document.getElementById("pausar");

    document.getElementById("cambiarVista").addEventListener("click", cambiarVista);
    botonPausa.addEventListener("click", cambiarPausa);
    document.getElementById("saltarNave").addEventListener("click", saltarNave);

    ficha = document.createElement("div");
    Object.assign(ficha.style, {
        position: "fixed", bottom: "20px", left: "20px",
        zIndex: "11", width: "310px", maxHeight: "43vh",
        overflowY: "auto", padding: "15px",
        borderRadius: "10px", border: "1px solid #555",
        background: "rgba(0,0,0,0.84)",
        color: "white", font: "13px/1.45 Arial",
        display: "none"
    });
    document.body.appendChild(ficha);

    const firma = document.createElement("div");
    firma.textContent = "Marcos Gonzalez Gomez EII-IG";

    Object.assign(firma.style, {
        position: "fixed", right: "12px", bottom: "10px",
        zIndex: "10", color: "rgba(255,255,255,0.75)",
        font: "12px Arial", textShadow: "0 1px 4px black",
        pointerEvents: "none"
    });

    document.body.appendChild(firma);
}

// Panel lil-gui
function crearGUI() {
    gui = new GUI();

    const simulacion = gui.addFolder("Simulación");
    simulacion.add(parametros, "velocidad", 0, 5, 0.1).name("Velocidad");

    simulacion.add(parametros, "orbitas")
        .name("Mostrar órbitas")
        .onChange(valor => {
            for (const planeta of planetas) {
                planeta.userData.orbita.visible = valor && planeta.visible;
            }
        });

    simulacion.add(parametros, "etiquetas").name("Mostrar etiquetas");
    simulacion.add(parametros, "intensidadSol", 0, 8, 0.1)
        .name("Luz solar")
        .onChange(valor => luzSolar.intensity = valor);

    simulacion.open();

    carpetaGestion = gui.addFolder("Crear y eliminar planetas");
    carpetaGestion.add(parametros, "crear").name("Crear planeta");
    carpetaGestion.add(parametros, "eliminar").name("Eliminar seleccionado");
    actualizarSelectorEditables();
    carpetaGestion.open();

    const visibilidad = gui.addFolder("Visibilidad de planetas");

    for (const planeta of planetas.slice(0, 8)) {
        const estado = { visible: true };
        planeta.userData.controlVisibilidad = estado;

        visibilidad.add(estado, "visible")
            .name(planeta.name)
            .listen()
            .onChange(valor => cambiarVisibilidad(planeta, valor));
    }

    visibilidad.close();
}

// Cámaras y navegación
function actualizarDestinos() {
    const anterior = selectorDestino.value;
    selectorDestino.replaceChildren();

    for (const planeta of planetas) {
        const opcion = document.createElement("option");
        opcion.value = planeta.uuid;
        opcion.textContent = planeta.name;
        selectorDestino.appendChild(opcion);
    }

    if (planetas.some(p => p.uuid === anterior)) selectorDestino.value = anterior;
    else if (planetas[2]) selectorDestino.value = planetas[2].uuid;
}

function saltarNave() {
    const planeta = planetas.find(p => p.uuid === selectorDestino.value);
    if (!planeta) return;

    if (!planeta.visible) {
        cambiarVisibilidad(planeta, true);
        if (planeta.userData.controlVisibilidad) {
            planeta.userData.controlVisibilidad.visible = true;
        }
    }

    if (vistaActual !== "nave") cambiarVista();

    const destino = new THREE.Vector3();
    planeta.getWorldPosition(destino);

    const radio = planeta.userData.radioVisual;
    const radial = destino.clone().normalize();
    if (radial.lengthSq() < 0.01) radial.set(1, 0, 0);

    cameraNave.position.copy(destino)
        .addScaledVector(radial, Math.max(2.5, radio * 4));
    cameraNave.position.y += Math.max(0.6, radio);
    cameraNave.lookAt(destino);

    naveIniciada = true;
}

function cambiarVista() {
    if (vistaActual === "general") {
        desactivarTransformControls();

        vistaActual = "nave";
        controls.enabled = false;
        flyControls.enabled = true;
        panelNave.style.display = "block";

        document.getElementById("vistaInfo").textContent = "Vista actual: Nave";
        document.getElementById("controlesInfo").innerHTML =
            "W/S: avanzar/retroceder<br>" +
            "A/D: movimiento lateral<br>" +
            "R/F: subir/bajar<br>" +
            "Q/E: inclinar<br>" +
            "Arrastrar ratón: girar<br>" +
            "P: pausar";

        if (!naveIniciada) {
            naveIniciada = true;
            saltarNave();
        }
    } else {
        vistaActual = "general";
        controls.enabled = true;
        flyControls.enabled = false;
        panelNave.style.display = "none";

        document.getElementById("vistaInfo").textContent = "Vista actual: General";
        document.getElementById("controlesInfo").innerHTML =
            "Ratón: girar y zoom<br>" +
            "Clic en astro: ficha<br>" +
            "Planetas nuevos: mover con flechas";
    }
}

function cambiarPausa() {
    pausado = !pausado;
    botonPausa.textContent = pausado ? "Reanudar (P)" : "Pausar (P)";
}

function onKeyDown(event) {
    if (event.target.closest("input,textarea,select") || event.repeat) return;
    const tecla = event.key.toLowerCase();
    if (tecla === "v") cambiarVista();
    if (tecla === "p") cambiarPausa();
}

// Animación
function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(reloj.getDelta(), 0.05);

    if (!pausado) {
        timestamp += delta * parametros.velocidad;
        sol.rotation.y += 0.12 * delta * parametros.velocidad;

        for (const planeta of planetas) {
            if (!(arrastrando && transformControls.object === planeta)) {
                posicionarPlaneta(planeta);
            }

            planeta.userData.cuerpo.rotation.y +=
                planeta.userData.rotacion * delta * parametros.velocidad;
        }

        for (const luna of lunas) posicionarLuna(luna);

        const nubes = planetas[2].userData.nubes;
        if (nubes) nubes.rotation.y += 0.3 * delta * parametros.velocidad;
    }

    if (vistaActual === "general") controls.update();
    else flyControls.update(delta);

    renderer.render(scene, vistaActual === "general" ? camera : cameraNave);
    actualizarEtiquetas();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    cameraNave.aspect = window.innerWidth / window.innerHeight;
    cameraNave.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}
