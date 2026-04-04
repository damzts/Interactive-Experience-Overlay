import { Btn, ConfigCard, ConfigNotice } from '../ui'
import { EventForm } from './EventForm'
import { describeEventSetup, type EventDef, type EventPresetId } from './eventPresets'

export function EventsTabSidebar({
  eventSearch,
  onEventSearchChange,
  filteredEventDefs,
  selectedEventId,
  onSelectEvent,
}: {
  eventSearch: string
  onEventSearchChange: (value: string) => void
  filteredEventDefs: EventDef[]
  selectedEventId: string | null
  onSelectEvent: (eventId: string) => void
}) {
  return (
    <>
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Search</div>
        <div className="mt-1 text-xs text-zinc-500">Find events by label, description, or id.</div>
      </div>
      <input
        type="text"
        value={eventSearch}
        onChange={(event) => onEventSearchChange(event.target.value)}
        placeholder="Search events"
        className="w-full text-sm"
      />
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {filteredEventDefs.length ? filteredEventDefs.map((def) => {
          const active = def.id === selectedEventId
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => onSelectEvent(def.id)}
              className={'w-full rounded-xl border px-3 py-3 text-left transition-colors ' + (
                active
                  ? 'border-cyan-400/35 bg-cyan-500/12 text-zinc-100'
                  : 'border-zinc-800/80 bg-zinc-950/55 text-zinc-400 hover:border-zinc-700/80 hover:text-zinc-200'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm leading-none">{def.icon}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{def.label}</span>
                {def.auto.enabled && <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-300">Auto</span>}
              </div>
              <div className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">{def.desc || describeEventSetup(def)}</div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] uppercase tracking-[0.12em] text-zinc-500">
                <span>{def.actions?.length ?? 0} actions</span>
                <span>{def.effects.length} fx</span>
              </div>
            </button>
          )
        }) : (
          <ConfigNotice tone="info">No events match this filter.</ConfigNotice>
        )}
      </div>
    </>
  )
}

export function EventsTabContent({
  filteredEventPresets,
  createEventDraft,
  editingEvent,
  eventDraftOriginalId,
  patchEventDraft,
  saveEventDraft,
  deleteEventDraft,
  onTriggerEvent,
}: {
  filteredEventPresets: Array<{ id: EventPresetId; icon: string; label: string; description: string }>
  createEventDraft: (presetId?: EventPresetId) => void
  editingEvent: EventDef | null
  eventDraftOriginalId: string | null
  patchEventDraft: (updated: EventDef) => void
  saveEventDraft: () => void
  deleteEventDraft: () => void
  onTriggerEvent: (def: EventDef) => void
}) {
  const editingEventCreatesNew = !eventDraftOriginalId

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <ConfigCard className="space-y-4 p-5 sm:p-6">
        <div className="space-y-3 rounded-2xl border border-dashed border-cyan-500/25 bg-cyan-500/5 px-4 py-4">
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">Add Event Type</div>
            <div className="text-xs text-zinc-500">Pick an event type to open a new event draft below.</div>
          </div>
          <Btn type="button" variant="ghost" onClick={() => createEventDraft('blank')} className="w-full justify-center border-zinc-700/80 py-2 text-sm">
            Blank Event
          </Btn>
          <div className="grid gap-2 lg:grid-cols-2">
            {filteredEventPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => createEventDraft(preset.id)}
                className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/55 px-3 py-3 text-left transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/75"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{preset.icon}</span>
                  <span className="text-[12px] font-medium text-zinc-100">{preset.label}</span>
                </div>
                <div className="mt-1 text-[10px] leading-relaxed text-zinc-500">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>
      </ConfigCard>

      {editingEvent ? (
        <ConfigCard className="space-y-4 p-5 sm:p-6">
          <div className="space-y-3 border-b border-zinc-800/80 pb-5">
            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Event Summary</div>
            <div className="grid gap-3 sm:grid-cols-4">
              <ConfigCard className="text-left p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Event Id</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{eventDraftOriginalId ?? 'Draft until saved'}</div>
              </ConfigCard>
              <ConfigCard className="text-left p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Setup</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{describeEventSetup(editingEvent)}</div>
              </ConfigCard>
              <ConfigCard className="text-left p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Runtime Actions</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{editingEvent.actions?.length ?? 0}</div>
              </ConfigCard>
              <ConfigCard className="text-left p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Overlay Effects</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{editingEvent.effects.length}</div>
              </ConfigCard>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">Event Details</div>
            <div className="text-sm text-zinc-400">Adjust the selected draft or saved event below, then save when ready.</div>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/45 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Configure Event</div>
            <div className="mt-1 text-sm text-zinc-400">Create or refine event identity, trigger rules, runtime actions, and overlay effects.</div>
          </div>

          <div className="flex items-center justify-between gap-3 px-0.5">
            <div className="text-sm text-zinc-500">{editingEventCreatesNew ? 'Editing new event draft' : `Editing ${editingEvent.label}`}</div>
            <div className="flex flex-wrap gap-2">
              <Btn type="button" variant="primary" onClick={saveEventDraft} className="px-4 py-2 text-sm">
                {editingEventCreatesNew ? 'Save Event' : 'Update Event'}
              </Btn>
              {!editingEventCreatesNew && (
                <Btn type="button" variant="primary" onClick={() => onTriggerEvent(editingEvent)} className="px-4 py-2 text-sm">
                  Fire Now
                </Btn>
              )}
              <Btn type="button" variant="danger" onClick={deleteEventDraft} className="px-4 py-2 text-sm">
                {editingEventCreatesNew ? 'Delete Draft' : 'Delete Event'}
              </Btn>
            </div>
          </div>

          <EventForm
            def={editingEvent}
            onUpdate={patchEventDraft}
            showOverview={false}
            showDeleteButton={false}
          />
        </ConfigCard>
      ) : (
        <ConfigNotice tone="info" className="py-8 text-center">
          Select an event from the left column or choose an event type above to start a new draft.
        </ConfigNotice>
      )}
    </div>
  )
}
