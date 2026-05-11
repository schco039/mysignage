import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit, Save, X, Tv, Moon } from 'lucide-react';
import { useState } from 'react';
import api from '../api/client';

export default function UserGroups() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: '', members: [], sleep: { enable: false, ontime: '07:00', offtime: '23:00' } });

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['userGroups'],
    queryFn: () => api.get('/user-groups').then((r) => r.data),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const createGroup = useMutation({
    mutationFn: (data) => api.post('/user-groups', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userGroups'] });
      setShowCreate(false);
      setNewName('');
    },
    onError: (err) => alert(err.response?.data?.error || 'Error creating group'),
  });

  const updateGroup = useMutation({
    mutationFn: ({ id, data }) => api.put(`/user-groups/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userGroups'] });
      setEditingId(null);
    },
  });

  const deleteGroup = useMutation({
    mutationFn: (id) => api.delete(`/user-groups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userGroups'] }),
  });

  const startEdit = (group) => {
    setEditingId(group._id);
    setEditData({
      name: group.name || '',
      members: group.members?.map((m) => m._id) || [],
      sleep: group.sleep || { enable: false, ontime: '07:00', offtime: '23:00' },
    });
  };

  const toggleItem = (arr, id) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="page-title">User Groups</h2>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 btn-brand">
          <Plus size={18} /> New Group
        </button>
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
            <button type="submit" className="btn-brand">Create</button>
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

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group._id} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              {editingId === group._id ? (
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="font-semibold text-lg border rounded-lg px-3 py-1 flex-1 mr-3"
                  placeholder="Group name"
                />
              ) : (
                <h3 className="font-semibold text-lg">{group.name}</h3>
              )}
              <div className="flex gap-1">
                {editingId === group._id ? (
                  <>
                    <button
                      onClick={() => updateGroup.mutate({ id: group._id, data: editData })}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Save size={18} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 text-gray-600 hover:bg-gray-50 rounded"
                    >
                      <X size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(group)}
                      className="p-1.5 text-brand-600 hover:bg-brand-50 rounded"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Really delete this user group?')) deleteGroup.mutate(group._id);
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Members */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Members</h4>
                {editingId === group._id ? (
                  <div className="space-y-1">
                    {users.map((user) => (
                      <label key={user._id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editData.members.includes(user._id)}
                          onChange={() =>
                            setEditData({ ...editData, members: toggleItem(editData.members, user._id) })
                          }
                        />
                        {user.username} ({user.role})
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {group.members?.length > 0 ? (
                      group.members.map((m) => (
                        <span
                          key={m._id}
                          className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-xs"
                        >
                          {m.username}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">No members</span>
                    )}
                  </div>
                )}
              </div>

              {/* Players (read-only — assignment via Players page) */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <Tv size={14} /> Players
                </h4>
                <div className="flex flex-wrap gap-1">
                  {group.players?.length > 0 ? (
                    group.players.map((p) => (
                      <span
                        key={p._id}
                        className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs"
                      >
                        {p.name || p.cpuSerialNumber}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">No players (assign via Players page)</span>
                  )}
                </div>
              </div>
            </div>

            {/* CEC Sleep-Anzeige (außerhalb des Edit-Modus) */}
            {editingId !== group._id && (
              <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs">
                <Moon size={14} className="text-gray-400" />
                {group.sleep?.enable ? (
                  <span className="text-gray-600">
                    TV CEC active: <span className="font-mono font-semibold">{group.sleep.ontime}</span>
                    {' – '}
                    <span className="font-mono font-semibold">{group.sleep.offtime}</span>
                  </span>
                ) : (
                  <span className="text-gray-400">CEC sleep disabled</span>
                )}
              </div>
            )}

            {/* Sleep / TV-Zeiten */}
            {editingId === group._id && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <Moon size={14} /> TV sleep times
                </h4>
                <label className="flex items-center gap-2 text-sm mb-2">
                  <input
                    type="checkbox"
                    checked={editData.sleep?.enable || false}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        sleep: { ...editData.sleep, enable: e.target.checked },
                      })
                    }
                  />
                  Enable sleep (CEC)
                </label>
                {editData.sleep?.enable && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">TV on from (HH:MM)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
                        placeholder="07:00"
                        value={editData.sleep.ontime || ''}
                        onChange={(e) =>
                          setEditData({ ...editData, sleep: { ...editData.sleep, ontime: e.target.value } })
                        }
                        className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">TV off from (HH:MM)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
                        placeholder="23:00"
                        value={editData.sleep.offtime || ''}
                        onChange={(e) =>
                          setEditData({ ...editData, sleep: { ...editData.sleep, offtime: e.target.value } })
                        }
                        className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {groups.length === 0 && (
          <div className="card p-8 text-center text-gray-500">
            No user groups yet.
          </div>
        )}
      </div>
    </div>
  );
}
