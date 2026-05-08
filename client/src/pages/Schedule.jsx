import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { X, Clock, Calendar as CalendarIcon, Plus, Image, Video, FileText, Globe, Check, Monitor } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api/client';

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

const typeIcons = {
  image: Image,
  video: Video,
  pdf: FileText,
  html: Globe,
  other: FileText,
};

function getGroupColor(groupId, groups) {
  const idx = groups.findIndex((g) => g._id === groupId);
  return COLORS[idx % COLORS.length];
}

const DAYS_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export default function Schedule() {
  const queryClient = useQueryClient();
  const [filterGroup, setFilterGroup] = useState('');
  const [modal, setModal] = useState(null);

  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => api.get('/playlists').then((r) => r.data),
  });

  const { data: userGroups = [] } = useQuery({
    queryKey: ['userGroups'],
    queryFn: () => api.get('/user-groups').then((r) => r.data),
  });

  const { data: allAssets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.get('/assets').then((r) => r.data),
  });

  const { data: allPlayers = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => api.get('/players').then((r) => r.data),
  });

  const updateSchedule = useMutation({
    mutationFn: ({ id, schedule }) => api.put(`/playlists/${id}`, { schedule }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      setModal(null);
    },
  });

  const createAndSchedule = useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/playlists', {
        name: data.name,
        userGroup: data.userGroup,
        assets: data.assets.map((a) => ({
          asset: a._id,
          duration: a.duration || 10,
          option: { filename: a.filename, duration: a.duration || 10, selected: true },
        })),
        targetPlayers: data.targetPlayers,
        schedule: data.schedule,
      });
      // Deploy an die ausgewählten Player
      await api.post('/playlists/deploy-players', { playerIds: data.targetPlayers });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      setModal(null);
    },
  });

  const deletePlaylist = useMutation({
    mutationFn: (id) => api.delete(`/playlists/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playlists'] }),
  });

  // Events für Kalender
  const events = useMemo(() => {
    return playlists
      .filter((pl) => pl.schedule?.enabled)
      .filter((pl) => !filterGroup || pl.userGroup?._id === filterGroup || pl.userGroup === filterGroup)
      .map((pl) => {
        const s = pl.schedule;
        const ugId = pl.userGroup?._id || pl.userGroup;
        const color = getGroupColor(ugId, userGroups);
        const startDate = s.startDate ? new Date(s.startDate) : new Date();
        const endDate = s.endDate
          ? new Date(s.endDate)
          : new Date(startDate.getTime() + 365 * 86400000);

        const firstAsset = pl.assets?.[0]?.asset;
        const assetName = firstAsset?.originalName || pl.name;
        const playerCount = pl.targetPlayers?.length || 0;
        const title = playerCount > 0 ? `${assetName} (${playerCount} Screens)` : assetName;

        if (s.startTime && s.endTime) {
          return {
            id: pl._id,
            title,
            daysOfWeek: s.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
            startTime: s.startTime,
            endTime: s.endTime,
            startRecur: startDate.toISOString().split('T')[0],
            endRecur: new Date(endDate.getTime() + 86400000).toISOString().split('T')[0],
            backgroundColor: color,
            borderColor: color,
            extendedProps: { playlist: pl },
          };
        }

        return {
          id: pl._id,
          title,
          start: startDate.toISOString().split('T')[0],
          end: new Date(endDate.getTime() + 86400000).toISOString().split('T')[0],
          allDay: true,
          backgroundColor: color,
          borderColor: color,
          extendedProps: { playlist: pl },
        };
      });
  }, [playlists, userGroups, filterGroup]);

  const unscheduled = playlists
    .filter((pl) => !pl.schedule?.enabled)
    .filter((pl) => !filterGroup || pl.userGroup?._id === filterGroup || pl.userGroup === filterGroup);

  const handleEventClick = (info) => {
    const pl = info.event.extendedProps.playlist;
    setModal({ mode: 'edit', playlist: pl });
  };

  const handleDateSelect = (info) => {
    setModal({ mode: 'create', startDate: info.startStr, endDate: info.endStr });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="page-title">Schedule</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModal({ mode: 'create', startDate: '', endDate: '' })}
            className="flex items-center gap-2 btn-brand"
          >
            <Plus size={18} /> Neuer Eintrag
          </button>
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Alle Gruppen</option>
            {userGroups.map((ug) => (
              <option key={ug._id} value={ug._id}>{ug.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 card p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek',
            }}
            selectable
            select={handleDateSelect}
            eventClick={handleEventClick}
            events={events}
            height="auto"
            firstDay={1}
            locale="de"
            nowIndicator
            eventDisplay="block"
            dayMaxEvents={3}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          />
        </div>

        {/* Sidebar */}
        <div>
          <div className="card">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm">Immer aktiv</h3>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y">
              {unscheduled.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 text-center">
                  Alles hat einen Zeitplan.
                </div>
              ) : (
                unscheduled.map((pl) => {
                  const firstAsset = pl.assets?.[0]?.asset;
                  const assetName = firstAsset?.originalName || pl.name;
                  const ugId = pl.userGroup?._id || pl.userGroup;
                  return (
                    <div
                      key={pl._id}
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setModal({ mode: 'edit', playlist: pl })}
                    >
                      <div className="text-sm font-medium">{assetName}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: getGroupColor(ugId, userGroups) }}
                        />
                        {pl.userGroup?.name || '-'}
                        {pl.targetPlayers?.length > 0 && (
                          <span className="ml-1">{pl.targetPlayers.length} Screen(s)</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {modal && modal.mode === 'create' && (
        <CreateScheduleModal
          modal={modal}
          allAssets={allAssets}
          allPlayers={allPlayers}
          userGroups={userGroups}
          onSave={(data) => createAndSchedule.mutate(data)}
          onClose={() => setModal(null)}
          isPending={createAndSchedule.isPending}
        />
      )}
      {modal && modal.mode === 'edit' && (
        <EditScheduleModal
          playlist={modal.playlist}
          allPlayers={allPlayers}
          onSave={(id, schedule) => updateSchedule.mutate({ id, schedule })}
          onDelete={(id) => deletePlaylist.mutate(id)}
          onClose={() => setModal(null)}
          isPending={updateSchedule.isPending}
        />
      )}
    </div>
  );
}

// ─── CREATE ───────────────────────────────────────────────
function CreateScheduleModal({ modal, allAssets, allPlayers, userGroups, onSave, onClose, isPending }) {
  const [step, setStep] = useState(1);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [filterGroup, setFilterGroup] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(modal.startDate || '');
  const [endDate, setEndDate] = useState(
    modal.endDate ? format(new Date(new Date(modal.endDate).getTime() - 86400000), 'yyyy-MM-dd') : ''
  );
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [assetFilter, setAssetFilter] = useState('');

  const toggleAsset = (asset) => {
    setSelectedAssets((prev) => {
      const exists = prev.find((a) => a._id === asset._id);
      return exists ? [] : [asset];
    });
  };

  const togglePlayer = (id) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const filteredAssets = allAssets.filter((a) => {
    if (!assetFilter) return true;
    return a.originalName?.toLowerCase().includes(assetFilter.toLowerCase()) || a.type === assetFilter;
  });

  // Player nach UserGroup filtern (nur die erlaubten)
  const visiblePlayers = allPlayers.filter((p) => {
    if (!filterGroup) return true;
    return (p.userGroups || []).some((ug) => {
      const ugId = typeof ug === 'object' ? ug._id : ug;
      return ugId === filterGroup;
    });
  });

  // UserGroup für die Playlist aus dem ersten ausgewählten Player ermitteln
  const getUserGroupForPlayers = () => {
    if (selectedPlayerIds.length === 0) return null;
    const firstPlayer = allPlayers.find((p) => p._id === selectedPlayerIds[0]);
    const groups = firstPlayer?.userGroups || [];
    const firstGroup = groups[0];
    return firstGroup ? (typeof firstGroup === 'object' ? firstGroup._id : firstGroup) : null;
  };

  const handleSubmit = () => {
    if (selectedAssets.length === 0) { alert('Bitte ein Asset auswählen'); return; }
    if (selectedPlayerIds.length === 0) { alert('Bitte mindestens einen Bildschirm auswählen'); return; }

    const autoName = name || selectedAssets[0]?.originalName || 'Schedule';
    onSave({
      name: autoName,
      userGroup: getUserGroupForPlayers(),
      assets: selectedAssets,
      targetPlayers: selectedPlayerIds,
      schedule: {
        enabled: !!(startDate || startTime),
        startDate: startDate || null,
        endDate: endDate || null,
        startTime: startTime || null,
        endTime: endTime || null,
        daysOfWeek,
      },
    });
  };

  const stepTitles = ['Asset auswählen', 'Bildschirme wählen', 'Zeitplan'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h3 className="text-lg font-semibold">{stepTitles[step - 1]}</h3>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`w-2 h-2 rounded-full ${step >= s ? 'bg-brand-500' : 'bg-gray-200'}`} />
              ))}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
        </div>

        {/* Step 1: Asset */}
        {step === 1 && (
          <>
            <div className="p-4 border-b shrink-0">
              <input
                type="text"
                value={assetFilter}
                onChange={(e) => setAssetFilter(e.target.value)}
                placeholder="Assets suchen..."
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              {selectedAssets.length > 0 && (
                <div className="mt-2 text-sm text-brand-600 font-medium">{selectedAssets[0].originalName}</div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredAssets.map((asset) => {
                  const isSelected = selectedAssets.some((a) => a._id === asset._id);
                  const Icon = typeIcons[asset.type] || FileText;
                  return (
                    <div
                      key={asset._id}
                      onClick={() => toggleAsset(asset)}
                      className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        isSelected ? 'border-brand-500 ring-2 ring-brand-200' : 'border-transparent hover:border-gray-200'
                      }`}
                    >
                      <div className="aspect-video bg-gray-100 flex items-center justify-center">
                        {asset.thumbnail ? (
                          <img src={`/media/${asset.thumbnail}`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Icon size={28} className="text-gray-300" />
                        )}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center">
                            <Check size={14} className="text-white" />
                          </div>
                        )}
                        {asset.type === 'video' && asset.duration > 0 && (
                          <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                            {asset.duration}s
                          </span>
                        )}
                      </div>
                      <div className="p-1.5">
                        <div className="text-xs font-medium truncate">{asset.originalName}</div>
                        <div className="text-[10px] text-gray-400">{asset.type}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredAssets.length === 0 && (
                <div className="text-center text-gray-400 py-8 text-sm">Keine Assets gefunden.</div>
              )}
            </div>
            <div className="p-4 border-t shrink-0 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={selectedAssets.length === 0}
                className="btn-brand px-6 py-2 disabled:opacity-40"
              >
                Weiter
              </button>
            </div>
          </>
        )}

        {/* Step 2: Player */}
        {step === 2 && (
          <>
            <div className="p-4 border-b shrink-0">
              <select
                value={filterGroup}
                onChange={(e) => { setFilterGroup(e.target.value); setSelectedPlayerIds([]); }}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Alle Gruppen</option>
                {userGroups.map((ug) => (
                  <option key={ug._id} value={ug._id}>{ug.name}</option>
                ))}
              </select>
              {selectedPlayerIds.length > 0 && (
                <div className="mt-2 text-sm text-brand-600 font-medium">
                  {selectedPlayerIds.length} Bildschirm(e) ausgewählt
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {visiblePlayers.length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-sm">
                  Keine Bildschirme in dieser Gruppe.
                </div>
              ) : (
                <div className="space-y-1">
                  {visiblePlayers.map((player) => {
                    const selected = selectedPlayerIds.includes(player._id);
                    const groupNames = (player.userGroups || [])
                      .map((g) => (typeof g === 'object' ? g.name : g))
                      .join(', ');
                    return (
                      <div
                        key={player._id}
                        onClick={() => togglePlayer(player._id)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                          selected ? 'bg-brand-50 ring-1 ring-brand-300' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${player.isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <Monitor size={16} className="text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {player.name || player.cpuSerialNumber || 'Unnamed'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {groupNames || 'Keine Gruppe'} — {player.myIpAddress || player.ip || '-'}
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          selected ? 'bg-brand-500 border-brand-500' : 'border-gray-300'
                        }`}>
                          {selected && <Check size={12} className="text-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t shrink-0 flex gap-2">
              <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg border hover:bg-gray-50 text-sm">
                Zurück
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={selectedPlayerIds.length === 0}
                className="flex-1 btn-brand py-2 disabled:opacity-40"
              >
                Weiter ({selectedPlayerIds.length} Screens)
              </button>
            </div>
          </>
        )}

        {/* Step 3: Schedule */}
        {step === 3 && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  {selectedAssets[0] && (
                    <div className="w-14 aspect-video bg-gray-200 rounded overflow-hidden shrink-0">
                      {selectedAssets[0].thumbnail ? (
                        <img src={`/media/${selectedAssets[0].thumbnail}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                          {selectedAssets[0].type}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{selectedAssets[0]?.originalName}</div>
                    <div className="text-xs text-gray-400">{selectedPlayerIds.length} Bildschirm(e)</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={selectedAssets[0]?.originalName || 'Schedule'}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    <CalendarIcon size={11} className="inline mr-1" />Start
                  </label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    <CalendarIcon size={11} className="inline mr-1" />Ende
                  </label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    <Clock size={11} className="inline mr-1" />Von
                  </label>
                  <input
                    type="text" inputMode="numeric" pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$" placeholder="HH:MM"
                    value={startTime} onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    <Clock size={11} className="inline mr-1" />Bis
                  </label>
                  <input
                    type="text" inputMode="numeric" pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$" placeholder="HH:MM"
                    value={endTime} onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
              </div>
              <p className="text-xs text-gray-400">Leer = ganztägig / immer aktiv</p>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Wochentage
                </label>
                <div className="flex gap-1">
                  {DAYS_LABELS.map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setDaysOfWeek((prev) =>
                          prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()
                        )
                      }
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                        daysOfWeek.includes(idx)
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t shrink-0 flex gap-2">
              <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg border hover:bg-gray-50 text-sm">
                Zurück
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex-1 btn-brand py-2 text-sm disabled:opacity-40"
              >
                {isPending ? 'Erstelle...' : 'Erstellen & Deployen'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── EDIT ─────────────────────────────────────────────────
function EditScheduleModal({ playlist, allPlayers, onSave, onDelete, onClose, isPending }) {
  const firstAsset = playlist?.assets?.[0]?.asset;
  const assetName = firstAsset?.originalName || playlist.name;

  const [enabled, setEnabled] = useState(playlist?.schedule?.enabled || false);
  const [startDate, setStartDate] = useState(
    playlist?.schedule?.startDate ? format(new Date(playlist.schedule.startDate), 'yyyy-MM-dd') : ''
  );
  const [endDate, setEndDate] = useState(
    playlist?.schedule?.endDate ? format(new Date(playlist.schedule.endDate), 'yyyy-MM-dd') : ''
  );
  const [startTime, setStartTime] = useState(playlist?.schedule?.startTime || '');
  const [endTime, setEndTime] = useState(playlist?.schedule?.endTime || '');
  const [daysOfWeek, setDaysOfWeek] = useState(playlist?.schedule?.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]);

  const targetPlayerNames = (playlist?.targetPlayers || []).map((tp) => {
    if (typeof tp === 'object') return tp.name || tp.cpuSerialNumber || 'Unnamed';
    const p = allPlayers.find((pl) => pl._id === tp);
    return p ? p.name || p.cpuSerialNumber : 'Unknown';
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(playlist._id, {
      enabled,
      startDate: startDate || null,
      endDate: endDate || null,
      startTime: startTime || null,
      endTime: endTime || null,
      daysOfWeek,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">{assetName}</h3>
            <div className="text-xs text-gray-400">
              {playlist.userGroup?.name}
              {targetPlayerNames.length > 0 && ` — ${targetPlayerNames.join(', ')}`}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium">Zeitplan aktiviert</span>
          </label>

          {enabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    <CalendarIcon size={11} className="inline mr-1" />Start
                  </label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    <CalendarIcon size={11} className="inline mr-1" />Ende
                  </label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    <Clock size={11} className="inline mr-1" />Von
                  </label>
                  <input
                    type="text" inputMode="numeric" pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$" placeholder="HH:MM"
                    value={startTime} onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    <Clock size={11} className="inline mr-1" />Bis
                  </label>
                  <input
                    type="text" inputMode="numeric" pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$" placeholder="HH:MM"
                    value={endTime} onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
              </div>
              <p className="text-xs text-gray-400">Leer = ganztägig</p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">Wochentage</label>
                <div className="flex gap-1">
                  {DAYS_LABELS.map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setDaysOfWeek((prev) =>
                          prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()
                        )
                      }
                      className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                        daysOfWeek.includes(idx)
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={isPending} className="flex-1 btn-brand py-2 text-sm">
              {isPending ? 'Speichere...' : 'Speichern'}
            </button>
            <button
              type="button"
              onClick={() => { if (confirm('Eintrag löschen?')) onDelete(playlist._id); onClose(); }}
              className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 text-sm"
            >
              Löschen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
