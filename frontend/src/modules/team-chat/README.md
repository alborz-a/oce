# team-chat

Company, project, group and direct chat inside OCE. Backend: `backend/app/modules/team_chat` (REST `/api/v1/team-chat/`,
WebSocket `/api/v1/team-chat/ws/`).

Paths found while building it (2.1):

- module contract: `src/modules/_types.ts`, `src/modules/_registry.ts`, `src/modules/MODULE_DEVELOPMENT_GUIDE.md`
- sidebar: a manifest `navItems` entry with `group: 'grp_communication'` (group ids live in `src/app/layout/navCatalog.ts`)
- project page: `src/features/projects/ProjectDetailPage.tsx` (header buttons next to "Settings")
- Persian strings: bundled in `manifest.ts` (`translations.fa`), merged by the module system (no separate `fa` file)
- Jalali dates: `src/shared/lib/jalali.ts`; WebSocket helpers: `src/shared/lib/socketAuth.ts`

## Shared files touched (check these on every upstream merge)

1. `src/modules/_registry.ts` - import and list `team-chat/manifest`.
2. `src/features/projects/ProjectDetailPage.tsx` - one button «گفتگوی پروژه» (`data-testid="project-chat-button"`).

Everything else is inside this folder. Chat attachments use the existing documents API
(`features/documents/api.ts` `uploadDocument` / `fetchDocuments`), so files follow the documents storage backend.
Uploading from the composer is offered in project rooms only (company/group/DM rooms can show documents
linked by the importer).
