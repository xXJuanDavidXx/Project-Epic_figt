# PROGRESS

Estado del proyecto por milestone. Se actualiza al cerrar cada uno.

---

## M0 — Esqueleto ✅ (pendiente de validación del usuario)

**Fecha:** 2026-10-15

### Qué se hizo

- Proyecto Vite + TypeScript 6 en modo `strict` ampliado (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`), alias `@/*` → `src/*`.
- Three.js 0.186 + Rapier 0.21 (`@dimforge/rapier3d-compat`) + Vitest 5 + ESLint 10 (flat config,
  type-checked) + Prettier.
- **Game loop con timestep fijo a 60 Hz** (`src/core/loop.ts`):
  - `FixedStepAccumulator`: pieza pura y testeada (sin DOM ni Three.js). Devuelve cuántos ticks
    simular, expone `alpha` en `[0,1)` para interpolar el render, recorta el delta de frame y
    **descarta el backlog** en vez de entrar en spiral of death.
  - `GameLoop`: registra sistemas (`fixedUpdate` para lógica, `renderUpdate` para dibujo),
    inyecta reloj y planificador (tests deterministas), soporta `timeScale` global y
    `stepOnce()` para avance tick a tick.
  - El primer frame tras `start()` no se simula: la carga de WASM/shaders no genera un salto.
- **Bus de eventos tipado** (`src/core/events.ts` + `src/core/eventMap.ts`): la lógica emite, la
  presentación escucha. El mapa de eventos crece por milestone.
- **Wrapper de Rapier** (`src/physics/world.ts`): único punto que inicializa el WASM; el mundo
  avanza siempre con el timestep fijo (`world.timestep = FIXED_DELTA`).
- **Interpolación de poses** (`src/physics/bodySync.ts`): `InterpolatedBody` liga un rigidbody a un
  `Object3D` con lerp/slerp entre tick anterior y actual, sin allocations por frame. Es la pieza
  que usarán jugador y enemigos en M1+.
- **Render greybox** (`src/render/scene.ts`): renderer con tope de pixel ratio, niebla, luz
  hemisférica + direccional con sombras, suelo con rejilla.
- **Debug** (`src/debug/`): overlay de FPS/tick/pasos por frame/alpha/ticks descartados,
  wireframe de colliders vía debug render pipeline de Rapier, y panel lil-gui (timeScale,
  presets 1x/0.25x/0.1x/congelar, avanzar 1 tick, max sub-steps, gravedad, FOV, pixel ratio).
  Todo el bloque de debug se carga **solo en dev** (`import.meta.env.DEV`).
- Regla de arquitectura blindada en el linter: `src/combat/**` no puede importar Three.js ni
  Rapier (regla 3 de CLAUDE.md). Si alguien lo intenta, falla `npm run lint`.

### Cómo probarlo

```bash
npm install
npm run dev     # http://localhost:5173
npm run check   # typecheck + tests + lint
```

En pantalla: suelo con rejilla, cubo rojo que cae y rebota, overlay arriba a la izquierda y panel
de debug a la derecha. Comprobaciones rápidas:

- El overlay marca 60 FPS, el tick sube y `pasos/f` oscila entre 0 y 1.
- `congelar` (timeScale 0) detiene el cubo pero el render sigue → base del hitstop de M2.
- `avanzar 1 tick` mueve la simulación exactamente un tick.
- `wireframe colliders` dibuja los colliders de Rapier sobre la escena.
- Cambiar de pestaña 10 s y volver: no hay salto temporal (el delta se recorta).

### Valores de tuning actuales

| Parámetro       | Valor    | Archivo                 |
| --------------- | -------- | ----------------------- |
| `tickRate`      | 60 Hz    | `src/config/sim.ts`     |
| `maxSubSteps`   | 5        | `src/config/sim.ts`     |
| `maxFrameDelta` | 0.25 s   | `src/config/sim.ts`     |
| `timeScale`     | 1.0      | `src/config/sim.ts`     |
| `gravity.y`     | −24 m/s² | `src/config/physics.ts` |
| `fov`           | 55°      | `src/config/render.ts`  |
| `maxPixelRatio` | 2        | `src/config/render.ts`  |

Gravedad a −24 (no −9.81) a propósito: los juegos de acción usan gravedad exagerada para que los
saltos se sientan nítidos. Se tunea en M1 junto con la altura de salto.

### Qué quedó pendiente

- El cubo greybox de `main.ts` es andamiaje: lo reemplaza el jugador en M1.
- `src/core/input.ts`, `src/camera/`, `src/combat/`, `src/entities/`, `src/audio/`, `src/ui/`
  están creados pero vacíos: se llenan en M1–M2.
- Un tick descartado al arrancar (compilación de shaders del primer frame). Inofensivo.
- Bundle de producción: 4.9 MB (1.8 MB gzip). Es el WASM de Rapier inlineado en base64 por el
  paquete `-compat` (~3.5 MB) más Three. Para M9: migrar a `@dimforge/rapier3d` con el `.wasm`
  cargado aparte y code-splitting. No se toca antes: `-compat` simplifica todo el desarrollo.

### Decisiones de arquitectura que conviene recordar

1. **Los sistemas se registran en el loop en orden de ejecución**: física → entidades → render.
   El loop no sabe qué hace cada sistema.
2. **`simConfig` es el estado vivo**: lil-gui lo edita y el loop lo relee cada frame. Un loop
   construido con valores explícitos los "fija" e ignora el config global (tests deterministas).
3. **Todo el timing se mide en ticks.** `ticksToSeconds` / `secondsToTicks` existen solo para
   leer logs y configurar; la lógica nunca ve milisegundos de frame.

---

## Próximo: M1 — Movimiento y cámara

Character controller cinemático de Rapier, salto con coyote time + jump buffer, sprint, esquiva,
cámara en tercera persona con colisión, greybox con rampas y escalones.
