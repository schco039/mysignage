import { useQuery } from '@tanstack/react-query';
import {
  Tv, Monitor, FolderOpen, ListVideo, HardDrive,
  Wifi, WifiOff, Thermometer, Clock, CalendarDays,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/client';

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-gray-500 text-sm">{label}</div>
          {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => api.get('/players').then((r) => r.data),
    refetchInterval: 30000,
  });
  const { data: displayGroups = [] } = useQuery({
    queryKey: ['displayGroups'],
    queryFn: () => api.get('/display-groups').then((r) => r.data),
  });
  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.get('/assets').then((r) => r.data),
  });
  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => api.get('/playlists').then((r) => r.data),
  });

  const onlinePlayers = players.filter((p) => p.isConnected);
  const offlinePlayers = players.filter((p) => !p.isConnected);
  const scheduledPlaylists = playlists.filter((p) => p.schedule?.enabled);

  return (
    <div>
      <h2 className="page-title mb-6">Dashboard</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Tv}
          label="Players"
          value={`${onlinePlayers.length} / ${players.length}`}
          sub={onlinePlayers.length === players.length ? 'All online' : `${offlinePlayers.length} offline`}
          color="bg-green-500"
        />
        <StatCard
          icon={Monitor}
          label="Display Groups"
          value={displayGroups.length}
          color="bg-brand-600"
        />
        <StatCard
          icon={FolderOpen}
          label="Assets"
          value={assets.length}
          color="bg-purple-500"
        />
        <StatCard
          icon={CalendarDays}
          label="Scheduled"
          value={scheduledPlaylists.length}
          sub={`${playlists.length} total playlists`}
          color="bg-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Players list */}
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">Players</h3>
            <Link to="/players" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all</Link>
          </div>
          {players.length === 0 ? (
            <p className="p-4 text-gray-500 text-sm">No players registered yet.</p>
          ) : (
            <div className="divide-y max-h-96 overflow-y-auto">
              {players.map((player) => (
                <div key={player._id} className="flex items-center gap-3 p-3">
                  <div className={`p-1.5 rounded-lg ${player.isConnected ? 'bg-green-50' : 'bg-gray-50'}`}>
                    {player.isConnected ? (
                      <Wifi size={16} className="text-green-500" />
                    ) : (
                      <WifiOff size={16} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {player.name || player.cpuSerialNumber || 'Unnamed'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {player.displayGroup?.name || 'No group'} {player.ip ? `\u2022 ${player.ip}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {player.isConnected ? (
                      <div className="space-y-0.5">
                        {player.piTemperature && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Thermometer size={12} />
                            {player.piTemperature}
                          </div>
                        )}
                        {player.currentPlaylist && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <ListVideo size={12} />
                            {player.currentPlaylist}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={12} />
                        {player.lastReported
                          ? timeAgo(new Date(player.lastReported))
                          : 'Never'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Display Groups overview */}
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">Display Groups</h3>
            <Link to="/display-groups" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all</Link>
          </div>
          {displayGroups.length === 0 ? (
            <p className="p-4 text-gray-500 text-sm">No display groups yet.</p>
          ) : (
            <div className="divide-y max-h-96 overflow-y-auto">
              {displayGroups.map((group) => {
                const groupPlayers = players.filter(
                  (p) => p.displayGroup?._id === group._id || p.displayGroup?.name === group.name
                );
                const groupOnline = groupPlayers.filter((p) => p.isConnected).length;
                const groupPlaylists = playlists.filter(
                  (p) => p.displayGroup?._id === group._id || p.displayGroup === group._id
                );

                return (
                  <div key={group._id} className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{group.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        groupOnline > 0
                          ? 'bg-green-100 text-green-700'
                          : groupPlayers.length > 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-500'
                      }`}>
                        {groupOnline}/{groupPlayers.length} online
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{group.orientation}</span>
                      <span>{groupPlaylists.length} playlists</span>
                      {group.sleep?.enable && (
                        <span>Sleep {group.sleep.ontime}-{group.sleep.offtime}</span>
                      )}
                      {group.lastDeployed && (
                        <span>Deployed {timeAgo(new Date(group.lastDeployed))}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
