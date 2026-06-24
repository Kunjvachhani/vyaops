import { notFound, redirect } from 'next/navigation'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { hasAccess } from '@/config/features'
import type { Tier } from '@/config/features'
import { adminClient } from '@/lib/supabase/admin'
import { EditorClient } from './_components/editor-client'
import { FeatureGateCard } from '@/components/dashboard/feature-gate-card'

type SopVersion = {
  id: string
  title: string
  category: string | null
  content: string
  version: number
  status: string
  parent_id: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export default async function SopEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { data: orgData } = await adminClient
    .from('organizations')
    .select('tier')
    .eq('id', user.org_id)
    .is('deleted_at', null)
    .single()
  const orgTier = ((orgData as { tier: string } | null)?.tier ?? 'tier_1') as Tier

  if (!hasAccess(orgTier, 'sop_builder')) {
    return (
      <div className="space-y-6">
        <FeatureGateCard featureName="SOP Builder" requiredTier="tier_3" />
      </div>
    )
  }

  const { id } = await params
  const supabase = await createClient()

  // Fetch root document
  const { data: root, error } = await supabase
    .from('sop_documents')
    .select('*')
    .eq('id', id)
    .eq('organization_id', user.org_id)
    .is('parent_id', null)
    .is('deleted_at', null)
    .single()

  if (error || !root) notFound()

  // Fetch all versions
  const { data: childVersions } = await supabase
    .from('sop_documents')
    .select('*')
    .eq('organization_id', user.org_id)
    .eq('parent_id', id)
    .is('deleted_at', null)
    .order('version', { ascending: true })

  const rootRow = root as SopVersion
  const allVersions: SopVersion[] = [rootRow, ...((childVersions ?? []) as SopVersion[])]

  return (
    <div className="space-y-4">
      <EditorClient rootId={id} versions={allVersions} />
    </div>
  )
}
