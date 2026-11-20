# Sistema Planetario — Fondo de la Disformidad

**Autor:** Marcos González Gómez  
**Asignatura:** Informática Gráfica  
**Práctica:** Ampliación de S6/S7 para S9/S10 — Shaders

## 1. Descripción

Copia del sistema planetario original que sustituye el fondo estelar por el shader de la **Disformidad de 504 bytes**. Se conservan los astros, texturas, iluminación, órbitas, fichas, edición y las dos cámaras. La intención es representar la Disformidad descrita en los libros de Warhammer 40K.

![Sistema planetario con el nuevo fondo](./preview.png)

## 2. Ejecución

Para ver la compilación incluida, sin instalar paquetes:

```sh
node servidor.mjs
```

Abrir `http://127.0.0.1:8100`. Ctrl+C detiene el servidor. Se sirve por HTTP para cargar las texturas WebGL.

Para desarrollar o recompilar:

```sh
npm ci
npm start
npm run build
```

El proyecto conserva Parcel 1 de la práctica original. `ejecutar.mjs` aplica las opciones de compatibilidad con Node reciente y compila sin el optimizador CSS antiguo. El resultado queda en `dist/`.

## 3. Integración

`src/fondo-warp.js` crea el material del fondo y `src/warp-nebula.js` contiene una copia exacta del GLSL minificado de `../shaders/disformidad.frag`. Ejecutar `node preparar.mjs` desde S9_10 después de editar el shader comentado. Ese comando también actualiza esta copia y comprueba el máximo de 512 bytes.

La esfera acompaña a la cámara activa. Antes de dibujar se actualizan resolución y tiempo; la animación respeta la pausa y la velocidad existentes. El shader trabaja en coordenadas de pantalla y se dibuja antes de los planetas, sin afectar a su iluminación ni escribir profundidad. No se trata de un mapa panorámico tridimensional.

## 4. Documentación y verificación

La motivación, desarrollo detallado, versión comentada y fuentes se encuentran en [el README de S9/S10](../README.md). Se han comprobado en Chrome el render, el cambio de cámara y la pausa. Los auxiliares de pruebas no forman parte de la entrega final.

La base del sistema planetario es la práctica original de Marcos González Gómez. La integración y la documentación se han preparado con asistencia de Codex.

## 5. Archivos

| Archivo o carpeta | Para qué sirve |
|---|---|
| `src/index.html` | Página de entrada de la aplicación. |
| `src/script.js` | Escena, astros, cámaras, controles e interacciones. |
| `src/fondo-warp.js` | Aplica el shader al fondo de Three.js. |
| `src/warp-nebula.js` | Shader generado para importarlo en la aplicación. |
| `src/Textures/` | Imágenes utilizadas por los planetas y lunas. |
| `dist/` | Aplicación compilada y lista para servir sin instalar paquetes. No se edita a mano. |
| `package.json` | Dependencias y comandos del proyecto. |
| `package-lock.json` | Versiones exactas de las dependencias para instalar de forma reproducible. |
| `ejecutar.mjs` | Arranca o compila Parcel con las opciones necesarias. |
| `servidor.mjs` | Sirve la compilación localmente en el puerto 8100. |
| `preview.png` | Captura utilizada por la documentación. |
| `README.md` | Explicación e instrucciones de esta integración. |

`node_modules` y la caché se han retirado porque se regeneran. Para editar y recompilar, ejecutar primero `npm ci`. Para ver la compilación existente, basta con `node servidor.mjs`.
