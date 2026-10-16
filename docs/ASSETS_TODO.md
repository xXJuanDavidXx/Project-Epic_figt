# ASSETS TODO

Assets pendientes. Cada entrada: qué es, para qué se usa, prioridad y qué placeholder lo cubre
mientras tanto. El desarrollo nunca se bloquea esperando arte (regla 8 de CLAUDE.md).

Prioridad: **P0** bloquea el milestone · **P1** necesario para que se sienta bien · **P2** pulido.

## Modelos

| Asset              | Uso                              | Prioridad | Milestone | Placeholder actual    |
| ------------------ | -------------------------------- | --------- | --------- | --------------------- |
| Jugador rigged     | Personaje principal + hitboxes   | P0        | M5        | Cápsula greybox       |
| Katana del jugador | Anclada al hueso `weapon_r`      | P0        | M5        | Caja alargada         |
| Enemigo común      | 3 variantes del moveset base     | P1        | M4/M5     | Cápsula de otro color |
| Mini-jefe          | Zona de M7                       | P2        | M7        | Cápsula escalada      |
| Jefe final         | 2 fases                          | P2        | M8        | Cápsula escalada      |
| Props de nivel     | Tejados, muros, puntos de gancho | P2        | M7        | Cubos                 |

## Animaciones

Convención de clips (sección 9 de CLAUDE.md): `idle, run, sprint, jump_start, jump_loop, land,
dodge_f/b/l/r, guard_idle, deflect_1, deflect_2, atk_1..atk_5, hit_react, guard_break, deathblow,
death, grapple_throw, crouch_idle, crouch_walk`.

| Grupo                      | Prioridad | Milestone | Nota                                                     |
| -------------------------- | --------- | --------- | -------------------------------------------------------- |
| Locomoción (idle/run/...)  | P0        | M5        | Mixamo sirve para prototipar                             |
| Ataques `atk_1..atk_5`     | P0        | M5        | Los ticks de startup/active/recovery los manda el diseño |
| `deflect_1/2`, `guard_*`   | P0        | M5        | El impacto debe caer en el frame exacto de la ventana    |
| `guard_break`, `deathblow` | P1        | M5        | Momentos de cámara                                       |
| Moveset del jefe           | P2        | M8        | Documentar cada ataque en COMBAT_TUNING.md               |

## VFX

| Asset                       | Uso                      | Prioridad | Milestone | Placeholder                                                         |
| --------------------------- | ------------------------ | --------- | --------- | ------------------------------------------------------------------- |
| Chispas de deflect          | Feedback del deflect     | P0        | M2        | Sprites/puntos                                                      |
| Trail de la katana          | Legibilidad del swing    | P1        | M2        | —                                                                   |
| Indicador de peligro propio | Aviso de ataque perilous | P0        | M3        | Triángulo rojo (diseño original, nunca el kanji del juego original) |
| Marca de remate             | Postura rota             | P1        | M2        | Círculo sobre la cabeza                                             |

## Audio

| Asset                      | Prioridad | Milestone | Placeholder            |
| -------------------------- | --------- | --------- | ---------------------- |
| Golpe a carne              | P0        | M2        | Tono sintetizado grave |
| Bloqueo                    | P0        | M2        | Tono medio             |
| Deflect / deflect perfecto | P0        | M2        | Tono metálico agudo    |
| Rotura de postura          | P0        | M2        | Impacto sintetizado    |
| Aviso de perilous          | P0        | M3        | Campana sintetizada    |
| Pasos / ambiente / música  | P2        | M7/M8     | —                      |

## UI

| Asset              | Prioridad | Milestone | Placeholder          |
| ------------------ | --------- | --------- | -------------------- |
| Barra de vitalidad | P0        | M2        | Rectángulo CSS       |
| Barra de postura   | P0        | M2        | Rectángulo CSS       |
| Tipografía del HUD | P2        | M8        | Monoespaciada del SO |
