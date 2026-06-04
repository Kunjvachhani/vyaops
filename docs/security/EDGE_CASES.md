# Edge Cases & Safety

## Destructive Action Protection (7 Layers)
1. Explicit confirmation (type "DELETE 047", not single tap)
2. Soft delete only (deleted_at timestamp, never hard delete)
3. 30-minute undo window
4. Audit trail (every mutation logged)
5. Admin recovery (we can restore any record)
6. Daily database backups (30-day retention)
7. Bulk action protection (WhatsApp bot refuses bulk deletes)

## Specific Cases
- Duplicate orders: idempotency key check (org+customer+product+qty+date_hour)
- AI hallucination: eval gate < 0.7 → guided prompts, no auto-processing
- Voice notes: logged but not processed, reply "please type or use menu"
- Wrong production data: editable within 24h by manager/owner, then read-only
- Phone lost: web dashboard to disable WhatsApp, all data in cloud
- Payment fails: 7-day grace → downgrade to tier_1 → day 31 suspend → day 91 archive
- Message timeout: acknowledge webhook in <1s, process async
- Power outage during processing: idempotent workflows, DB transactions, auto-retry
