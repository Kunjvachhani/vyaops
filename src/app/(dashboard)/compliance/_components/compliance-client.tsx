'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComplianceTask {
  id: string
  task_name: string
  category: string
  frequency: string
  due_date: string
  status: string
  completed_date: string | null
  notes: string | null
  reminder_sent: boolean
  created_at: string
}

type ComplianceCategory = 'gst' | 'tds' | 'pf' | 'esi' | 'factory' | 'pollution' | 'fire' | 'electrical' | 'custom'
type ComplianceFrequency = 'monthly' | 'quarterly' | 'annual' | 'biannual'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  gst: 'bg-blue-100 text-blue-800',
  tds: 'bg-purple-100 text-purple-800',
  pf: 'bg-indigo-100 text-indigo-800',
  esi: 'bg-cyan-100 text-cyan-800',
  factory: 'bg-amber-100 text-amber-800',
  pollution: 'bg-green-100 text-green-800',
  fire: 'bg-red-100 text-red-800',
  electrical: 'bg-yellow-100 text-yellow-800',
  custom: 'bg-gray-100 text-gray-800',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  na: 'bg-gray-100 text-gray-600',
}

const CATEGORY_DOT_COLORS: Record<string, string> = {
  gst: 'bg-blue-500',
  tds: 'bg-purple-500',
  pf: 'bg-indigo-500',
  esi: 'bg-cyan-500',
  factory: 'bg-amber-500',
  pollution: 'bg-green-500',
  fire: 'bg-red-500',
  electrical: 'bg-yellow-500',
  custom: 'bg-gray-500',
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function isOverdue(task: ComplianceTask): boolean {
  return task.status === 'overdue' || (task.due_date < todayStr() && task.status === 'pending')
}

function daysUntilDue(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const grid: (Date | null)[][] = []
  let row: (Date | null)[] = Array(firstDay).fill(null)

  for (let d = 1; d <= daysInMonth; d++) {
    row.push(new Date(year, month, d))
    if (row.length === 7) { grid.push(row); row = [] }
  }
  while (row.length > 0 && row.length < 7) row.push(null)
  if (row.length > 0) grid.push(row)
  return grid
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ tasks }: { tasks: ComplianceTask[] }) {
  const t = useTranslations('pages.compliance')
  const today = todayStr()
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split('T')[0]
  const monthStart = today.slice(0, 7) + '-01'
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toISOString().split('T')[0]

  const dueThisWeek = tasks.filter(
    (task) => task.due_date >= today && task.due_date <= weekEndStr && task.status !== 'completed' && task.status !== 'na'
  ).length
  const overdueCount = tasks.filter((task) => isOverdue(task)).length
  const completedThisMonth = tasks.filter(
    (task) => task.status === 'completed' && task.completed_date && task.completed_date >= monthStart && task.completed_date <= monthEnd
  ).length

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
            <Clock className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{dueThisWeek}</p>
            <p className="text-sm text-muted-foreground">{t('summaryDueThisWeek')}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${overdueCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
            <AlertCircle className={`h-5 w-5 ${overdueCount > 0 ? 'text-red-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : ''}`}>{overdueCount}</p>
            <p className="text-sm text-muted-foreground">{t('summaryOverdue')}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{completedThisMonth}</p>
            <p className="text-sm text-muted-foreground">{t('summaryCompletedThisMonth')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({ tasks }: { tasks: ComplianceTask[] }) {
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const grid = buildCalendarGrid(calYear, calMonth)
  const todayString = todayStr()

  const tasksByDate = new Map<string, ComplianceTask[]>()
  for (const task of tasks) {
    if (!tasksByDate.has(task.due_date)) tasksByDate.set(task.due_date, [])
    tasksByDate.get(task.due_date)!.push(task)
  }

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11) }
    else setCalMonth(calMonth - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0) }
    else setCalMonth(calMonth + 1)
    setSelectedDay(null)
  }

  const selectedTasks = selectedDay ? (tasksByDate.get(selectedDay) ?? []) : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={prevMonth} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-base font-semibold">{MONTH_NAMES[calMonth]} {calYear}</span>
        <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[320px]">
          <div className="grid grid-cols-7 gap-px text-center">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-1 text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {grid.map((row, ri) =>
              row.map((day, ci) => {
                if (!day) return <div key={`${ri}-${ci}`} className="h-14 rounded bg-muted/30" />
                const ds = dateToStr(day)
                const dayTasks = tasksByDate.get(ds) ?? []
                const isToday = ds === todayString
                const isSelected = ds === selectedDay
                const hasOverdue = dayTasks.some((task) => isOverdue(task))

                return (
                  <button
                    key={ds}
                    onClick={() => setSelectedDay(isSelected ? null : ds)}
                    className={`flex h-14 flex-col items-start justify-start gap-0.5 rounded p-1 text-left transition-colors ${
                      isToday ? 'ring-2 ring-primary ring-offset-1' : ''
                    } ${isSelected ? 'bg-primary/10' : 'hover:bg-muted'} ${
                      hasOverdue && !isSelected ? 'bg-red-50' : ''
                    }`}
                  >
                    <span className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-foreground'}`}>
                      {day.getDate()}
                    </span>
                    <div className="flex flex-wrap gap-0.5">
                      {dayTasks.slice(0, 3).map((task) => (
                        <span
                          key={task.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            task.status === 'completed' ? 'bg-green-400' :
                            isOverdue(task) ? 'bg-red-500' :
                            (CATEGORY_DOT_COLORS[task.category] ?? 'bg-gray-400')
                          }`}
                        />
                      ))}
                      {dayTasks.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3}</span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {selectedDay && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{formatDueDate(selectedDay)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {selectedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks on this day.</p>
            ) : (
              <ul className="space-y-2">
                {selectedTasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2">
                    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[task.category] ?? 'bg-gray-100 text-gray-800'}`}>
                      {task.category.toUpperCase()}
                    </span>
                    <span className="text-sm">{task.task_name}</span>
                    <span className={`ml-auto inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status] ?? ''}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Upcoming List ────────────────────────────────────────────────────────────

function UpcomingList({
  tasks,
  showAll,
  onMarkComplete,
  onDelete,
  completing,
  deleting,
}: {
  tasks: ComplianceTask[]
  showAll: boolean
  onMarkComplete: (id: string) => void
  onDelete: (id: string) => void
  completing: string | null
  deleting: string | null
}) {
  const t = useTranslations('pages.compliance')
  const thirtyDays = new Date(); thirtyDays.setDate(thirtyDays.getDate() + 30)
  const thirtyDaysStr = thirtyDays.toISOString().split('T')[0]

  const displayed = showAll
    ? tasks
    : tasks.filter((task) => task.due_date <= thirtyDaysStr || isOverdue(task))

  if (displayed.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <CalendarDays className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {showAll ? 'No compliance tasks found.' : 'No tasks due in the next 30 days.'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('tableDueDate')}</TableHead>
            <TableHead>{t('tableTask')}</TableHead>
            <TableHead className="hidden sm:table-cell">{t('tableCategory')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('tableFrequency')}</TableHead>
            <TableHead>{t('tableStatus')}</TableHead>
            <TableHead className="text-right">{t('tableActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayed.map((task) => {
            const days = daysUntilDue(task.due_date)
            const overdueFlag = isOverdue(task)
            return (
              <TableRow key={task.id} className={overdueFlag ? 'bg-red-50/50' : ''}>
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-sm ${overdueFlag ? 'text-red-600' : ''}`}>
                      {formatDueDate(task.due_date)}
                    </span>
                    {task.status !== 'completed' && task.status !== 'na' && (
                      <span className={`text-xs ${
                        overdueFlag ? 'text-red-500' : days <= 3 ? 'text-amber-600' : 'text-muted-foreground'
                      }`}>
                        {overdueFlag
                          ? `${Math.abs(days)}d overdue`
                          : days === 0 ? 'Due today'
                          : `${days}d left`}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[160px]">
                  <span className="truncate text-sm">{task.task_name}</span>
                  {task.notes && (
                    <p className="truncate text-xs text-muted-foreground">{task.notes}</p>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[task.category] ?? 'bg-gray-100 text-gray-800'}`}>
                    {task.category.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm capitalize text-muted-foreground">{task.frequency}</span>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status] ?? ''}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {task.status !== 'completed' && task.status !== 'na' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-green-700 hover:bg-green-50 hover:text-green-800"
                        onClick={() => onMarkComplete(task.id)}
                        disabled={completing === task.id}
                      >
                        {completing === task.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        <span className="hidden sm:inline">{t('actionMarkComplete')}</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      onClick={() => onDelete(task.id)}
                      disabled={deleting === task.id}
                    >
                      {deleting === task.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Add Reminder Dialog ──────────────────────────────────────────────────────

interface AddReminderDialogProps {
  open: boolean
  onClose: () => void
  onSave: (data: {
    task_name: string
    category: ComplianceCategory
    frequency: ComplianceFrequency
    due_date: string
    notes: string
  }) => Promise<void>
  saving: boolean
}

function AddReminderDialog({ open, onClose, onSave, saving }: AddReminderDialogProps) {
  const t = useTranslations('pages.compliance')
  const [taskName, setTaskName] = useState('')
  const [category, setCategory] = useState<ComplianceCategory>('gst')
  const [frequency, setFrequency] = useState<ComplianceFrequency>('monthly')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState('')

  const reset = () => {
    setTaskName(''); setCategory('gst'); setFrequency('monthly')
    setDueDate(''); setNotes(''); setFormError('')
  }

  useEffect(() => { if (!open) reset() }, [open])

  const handleSave = async () => {
    if (!taskName.trim()) { setFormError('Task name is required.'); return }
    if (!dueDate) { setFormError('Due date is required.'); return }
    setFormError('')
    await onSave({ task_name: taskName.trim(), category, frequency, due_date: dueDate, notes: notes.trim() })
  }

  const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-name">{t('dialogTaskName')}</Label>
            <Input
              id="task-name"
              placeholder={t('dialogTaskNamePlaceholder')}
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category">{t('dialogCategory')}</Label>
              <select
                id="category"
                className={selectClass}
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplianceCategory)}
              >
                {(['gst','tds','pf','esi','factory','pollution','fire','electrical','custom'] as const).map((c) => (
                  <option key={c} value={c}>{t(`categories.${c}`)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frequency">{t('dialogFrequency')}</Label>
              <select
                id="frequency"
                className={selectClass}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ComplianceFrequency)}
              >
                {(['monthly','quarterly','annual','biannual'] as const).map((f) => (
                  <option key={f} value={f}>{t(`frequencies.${f}`)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="due-date">{t('dialogDueDate')}</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={todayStr()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">
              {t('dialogNotes')} <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder={t('dialogNotesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('dialogCancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {t('dialogSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────

function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const t = useTranslations('pages.compliance')
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('actionConfirmDeleteTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('actionConfirmDelete')}</p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{t('dialogCancel')}</Button>
          <Button variant="destructive" onClick={onConfirm}>{t('actionDelete')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  onSeedDefaults,
  onAddCustom,
  seeding,
}: {
  onSeedDefaults: () => void
  onAddCustom: () => void
  seeding: boolean
}) {
  const t = useTranslations('pages.compliance')
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <CalendarDays className="h-12 w-12 text-muted-foreground" />
        <div>
          <p className="text-base font-semibold">{t('emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptyDesc')}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={onSeedDefaults} disabled={seeding}>
            {seeding && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {t('initDefaults')}
          </Button>
          <Button variant="outline" onClick={onAddCustom}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('addReminder')}
          </Button>
        </div>
        <p className="max-w-sm text-xs text-muted-foreground">{t('initDefaultsDesc')}</p>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ComplianceClient() {
  const t = useTranslations('pages.compliance')
  const [tasks, setTasks] = useState<ComplianceTask[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [completing, setCompleting] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/compliance')
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json() as { data: ComplianceTask[] }
      setTasks(json.data)
    } catch {
      setErrorMsg(t('fetchError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchTasks() }, [fetchTasks])

  const handleSeedDefaults = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_defaults' }),
      })
      if (res.status === 409) { showToast('Tasks already initialized.'); return }
      if (!res.ok) throw new Error('seed failed')
      showToast(t('successSeeded'))
      await fetchTasks()
    } catch {
      setErrorMsg(t('seedError'))
    } finally {
      setSeeding(false)
    }
  }

  const handleAddTask = async (data: {
    task_name: string
    category: ComplianceCategory
    frequency: ComplianceFrequency
    due_date: string
    notes: string
  }) => {
    setSavingTask(true)
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('create failed')
      showToast(t('successCreated'))
      setShowAddDialog(false)
      await fetchTasks()
    } catch {
      setErrorMsg(t('createError'))
    } finally {
      setSavingTask(false)
    }
  }

  const handleMarkComplete = async (id: string) => {
    setCompleting(id)
    try {
      const res = await fetch(`/api/compliance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', completed_date: todayStr() }),
      })
      if (!res.ok) throw new Error('update failed')
      showToast(t('successCompleted'))
      setTasks((prev) =>
        prev.map((task) =>
          task.id === id ? { ...task, status: 'completed', completed_date: todayStr() } : task
        )
      )
    } catch {
      setErrorMsg(t('updateError'))
    } finally {
      setCompleting(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setConfirmDeleteId(null)
    try {
      const res = await fetch(`/api/compliance/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      showToast(t('successDeleted'))
      setTasks((prev) => prev.filter((task) => task.id !== id))
    } catch {
      setErrorMsg(t('deleteError'))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const thirtyDays = new Date(); thirtyDays.setDate(thirtyDays.getDate() + 30)
  const hasTasksBeyond30 = tasks.some(
    (task) => task.due_date > thirtyDays.toISOString().split('T')[0] && !isOverdue(task)
  )

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-red-700"
            onClick={() => setErrorMsg('')}
          >
            ✕
          </Button>
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 ? (
        <EmptyState
          onSeedDefaults={handleSeedDefaults}
          onAddCustom={() => setShowAddDialog(true)}
          seeding={seeding}
        />
      ) : (
        <>
          <SummaryCards tasks={tasks} />

          <div className="space-y-4">
            {/* Tab bar + Add button */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex rounded-lg border bg-muted p-1">
                <button
                  onClick={() => setActiveTab('list')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === 'list'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  {t('upcomingTab')}
                </button>
                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === 'calendar'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t('calendarTab')}
                </button>
              </div>
              <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                {t('addReminder')}
              </Button>
            </div>

            {/* Tab content */}
            {activeTab === 'list' && (
              <div className="space-y-3">
                <UpcomingList
                  tasks={tasks}
                  showAll={showAll}
                  onMarkComplete={handleMarkComplete}
                  onDelete={(id) => setConfirmDeleteId(id)}
                  completing={completing}
                  deleting={deletingId}
                />
                {!showAll && hasTasksBeyond30 && (
                  <div className="text-center">
                    <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
                      {t('allTasksButton')}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'calendar' && (
              <Card>
                <CardContent className="p-4">
                  <CalendarView tasks={tasks} />
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      <AddReminderDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSave={handleAddTask}
        saving={savingTask}
      />

      <ConfirmDeleteDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && void handleDelete(confirmDeleteId)}
      />
    </div>
  )
}
