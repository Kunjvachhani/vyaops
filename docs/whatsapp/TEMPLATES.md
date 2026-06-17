# WhatsApp Message Templates

## Templates must be pre-approved by Meta before use.
Submit via Meta Business Suite → WhatsApp Manager → Message Templates. Approval takes 1-24 hours.

## Template List (submit in Sprint 1)

### Utility Templates (₹0.145/message)
1. order_confirmation: "✅ Order #{order_number} confirmed. {product} {qty}pc for {customer}. Delivery: {date}."
2. invoice_generated: "🧾 Invoice #{invoice_number} generated for {customer}. Amount: ₹{amount}. Due: {date}. [View PDF]"
3. payment_received: "💰 Payment of ₹{amount} received from {customer} for Invoice #{invoice_number}. Thank you!"
4. production_logged: "✅ Batch #{batch} logged. {qty} produced, {rejected} rejected ({rate}%). {defect_note}"
5. inventory_alert: "⚠️ Low stock: {item} — {qty} {unit} remaining ({days} days supply). Reorder? [Yes/No]"
6. order_completed: "✅ Order #{order_number} complete! {qty}pc {product} ready. Generate invoice? [Yes/No]"

### Marketing Templates (₹0.86-1.09/message — use sparingly)
7. daily_morning_summary: "🏭 Good morning! Today's plan: {summary}..."
8. daily_evening_summary: "📊 Today's wrap: {summary}..."
9. payment_reminder: "⏰ Reminder: Invoice #{invoice_number} for {customer}, ₹{amount}, {days} days overdue."
10. compliance_reminder: "📋 Upcoming: {task_name} due on {date}. Status: {status}."

### Tiered Payment Reminders — Utility category (used by n8n/workflows/payment-reminder.json)
**Category: utility** (NOT marketing). Submit each of the four to Meta as a
**Utility** template. Rationale: a payment reminder is a transactional
notification about an existing invoice/order relationship the customer already
has with the business — under Meta's template category guidelines that qualifies
as utility, not marketing. Practical consequences of utility classification:
  - No marketing opt-in required to send.
  - Not subject to Meta's per-user marketing-frequency cap.
  - Priced at the utility rate (₹0.145/message), not the marketing rate.
Keep the copy strictly transactional (invoice number, amount, days overdue, a
payment ask) — promotional language would get them re-categorised as marketing.

Escalation by days overdue. All four share the SAME 4 body variables in this order:
{{1}} customer, {{2}} invoice_number, {{3}} amount, {{4}} days overdue.
The overdue endpoint (`GET /api/invoices/overdue`) picks the template per tier.
9a. payment_reminder_gentle (1–3 days):  "🙏 Gentle reminder, {{1}}: Invoice #{{2}} for ₹{{3}} is {{4}} days overdue. Kindly arrange payment."
9b. payment_reminder_followup (4–7 days): "🔔 Follow-up, {{1}}: Invoice #{{2}} (₹{{3}}) is now {{4}} days overdue. Please clear it at the earliest."
9c. payment_reminder_urgent (8–14 days):  "⚠️ Urgent, {{1}}: Invoice #{{2}} of ₹{{3}} is {{4}} days overdue. Please make payment to avoid disruption."
9d. payment_reminder_final (15+ days):     "🚨 Final notice, {{1}}: Invoice #{{2}} (₹{{3}}) is {{4}} days overdue. Immediate payment is required."

### Authentication Templates (₹0.145/message)
11. otp_verification: "Your VyaOps verification code: {otp}. Valid for 10 minutes."

## Template Variables
Use {{1}}, {{2}}, etc. in Meta template format. Map to actual data at send time.
Include fallback values for all variables.

## Template Language
Submit each template in: English, Hindi, Gujarati.
Meta approves per-language. Some may need rewording for approval.
