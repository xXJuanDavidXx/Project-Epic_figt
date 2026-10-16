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

## M1 — Movimiento y cámara ✅

**Fecha:** 2026-10-15

### Qué se hizo

- **Input** (`src/core/input.ts`): teclado + ratón + **gamepad** (mapeo estándar, zona muerta
  reescalada). Los eventos del DOM solo acumulan; la simulación lee una foto estable por tick.
  - `InputBuffer` (~9 ticks, tuneable): una acción pulsada durante la recuperación de otra se
    ejecuta en cuanto el estado lo permite. Pieza pura y testeada.
  - Pointer lock al hacer clic en el canvas; al perder el foco se sueltan todas las teclas.
- **FSM genérica** (`src/core/fsm.ts`): `enter`/`update`/`exit` + transiciones evaluadas en orden,
  encadenables dentro del mismo tick (tope de 4, sin bucles infinitos), historial con el tick de
  cada cambio. La usarán también los enemigos.
- **Estados del jugador** (`playerStates.ts`): `idle, run, sprint, jump, fall, dodge`.
  Shift tap = esquiva, Shift mantenido = sprint (como el juego de referencia).
- **Locomoción pura** (`locomotion.ts`): aceleración/frenada separadas, dirección relativa a la
  cámara, giro por el lado corto, `GroundMemory` con coyote time y bloqueo de doble salto.
- **PlayerController**: character controller **cinemático** de Rapier (no rigidbody dinámico) con
  autostep, snap-to-ground, pendientes y deslizamiento. Gravedad asimétrica (se cae más rápido de
  lo que se sube) y salto variable según se mantenga el botón.
- **Cámara**: `CameraRig` (yaw/pitch en la simulación, determinista, porque el movimiento es
  relativo a ella) + `ThirdPersonCamera` (coloca la cámara en el render con esfera de colisión
  contra el mundo; nunca atraviesa un muro). Altura del pivote suavizada aparte para que los
  escalones no sacudan la cámara.
- **Nivel greybox** (`src/world/greyboxLevel.ts`): suelo, rampas de 15°/30°/48°, escalera de 8
  escalones de 0.3 m, tres plataformas a distinta altura, pasillo estrecho con techo (prueba de
  cámara) y muros perimetrales. Malla y collider se crean juntos: no pueden desincronizarse.
- **Debug**: el overlay añade estado FSM + ticks en estado, suelo, velocidad y posición. El panel
  lil-gui expone todo el tuning de jugador, esquiva y cámara. En dev, `window.__game` da acceso a
  loop/input/rig/player/physics/view desde la consola.

### Cómo probarlo

`npm run dev`, clic en el canvas para capturar el ratón.

| Control          | Acción                                               |
| ---------------- | ---------------------------------------------------- |
| WASD             | Mover (relativo a la cámara)                         |
| Ratón            | Cámara                                               |
| Espacio          | Saltar (mantener = salto alto, soltar = salto corto) |
| Shift (toque)    | Esquiva                                              |
| Shift (mantener) | Sprint                                               |

Checklist de aceptación (verificado en navegador):

- Rampa de 15° y 30°: se suben andando. La de 48° desliza (por encima del ángulo de deslizamiento).
- Escalera de 0.3 m: se sube sola por autostep, sin saltar (medido: y 0.92 → 2.72).
- Salto: altura real medida 1.63 m con `jumpHeight` 1.7 (pérdida por integración a 60 Hz).
- Cámara contra un muro alto: se queda a 0.20 m del pivote sin atravesarlo; al despejarse vuelve
  suavemente a 5 m.
- Si te caes del mundo (y < −20) vuelves al punto de aparición.

### Valores de tuning actuales

| Parámetro                     | Valor         | Archivo            |
| ----------------------------- | ------------- | ------------------ |
| `walkSpeed` / `sprintSpeed`   | 4.6 / 7.6 m/s | `config/player.ts` |
| `groundAccel` / `groundDecel` | 70 / 55 m/s²  | `config/player.ts` |
| `airControl`                  | 0.35          | `config/player.ts` |
| `jumpHeight`                  | 1.7 m         | `config/player.ts` |
| `fallGravityMultiplier`       | 1.45          | `config/player.ts` |
| `lowJumpGravityMultiplier`    | 2.2           | `config/player.ts` |
| `coyoteTicks`                 | 6             | `config/player.ts` |
| `bufferTicks` (input)         | 9             | `config/input.ts`  |
| `dodgeSpeed` / `dodgeTicks`   | 11.5 / 16     | `config/player.ts` |
| `distance` / `pivotHeight`    | 5 / 1.45 m    | `config/camera.ts` |
| `mouseSensitivity`            | 0.0024 rad/px | `config/camera.ts` |

### Qué quedó pendiente

- Sin animaciones: el jugador es una cápsula con una marca roja al frente para leer la
  orientación. Los estados ya están listos para mapear clips en M5.
- Remapeo de controles en un menú (M8); de momento el mapeo vive en `config/input.ts`.
- `strafe` con lock-on llega en M3: ahora el personaje siempre mira hacia donde se mueve.

### Tests (91 en total)

`FixedStepAccumulator` y `GameLoop`, `EventBus`, `InputBuffer` + zona muerta, `StateMachine`,
matemáticas de locomoción (incluida una simulación del salto que comprueba el ápice) y **la FSM
completa del jugador** con un input falso: coyote time, buffer de salto al aterrizar, no al doble
salto, duración y recuperación de la esquiva, transiciones de sprint.

---

## M2 — Núcleo de combate + personaje y animación ✅ (pendiente de que lo pruebes)

**Fecha:** 2026-10-16

Por petición tuya se adelantó el personaje y la animación (normalmente M5), empezando por el
parry. Todo sin assets externos: personaje, animación, efectos y sonido son procedurales.

### Qué se hizo

**Lógica pura de combate** (`src/combat/`, sin Three.js — lo garantiza el linter):

- `GuardTracker`: ventana de deflect de 12 ticks, los 4 primeros = **deflect perfecto**.
  Anti-spam: cada pulsación seguida recorta 3 ticks la siguiente ventana (mínimo 4); se olvida
  tras 30 ticks sin pulsar o tras un deflect con éxito.
- `Posture` / `Vitality`: regeneración proporcional a la vida, más rápida en guardia, pausada
  45 ticks tras cada daño. Un deflect nunca rompe tu postura (configurable).
- `resolveHit`: deflect perfecto > deflect > bloqueo > golpe; arco frontal de guardia de 200°;
  i-frames de esquiva; reglas de perilous (barrido/agarre imbloqueables, estocada solo desviable)
  ya implementadas y testeadas para M3.
- `CombatSystem`: detecta golpes (esfera contra cápsula), **un golpe por objetivo por tajo**,
  aplica daño, hitstop a ambos y emite eventos. Contrato `Combatant` común a jugador y enemigos.
- Ataques data-driven (`attackData.ts`): combo del jugador de 3 golpes + remate; 4 ataques del
  duelista. La hitbox recorre un arco durante los ticks activos.

**Jugador:** estados `guard, deflect, blockstun, attack (combo), deathblow, hitstun, guardBreak,
dead`. Contraataque tras deflect, cancelación del combo a guardia en su ventana, remate al pulsar
ataque con el enemigo roto y a menos de 2.6 m. Encaramiento suave al enemigo más cercano (hasta
que llegue el lock-on en M3).

**Duelista enmascarado** (enemigo de prueba): patrón fijo en bucle (tajo / tajo+ascendente /
vertical retardado / combo de 3). Bloquea cuando no ataca y contraataca tras 2 bloqueos seguidos.
**Un deflect no corta su combo** — el siguiente golpe sale igual y encadenas _clang-clang-clang_;
solo el último golpe desviado lo deja rebotado y abierto. Postura rota → rodilla en tierra →
ventana de remate de 150 ticks → muerte → reaparece a los 3 s.

**Personaje y animación** (`src/render/character/`, `src/animation/`):

- Humanoide low-poly procedural: ronin (katana a una mano, bufanda) y duelista (hoja larga a dos
  manos, máscara de cerámica, hombreras). Katana con perfil real: curvatura y kissaki.
- Clips como **datos en ticks**, muestreados de forma pura. Los clips de ataque se construyen
  desde el `AttackDef`: la hoja visible y la hitbox no pueden desincronizarse.
- **Brazo de la espada por IK de dos huesos**: cada pose dice dónde está la mano y hacia dónde
  apunta la hoja. La mano izquierda del duelista agarra el mango por IK.
- Deflect: corte seco a la pose de contacto, que el hitstop congela mientras saltan las chispas
  y las hojas tiemblan; luego un rebote y vuelta a la guardia. Una pose por dirección del golpe
  (izquierda, derecha, vertical, estocada).

**Feedback** (`src/render/vfx/`, `src/audio/`, `src/ui/`):

- Chispas que salen **del punto exacto donde se cruzan las dos hojas** (calculado sobre los
  esqueletos posados), destello breve, luz puntual, brillo en ambas hojas.
- Sacudida de cámara por "trauma" (cuadrática) y direccional, golpe de FOV.
- Aviso de lectura: la hoja enemiga brilla y suena un "ting" ~12 ticks antes del impacto.
- Sonido sintetizado con Web Audio, con paneo estéreo: deflect (transitorio + parciales metálicos
  - golpe grave), deflect perfecto (más largo, con batido), bloqueo, golpe, rotura de postura,
    remate, silbido de cada tajo.
- Render: tone mapping ACES, bloom, mapa de entorno para el acero, contraluz frío.
- HUD: la postura es una **hoja que se calienta** desde el centro (brasa → blanco incandescente,
  reverbera cerca del límite); vitalidad en laca con rastro del daño reciente; barras del enemigo
  sobre su cabeza; marca de remate original (anillo roto + chispa de cuatro puntas).

**Debug:** log de combate con tick exacto, hitboxes/hurtboxes en wireframe, panel lil-gui con
deflect, postura, hitstop, duelista y feedback. `window.__game` incluye enemigo, combate y eventos.

### Cómo probarlo

`npm run dev`, clic en el canvas. El duelista está delante del punto de aparición.

| Control        | Acción                                               |
| -------------- | ---------------------------------------------------- |
| Clic derecho   | Guardia. **Pulsar justo antes del golpe = deflect**  |
| Clic izquierdo | Ataque (combo de 3) / remate si el enemigo está roto |
| Shift (toque)  | Esquiva (i-frames en los ticks 2–11)                 |

Cómo leer al duelista: cuando su hoja **brilla y suena un "ting"**, tienes ~12 ticks (0.2 s)
hasta el impacto. Pulsa guardia en ese momento. El vertical retardado aguanta el arma arriba más
tiempo a propósito, para castigar al que pulsa por reflejo.

### Verificado en navegador

- Un bot que pulsa guardia con cada aviso desvió 7 golpes seguidos (varios perfectos) y rompió la
  postura del duelista; remate y reaparición funcionan.
- Encontrado y corregido: un mismo tajo golpeaba dos veces tras el hitstop.
- Encontrado por los tests y corregido: entrar en guardia con el botón ya mantenido no bloqueaba.

### Lo que NO pude verificar

- **El sonido**: lo diseñé y el código corre sin errores, pero no puedo oírlo. Dime cómo suena.
- **Las poses de ataque, golpe recibido, rotura de guardia y muerte**: solo revisé a fondo la del
  deflect con capturas. Las demás pueden tener ángulos raros.
- **El "feel"**: los números de ventana, hitstop y sacudida son puntos de partida. Están todos
  en el panel de debug para que los ajustes jugando.

### Valores de tuning actuales

Ver `docs/COMBAT_TUNING.md` (tabla completa por ataque y respuesta correcta).

### Qué quedó pendiente

- Lock-on, indicador de peligro y ataques perilous con sus contras → M3.
- IA real del enemigo (detección, decisiones, deflect propio) → M4.
- Trails de la hoja en los tajos.
- Resurrección (5.6, detrás de un flag).

### Tests (179 en total)

Ventana de deflect y anti-spam, postura y regeneración, resolución de golpes (incluidas las reglas
de perilous), `CombatSystem` con combatientes falsos (un golpe por tajo, regresión del doble golpe
tras hitstop, rotura de postura por deflects, remate), FSM de combate del jugador (guardia,
re-pulsación, contraataque, combo, cancelación, remate, reacciones), muestreo de animación y
sincronía de cada clip de ataque con su `AttackDef`.

---

## Próximo: M3 — Lock-on y ataques peligrosos

Lock-on completo con strafe, indicador de peligro original, barrido/estocada/agarre con sus
respuestas (salto con pisotón, contra-esquiva, esquiva).
