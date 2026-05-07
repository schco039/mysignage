import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, Image, Video, FileText, Globe, Clock, X } from 'lucide-react';
import { useState, useRef } from 'react';
import api from '../api/client';
import useAuth from '../hooks/useAuth';

const typeIcons = {
  image: Image,
  video: Video,
  pdf: FileText,
  html: Globe,
  other: FileText,
};

const typeFilters = [
  { value: '', label: 'Alle' },
  { value: 'image', label: 'Bilder' },
  { value: 'video', label: 'Videos' },
  { value: 'pdf', label: 'PDF' },
  { value: 'html', label: 'HTML' },
];

export default function Assets() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [uploadModal, setUploadModal] = useState(null); // [{ file, name }] or null

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', typeFilter],
    queryFn: () => {
      const params = {};
      if (typeFilter) params.type = typeFilter;
      return api.get('/assets', { params }).then((r) => r.data);
    },
  });

  const deleteAsset = useMutation({
    mutationFn: (id) => api.delete(`/assets/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
    onError: (err) => alert(err.response?.data?.error || 'Delete failed'),
  });

  const handleFilesSelected = (files) => {
    if (!files?.length) return;
    const items = Array.from(files).map((file) => {
      // Default name = filename without extension
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      return { file, name: nameWithoutExt };
    });
    setUploadModal(items);
  };

  const handleUpload = async () => {
    if (!uploadModal?.length) return;
    // Validate all names
    for (const item of uploadModal) {
      if (!item.name.trim()) {
        alert('Bitte alle Namen ausfüllen');
        return;
      }
    }
    setUploading(true);
    try {
      const formData = new FormData();
      for (const item of uploadModal) {
        formData.append('files', item.file);
      }
      formData.append('names', JSON.stringify(uploadModal.map((i) => i.name.trim())));
      formData.append('displayGroups', JSON.stringify([]));
      formData.append('labels', JSON.stringify([]));
      formData.append('validity', JSON.stringify({ enabled: false }));

      await api.post('/assets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setUploadModal(null);
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const updateUploadName = (index, name) => {
    setUploadModal((prev) =>
      prev.map((item, i) => (i === index ? { ...item, name } : item))
    );
  };

  const removeUploadItem = (index) => {
    setUploadModal((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : null;
    });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    if (seconds < 60) return seconds + 's';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="page-title">Media Library</h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {typeFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  typeFilter === f.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 btn-brand disabled:opacity-50"
          >
            <Upload size={18} />
            Upload
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : assets.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No assets yet. Upload files to get started.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {assets.map((asset) => {
            const Icon = typeIcons[asset.type] || FileText;
            return (
              <div key={asset._id} className="card overflow-hidden group">
                <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
                  {asset.thumbnail ? (
                    <img
                      src={`/media/${asset.thumbnail}`}
                      alt={asset.originalName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon size={32} className="text-gray-400" />
                  )}
                  <button
                    onClick={() => {
                      if (confirm('Delete this asset?')) deleteAsset.mutate(asset._id);
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                  {asset.type === 'video' && asset.duration > 0 && (
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Clock size={10} />
                      {formatDuration(asset.duration)}
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <div className="text-xs font-medium truncate" title={asset.originalName}>
                    {asset.originalName}
                  </div>
                  <div className="text-xs text-gray-400 flex justify-between">
                    <span>{asset.type}</span>
                    <span>{formatSize(asset.size)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b shrink-0">
              <h3 className="text-lg font-semibold">
                {uploadModal.length === 1 ? 'Asset benennen' : `${uploadModal.length} Assets benennen`}
              </h3>
              <button onClick={() => setUploadModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {uploadModal.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="shrink-0 w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                    {item.file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(item.file)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : item.file.type.startsWith('video/') ? (
                      <Video size={20} className="text-gray-400" />
                    ) : (
                      <FileText size={20} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateUploadName(idx, e.target.value)}
                      placeholder="Name eingeben..."
                      className="w-full border rounded-lg px-3 py-1.5 text-sm font-medium"
                      required
                    />
                    <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                      {item.file.name} — {formatSize(item.file.size)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeUploadItem(idx)}
                    className="text-gray-300 hover:text-red-500 shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t shrink-0">
              <button
                onClick={handleUpload}
                disabled={uploading || uploadModal.some((i) => !i.name.trim())}
                className="w-full btn-brand py-2.5 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Upload size={16} />
                {uploading ? 'Uploading...' : `${uploadModal.length} Asset(s) hochladen`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
