import type { Migration } from '../migrationRunner.js'
import { migration001 } from './001_create_users_table.js'
import { migration002 } from './002_create_tenant_tables.js'

export const migrations: Migration[] = [migration001, migration002]
