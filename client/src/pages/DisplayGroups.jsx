import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Rocket, Trash2, Settings, X, Monitor, Moon, RotateCcw, Type, Check,
} from 'lucide-react';
import { useState } from 'react';
import api from '../api/client';
import useAuth from '../hooks/useAuth';

export default function DisplayGroups() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [deploying, setDeploying] = useState(null);
  const [editGroup, setEditGroup] = useState(null);
  const [deployModal, setDeployModal] = useState(null); // group or null

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['displayGroups'],
    queryFn: () => api.get('/display-groups').then((r) => r.data),
  });

  const { data: allPlayers = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => api.get('/players').then((r) => r.data),
  });

  const createGroup = useMutation({
    mutationFn: (data) => api.post('/display-groups', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['displayGroups'] });
      setShowCreate(false);
      setNewName('');
    },
  });

  const deleteGroup = useMutation({
    mutationFn: (id) => api.delete(`/display-groups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['displayGroups'] }),
  });

  const handleDeploy = async (groupId, playerIds = null) => {
    setDeploying(groupId);
    try {
      await api.post(`/playlists/deploy/${groupId}`, { playerIds });
      setDeployModal(null);
      alert('Deploy successful!');
    } catch (err) {
      alert('Deploy failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeploying(null);
    }
  };

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="page-title">Display Groups</h2>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 btn-brand"
          >
            <Plus size={18} /> New Group
          </button>
        )}
      </div>

      {showCreate && (
        <div className="card p-4 mb-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createGroup.mutate({ name: newName });
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Group name"
              className="flex-1 border rounded-lg px-3 py-2"
              required
            />
            <button type="submit" className="btn-brand">
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
              Cancel
            </button>
          </form>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No display groups yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div key={group._id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">{group.name}</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditGroup(group)}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                    title="Settings"
                  >
                    <Settings size={18} />
                  </button>
                  <button
                    onClick={() => setDeployModal(group)}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                    title="Deploy"
                  >
                    <Rocket size={18} />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (confirm('Delete this display group?')) deleteGroup.mutate(group._id);
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                <div className="flex items-center gap-2">
                  <Monitor size={14} />
                  {group.orientation} / {group.resolution}
                </div>
                {group.sleep?.enable && (
                  <div className="flex items-center gap-2">
                    <Moon size={14} />
                    Sleep: {group.sleep.ontime} - {group.sleep.offtime}
                  </div>
                )}
                {group.reboot?.enable && (
                  <div className="flex items-center gap-2">
                    <RotateCcw size={14} />
                    Reboot: {group.reboot.time}
                  </div>
                )}
                {group.ticker?.enable && (
                  <div className="flex items-center gap-2">
                    <Type size={14} />
                    Ticker active
                  </div>
                )}
                <div className="text-xs text-gray-400 pt-1">
                  Last deployed:{' '}
                  {group.lastDeployed ? new Date(group.lastDeployed).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editGroup && (
        <SettingsModal
          group={editGroup}
          onClose={() => setEditGroup(null)}
          onSaved={() => {
            setEditGroup(null);
            queryClient.invalidateQueries({ queryKey: ['displayGroups'] });
          }}
        />
      )}

      {deployModal && (
        <DeployModal
          group={deployModal}
          players={allPlayers.filter((p) => p.displayGroup?._id === deployModal._id)}
          deploying={deploying === deployModal._id}
          onDeploy={(playerIds) => handleDeploy(deployModal._id, playerIds)}
          onClose={() => setDeployModal(null)}
        />
      )}
    </div>
  );
}

function DeployModal({ group, players, deploying, onDeploy, onClose }) {
  const [mode, setMode] = useState('all'); // 'all' or 'select'
  const [selectedIds, setSelectedIds] = useState([]);

  const togglePlayer = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleDeploy = () => {
    if (mode === 'all') {
      onDeploy(null);
    } else {
      if (selectedIds.length === 0) { alert('Please select at least one screen'); return; }
      onDeploy(selectedIds);
    }
  };

  const connectedPlayers = players.filter((p) => p.isConnected);
  const offlinePlayers = players.filter((p) => !p.isConnected);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Deploy: {group.name}</h3>
            <div className="text-xs text-gray-400">
              {connectedPlayers.length} online, {offlinePlayers.length} offline
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Mode selection */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('all')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                mode === 'all'
                  ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              All screens ({connectedPlayers.length})
            </button>
            <button
              onClick={() => setMode('select')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                mode === 'select'
                  ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Select individual
            </button>
          </div>

          {/* Player list (only in select mode) */}
          {mode === 'select' && (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {players.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-4">
                  No players in this group
                </div>
              ) : (
                players.map((player) => {
                  const selected = selectedIds.includes(player._id);
                  return (
                    <div
                      key={player._id}
                      onClick={() => player.isConnected && togglePlayer(player._id)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                        !player.isConnected
                          ? 'opacity-40 cursor-not-allowed'
                          : selected
                          ? 'bg-blue-50 ring-1 ring-blue-300'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        player.isConnected ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {player.name || player.cpuSerialNumber || 'Unnamed'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {player.myIpAddress || player.ip || '-'}
                        </div>
                      </div>
                      {player.isConnected && (
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        }`}>
                          {selected && <Check size={12} className="text-white" />}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          <button
            onClick={handleDeploy}
            disabled={deploying || (mode === 'select' && selectedIds.length === 0)}
            className="w-full btn-brand py-2.5 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Rocket size={16} />
            {deploying ? 'Deploying...' : mode === 'all'
              ? `An alle ${connectedPlayers.length} Screens deployen`
              : `An ${selectedIds.length} Screen(s) deployen`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ group, onClose, onSaved }) {
  const [form, setForm] = useState({
    orientation: group.orientation || 'landscape',
    resolution: group.resolution || 'auto',
    signageBackgroundColor: group.signageBackgroundColor || '#000000',
    omxVolume: group.omxVolume ?? 100,
    animationEnable: group.animationEnable || false,
    resizeAssets: group.resizeAssets || false,
    videoKeepAspect: group.videoKeepAspect || false,
    // Sleep
    sleepEnable: group.sleep?.enable || false,
    sleepOntime: group.sleep?.ontime || '07:00',
    sleepOfftime: group.sleep?.offtime || '23:00',
    // Reboot
    rebootEnable: group.reboot?.enable || false,
    rebootTime: group.reboot?.time || '03:00',
    // Ticker
    tickerEnable: group.ticker?.enable || false,
    tickerText: group.ticker?.text || '',
    tickerSpeed: group.ticker?.speed ?? 3,
  });
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/display-groups/${group._id}`, {
        orientation: form.orientation,
        resolution: form.resolution,
        signageBackgroundColor: form.signageBackgroundColor,
        omxVolume: form.omxVolume,
        animationEnable: form.animationEnable,
        resizeAssets: form.resizeAssets,
        videoKeepAspect: form.videoKeepAspect,
        sleep: {
          enable: form.sleepEnable,
          ontime: form.sleepOntime,
          offtime: form.sleepOfftime,
        },
        reboot: {
          enable: form.rebootEnable,
          time: form.rebootTime,
        },
        ticker: {
          enable: form.tickerEnable,
          text: form.tickerText,
          speed: form.tickerSpeed,
        },
      });
      onSaved();
    } catch (err) {
      alert('Save failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">Settings: {group.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-5">
          {/* Display */}
          <Section title="Display" icon={Monitor}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Orientation">
                <select value={form.orientation} onChange={(e) => set('orientation', e.target.value)} className="input">
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
              </Field>
              <Field label="Resolution">
                <input type="text" value={form.resolution} onChange={(e) => set('resolution', e.target.value)} className="input" placeholder="auto" />
              </Field>
              <Field label="Background">
                <div className="flex gap-2">
                  <input type="color" value={form.signageBackgroundColor} onChange={(e) => set('signageBackgroundColor', e.target.value)} className="w-10 h-9 rounded border cursor-pointer" />
                  <input type="text" value={form.signageBackgroundColor} onChange={(e) => set('signageBackgroundColor', e.target.value)} className="input flex-1" />
                </div>
              </Field>
              <Field label="Volume">
                <div className="flex items-center gap-2">
                  <input type="range" min="0" max="100" value={form.omxVolume} onChange={(e) => set('omxVolume', parseInt(e.target.value))} className="flex-1" />
                  <span className="text-sm text-gray-500 w-8">{form.omxVolume}</span>
                </div>
              </Field>
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              <Toggle label="Animations" checked={form.animationEnable} onChange={(v) => set('animationEnable', v)} />
              <Toggle label="Resize Assets" checked={form.resizeAssets} onChange={(v) => set('resizeAssets', v)} />
              <Toggle label="Video Keep Aspect" checked={form.videoKeepAspect} onChange={(v) => set('videoKeepAspect', v)} />
            </div>
          </Section>

          {/* Sleep / CEC */}
          <Section title="Sleep / CEC" icon={Moon}>
            <Toggle label="Enable Sleep Schedule" checked={form.sleepEnable} onChange={(v) => set('sleepEnable', v)} />
            {form.sleepEnable && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="TV On">
                  <input type="time" value={form.sleepOntime} onChange={(e) => set('sleepOntime', e.target.value)} className="input" />
                </Field>
                <Field label="TV Off">
                  <input type="time" value={form.sleepOfftime} onChange={(e) => set('sleepOfftime', e.target.value)} className="input" />
                </Field>
              </div>
            )}
          </Section>

          {/* Reboot */}
          <Section title="Daily Reboot" icon={RotateCcw}>
            <Toggle label="Enable Daily Reboot" checked={form.rebootEnable} onChange={(v) => set('rebootEnable', v)} />
            {form.rebootEnable && (
              <div className="mt-3">
                <Field label="Reboot Time">
                  <input type="time" value={form.rebootTime} onChange={(e) => set('rebootTime', e.target.value)} className="input w-40" />
                </Field>
              </div>
            )}
          </Section>

          {/* Ticker */}
          <Section title="Ticker" icon={Type}>
            <Toggle label="Enable Ticker" checked={form.tickerEnable} onChange={(v) => set('tickerEnable', v)} />
            {form.tickerEnable && (
              <div className="space-y-3 mt-3">
                <Field label="Text">
                  <textarea value={form.tickerText} onChange={(e) => set('tickerText', e.target.value)} className="input" rows={2} placeholder="Ticker text..." />
                </Field>
                <Field label="Speed">
                  <div className="flex items-center gap-2">
                    <input type="range" min="1" max="10" value={form.tickerSpeed} onChange={(e) => set('tickerSpeed', parseInt(e.target.value))} className="flex-1" />
                    <span className="text-sm text-gray-500 w-6">{form.tickerSpeed}</span>
                  </div>
                </Field>
              </div>
            )}
          </Section>

          <button
            type="submit"
            disabled={saving}
            className="w-full btn-brand py-2.5"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
      <h4 className="flex items-center gap-2 font-medium text-sm text-gray-700 mb-3">
        <Icon size={16} /> {title}
      </h4>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      {label}
    </label>
  );
}
