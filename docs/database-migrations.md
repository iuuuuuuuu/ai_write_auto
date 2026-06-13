# Database Migration Baseline

This project uses MikroORM as the database abstraction layer for SQLite/LibSQL and MySQL.

## Current Baseline

- Schema version: `2026.06.10.006`
- Schema sync entry point: `server/database/schema-sync.ts`
- Entity definitions: `server/database/entities/index.ts`
- Runtime database config: `data/db-config.json`
- Startup database plugin: `server/plugins/database.ts`
- Setup initialization endpoint: `server/api/setup/init.post.ts`
- Migration plan helper: `server/database/migration-plan.ts`
- Data migration executor: `server/database/migration-executor.ts`
- Current database preflight API: `server/api/settings/migration-plan.get.ts`
- Target database preflight API: `server/api/settings/migration-target.post.ts`
- Data migration API: `server/api/settings/migration-execute.post.ts`
- Data migration validation API: `server/api/settings/migration-validate.post.ts`
- Migration switch API: `server/api/settings/migration-switch.post.ts`
- SQLite backup API: `server/api/settings/backup.ts`
- SQLite backup service: `server/services/database-backup.ts`

The application performs a safe schema sync with:

```ts
generator.updateSchema({ safe: true, dropTables: false })
```

This keeps startup/setup compatible with self-hosted installs while avoiding destructive table drops.

## Tracking

Schema sync writes these records:

- `schema_migrations.version`
- `schema_migrations.source`
- `schema_migrations.applied_at`
- `site_config.schema_version`
- `site_config.schema_last_synced_at`
- `site_config.schema_sync_source`

SQLite backup settings also use `site_config`:

- `backup_max_count`
- `backup_auto_on_startup`

## Schema Notes

- `2026.06.10.006`: adds `ai_models.context_window_tokens` with a default of `32768` so generation can budget model input and output separately from the existing maximum output token limit.

## Adding A Schema Change

1. Update the MikroORM entity in `server/database/entities/index.ts`.
2. Bump `DATABASE_SCHEMA_VERSION` in `server/database/schema-sync.ts`.
3. Verify SQLite setup/startup creates or updates the expected columns.
4. Verify MySQL setup/startup creates or updates the expected columns.
5. Add a note to this file with the schema version and changed tables.

## Data Migration Guidance

For data migrations between SQLite and MySQL, do not copy raw database files. Use the database migration flow:

1. Generate a source plan with `collectDatabaseMigrationPlan`.
2. Test the target database connection.
3. Sync the target schema with `syncDatabaseSchema`.
4. Refuse migration if the target database has existing business rows.
5. Copy known application tables in dependency order.
6. Preserve primary keys and foreign-key values by inserting raw table rows.
7. Validate source and inserted row counts per table.
8. Create a backup before switching the active `data/db-config.json`.

## Migration Plan Helper

`server/database/migration-plan.ts` provides a read-only manifest for migration preflight checks:

- Dialect and sanitized database label.
- Generated timestamp.
- Known application tables.
- Per-table row counts.
- Per-table availability and error message.
- Total migratable row count.

This helper does not copy or mutate data. It powers the admin preflight API, target preflight API, and migration executor checks.

## Target Database Preflight

`POST /api/settings/migration-target` accepts a target database config and returns a preflight result.

Safety rules:

- Admin only.
- Rejects the request when the target config points to the current database.
- Tests the target connection before collecting table metadata.
- Does not copy data.
- Does not switch the active `data/db-config.json`.
- Only runs `syncDatabaseSchema` against the target when `syncSchema` is explicitly true.

The settings page uses this endpoint to preview a target database before running a real migration.

## Data Migration Execution

`POST /api/settings/migration-execute` accepts a target database config and `confirmEmptyTarget: true`.

Safety rules:

- Admin only.
- Rejects the request when the target config points to the current database.
- Tests the target connection before opening the target ORM.
- Always runs safe target schema sync before copying data.
- Refuses to copy when the target database has business rows.
- Allows only schema metadata tables (`schema_migrations`, `site_config`) to contain rows before copying, and clears them before inserting source rows.
- Copies raw table rows in the `MIGRATION_TABLES` order so existing IDs and relation columns are preserved.
- Returns source, target-before, target-after, and per-table inserted row counts.
- Does not switch the active `data/db-config.json`.

The settings page exposes this as an explicit action after target preflight. The user must confirm that the target database has no business data before the button is enabled.

## Data Migration Validation

`POST /api/settings/migration-validate` accepts a target database config and compares the current database with the target database.

Safety rules:

- Admin only.
- Rejects validation when the target config points to the current database.
- Tests the target connection before collecting target metadata.
- Reads source and target table plans with `collectDatabaseMigrationPlan`.
- Compares every table in `MIGRATION_TABLES` by availability, row count, and SHA-256 content hash.
- Normalizes row object keys before hashing so equivalent rows hash consistently across supported drivers.
- Returns matched tables, mismatches, source plan, target plan, row count match status, and content hash match status.
- Does not copy data, mutate schema, or switch `data/db-config.json`.

The settings page exposes this action after a successful migration result so the user can validate the target before switching the active database.

## Switching Active Database

`POST /api/settings/migration-switch` accepts a target database config and `confirmSwitch: true`.

Safety rules:

- Admin only.
- Tests the target connection before writing `data/db-config.json`.
- Runs safe schema sync on the target before switching.
- Refuses to switch when the target database has no user rows, which prevents switching to an empty schema-only database.
- Closes the current ORM, writes the target config, initializes the target ORM, and runs schema sync again as the active database.
- Returns whether the target was already active and a target plan snapshot.

The settings page only exposes this action after a successful migration result and requires a second explicit confirmation.

## Database Backup And Restore

`/api/settings/backup` manages local database backup files under `data/backups`.

Supported methods:

- `GET`: list local `.db` and `.mysql.json` backups with type, name, size, and creation time.
- `POST`: create a new backup of the current database and keep the newest configured backups.
- `PATCH`: update backup settings, including retained backup count and startup auto-backup.
- `PUT`: restore a named backup. Before restore, the endpoint creates a `pre-restore-*` safety backup of the current database.

Safety rules:

- Admin only.
- SQLite backups are file copies with `.db` extension.
- MySQL backups are logical JSON exports with `.mysql.json` extension.
- Retained backup count is clamped between 1 and 30.
- Backup names are normalized with `basename` and must end with `.db` or `.mysql.json`.
- Startup auto-backup runs only after the active SQLite ORM initializes and schema sync completes.
- SQLite restore closes the active ORM, copies the selected backup over the active SQLite file, reinitializes the ORM, and runs safe schema sync.
- MySQL restore disables foreign-key checks, clears known migration tables, inserts backup rows in migration order, reenables foreign-key checks, and runs safe schema sync.

The settings page exposes backup creation, refresh, restore actions, retained backup count, and startup auto-backup. Restore requires a confirmation dialog.

## Versions

### 2026.06.10.005

- Added `chapter_workflow_plans` to persist single-chapter workflow plan snapshots, validation issues, optional AI judge output, acceptance status, and linked generation tasks.
- Added `chapter_workflow_plans` to the SQLite/MySQL migration table manifest so accepted workflow plans are copied during database migration.

### 2026.05.21.001

- Added schema sync baseline.
- Added `schema_migrations` tracking table.
- Added `site_config` schema sync metadata keys.
- Added read-only migration plan helper.
- Added current and target database preflight APIs.
- Added empty-target data migration executor and admin execution API.
- Added post-migration row count/content hash validation API and settings page validation report.
- Added manual active database switch API and settings page switch action.
- Added SQLite/MySQL backup list/create/restore/settings API, retained backup count, startup auto-backup, and settings page backup management.
