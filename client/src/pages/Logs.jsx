import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw, Trash2, Filter, Wifi, WifiOff, Rocket, Download, AlertCircle, Tv, RotateCcw, Clock,
} from 'lucide-react';
import { useState } from 'react';
import api from '../api/client';
import useAuth from '../hooks/useAuth';
import { formatRelative } from '../utils/format';

const TYPE_CONFIG = {
  deploy: { icon: Rocket, color: 'text-blue-600 bg-blue-50', label: 'Deploy' },
  download: { icon: Download, color: 'text-purple-600 bg-purple-50', label: 'Download' },
  connect: { icon: Wifi, color: 'text-green-600 bg-green-50', label: 'Connect' },
  disconnect: { icon: WifiOff, color: 'text-gray-600 bg-gray-50', label: 'Disconnect' },
  error: { icon: AlertCircle, color: 'text-red-600 bg-red-50', label: 'Error' },
  cec: { icon: Tv, color: 'text-yellow-600 bg-yellow-50', label: 'CEC' },
  reboot: { icon: RotateCcw, color: 'text-orange-600 bg-orange-50', label: 'Reboot' },
  cron: { icon: Clock, color: 'text-cyan-600 bg-cyan-50', label: 'Cron' },
};

export default function Logs() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [filterType, setFilterType] = useState('');
  const [filterPlayer, setFilterPlayer] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [expanded, setExpanded] = useState(null);

  const { data: logs = [], isLoading, isFetching } = useQuery({
    queryKey: ['logs', filterType, filterPlayer, filterGroup],
    queryFn: () => {
      const params = {};
      if (filterType) params.type = filterType;
      if (filterPlayer) params.player = filterPlayer;
      if (filterGroup) params.displayGroup = filterGroup;
      return api.get('/logs', { params }).then((r) => r.data);
    },
    refetchInterval: 15000,
  });

  const clearLogs = useMutation({
    mutationFn: () => api.delete('/logs'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['logs'] }),
  });

  // Unique players and groups for filter dropdowns
  const players = [...new Set(logs.map((l) => l.player).filter(Boolean))].sort();
  const groups = [...new Set(logs.map((l) => l.displayGroup).filter(Boolean))].sort();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="page-title">Logs</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['logs'] })}
            className={`p-2 rounded-lg border hover:bg-gray-50 ${isFetching ? 'animate-spin' : ''}`}
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          {isAdmin && (
            <button
              onClick={() => { if (confirm('Clear all logs?')) clearLogs.mutate(); }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              <Trash2 size={16} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>

        <select
          value={filterPlayer}
          onChange={(e) => setFilterPlayer(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Players</option>
          {players.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Groups</option>
          {groups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        {(filterType || filterPlayer || filterGroup) && (
          <button
            onClick={() => { setFilterType(''); setFilterPlayer(''); setFilterGroup(''); }}
            className="text-sm text-gray-500 hover:text-gray-700 px-2"
          >
            Clear filters
          </button>
        )}

        <span className="text-sm text-gray-400 ml-auto py-2">{logs.length} entries</span>
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No logs yet.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y max-h-[70vh] overflow-y-auto">
            {logs.map((entry) => {
              const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.error;
              const Icon = cfg.icon;
              const isExpanded = expanded === entry._id;

              return (
                <div
                  key={entry._id}
                  className="p-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : entry._id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${cfg.color}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{entry.message}</div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        {entry.player && <span>{entry.player}</span>}
                        {entry.displayGroup && <span>{entry.displayGroup}</span>}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 shrink-0">
                      {formatRelative(entry.createdAt)}
                    </div>
                  </div>

                  {isExpanded && entry.details && (
                    <div className="mt-2 ml-10 p-2 bg-gray-50 rounded text-xs font-mono text-gray-600 overflow-x-auto">
                      <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

