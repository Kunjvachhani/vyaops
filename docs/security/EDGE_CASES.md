# Edge Cases & Safety

## Destructive Action Protection (7 Layers)
1. Explicit confirmation (type "DELETE 047", not single tap)
2. Soft delete only (deleted_at timestamp, never hard delete)
3. 30-minute undo window
4. Audit trail (every mutation logged)
5. Admin recovery (we can restore any record)
6. Daily database backups (30-day retention)
7. Bulk action protection (WhatsApp bot refuses bulk deletes)

## Recovery Tiers (who can restore a soft-deleted record)
1. **In-app undo (owner/manager):** the "Deleted — [Undo]" toast restores within ~30s via
   `POST /api/admin/restore` (org-scoped to the caller's own org). See `src/lib/hooks/use-undoable-delete.ts`.
2. **Org owner recovery:** `GET /api/admin/deleted?table=...` lists their org's soft-deleted rows;
   `POST /api/admin/restore` restores them. Owner-only, strictly scoped to the owner's own org.
3. **Platform-admin cross-org recovery (S5):** a VyaOps platform maintainer (row in `platform_admins`)
   can pass `?org_id=<uuid>` to `/api/admin/deleted` and `org_id` in the `/api/admin/restore` body to
   view and restore records in ANY org. The `(admin)` panel's recovery page (`/admin/recovery`) drives
   this with an org + table selector. Platform admins must specify an explicit `org_id` (no implicit
   "their own org" default — a platform admin may not belong to any org). Every platform-admin restore
   writes `audit_log` with `changed_by_source = 'platform_admin'`.
   - Gate: `app_metadata.is_platform_admin` (fast middleware path) + `getPlatformAdmin()` DB lookup
     (authoritative). See `docs/security/RLS_POLICIES.md` → "Platform Admins".

## Specific Cases
- Duplicate orders: idempotency key check (org+customer+product+qty+date_hour)
- AI hallucination: eval gate < 0.7 → guided prompts, no auto-processing
- Voice notes: logged but not processed, reply "please type or use menu"
- Wrong production data: editable within 24h by manager/owner, then read-only
- Phone lost: web dashboard to disable WhatsApp, all data in cloud
- Payment fails: 7-day grace → downgrade to tier_1 → day 31 suspend → day 91 archive
- Message timeout: acknowledge webhook in <1s, process async
- Power outage during processing: idempotent workflows, DB transactions, auto-retry
