/**
 * WhatsApp-facing bot message strings in all three supported locales.
 *
 * These are used by the flow engine and interactive builders for messages
 * visible to the owner and customer in the WhatsApp chat. next-intl is not
 * available in the background-processing context (no request), so translations
 * live here as plain TypeScript — sourced from the org's language_preference.
 */

export type Locale = 'en' | 'hi' | 'gu'

export type BotStrings = {
  orderDraft: {
    title: string
    urgentSuffix: string
    customerLabel: string
    readyByLine: string
    instructions: string
  }
  modDraft: {
    title: string
    customerLabel: string
    productLabel: string
    ambiguousQuestion: (a: number, b: number) => string
    ambiguousInstructions: (a: number, b: number) => string
    addedLabel: (n: number) => string
    updatedLabel: string
    instructions: string
  }
  cancelDraft: {
    title: string
    orderLabel: string
    customerLabel: string
    producedWarning: (n: number) => string
    instructions: string
  }
  status: {
    header: string
    noOrders: string
    doneSuffix: (n: number) => string
    readyLabel: string
  }
  confirm: {
    newOrder: (orderNumber: string) => string
    readyBy: (date: string) => string
    cancelOrder: (orderNumber: string) => string
    modifyOrder: (orderNumber: string) => string
    newQuantity: (n: number) => string
  }
}

const STRINGS: Record<Locale, BotStrings> = {
  en: {
    orderDraft: {
      title: '📋 Order Draft',
      urgentSuffix: ' | Urgent',
      customerLabel: 'Customer',
      readyByLine: 'Ready by: — (reply "ok <date>" to set)',
      instructions: 'Reply "ok" to confirm · /cancel to discard',
    },
    modDraft: {
      title: '📋 Modification Draft',
      customerLabel: 'Customer',
      productLabel: 'Product',
      ambiguousQuestion: (a, b) => `Total ${a} or total ${b}?`,
      ambiguousInstructions: (a, b) => `Reply "ok ${a}" (add) · "ok ${b}" (replace) · /cancel`,
      addedLabel: (n) => `+${n} added`,
      updatedLabel: 'quantity updated',
      instructions: 'Reply "ok" to confirm · /cancel to discard',
    },
    cancelDraft: {
      title: '⚠️ Cancel Order?',
      orderLabel: 'Order',
      customerLabel: 'Customer',
      producedWarning: (n) => `⚠️ ${n} pcs already produced — this work will be wasted`,
      instructions: 'Reply YES to confirm cancellation · /cancel to keep order',
    },
    status: {
      header: '📦 Your Orders',
      noOrders: 'No open orders.',
      doneSuffix: (n) => ` — ${n} done`,
      readyLabel: '✅ Ready',
    },
    confirm: {
      newOrder: (orderNumber) => `✅ Order Confirmed — ${orderNumber}`,
      readyBy: (date) => `Ready by: ${date}`,
      cancelOrder: (orderNumber) => `✅ Order Confirmed — ${orderNumber} cancelled.`,
      modifyOrder: (orderNumber) => `✅ Order Updated — ${orderNumber}`,
      newQuantity: (n) => `New quantity: ${n}`,
    },
  },

  gu: {
    orderDraft: {
      title: '📋 ઓર્ડર ડ્રાફ્ટ',
      urgentSuffix: ' | અર્જન્ટ',
      customerLabel: 'ગ્રાહક',
      readyByLine: 'તૈયાર ક્યારે: — ("ok <તારીખ>" ટાઇપ કરો)',
      instructions: '"ok" ટાઇપ કરો કન્ફર્મ · /cancel રદ',
    },
    modDraft: {
      title: '📋 ફેરફાર ડ્રાફ્ટ',
      customerLabel: 'ગ્રાહક',
      productLabel: 'પ્રોડક્ટ',
      ambiguousQuestion: (a, b) => `કુલ ${a} કે કુલ ${b}?`,
      ambiguousInstructions: (a, b) => `"ok ${a}" (ઉમેરો) · "ok ${b}" (બદલો) · /cancel`,
      addedLabel: (n) => `+${n} ઉમેર્યા`,
      updatedLabel: 'જથ્થો અપડેટ',
      instructions: '"ok" ટાઇપ કરો કન્ફર્મ · /cancel રદ',
    },
    cancelDraft: {
      title: '⚠️ ઓર્ડર કેન્સલ?',
      orderLabel: 'ઓર્ડર',
      customerLabel: 'ગ્રાહક',
      producedWarning: (n) => `⚠️ ${n} pcs બની ગઈ છે — આ કામ વ્યર્થ જશે`,
      instructions: 'YES ટાઇપ કરો કેન્સલ કન્ફર્મ · /cancel ઓર્ડર રાખો',
    },
    status: {
      header: '📦 તમારા ઓર્ડર',
      noOrders: 'કોઈ ખુલ્લો ઓર્ડર નથી.',
      doneSuffix: (n) => ` — ${n} બન્યા`,
      readyLabel: '✅ તૈયાર',
    },
    confirm: {
      newOrder: (orderNumber) => `✅ ઓર્ડર કન્ફર્મ — ${orderNumber}`,
      readyBy: (date) => `તૈયાર ક્યારે: ${date}`,
      cancelOrder: (orderNumber) => `✅ ઓર્ડર કન્ફર્મ — ${orderNumber} કેન્સલ.`,
      modifyOrder: (orderNumber) => `✅ ઓર્ડર અપડેટ — ${orderNumber}`,
      newQuantity: (n) => `નવો જથ્થો: ${n}`,
    },
  },

  hi: {
    orderDraft: {
      title: '📋 ऑर्डर ड्राफ्ट',
      urgentSuffix: ' | अर्जेंट',
      customerLabel: 'ग्राहक',
      readyByLine: 'तैयार कब: — ("ok <तारीख>" टाइप करें)',
      instructions: '"ok" कन्फर्म · /cancel रद्द',
    },
    modDraft: {
      title: '📋 बदलाव ड्राफ्ट',
      customerLabel: 'ग्राहक',
      productLabel: 'प्रोडक्ट',
      ambiguousQuestion: (a, b) => `कुल ${a} या कुल ${b}?`,
      ambiguousInstructions: (a, b) => `"ok ${a}" (जोड़ें) · "ok ${b}" (बदलें) · /cancel`,
      addedLabel: (n) => `+${n} जोड़े`,
      updatedLabel: 'मात्रा अपडेट',
      instructions: '"ok" कन्फर्म · /cancel रद्द',
    },
    cancelDraft: {
      title: '⚠️ ऑर्डर कैंसल?',
      orderLabel: 'ऑर्डर',
      customerLabel: 'ग्राहक',
      producedWarning: (n) => `⚠️ ${n} pcs बन चुके हैं — यह काम बर्बाद होगा`,
      instructions: 'YES टाइप करें कैंसल कन्फर्म · /cancel ऑर्डर रखें',
    },
    status: {
      header: '📦 आपके ऑर्डर',
      noOrders: 'कोई खुला ऑर्डर नहीं।',
      doneSuffix: (n) => ` — ${n} बने`,
      readyLabel: '✅ तैयार',
    },
    confirm: {
      newOrder: (orderNumber) => `✅ ऑर्डर कन्फर्म — ${orderNumber}`,
      readyBy: (date) => `तैयार कब: ${date}`,
      cancelOrder: (orderNumber) => `✅ ऑर्डर कन्फर्म — ${orderNumber} कैंसल।`,
      modifyOrder: (orderNumber) => `✅ ऑर्डर अपडेट — ${orderNumber}`,
      newQuantity: (n) => `नई मात्रा: ${n}`,
    },
  },
}

export function getBotStrings(locale: Locale): BotStrings {
  return STRINGS[locale] ?? STRINGS.en
}
