import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, RotateCcw, Terminal, Tv, Pencil, Check, X, Plus, Trash2, Send, Image, Video, FileText, Globe } from 'lucide-react';
import { useState } from 'react';
import api from '../api/client';
import useAuth from '../hooks/useAuth';

const typeIcons = {
  image: Image,
  video: Video,
  pdf: FileText,
  html: Globe,
  other: FileText,
};

export default function Players() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['players'],
    queryFn: () => api.get('/players').then((r) => r.data),
    refetchInterval: 10000,
  });

  const { data: userGroups = [] } = useQuery({
    queryKey: ['userGroups'],
    queryFn: () => api.get('/user-groups').then((r) => r.data),
  });

  const { data: allAssets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.get('/assets').then((r) => r.data),
  });

  const updatePlayer = useMutation({
    mutationFn: ({ id, data }) => api.put(`/players/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
  });

  const deletePlayer = useMutation({
    mutationFn: (id) => api.delete(`/players/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
    onError: (err) => alert(err.response?.data?.error || 'Delete failed'),
  });

  const deployPlayer = useMutation({
    mutationFn: (id) => api.post(`/players/${id}/deploy-direct`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
    onError: (err) => alert(err.response?.data?.error || 'Deploy failed'),
  });

  const [shellInput, setShellInput] = useState({});
  const [editingName, setEditingName] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState({});
  const [assetPicker, setAssetPicker] = useState(null);
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  };

  const sendAction = async (id, action) => {
    const labels = {
      screenshot: 'Screenshot requested',
      reboot: 'Reboot command sent',
      'tv-power': 'TV power command sent',
    };
    try {
      await api.post(`/players/${id}/${action}`);
      showToast(labels[action] || `${action} ausgeführt`, 'success');
      if (action === 'screenshot') {
        setTimeout(() => {
          setScreenshotUrl((prev) => ({
            ...prev,
            [id]: `/media/_screenshots/${players.find((p) => p._id === id)?.cpuSerialNumber}.png?t=${Date.now()}`,
          }));
          showToast('Screenshot received', 'success');
        }, 3000);
      }
    } catch (err) {
      showToast(err.response?.data?.error || `${action} failed`, 'error');
    }
  };

  const sendShell = async (id) => {
    const cmd = shellInput[id];
    if (!cmd) return;
    try {
      await api.post(`/players/${id}/shell`, { cmd });
      showToast(`Shell command sent: ${cmd}`, 'success');
      setShellInput((prev) => ({ ...prev, [id]: '' }));
    } catch (err) {
      showToast(err.response?.data?.error || 'Shell command failed', 'error');
    }
  };

  const startEditName = (player) => {
    setEditingName(player._id);
    setNameInput(player.name || '');
  };

  const saveName = (playerId) => {
    updatePlayer.mutate({ id: playerId, data: { name: nameInput } });
    setEditingName(null);
  };

  const toggleUserGroup = (playerId, groupId, currentGroups) => {
    const ids = currentGroups.map((g) => (typeof g === 'object' ? g._id : g));
    const next = ids.includes(groupId)
      ? ids.filter((id) => id !== groupId)
      : [...ids, groupId];
    updatePlayer.mutate({ id: playerId, data: { userGroups: next } });
  };

  const addDirectAsset = (playerId, asset) => {
    const player = players.find((p) => p._id === playerId);
    const current = player?.directAssets || [];
    updatePlayer.mutate({
      id: playerId,
      data: { directAssets: [...current, { asset: asset._id, duration: asset.duration || 10 }] },
    });
  };

  const removeDirectAsset = (playerId, index) => {
    const player = players.find((p) => p._id === playerId);
    const newAssets = (player?.directAssets || []).filter((_, i) => i !== index);
    updatePlayer.mutate({ id: playerId, data: { directAssets: newAssets } });
  };

  const updateDirectAssetDuration = (playerId, index, duration) => {
    const player = players.find((p) => p._id === playerId);
    const newAssets = (player?.directAssets || []).map((da, i) =>
      i === index ? { ...da, duration } : da
    );
    updatePlayer.mutate({ id: playerId, data: { directAssets: newAssets } });
  };

  const getAssetInfo = (assetId) => allAssets.find((a) => a._id === assetId) || null;

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h2 className="page-title mb-6">Players</h2>

      {players.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No players registered yet. Connect a player to see it here.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {players.map((player) => {
            const ssUrl =
              screenshotUrl[player._id] ||
              (player.cpuSerialNumber
                ? `/media/_screenshots/${player.cpuSerialNumber}.png`
                : null);
            const directAssets = player.directAssets || [];
            const playerGroupIds = (player.userGroups || []).map((g) =>
              typeof g === 'object' ? g._id : g
            );

            return (
              <div key={player._id} className="card p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        player.isConnected ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                    {editingName === player._id ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveName(player._id)}
                          className="border rounded px-2 py-0.5 text-sm flex-1 min-w-0"
                          autoFocus
                        />
                        <button onClick={() => saveName(player._id)} className="text-green-600 hover:text-green-700">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingName(null)} className="text-gray-400 hover:text-gray-600">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {player.name || player.cpuSerialNumber || 'Unnamed'}
                        </h3>
                        <button
                          onClick={() => startEditName(player)}
                          className="text-gray-300 hover:text-gray-600 shrink-0"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className="text-xs text-gray-400">{player.version}</span>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          if (confirm(`Really delete player "${player.name || player.cpuSerialNumber}"?`))
                            deletePlayer.mutate(player._id);
                        }}
                        className="p-1 text-gray-300 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Screenshot */}
                {ssUrl && (
                  <div className="mb-3 rounded-lg overflow-hidden bg-gray-100 aspect-video">
                    <img
                      src={ssUrl}
                      alt="Screenshot"
                      className="w-full h-full object-contain"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}

                {/* Info */}
                <div className="text-sm text-gray-600 space-y-1 mb-3">
                  {player.name && <div className="text-xs text-gray-400">{player.cpuSerialNumber}</div>}
                  <div>IP: {player.myIpAddress || player.ip || '-'}</div>
                  <div>Temp: {player.piTemperature || '-'}</div>
                  <div>Disk: {player.diskSpaceUsed || '-'} / {player.diskSpaceAvailable || '-'}</div>
                  <div>Playlist: {player.currentPlaylist || '-'}</div>
                </div>

                {/* Settings */}
                <div className="mb-3 space-y-2">
                  {/* Standby Screen */}
                  <select
                    value={player.defaultScreen || 'modern'}
                    onChange={(e) =>
                      updatePlayer.mutate({ id: player._id, data: { defaultScreen: e.target.value } })
                    }
                    className="input text-sm w-full"
                  >
                    <option value="modern">Standby: Modern</option>
                    <option value="testbild">Standby: Test pattern</option>
                  </select>

                  {/* User Groups — nur Admin kann zuweisen */}
                  {isAdmin && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        User Groups
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {userGroups.map((ug) => {
                          const active = playerGroupIds.includes(ug._id);
                          return (
                            <button
                              key={ug._id}
                              onClick={() => toggleUserGroup(player._id, ug._id, player.userGroups || [])}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                active
                                  ? 'bg-brand-500 text-white'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {ug.name}
                            </button>
                          );
                        })}
                        {userGroups.length === 0 && (
                          <span className="text-xs text-gray-400">No user groups available</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Assets */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Direct Assets
                    </h4>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setAssetPicker(assetPicker === player._id ? null : player._id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 font-medium"
                      >
                        <Plus size={12} /> Add
                      </button>
                      {directAssets.length > 0 && player.isConnected && (
                        <button
                          onClick={() => deployPlayer.mutate(player._id)}
                          disabled={deployPlayer.isPending}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-medium disabled:opacity-50"
                        >
                          <Send size={12} /> Deploy
                        </button>
                      )}
                    </div>
                  </div>

                  {assetPicker === player._id && (
                    <div className="mb-2 border rounded-lg max-h-48 overflow-y-auto bg-white shadow-sm">
                      {allAssets.length === 0 ? (
                        <div className="p-3 text-xs text-gray-400 text-center">No assets</div>
                      ) : (
                        allAssets.map((asset) => {
                          const Icon = typeIcons[asset.type] || FileText;
                          return (
                            <div
                              key={asset._id}
                              onClick={() => { addDirectAsset(player._id, asset); setAssetPicker(null); }}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                            >
                              <div className="w-10 h-7 bg-gray-100 rounded flex items-center justify-center overflow-hidden shrink-0">
                                {asset.thumbnail ? (
                                  <img src={`/media/${asset.thumbnail}`} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Icon size={14} className="text-gray-400" />
                                )}
                              </div>
                              <span className="truncate flex-1">{asset.originalName}</span>
                              <span className="text-xs text-gray-400">{asset.type}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {directAssets.length > 0 ? (
                    <div className="space-y-1">
                      {directAssets.map((da, idx) => {
                        const asset = getAssetInfo(da.asset?._id || da.asset);
                        const Icon = typeIcons[asset?.type] || FileText;
                        return (
                          <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                            <div className="w-8 h-6 bg-gray-200 rounded flex items-center justify-center overflow-hidden shrink-0">
                              {asset?.thumbnail ? (
                                <img src={`/media/${asset.thumbnail}`} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Icon size={12} className="text-gray-400" />
                              )}
                            </div>
                            <span className="text-xs truncate flex-1">{asset?.originalName || 'Unknown'}</span>
                            <input
                              type="number"
                              value={da.duration || 10}
                              onChange={(e) =>
                                updateDirectAssetDuration(player._id, idx, parseInt(e.target.value, 10) || 1)
                              }
                              className="w-14 border rounded px-1.5 py-0.5 text-xs text-center"
                              min="1"
                            />
                            <span className="text-[10px] text-gray-400">s</span>
                            <button
                              onClick={() => removeDirectAsset(player._id, idx)}
                              className="text-red-400 hover:text-red-600 shrink-0"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 text-center py-2">
                      No direct assets. Use the Schedule for time-based content.
                    </div>
                  )}
                </div>

                {/* Actions */}
                {player.isConnected && (
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => sendAction(player._id, 'screenshot')}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 font-medium"
                    >
                      <Camera size={14} /> Screenshot
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => sendAction(player._id, 'reboot')}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-50 text-orange-600 rounded hover:bg-orange-100"
                        >
                          <RotateCcw size={14} /> Reboot
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await api.post(`/players/${player._id}/tv-power`, { on: !player.tvStatus });
                              showToast(`TV ${!player.tvStatus ? 'on' : 'off'} sent`, 'success');
                            } catch (err) {
                              showToast(err.response?.data?.error || 'TV command failed', 'error');
                            }
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
                        >
                          <Tv size={14} /> TV
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Shell (Admin only) */}
                {isAdmin && player.isConnected && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shellInput[player._id] || ''}
                      onChange={(e) => setShellInput((prev) => ({ ...prev, [player._id]: e.target.value }))}
                      placeholder="Shell command..."
                      className="flex-1 border rounded px-2 py-1 text-xs"
                      onKeyDown={(e) => e.key === 'Enter' && sendShell(player._id)}
                    />
                    <button
                      onClick={() => sendShell(player._id)}
                      className="px-2 py-1 text-xs bg-brand-700 text-white rounded-lg hover:bg-brand-800"
                    >
                      <Terminal size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2 ${
              t.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-green-500 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
