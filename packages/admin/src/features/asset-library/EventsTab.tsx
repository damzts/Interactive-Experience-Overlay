import { Btn, ConfigCard, ConfigNotice, ConfigSectionPanel } from '../../shared/ui'
import { EventForm } from './EventForm'
import { describeEventSetup, type EventDef, type EventPresetId } from './eventPresets'
import { LibraryItemBtn } from './mediaLibraryUi'
import { MediaSearchInput } from './AssetLibraryPanel'

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
              <LibraryItemBtn key={preset.id} active={false} onClick={() => createEventDraft(preset.id)}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{preset.icon}</span>
                  <span className="text-[12px] font-medium text-zinc-100">{preset.label}</span>
                </div>
                <div className="mt-1 text-[10px] leading-relaxed text-zinc-500">{preset.description}</div>
              </LibraryItemBtn>
            ))}
          </div>
        </div>
      </ConfigCard>

      {editingEvent ? (
        <ConfigCard className="space-y-4 p-5 sm:p-6">
          <div className="space-y-1 rounded-xl border border-zinc-800/80 bg-zinc-950/35 px-5 py-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">Event Editor</div>
            <div className="text-xs text-zinc-500">Primary event authoring card.</div>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-2">
            <div className="min-w-0">
              <ConfigSectionPanel label="Event Summary" first>
                <div className="space-y-3">
                  <div className="space-y-1.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-5 py-4">
                    <InfoRow label="Label">{editingEvent.label}</InfoRow>
                    <InfoRow label="Event Id">{eventDraftOriginalId ?? 'Draft until saved'}</InfoRow>
                    <InfoRow label="Setup">{describeEventSetup(editingEvent)}</InfoRow>
                    <InfoRow label="Runtime Actions">{editingEvent.actions?.length ?? 0}</InfoRow>
                    <InfoRow label="Overlay Effects">{editingEvent.effects.length}</InfoRow>
                  </div>
                  <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-5 py-4 text-[11px] leading-relaxed text-zinc-500">
                    Create or refine event identity, trigger rules, runtime actions, and overlay effects below.
                  </div>
                </div>
              </ConfigSectionPanel>
            </div>

            <div className="min-w-0">
              <ConfigSectionPanel label="Actions" first>
                <div className="space-y-3">
                  <div className="space-y-1.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-5 py-4">
                    <InfoRow label="Editing">{editingEventCreatesNew ? 'New event draft' : editingEvent.label}</InfoRow>
                    <InfoRow label="Save Action">{editingEventCreatesNew ? 'Save Event' : 'Update Event'}</InfoRow>
                  </div>
                  <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-3 py-3">
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
                  </div>
                </div>
              </ConfigSectionPanel>
            </div>

            <div className="min-w-0 xl:col-span-2">
              <EventForm
                def={editingEvent}
                onUpdate={patchEventDraft}
                showOverview={false}
                showDeleteButton={false}
                layout="flat-grid"
              />
            </div>
          </div>
        </ConfigCard>
      ) : (
        <ConfigNotice tone="info" className="py-8 text-center">
          Select an event from the left column or choose an event type above to start a new draft.
        </ConfigNotice>
      )}
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px]">
      <span className="text-zinc-500">{label}</span>
      <span className="truncate text-right font-semibold text-zinc-100">{children}</span>
    </div>
  )
}
