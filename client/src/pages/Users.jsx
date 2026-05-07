import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit } from 'lucide-react';
import { useState } from 'react';
import api from '../api/client';

export default function Users() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'editor' });
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const createUser = useMutation({
    mutationFn: (data) => api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      setForm({ username: '', email: '', password: '', role: 'editor' });
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }) => api.put(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingId(null);
    },
  });

  const deleteUser = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="page-title">Users</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 btn-brand"
        >
          <Plus size={18} /> New User
        </button>
      </div>

      {showCreate && (
        <div className="card p-4 mb-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createUser.mutate(form);
            }}
            className="grid grid-cols-1 sm:grid-cols-5 gap-3"
          >
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="Username"
              className="border rounded-lg px-3 py-2"
              required
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="border rounded-lg px-3 py-2"
              required
            />
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Password"
              className="border rounded-lg px-3 py-2"
              required
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="border rounded-lg px-3 py-2"
            >
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex gap-2">
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
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="p-3">Username</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Groups</th>
              <th className="p-3">Last Login</th>
              <th className="p-3 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-3 font-medium">{user.username}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">
                  {editingId === user._id ? (
                    <div className="flex gap-2">
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() =>
                          updateUser.mutate({ id: user._id, data: { role: editRole } })
                        }
                        className="text-xs bg-brand-600 text-white px-2 py-1 rounded-lg"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {user.role}
                    </span>
                  )}
                </td>
                <td className="p-3 text-gray-500">
                  {user.userGroups?.map((g) => g.name).join(', ') || '-'}
                </td>
                <td className="p-3 text-gray-500">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '-'}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingId(user._id);
                        setEditRole(user.role);
                      }}
                      className="p-1.5 text-brand-600 hover:bg-brand-50 rounded"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this user?')) deleteUser.mutate(user._id);
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
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
    </div>
  );
}
