import { Btn, ConfigNotice } from '../../shared/ui'
import { EventForm } from './EventForm'
import { describeEventSetup, type EventDef, type EventDraft } from './eventPresets'
import { LibraryItemBtn } from './mediaLibraryUi'
import { MediaSearchInput } from './MediaLibraryPanel'

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
      <MediaSearchInput value={eventSearch} onChange={onEventSearchChange} placeholder="Search events…" />
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {filteredEventDefs.length ? filteredEventDefs.map((def) => (
          <LibraryItemBtn key={def.id} active={def.id === selectedEventId} onClick={() => onSelectEvent(def.id)}>
            <div className="flex items-center gap-2">
              <span className="text-sm leading-none">{def.icon}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{def.label}</span>
              {def.auto.enabled && (
                <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                  Auto
                </span>
              )}
            </div>
            <div className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">
              {def.desc || describeEventSetup(def)}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] uppercase tracking-[0.12em] text-zinc-500">
              <span>{def.actions?.length ?? 0} actions</span>
              <span>{def.effects.length} fx</span>
            </div>
          </LibraryItemBtn>
        )) : (
          <ConfigNotice tone="info">No events match this filter.</ConfigNotice>
        )}
      </div>
    </>
  )
}

export function EventsTabContent({
  createEventDraft,
  editingEvent,
  eventDraftOriginalId,
  patchEventDraft,
  saveEventDraft,
  deleteEventDraft,
  onTriggerEvent,
}: {
  createEventDraft: () => void
  editingEvent: EventDraft | null
  eventDraftOriginalId: string | null
  patchEventDraft: (updated: EventDraft) => void
  saveEventDraft: () => void
  deleteEventDraft: () => void
  onTriggerEvent: (def: EventDraft) => void
}) {
  const editingEventCreatesNew = !eventDraftOriginalId

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3">
        <div className="flex flex-wrap items-end gap-2">
          {editingEvent && !editingEvent.builtIn && (
            <>
              <div className="w-14 shrink-0">
                <div className="mb-1 text-[10px] text-zinc-400">Icon</div>
                <input
                  type="text"
                  value={editingEvent.icon}
                  onChange={(event) => patchEventDraft({ ...editingEvent, icon: event.target.value })}
                  className="w-full text-center"
                  placeholder="⚡"
                />
              </div>
              <div className="min-w-[140px] flex-1">
                <div className="mb-1 text-[10px] text-zinc-400">Label</div>
                <input
                  type="text"
                  value={editingEvent.label}
                  onChange={(event) => patchEventDraft({ ...editingEvent, label: event.target.value })}
                  className="w-full"
                />
              </div>
            </>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Btn type="button" variant="ghost" onClick={() => createEventDraft()} className="px-4 py-2 text-sm">
              + New Blank Event
            </Btn>
            {editingEvent && (
              <>
                <Btn type="button" variant="primary" onClick={saveEventDraft} className="px-4 py-2 text-sm">
                  {editingEventCreatesNew ? 'Save Event' : 'Update Event'}
                </Btn>
                {!editingEventCreatesNew && (
                  <Btn type="button" variant="primary" onClick={() => onTriggerEvent(editingEvent)} className="px-4 py-2 text-sm">
                    Test Draft
                  </Btn>
                )}
                <Btn type="button" variant="danger" onClick={deleteEventDraft} className="px-4 py-2 text-sm">
                  {editingEventCreatesNew ? 'Delete Draft' : 'Delete Event'}
                </Btn>
              </>
            )}
          </div>
        </div>
        {editingEvent && !editingEvent.builtIn && (
          <div>
            <div className="mb-1 text-[10px] text-zinc-400">Description</div>
            <textarea
              value={editingEvent.desc}
              onChange={(event) => patchEventDraft({ ...editingEvent, desc: event.target.value })}
              className="min-h-[56px] w-full text-sm"
            />
          </div>
        )}
      </div>

      {editingEvent ? (
        <EventForm
          def={editingEvent}
          onUpdate={patchEventDraft}
          showOverview={false}
          showDeleteButton={false}
          layout="flat-grid"
        />
      ) : (
        <ConfigNotice tone="info" className="py-8 text-center">
          Select an event from the left column or choose an event type above to start a new draft.
        </ConfigNotice>
      )}
    </div>
  )
}
