# Data Alignment Engine — 5 Layers

## The Challenge
Messages like: "rajubhai no order 500 piece valve body kal deliver"
Mixed Gujarati/Hindi/Hinglish/English, misspellings, abbreviations, no punctuation.

## Layer 1: Language Detection + Normalization
DeepSeek V4 Pro detects language, expands abbreviations (pcs→pieces, qty→quantity), normalizes common misspellings. System prompt includes manufacturing vocabulary in Gujarati/Hindi/English.

## Layer 2: Intent Classification
Categories: NEW_ORDER, ORDER_STATUS, VENDOR_ORDER, PRODUCTION_UPDATE, INVOICE_REQUEST, PAYMENT_UPDATE, INVENTORY_CHECK, COMPLIANCE_QUERY, GENERAL_QUERY
Returns: { intent, confidence }

## Layer 3: Entity Extraction
Extracts: customer_name_raw, product_raw, quantity, unit, price, date, defect_type
Returns structured JSON with raw extracted values.

## Layer 4: Fuzzy Matching
Matches raw names against master data using:
- Levenshtein distance (spelling similarity)
- Phonetic matching (Soundex/Metaphone for Indian names)
- Alias table lookup (stored in customers.aliases, vendors.aliases, products.aliases)
- Confidence scoring: >85% auto-match, <85% confirm with owner

## Layer 5: Confirmation Gate
Sends structured confirmation to owner. Owner confirms/edits/rejects.
Corrections feed into alias table + eval benchmark.

## Guided Prompts Bypass Layers 1-4
When owner uses buttons/lists/flows, data arrives pre-structured. Only Layer 5 applies.
