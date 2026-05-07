import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit, Play, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function Playlists() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [previewPlaylist, setPreviewPlaylist] = useState(null);

  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => api.get('/playlists').then((r) => r.data),
  });

  const { data: displayGroups = [] } = useQuery({
    queryKey: ['displayGroups'],
    queryFn: () => api.get('/display-groups').then((r) => r.data),
  });

  const createPlaylist = useMutation({
    mutationFn: (data) => api.post('/playlists', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      setShowCreate(false);
      setNewName('');
      setNewGroup('');
    },
  });

  const deletePlaylist = useMutation({
    mutationFn: (id) => api.delete(`/playlists/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playlists'] }),
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="page-title">Playlists</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 btn-brand"
        >
          <Plus size={18} /> New Playlist
        </button>
      </div>

      {showCreate && (
        <div className="card p-4 mb-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createPlaylist.mutate({ name: newName, displayGroup: newGroup });
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Playlist name"
              className="flex-1 border rounded-lg px-3 py-2"
              required
            />
            <select
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              className="border rounded-lg px-3 py-2"
              required
            >
              <option value="">Select group</option>
              {displayGroups.map((dg) => (
                <option key={dg._id} value={dg._id}>
                  {dg.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="btn-brand"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg border hover:bg-gray-50"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {playlists.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No playlists yet. Create one to get started.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="p-3">Name</th>
                <th className="p-3">Display Group</th>
                <th className="p-3">Assets</th>
                <th className="p-3">Schedule</th>
                <th className="p-3">Created</th>
                <th className="p-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {playlists.map((pl) => (
                <tr key={pl._id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3 font-medium">{pl.name}</td>
                  <td className="p-3">{pl.displayGroup?.name || '-'}</td>
                  <td className="p-3">{pl.assets?.length || 0}</td>
                  <td className="p-3">
                    {pl.schedule?.enabled ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Always on</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-500">
                    {new Date(pl.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {pl.assets?.length > 0 && (
                        <button
                          onClick={() => setPreviewPlaylist(pl)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="Preview"
                        >
                          <Play size={16} />
                        </button>
                      )}
                      <Link
                        to={`/playlists/${pl._id}/edit`}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm('Delete this playlist?'))
                            deletePlaylist.mutate(pl._id);
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewPlaylist && (
        <PlaylistPreview
          playlist={previewPlaylist}
          onClose={() => setPreviewPlaylist(null)}
        />
      )}
    </div>
  );
}

function PlaylistPreview({ playlist, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const assets = playlist.assets || [];
  const current = assets[currentIndex];
  const duration = (current?.duration || 10) * 1000;

  // Auto-advance
  useEffect(() => {
    if (paused || assets.length <= 1) return;
    const type = (current?.asset || current)?.type;
    if (type === 'video') return; // video advances on ended
    const timer = setTimeout(() => {
      setCurrentIndex((i) => (i + 1) % assets.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, paused, duration, assets.length]);

  const asset = current?.asset || current;
  const filename = asset?.filename || current?.option?.filename;
  const type = asset?.type || 'image';
  const mediaUrl = `/media/${filename}`;

  if (!filename) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" onClick={() => setPaused((p) => !p)}>
      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
      >
        <X size={24} />
      </button>

      {/* Info bar */}
      <div className="absolute top-4 left-4 z-10 bg-black/50 text-white px-3 py-1.5 rounded-lg text-sm">
        {playlist.name} — {currentIndex + 1} / {assets.length}
        {paused && ' (paused)'}
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
        {assets.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i === currentIndex ? 'bg-white' : 'bg-white/40'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center">
        {type === 'video' ? (
          <video
            key={filename}
            src={mediaUrl}
            autoPlay
            muted
            className="max-w-full max-h-full object-contain"
            onEnded={() => setCurrentIndex((i) => (i + 1) % assets.length)}
          />
        ) : type === 'html' || type === 'link' ? (
          <iframe
            key={filename}
            src={mediaUrl}
            className="w-full h-full border-0"
            title={filename}
          />
        ) : (
          <img
            key={filename}
            src={mediaUrl}
            alt={filename}
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* Navigation arrows */}
      {assets.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => (i - 1 + assets.length) % assets.length); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 text-xl"
          >
            &#8249;
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => (i + 1) % assets.length); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 text-xl"
          >
            &#8250;
          </button>
        </>
      )}
    </div>
  );
}
