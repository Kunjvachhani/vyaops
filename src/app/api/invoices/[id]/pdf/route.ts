import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { captureWithContext } from '@/lib/utils/sentry'
import { InvoiceRenderError, renderInvoice } from '@/lib/invoices/render'

type RouteContext = { params: Promise<{ id: string }> }

function pdfResponse(buffer: Buffer, invoiceNumber: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoiceNumber}.pdf"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  })
}

// POST /api/invoices/[id]/pdf
// Generates (or serves the cached) tax-invoice PDF for an invoice the caller's
// org owns. Rendering, caching, and pdf_url refresh live in renderInvoice().
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  try {
    const { buffer, invoiceNumber } = await renderInvoice(user.org_id, id)
    return pdfResponse(buffer, invoiceNumber)
  } catch (err) {
    if (err instanceof InvoiceRenderError) {
      const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'DATA_INTEGRITY_ERROR' ? 422 : 500
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }
    captureWithContext(err, { action: 'POST /api/invoices/[id]/pdf', org_id: user.org_id, user_role: user.role })
    return NextResponse.json(
      { error: 'Failed to generate invoice PDF', code: 'PDF_GENERATION_ERROR' },
      { status: 500 }
    )
  }
}
