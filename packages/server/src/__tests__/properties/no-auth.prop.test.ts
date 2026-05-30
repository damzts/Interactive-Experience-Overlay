/**
 * Property 2: No Authentication in Desktop Mode
 *
 * For any HTTP route and any Socket.IO namespace, requests without auth
 * SHALL be accepted and processed normally (no 401, 403, or connection rejection).
 *
 * This is a static analysis property test — verifying the code structure
 * guarantees the property holds for all routes and namespaces.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import fc from 'fast-check'

const __dirname = dirname(fileURLToPath(import.meta.url))
const desktopEntryPath = join(__dirname, '..', '..', 'desktop-entry.ts')

let desktopEntrySource: string

beforeAll(() => {
  desktopEntrySource = readFileSync(desktopEntryPath, 'utf-8')
})

describe('Property 2: No Authentication in Desktop Mode', () => {
  describe('Static analysis: no authMiddleware registration', () => {
    it('for any arbitrary route name, authMiddleware is never registered in the source', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz/-_'.split('')), { minLength: 1, maxLength: 30 }),
          (routeName: string) => {
            // The source must not contain authMiddleware registration regardless of route
            expect(desktopEntrySource).not.toMatch(/registerAuthMiddleware\s*\(/)
            expect(desktopEntrySource).not.toMatch(/import\s+\{[^}]*authMiddleware[^}]*\}\s+from/)
            // The route name itself doesn't appear as a guarded route
            // (no auth guard pattern exists at all)
            const sourceWithoutComments = desktopEntrySource
              .replace(/\/\/.*$/gm, '')
              .replace(/\/\*[\s\S]*?\*\//g, '')
            expect(sourceWithoutComments).not.toMatch(/authMiddleware/)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Static analysis: no socketAuthMiddleware usage', () => {
    it('for any arbitrary namespace name, socketAuthMiddleware is never applied', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz/-_'.split('')), { minLength: 1, maxLength: 20 }),
          (namespace: string) => {
            // Remove comments to check only executable code
            const sourceWithoutComments = desktopEntrySource
              .replace(/\/\/.*$/gm, '')
              .replace(/\/\*[\s\S]*?\*\//g, '')

            // No socket auth middleware is applied regardless of namespace
            expect(sourceWithoutComments).not.toMatch(/io\.use\s*\(\s*socketAuthMiddleware\s*\)/)
            expect(sourceWithoutComments).not.toMatch(/\.use\s*\(\s*socketAuthMiddleware\s*\)/)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Static analysis: no csrfMiddleware registration', () => {
    it('for any arbitrary route name, CSRF middleware is never registered', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz/-_'.split('')), { minLength: 1, maxLength: 30 }),
          (routeName: string) => {
            // No CSRF middleware is registered regardless of route
            expect(desktopEntrySource).not.toMatch(/registerCsrfGuard\s*\(/)
            expect(desktopEntrySource).not.toMatch(/csrfMiddleware/)
            expect(desktopEntrySource).not.toMatch(/@fastify\/cookie/)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Static analysis: userId assigned without auth', () => {
    it('for any arbitrary route name, request.userId is assigned to DESKTOP_USER_ID without auth check', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz/-_'.split('')), { minLength: 1, maxLength: 30 }),
          (routeName: string) => {
            // The source DOES assign userId unconditionally via onRequest hook
            expect(desktopEntrySource).toMatch(/request\.userId\s*=\s*DESKTOP_USER_ID/)
            // The assignment is in an onRequest hook (applies to ALL routes)
            expect(desktopEntrySource).toMatch(/addHook\s*\(\s*['"]onRequest['"]/)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
