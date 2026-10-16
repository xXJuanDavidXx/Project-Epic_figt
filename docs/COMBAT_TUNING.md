# COMBAT TUNING

Todos los tiempos en **ticks de simulación a 60 Hz** (1 tick = 16.67 ms). Esta es la referencia
viva de los números del combate; los valores reales viven en `src/config/`.

## Conversión rápida

| Ticks | ms  | Sensación                                   |
| ----- | --- | ------------------------------------------- |
| 3     | 50  | Hitstop corto                               |
| 6     | 100 | Hitstop fuerte                              |
| 10    | 167 | Ventana de deflect generosa                 |
| 12    | 200 | Ventana de deflect muy generosa             |
| 18    | 300 | Wind-up legible de un ataque normal         |
| 30    | 500 | Wind-up de un ataque peligroso (telegrafía) |

## Deflect y postura (valores actuales)

| Parámetro                                               | Valor              | Nota                                                  |
| ------------------------------------------------------- | ------------------ | ----------------------------------------------------- |
| Ventana de deflect                                      | 12                 | Desde la pulsación. Funciona aunque sueltes enseguida |
| Tramo perfecto                                          | 4                  | Primeros ticks de la ventana                          |
| Castigo por spam                                        | −3                 | Por pulsación seguida; mínimo 4 ticks                 |
| Olvido del spam                                         | 30                 | Ticks sin pulsar (o un deflect con éxito)             |
| Postura máx. jugador/duelista                           | 100 / 100          |                                                       |
| Regeneración                                            | 0.2/tick × vida%   | ×1.8 en guardia; pausa de 45 ticks tras daño          |
| Postura al atacante (deflect / perfecto)                | 70% / 110%         | del `postureDmg` del ataque                           |
| Postura propia (deflect / perfecto / bloqueo)           | 30% / 10% / 100%   |                                                       |
| Hitstop (perfecto / deflect / bloqueo / golpe / rotura) | 7 / 5 / 3 / 4 / 10 |                                                       |
| Ventana de remate                                       | 150                | Postura rota del enemigo                              |
| Aviso de lectura                                        | 12                 | Ticks antes del primer tick activo                    |

Nota de medición: el contacto real llega 1–2 ticks después del primer tick activo, porque la
hitbox barre en arco. El aviso queda por tanto a ~13–14 ticks del choque.

## Jugador

| Ataque      | Startup | Activo | Recovery | Vida | Postura | Golpe      | Cancelable a guardia |
| ----------- | ------- | ------ | -------- | ---- | ------- | ---------- | -------------------- |
| `atk_1`     | 7       | 4      | 16       | 12   | 14      | horizontal | ticks 11–27          |
| `atk_2`     | 7       | 4      | 16       | 12   | 14      | ascendente | ticks 11–27          |
| `atk_3`     | 12      | 4      | 24       | 18   | 22      | vertical   | ticks 16–40          |
| `deathblow` | 14      | 3      | 40       | —    | —       | estocada   | no                   |

## Duelista enmascarado (enemigo de prueba M2)

| Ataque               | Startup | Activo | Recovery | Vida | Postura | Llega por            | Respuesta correcta                                                     |
| -------------------- | ------- | ------ | -------- | ---- | ------- | -------------------- | ---------------------------------------------------------------------- |
| `e_slash`            | 26      | 5      | 26       | 20   | 22      | tu izquierda         | deflect                                                                |
| `e_rising`           | 15      | 5      | 28       | 18   | 20      | tu derecha, de abajo | deflect                                                                |
| `e_overhead`         | 32      | 4      | 30       | 26   | 30      | arriba               | deflect                                                                |
| `e_overhead_delayed` | 50      | 4      | 30       | 26   | 30      | arriba               | deflect **tarde**: no pulses al ver levantar el arma, espera al brillo |

Patrón en bucle (pausa = ventana para contraatacar):

| Paso | Combo                        | Pausa después |
| ---- | ---------------------------- | ------------- |
| 1    | tajo                         | 55            |
| 2    | tajo → ascendente            | 65            |
| 3    | vertical retardado           | 55            |
| 4    | tajo → ascendente → vertical | 85            |

Bloquea todo golpe tuyo mientras no ataca; tras 2 bloqueos seguidos contraataca sin esperar.
Con deflects perfectos se le rompe la postura en ~4–5 golpes; con deflects normales en ~6–7.

## Estado actual

Reloj de la simulación:

| Parámetro       | Valor  | Dónde               |
| --------------- | ------ | ------------------- |
| `tickRate`      | 60 Hz  | `src/config/sim.ts` |
| `maxSubSteps`   | 5      | `src/config/sim.ts` |
| `maxFrameDelta` | 0.25 s | `src/config/sim.ts` |

## Plantilla por ataque (a rellenar desde M2)

| Campo              | Valor | Nota                                         |
| ------------------ | ----- | -------------------------------------------- |
| `id`               |       |                                              |
| `startupTicks`     |       | Debe ser legible: ≥ 12 en ataques normales   |
| `activeTicks`      |       |                                              |
| `recoveryTicks`    |       | Castigo si fallas                            |
| `vitalityDmg`      |       |                                              |
| `postureDmg`       |       |                                              |
| `kind`             |       | normal / sweep / thrust / grab               |
| Respuesta correcta |       | Deflect / saltar / contra-esquiva / esquivar |

## Movesets

### Jugador

Pendiente (M2).

### Enemigo común

Pendiente (M4).

### Jefe

Pendiente (M8). Cada ataque documentado con sus ticks y su respuesta correcta.
