'use client'

import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOutAction } from '@/app/(dashboard)/actions'

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button
        type="submit"
        variant="ghost"
        className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
      >
        <LogOut size={16} />
        Sign Out
      </Button>
    </form>
  )
}
