# CLAUDE.md — epic_fights · juego de acción "soulslike" estilo duelo de katanas (navegador)

> Este archivo es la fuente de verdad del proyecto. Léelo completo antes de cada sesión.
> Si algo aquí entra en conflicto con lo que te pida el usuario en el chat, gana el chat, y actualiza este archivo.

---

## 0. Acuerdos vigentes (decididos en chat)

- **Nombre del proyecto: `epic_fights`** (paquete npm `epic-fights`). Decidido 2026-10-15.
- **Orden de trabajo acordado 2026-10-15**: el agente avanza seguido por los milestones de
  mecánica (M1–M4) sin esperar validación milestone a milestone, porque son greybox y no
  dependen de arte. El usuario valida al final de cada bloque y entra de lleno a partir de
  **M5 (pipeline de assets)** con la dirección de arte. Esto sustituye a la regla 1 de la
  sección 3 mientras dure el bloque de mecánicas.
- ~~El usuario no genera arte todavía: hasta M5 todo es cápsulas y cubos.~~ Sustituido el
  2026-10-15: el usuario pidió **adelantar el personaje y la animación a M2**, empezando por el
  deflect, para que se sienta contundente desde ya. Se resuelve así, sin assets externos:
  - **Personaje procedural** (`src/render/character/`): humanoide estilizado low-poly hecho con
    primitivas, con jerarquía de articulaciones nombradas según la convención de huesos de la
    sección 9 (`weapon_r` incluido).
  - **Animación procedural por poses clave** (`src/animation/`): clips definidos como datos en
    TICKS, muestreados de forma pura y aplicados en el render. Los clips de ataque se construyen
    a partir del `AttackDef`, así que lo visual no puede desincronizarse del combate.
  - En **M5** se añade un backend glTF (`AnimationMixer`) detrás de la misma interfaz: el juego
    pide clips por nombre (`deflect_1`, `atk_1`...) y no sabe de dónde salen.
  - La regla "greybox primero" se mantiene para el **nivel**, no para los personajes.

---

## 1. Visión

Juego 3D en tercera persona para navegador, centrado en **duelos con katana basados en ritmo**: desviar (deflect) en el momento justo, romper la postura del enemigo y rematar. La inspiración mecánica es Sekiro, pero **todo el contenido es original**: nombres, personajes, historia, iconografía, modelos, audio. No uses nombres, assets, UI ni símbolos del juego original.

Pilares (en orden de prioridad; si dos chocan, gana el de arriba):

1. **Combate que se siente perfecto**: respuesta inmediata al input, timing legible, feedback fuerte (hitstop, chispas, sonido).
2. **Agresión recompensada**: atacar y desviar es mejor que huir.
3. **Enemigos legibles**: todo ataque se puede aprender y responder.
4. **Movilidad vertical**: salto, gancho (grappling) y sigilo.

No es pilar: mundo abierto, loot, RPG pesado. Alcance objetivo: **1 zona + 3 enemigos comunes + 1 mini-jefe + 1 jefe** pulidos.

---

## 2. Stack técnico

| Área                | Elección                                  | Nota                                                                   |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| Lenguaje            | TypeScript (strict)                       |                                                                        |
| Build               | Vite                                      |                                                                        |
| Render              | Three.js                                  | importar addons desde `three/addons/...`                               |
| Física / colisiones | Rapier (`@dimforge/rapier3d-compat`)      | character controller cinemático, no rigidbody dinámico para el jugador |
| Animación           | `THREE.AnimationMixer` + clips glTF       |                                                                        |
| Assets              | glTF binario (`.glb`)                     | exportados desde Blender                                               |
| Audio               | Web Audio API (o Howler.js si simplifica) |                                                                        |
| Debug UI            | lil-gui                                   | solo en modo dev                                                       |
| Tests               | Vitest                                    | para lógica de combate pura                                            |
| Lint/format         | ESLint + Prettier                         |                                                                        |

Reglas de dependencias:

- Instala siempre la versión actual con `npm install <pkg>` y **revisa la API real** (tipos en `node_modules` o docs oficiales) antes de usarla. No inventes métodos ni firmas. Si no estás seguro de una API, dilo y verifícala.
- No agregues dependencias nuevas sin justificarlo en el commit.

---

## 3. Reglas de trabajo para el agente

1. **Trabaja por milestones** (sección 8). No avances al siguiente sin cumplir los criterios de aceptación del actual y sin que el usuario lo pruebe.
2. **Greybox primero**: cápsulas y cubos hasta que el combate se sienta bien. El arte llega después.
3. **Lógica de combate desacoplada del render**: todo lo que decide daño, postura, timing y estados vive en módulos puros testeables, sin tocar Three.js.
4. **Todo número de gameplay es tuneable**: va en `src/config/*.ts` y se expone en lil-gui en dev. Nada de números mágicos en la lógica.
5. **Tests** para: ventanas de deflect, cálculo de postura, regeneración, transiciones de máquinas de estado, input buffer.
6. Después de cada cambio: `npm run typecheck && npm run test && npm run lint`. Si algo falla, arréglalo antes de reportar.
7. Commits pequeños con mensaje claro (`feat(combat): ventana de deflect perfecto`).
8. Si una tarea requiere un asset que no existe, crea un placeholder y anótalo en `docs/ASSETS_TODO.md`. Nunca bloquees el desarrollo esperando arte.
9. Cuando termines un milestone, actualiza `docs/PROGRESS.md` con: qué se hizo, qué quedó pendiente, valores de tuning actuales y cómo probarlo.

---

## 4. Arquitectura

```
src/
  main.ts                 bootstrap
  core/
    loop.ts               game loop con timestep fijo
    input.ts              teclado/mouse/gamepad + input buffer
    events.ts             bus de eventos tipado
  combat/                 LÓGICA PURA (sin Three.js)
    posture.ts
    vitality.ts
    deflect.ts
    attackData.ts         definición de ataques (frames, daño, tipo)
    hitResolver.ts        resuelve golpe vs estado del defensor
  entities/
    player/
      PlayerController.ts
      playerStates.ts     máquina de estados
    enemies/
      EnemyBase.ts
      ai/                 árboles de decisión / FSM por enemigo
  physics/
    world.ts              wrapper de Rapier
    hitboxes.ts           hitboxes/hurtboxes ligadas a huesos
  camera/
    ThirdPersonCamera.ts
    LockOn.ts
  render/
    scene.ts
    vfx.ts                chispas, trails, hitstop visual
  world/
    greyboxLevel.ts       geometria del nivel: mallas + colliders juntos
  animation/              poses y clips como DATOS en ticks; muestreo puro
    rig.ts                nombres de articulaciones (convencion de la seccion 9)
    clips/                clips por personaje
    sampler.ts            muestreo y mezcla de poses (sin Three.js)
    AnimationController.ts  aplica poses al rig en el render (crossfade, one-shots)
  render/character/       personajes procedurales (rig + mallas)
  audio/
  ui/                     HUD: barras de vida y postura, indicador de peligro
  config/                 todos los números de tuning
  debug/                  lil-gui, dibujado de hitboxes, slow-motion
tests/
docs/
  PROGRESS.md
  ASSETS_TODO.md
  COMBAT_TUNING.md
```

### Game loop

- **Simulación a timestep fijo de 60 Hz** (acumulador), render interpolado al framerate del monitor. Todo el timing de combate se mide en **ticks de simulación**, no en milisegundos de frame, para que sea determinista.
- Soportar `timeScale` global (para hitstop y slow-motion de debug).

### Máquinas de estado

Jugador y enemigos usan FSM explícitas. Cada estado define: `enter`, `update`, `exit`, qué inputs acepta, si se puede cancelar y hacia qué.

Estados mínimos del jugador:
`Idle, Run, Sprint, Jump, Fall, Attack(n), Guard, Deflect, Dodge, Hitstun, GuardBreak, Grapple, Crouch/Stealth, Deathblow, Dead`

### Ataques data-driven

Cada ataque se define como datos:

```ts
interface AttackDef {
  id: string;
  startupTicks: number; // antes de que el hitbox esté activo
  activeTicks: number; // hitbox activo
  recoveryTicks: number; // vulnerable después
  vitalityDmg: number;
  postureDmg: number;
  kind: 'normal' | 'perilous_sweep' | 'perilous_thrust' | 'perilous_grab';
  hitboxBone: string; // hueso al que se ancla el hitbox
  hitboxRadius: number;
  cancelWindow?: [number, number]; // ticks donde se puede cancelar
}
```

Los ticks de startup/active/recovery se alinean con la animación. Cuando haya animaciones reales, marcar los frames clave en la definición (no adivinar desde el código).

### Hitboxes

- Hurtboxes: cápsulas en el cuerpo de cada entidad.
- Hitboxes: esferas/cápsulas ancladas a un hueso (o a un punto del arma), activas solo en `activeTicks`.
- Un ataque golpea **una sola vez** por objetivo por swing.
- Modo debug para dibujarlas en wireframe.

---

## 5. Especificación del combate

Todos los valores son **puntos de partida para tunear**, no verdades. Viven en `src/config/combat.ts`.

### 5.1 Dos recursos por entidad

- **Vitalidad** (vida). Llega a 0 → muerte (o fase siguiente en jefes).
- **Postura**. Se llena al recibir golpes bloqueados, al bloquear y al ser desviado. Llena = **postura rota** → ventana de remate (deathblow).
  - Regeneración de postura proporcional a la vitalidad restante: con menos vida, regenera más lento. Fórmula sugerida: `regen = baseRegen * (vitality / maxVitality)`, con multiplicador extra si está en guardia.
  - La regeneración se pausa N ticks después de recibir daño de postura.

### 5.2 Guardia y deflect

- Presionar guardia inicia una **ventana de deflect** (sugerido: ~10–12 ticks a 60 Hz, tunear).
- Si un ataque conecta dentro de la ventana → **deflect**: 0 daño de vida, poco daño de postura propio, daño de postura al atacante, chispa + sonido metálico agudo + hitstop corto.
- Si conecta fuera de la ventana pero con guardia sostenida → **bloqueo**: 0 daño de vida, más daño de postura propio.
- **Anti-spam**: presionar guardia repetidamente acorta la ventana de deflect de las siguientes pulsaciones; se restaura tras un breve tiempo sin pulsar. Tunear para que el spam funcione un poco contra combos rápidos, pero no siempre.
- Postura del jugador rota → `GuardBreak` (stun vulnerable).

### 5.3 Ataques peligrosos (perilous)

Antes del ataque, aparece un indicador visual **original** (diseña uno propio, no el kanji del juego original) + sonido distintivo. Tipos:

- **Barrido**: no se puede bloquear → saltar. Saltar encima permite pisar al enemigo (daño de postura).
- **Estocada**: no se puede bloquear → contra-esquiva específica (dodge hacia el enemigo en el timing correcto) que hace gran daño de postura; o deflect con timing perfecto.
- **Agarre**: no se puede bloquear ni desviar → esquivar o saltar.

### 5.4 Ataque del jugador

- Combo ligero de 3–5 golpes, cancelable en guardia durante `cancelWindow`.
- El enemigo puede bloquear o desviar golpes del jugador según su IA; atacar a un enemigo en guardia sube su postura.

### 5.5 Remate (deathblow)

- Postura rota → indicador sobre el enemigo y ventana de N ticks para rematar con ataque.
- Ataque por la espalda sin ser detectado (sigilo) → remate instantáneo.
- Jefes tienen varios "nodos" de vida; cada remate consume uno.

### 5.6 Resurrección

- Al morir, opción de levantarse 1 vez (recargable al rematar enemigos). Mantener como opcional de diseño; implementar detrás de un flag.

### 5.7 Feedback (game feel) — obligatorio desde el milestone de combate

- **Hitstop**: congelar ambas entidades 3–6 ticks en deflect y golpes fuertes.
- Screen shake leve y direccional.
- Chispas en deflect, sangre/estilizado en daño (configurable).
- Sonido diferente para: golpe, bloqueo, deflect, deflect perfecto, rotura de postura.
- Barras de postura visibles para jugador y enemigo enfocado.

### 5.8 Input

- **Input buffer** de ~8–10 ticks: un input presionado durante la recuperación se ejecuta en cuanto sea posible.
- Soporte teclado+mouse y gamepad (Gamepad API) con remapeo.
- Controles por defecto (mouse/teclado): WASD mover, mouse cámara, clic izq atacar, clic der guardia/deflect, Espacio saltar, Shift esquivar/sprint, Q lock-on, E gancho, F remate/interactuar, Ctrl agacharse.

---

## 6. Cámara y movimiento

- Cámara tercera persona con colisión (no atravesar paredes: raycast del jugador a la cámara).
- **Lock-on**: selecciona el enemigo más cercano al centro de pantalla dentro de un rango; con lock-on el jugador hace strafe mirando al objetivo. Cambiar de objetivo con el stick/rueda.
- Character controller cinemático de Rapier: pendientes, escalones, salto con coyote time y jump buffer.
- **Gancho**: puntos de anclaje predefinidos en el nivel; cuando uno está en rango y visible se marca; al activarlo, trayectoria en arco hacia el punto.
- **Sigilo**: agacharse reduce el radio de detección; enemigos con cono de visión y estados `Unaware → Suspicious → Alert`.

---

## 7. IA de enemigos

- FSM + selección de ataque ponderada por distancia y estado del jugador.
- Cada enemigo tiene un **moveset legible**: anticipación clara (wind-up) proporcional al peligro.
- Reaccionan a la agresión: si el jugador ataca mucho, algunos enemigos responden con deflect propio.
- Jefe: 2 fases, la segunda añade ataques y cambia el ritmo. Cada ataque del jefe documentado en `docs/COMBAT_TUNING.md` con sus ticks y la respuesta correcta.

---

## 8. Milestones

Cada milestone termina con: build funcionando, tests verdes, `docs/PROGRESS.md` actualizado, y espera de validación del usuario.

### M0 — Esqueleto

- Vite + TS strict + Three + Rapier + Vitest + ESLint/Prettier.
- Escena con suelo, luz, cubo. Loop a timestep fijo con interpolación.
- **Aceptación**: `npm run dev` muestra escena; contador de FPS y ticks en debug.

### M1 — Movimiento y cámara

- Cápsula del jugador con character controller, salto, sprint, esquiva.
- Cámara tercera persona con colisión.
- **Aceptación**: moverse por un greybox con rampas y escalones sin atravesar nada.

### M2 — Núcleo de combate (greybox)

- FSM del jugador, ataque combo, guardia, deflect con ventana, postura, vitalidad, hitboxes debug.
- Dummy enemigo que ataca en loop con un patrón fijo.
- Hitstop, chispas placeholder, sonidos placeholder.
- **Aceptación**: se puede desviar el patrón del dummy, romperle la postura y rematarlo. Tests de deflect/postura pasan.

### M3 — Lock-on y ataques peligrosos

- Lock-on completo, indicador de peligro original, barrido/estocada/agarre con sus respuestas.
- **Aceptación**: cada tipo de perilous tiene su contra funcionando y testeada.

### M4 — IA de enemigo común

- 1 enemigo con FSM, detección, persecución, moveset de 3–4 ataques.
- **Aceptación**: pelear con él se siente justo y legible.

### M5 — Pipeline de assets

- Cargar `.glb` con personaje rigged y animaciones; mapear clips a estados; blending entre clips; ligar hitboxes a huesos.
- **Aceptación**: el jugador greybox se reemplaza por un modelo animado sin romper el combate.

### M6 — Movilidad vertical y sigilo

- Gancho, agacharse, conos de visión, remate por la espalda.

### M7 — Nivel y mini-jefe

- Una zona con verticalidad, 3 tipos de enemigo, checkpoints, mini-jefe.

### M8 — Jefe final y pulido

- Jefe 2 fases, HUD final, menú, opciones (sensibilidad, remapeo, volumen), guardado en localStorage.

### M9 — Rendimiento y build de producción

- Presupuesto: 60 FPS estables en laptop media con GPU integrada. Medir draw calls, usar instancing, LOD, texturas comprimidas (KTX2) y Draco/meshopt si los assets lo requieren.

---

## 9. Pipeline de arte (para el usuario)

- Modelado y rig en **Blender**. Exportar `.glb` (Y-up, escala en metros, aplicar transforms).
- Animaciones de prueba: Mixamo es útil para prototipar (revisa su licencia antes de publicar); las animaciones de combate finales conviene hacerlas a mano para controlar los frames de startup/active/recovery.
- Convención de nombres de clips: `idle, run, sprint, jump_start, jump_loop, land, dodge_f/b/l/r, guard_idle, deflect_1, deflect_2, atk_1..atk_5, hit_react, guard_break, deathblow, death, grapple_throw, crouch_idle, crouch_walk`.
- Hueso del arma: `weapon_r` (punto de anclaje de hitbox).
- Todo asset pendiente se lista en `docs/ASSETS_TODO.md` con su uso y prioridad.

### 9.1 Assets generados con IA (opcional, recomendado para prototipar rápido)

Flujo sugerido: **IA genera la base → Blender limpia y ajusta → el juego la consume**. La IA ahorra horas, pero casi nunca entrega algo listo para un juego sin retoque.

| Necesidad                                 | Tipo de herramienta           | Ejemplos (verificar estado, precio y licencia actuales antes de usar)                                           |
| ----------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Modelos 3D (personajes, props, escenario) | Texto/imagen → 3D             | Meshy, Tripo, Rodin (Hyper3D)                                                                                   |
| Concept art / referencias                 | Texto → imagen                | cualquier generador de imágenes; usar como referencia para modelar o como input de imagen→3D                    |
| Rig automático                            | Auto-rigging                  | Mixamo, AccuRIG                                                                                                 |
| Animaciones desde video                   | Video → mocap                 | DeepMotion, Rokoko Vision, Move.ai (grabarse uno mismo haciendo los movimientos con un palo/katana de práctica) |
| Pulir animaciones de combate              | Posing asistido por IA/física | Cascadeur                                                                                                       |
| Texturas                                  | Texto/imagen → textura PBR    | generadores de texturas tileables                                                                               |
| SFX y voces                               | Texto → audio                 | generadores de efectos de sonido por IA                                                                         |

Reglas al usar assets de IA:

- **Retopología y limpieza obligatorias**: los modelos generados suelen venir con polígonos de más y topología mala para deformar. Reducir polys (presupuesto sugerido: personaje 10–25k tris, enemigo común 5–15k) y revisar que deforme bien en codos, rodillas y hombros antes de animar.
- **Las animaciones de combate se ajustan a mano** aunque vengan de IA/mocap: el timing (startup/active/recovery) lo define el diseño de combate, no el clip. El mocap da una base natural; luego se recortan/aceleran frames en Blender o Cascadeur para que el wind-up sea legible.
- **Coherencia visual**: definir una guía de estilo (paleta, nivel de detalle, estilizado vs realista) y aplicarla a todos los prompts. Estilo estilizado/low-poly perdona mucho más los errores de la IA que el realista.
- **Licencias**: anotar en `docs/ASSET_LICENSES.md` herramienta, plan usado y términos de uso comercial de cada asset. Los términos cambian entre planes gratuitos y pagos.
- Nunca usar prompts que pidan replicar personajes, armaduras o escenarios reconocibles del juego original.
- El agente de terminal no genera los modelos; prepara el pipeline para cargarlos (`.glb`), mapear clips y ligar hitboxes, y deja placeholders mientras tanto.

---

## 10. Herramientas de debug (modo dev)

- lil-gui con todos los valores de `config/`.
- Toggle de hitboxes/hurtboxes, conos de visión, estado FSM flotante sobre cada entidad.
- Slow-motion (0.25x, 0.1x) y avance tick a tick.
- Log de eventos de combate (`deflect`, `block`, `hit`, `postureBreak`) con tick exacto.

---

## 11. Lo que NO hacer

- No usar assets, nombres, música ni UI del juego original.
- No meter lógica de combate dentro de callbacks de animación o render.
- No medir timing de combate en `deltaTime` variable.
- No inventar APIs de Three.js o Rapier: verifícalas.
- No avanzar de milestone sin validación del usuario.
