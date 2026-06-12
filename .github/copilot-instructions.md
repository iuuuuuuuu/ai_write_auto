# AI Novel Writer Development Guide

This is a Nuxt 4 / Vue 3 / Nitro full-stack application for AI-assisted novel writing. These notes are for AI coding agents working in this repository.

## Project Map

- `app/` contains the Nuxt frontend: pages, layouts, components, composables, plugins, and CSS.
- `server/api/` contains Nitro API route handlers.
- `server/database/` contains MikroORM entities, schema sync, and migration helpers.
- `server/services/` contains longer-running domain services such as RAG, embedding, task queue, backups, and generation context assembly.
- `server/utils/` contains shared backend utilities, including auth, AI client/config helpers, prompts, streaming, and parsing helpers.
- `shared/` contains domain constants and shared TypeScript data.
- `tests/` contains Vitest tests.
- `docs/` contains design notes and operational guidance. Link to these docs instead of copying their content.
- `browser-act/` is a separate tool/subproject area. Do not treat its `.github` folder, docs, or dependencies as root project conventions.

## Tech Stack

- Nuxt `4.x`, Vue `3.5.x`, TypeScript, Nitro server routes.
- Naive UI through `@bg-dev/nuxt-naiveui`.
- Tailwind CSS v4 through `@tailwindcss/vite`; global CSS is in `app/assets/css/main.css`.
- MikroORM 6 with SQLite/LibSQL and MySQL support.
- Zod for request body validation.
- Vitest for tests.
- AI providers use OpenAI-compatible chat completion endpoints with project utilities around streaming, token usage, model capabilities, and generation task tracking.

## Frontend Conventions

- Use Vue 3 Composition API with `<script setup lang="ts">` for Vue SFCs.
- Keep SFC block order as script, template, then style.
- Use Naive UI form components (`NForm`, `NFormItem`, inputs, switches, selects) for editable business forms. Show visible validation and user-facing success/failure messages.
- Prefer existing composables in `app/composables/` before adding new local state machinery.
- Use `useApi()` for normal JSON API calls when existing code does; use AI stream composables for streaming endpoints.
- Respect existing theme tokens and utility class style. Avoid unrelated UI redesigns while fixing behavior.
- Nuxt auto-imported component names include directory prefixes. For example `app/components/novel/GenerationContextPreview.vue` auto-registers as `NovelGenerationContextPreview`; use an explicit import if the template intentionally uses the bare name.
- Do not edit `.nuxt/`, `.output/`, `node_modules/`, `data/`, or other generated/runtime output unless the task explicitly targets them.

## Server And API Conventions

- Nitro route handlers live under `server/api/` and should use existing helper patterns.
- Validate request bodies with Zod for non-trivial inputs.
- Use `requireAuth(event)` or `requireAdmin(event)` for protected endpoints.
- Use `useEm(event)` for the request-scoped MikroORM EntityManager.
- Scope user data by `auth.userId`; do not trust client-provided user identifiers.
- Prefer existing helpers for pagination, integer params, API errors, and response shapes.
- Keep endpoint changes narrow. Do not change public API contracts unless the UI and tests are updated together.

## Database Conventions

- MikroORM entity definitions are centralized in `server/database/entities/index.ts`.
- Schema sync is intentionally safe and non-destructive. See `server/database/schema-sync.ts`.
- When adding or changing persisted fields:
  - update the entity definition;
  - bump `DATABASE_SCHEMA_VERSION` in `server/database/schema-sync.ts`;
  - add any required compatibility/backfill logic there;
  - update `docs/database-migrations.md` with the new schema version and affected tables.
- Do not add destructive ad hoc migrations, raw table drops, or local-only DB assumptions.
- Runtime DB configuration lives in `data/db-config.json`; never hardcode local credentials or secrets.

## AI Generation Conventions

- Model resolution and runtime request parameters should flow through `server/utils/ai-configs.ts`, `server/utils/ai-model-capabilities.ts`, and `server/utils/ai-client.ts`.
- Preserve the configuration layering: request override, novel default, user purpose config, then model capability defaults.
- Use `toAiOptions()` so `temperature`, `top_p`, thinking controls, max tokens, model IDs, and provider credentials stay consistent.
- Single-chapter generation must go through the chapter workflow plan gate: generate a structured plan, persist it in `chapter_workflow_plans`, accept the plan, then pass the accepted `workflowPlanId` to `/api/ai/generate`. Do not reintroduce hidden outline creation or batch正文 generation paths.
- Chapter generation and regeneration paths should preserve task tracking, token usage recording, SSE streaming, and truncation/continuation behavior.
- Context assembly belongs in `server/services/chapter-context.ts`, `server/services/generation-context.ts`, and related helpers. Do not bypass RAG/soft-delete filters when changing generation prompts.
- Keep JSON salvage, thinking stripping, streaming timeout, and token accounting behavior intact unless tests and callers are updated deliberately.
- For models with `samplingLockedWhenThinking`, UI and backend behavior should make it clear that custom `temperature` and `top_p` overrides are ignored while thinking is enabled.

## Testing And Validation

Common commands:

```bash
pnpm dev
pnpm test:run
pnpm test:run tests/<target>.test.ts
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

Notes:

- The dev server is configured for `http://localhost:4530`.
- `vitest.config.ts` sets `fileParallelism: false` because parallel workers can share MikroORM/libsql state and contaminate each other. Do not remove this without proving the database test isolation issue is solved.
- Prefer focused tests after small changes, then broader checks for shared AI, database, or generation utilities.
- Use browser verification for frontend behavior changes when a page is already running.

## Important Docs

Read these before changing the related areas:

- Database schema sync, migration, backup, and restore: `docs/database-migrations.md`
- AI generation quality and continuity plans: `docs/generation-quality-plan.md`
- Agentic retrieval and tool-loop design: `docs/agentic-retrieval-refactor-plan.md`
- MCP and writing skill product design: `docs/mcp-skill-integration-design.md`
- Reducing generic AI prose style: `docs/reduce-ai-flavor-plan.md`

## Safety And Repository Hygiene

- Do not commit secrets, API keys, local database files, backups, build output, or dependency directories.
- Treat `.env`, `data/*.db`, `data/backups/`, `.nuxt/`, `.output/`, and `node_modules/` as runtime/generated material.
- Do not revert unrelated user changes in a dirty worktree.
- Keep edits scoped to the requested behavior. Mention unrelated issues instead of opportunistically refactoring them.
- If a task modifies project-wide conventions, shared API contracts, database schema, or validation commands, update this file or the relevant `docs/` file in the same change.
