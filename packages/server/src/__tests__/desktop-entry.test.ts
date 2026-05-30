/**
 * Verification tests for desktop-entry.ts — Task 2.3
 *
 * Ensures the desktop server path is completely free of multi-tenant
 * authentication dependencies:
 * - No PostgreSQL connection pool
 * - No tenant-scoped repositories
 * - No CSRF middleware
 * - No auth middleware
 * - No socket auth handshake
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const desktopEntryPath = join(__dirname, '..', 'desktop-entry.ts')
const desktopEntrySource = readFileSync(desktopEntryPath, 'utf-8')

describe('desktop-entry.ts — multi-tenant auth removal verification', () => {
  describe('No PostgreSQL dependencies (Requirement 4.4)', () => {
    it('does not import from db/pool', () => {
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\/db\/pool/)
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\.\/db\/pool/)
    })

    it('does not import from db/envValidation', () => {
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\/db\/envValidation/)
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\.\/db\/envValidation/)
    })

    it('does not import from db/repositories', () => {
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\/db\/repositories/)
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\.\/db\/repositories/)
    })

    it('does not call createPool()', () => {
      expect(desktopEntrySource).not.toMatch(/createPool\s*\(/)
    })

    it('does not reference pg or PostgreSQL', () => {
      expect(desktopEntrySource).not.toMatch(/import.*from\s+['"]pg['"]/)
    })
  })

  describe('No tenant-scoped repositories (Requirement 4.4)', () => {
    it('does not call createTenantRepositories()', () => {
      expect(desktopEntrySource).not.toMatch(/createTenantRepositories\s*\(/)
    })

    it('does not instantiate UserRepository', () => {
      expect(desktopEntrySource).not.toMatch(/new\s+UserRepository\s*\(/)
    })

    it('does not import ConfigService from services (uses inline DesktopConfigService)', () => {
      // Should not have a runtime import of ConfigService (type-only is fine in route files)
      expect(desktopEntrySource).not.toMatch(/import\s+\{[^}]*ConfigService[^}]*\}\s+from\s+['"]\.\/services\/ConfigService/)
    })
  })

  describe('No CSRF middleware (Requirement 4.2)', () => {
    it('does not import csrfMiddleware', () => {
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\/auth\/csrfMiddleware/)
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\.\/auth\/csrfMiddleware/)
    })

    it('does not call registerCsrfGuard()', () => {
      expect(desktopEntrySource).not.toMatch(/registerCsrfGuard\s*\(/)
    })

    it('does not register fastify-cookie (required for CSRF)', () => {
      expect(desktopEntrySource).not.toMatch(/fastifyCookie/)
      expect(desktopEntrySource).not.toMatch(/@fastify\/cookie/)
    })
  })

  describe('No auth middleware (Requirement 4.1)', () => {
    it('does not import authMiddleware', () => {
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\/auth\/authMiddleware/)
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\.\/auth\/authMiddleware/)
    })

    it('does not call registerAuthMiddleware()', () => {
      expect(desktopEntrySource).not.toMatch(/registerAuthMiddleware\s*\(/)
    })

    it('does not import authRoutes', () => {
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\/auth\/authRoutes/)
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\.\/auth\/authRoutes/)
    })
  })

  describe('No socket auth handshake (Requirement 4.3)', () => {
    it('does not import socketAuthMiddleware', () => {
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\/auth\/socketAuthMiddleware/)
      expect(desktopEntrySource).not.toMatch(/from\s+['"]\.\.\/auth\/socketAuthMiddleware/)
    })

    it('does not call io.use(socketAuthMiddleware) in executable code', () => {
      // Remove comments from source before checking
      const sourceWithoutComments = desktopEntrySource
        .replace(/\/\/.*$/gm, '') // remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // remove multi-line comments
      expect(sourceWithoutComments).not.toMatch(/io\.use\s*\(\s*socketAuthMiddleware\s*\)/)
    })
  })

  describe('Desktop userId assignment (Requirement 4.5)', () => {
    it('assigns a fixed userId to every request via onRequest hook', () => {
      // Verify the onRequest hook pattern exists
      expect(desktopEntrySource).toMatch(/addHook\s*\(\s*['"]onRequest['"]/)
      expect(desktopEntrySource).toMatch(/request\.userId\s*=/)
    })

    it('uses a constant DESKTOP_USER_ID', () => {
      expect(desktopEntrySource).toMatch(/DESKTOP_USER_ID/)
    })
  })

  describe('Route files do not internally import auth modules', () => {
    const routeFiles = ['config.ts', 'media.ts', 'archive.ts']

    for (const routeFile of routeFiles) {
      it(`${routeFile} does not have runtime imports from auth/`, () => {
        const routePath = join(__dirname, '..', 'routes', routeFile)
        const routeSource = readFileSync(routePath, 'utf-8')

        // Runtime imports (not type-only) from auth modules would break desktop mode
        // Type-only imports are fine as they're erased at compile time
        const runtimeAuthImports = routeSource.match(
          /^import\s+\{[^}]*\}\s+from\s+['"]\.\.\/auth\//gm
        )

        // Filter out type-only imports
        const problematicImports = runtimeAuthImports?.filter(
          (imp) => !imp.startsWith('import type')
        )

        expect(problematicImports ?? []).toEqual([])
      })
    }
  })

  describe('Socket handlers do not import auth modules', () => {
    it('handlers.ts has no runtime imports from auth/', () => {
      const handlersPath = join(__dirname, '..', 'socket', 'handlers.ts')
      const handlersSource = readFileSync(handlersPath, 'utf-8')

      const runtimeAuthImports = handlersSource.match(
        /^import\s+\{[^}]*\}\s+from\s+['"]\.\.\/auth\//gm
      )

      const problematicImports = runtimeAuthImports?.filter(
        (imp) => !imp.startsWith('import type')
      )

      expect(problematicImports ?? []).toEqual([])
    })

    it('overlayHandlers.ts has no runtime imports from auth/', () => {
      const handlersPath = join(__dirname, '..', 'socket', 'overlayHandlers.ts')
      const handlersSource = readFileSync(handlersPath, 'utf-8')

      const runtimeAuthImports = handlersSource.match(
        /^import\s+\{[^}]*\}\s+from\s+['"]\.\.\/auth\//gm
      )

      const problematicImports = runtimeAuthImports?.filter(
        (imp) => !imp.startsWith('import type')
      )

      expect(problematicImports ?? []).toEqual([])
    })
  })
})
