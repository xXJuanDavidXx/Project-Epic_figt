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

## Estado actual

**M0 cerrado.** Todavía no hay valores de combate: el milestone solo monta el reloj determinista
que los hará reproducibles.

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
