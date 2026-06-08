# @ieom/shared

Shared types and contracts for the IEOM ecosystem (ieom-api, ieom-front, Interactive-Experience-Overlay).

## Install

```bash
# .npmrc (in consuming repo)
@ieom:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GH_TOKEN}

# package.json
"@ieom/shared": "^1.0.0"
```

## Usage

```ts
// Core types
import type { Room, SignalingMessage } from '@ieom/shared';

// Cloud (overlay-only) types
import type { CloudWebhook } from '@ieom/shared/cloud';
```

## Build

```bash
pnpm install
pnpm --filter @ieom/shared build
```

## Publish

The package is published automatically to GitHub Packages via `.github/workflows/publish-shared.yml` when changes land on `main`.

Manual publish:
```bash
pnpm --filter @ieom/shared build
pnpm --filter @ieom/shared publish
```

## Versioning

- **patch**: bugfixes, internal refactors, no breaking changes
- **minor**: new optional fields, new exports
- **major**: breaking changes (require coordinated update in ieom-api)

## Repository

[damzts/Interactive-Experience-Overlay](https://github.com/damzts/Interactive-Experience-Overlay/tree/main/packages/shared)
