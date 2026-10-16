# epic_fights

Juego de acción 3D en tercera persona para navegador: duelos de katana basados en ritmo
(desviar en el momento justo → romper la postura → rematar). Contenido original.

La especificación completa y las reglas de trabajo están en [`CLAUDE.md`](./CLAUDE.md).

## Arranque

```bash
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Script              | Qué hace                                   |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Servidor de desarrollo con HMR             |
| `npm run build`     | Typecheck + build de producción            |
| `npm run typecheck` | `tsc --noEmit`                             |
| `npm run test`      | Tests de lógica (Vitest)                   |
| `npm run lint`      | ESLint con reglas type-checked             |
| `npm run check`     | Typecheck + tests + lint (antes de commit) |

## Estado

Ver [`docs/PROGRESS.md`](./docs/PROGRESS.md). Milestone actual: **M0 — Esqueleto**.
