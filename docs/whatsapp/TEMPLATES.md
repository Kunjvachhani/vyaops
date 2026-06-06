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

### Authentication Templates (₹0.145/message)
11. otp_verification: "Your VyaOps verification code: {otp}. Valid for 10 minutes."

## Template Variables
Use {{1}}, {{2}}, etc. in Meta template format. Map to actual data at send time.
Include fallback values for all variables.

## Template Language
Submit each template in: English, Hindi, Gujarati.
Meta approves per-language. Some may need rewording for approval.
