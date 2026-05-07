import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Plus, X, GripVertical, Clock, CalendarDays } from 'lucide-react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../api/client';

export default function PlaylistEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState({
    enabled: false,
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  });

  const { data: playlist } = useQuery({
    queryKey: ['playlist', id],
    queryFn: () => api.get(`/playlists/${id}`).then((r) => r.data),
  });

  const { data: availableAssets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.get('/assets').then((r) => r.data),
    enabled: !!playlist,
  });

  useEffect(() => {
    if (playlist) {
      setName(playlist.name);
      if (playlist.schedule) {
        setSchedule({
          enabled: playlist.schedule.enabled || false,
          startDate: playlist.schedule.startDate
            ? format(new Date(playlist.schedule.startDate), 'yyyy-MM-dd')
            : '',
          endDate: playlist.schedule.endDate
            ? format(new Date(playlist.schedule.endDate), 'yyyy-MM-dd')
            : '',
          startTime: playlist.schedule.startTime || '',
          endTime: playlist.schedule.endTime || '',
          daysOfWeek: playlist.schedule.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
        });
      }
      setItems(
        playlist.assets.map((a) => ({
          asset: a.asset?._id || a.asset,
          filename: a.asset?.filename || a.option?.filename || '',
          originalName: a.asset?.originalName || a.option?.filename || '',
          thumbnail: a.asset?.thumbnail || null,
          duration: a.duration || 10,
        }))
      );
    }
  }, [playlist]);

  const updatePlaylist = useMutation({
    mutationFn: (data) => api.put(`/playlists/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist', id] });
    },
  });

  const handleSave = () => {
    updatePlaylist.mutate({
      name,
      assets: items.map((item) => ({
        asset: item.asset,
        duration: item.duration,
        option: { filename: item.filename, duration: item.duration, selected: true },
      })),
      schedule: {
        enabled: schedule.enabled,
        startDate: schedule.startDate || null,
        endDate: schedule.endDate || null,
        startTime: schedule.startTime || null,
        endTime: schedule.endTime || null,
        daysOfWeek: schedule.daysOfWeek,
      },
    });
  };

  const addAsset = (asset) => {
    setItems((prev) => [
      ...prev,
      {
        asset: asset._id,
        filename: asset.filename,
        originalName: asset.originalName,
        thumbnail: asset.thumbnail,
        duration: asset.duration || 10,
      },
    ]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const moveItem = (from, to) => {
    setItems((prev) => {
      const newItems = [...prev];
      const [moved] = newItems.splice(from, 1);
      newItems.splice(to, 0, moved);
      return newItems;
    });
  };

  if (!playlist) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/playlists')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={24} />
        </button>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-brand-500 outline-none"
        />
        <button
          onClick={handleSave}
          disabled={updatePlaylist.isPending}
          className="ml-auto flex items-center gap-2 btn-brand disabled:opacity-50"
        >
          <Save size={18} />
          {updatePlaylist.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Schedule panel */}
      <div className="card p-4 mb-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) => setSchedule((s) => ({ ...s, enabled: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-300 text-blue-600"
          />
          <CalendarDays size={16} className="text-gray-500" />
          <span className="text-sm font-medium">Schedule this playlist</span>
        </label>

        {schedule.enabled && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                value={schedule.startDate}
                onChange={(e) => setSchedule((s) => ({ ...s, startDate: e.target.value }))}
                className="w-full border rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                value={schedule.endDate}
                onChange={(e) => setSchedule((s) => ({ ...s, endDate: e.target.value }))}
                className="w-full border rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Time</label>
              <input
                type="time"
                value={schedule.startTime}
                onChange={(e) => setSchedule((s) => ({ ...s, startTime: e.target.value }))}
                className="w-full border rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Time</label>
              <input
                type="time"
                value={schedule.endTime}
                onChange={(e) => setSchedule((s) => ({ ...s, endTime: e.target.value }))}
                className="w-full border rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div className="col-span-2 md:col-span-4">
              <label className="block text-xs text-gray-500 mb-1">Days</label>
              <div className="flex gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setSchedule((s) => ({
                        ...s,
                        daysOfWeek: s.daysOfWeek.includes(idx)
                          ? s.daysOfWeek.filter((d) => d !== idx)
                          : [...s.daysOfWeek, idx].sort(),
                      }))
                    }
                    className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${
                      schedule.daysOfWeek.includes(idx)
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Playlist items */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Playlist Items ({items.length})</h3>
            </div>
            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Add assets from the panel on the right.
              </div>
            ) : (
              <div className="divide-y">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-3">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => index > 0 && moveItem(index, index - 1)}
                        disabled={index === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => index < items.length - 1 && moveItem(index, index + 1)}
                        disabled={index === items.length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                      >
                        ▼
                      </button>
                    </div>
                    <div className="w-16 h-10 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                      {item.thumbnail ? (
                        <img
                          src={`/media/${item.thumbnail}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-gray-400">No thumb</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.originalName}</div>
                      <div className="text-xs text-gray-400">{item.filename}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Duration:</label>
                      <input
                        type="number"
                        value={item.duration}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 1;
                          setItems((prev) =>
                            prev.map((it, i) => (i === index ? { ...it, duration: val } : it))
                          );
                        }}
                        className="w-16 border rounded px-2 py-1 text-sm"
                        min="1"
                      />
                      <span className="text-xs text-gray-400">s</span>
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Available assets */}
        <div>
          <div className="card">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Available Assets</h3>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y">
              {availableAssets.map((asset) => (
                <div
                  key={asset._id}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => addAsset(asset)}
                >
                  <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                    {asset.thumbnail ? (
                      <img
                        src={`/media/${asset.thumbnail}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{asset.originalName}</div>
                    <div className="text-xs text-gray-400">{asset.type}</div>
                  </div>
                  <Plus size={16} className="text-blue-500" />
                </div>
              ))}
              {availableAssets.length === 0 && (
                <div className="p-4 text-sm text-gray-500 text-center">
                  No assets available. Upload files in Media Library.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
