import { useMemo, useState } from 'react';
import { Search, User, Check, Mail } from 'lucide-react';
import Badge from './ui/Badge';

const ROLE_VARIANTS = {
  operator: 'success',
  viewer: 'neutral',
  admin: 'primary',
};

function userInitials(user) {
  return (user.full_name || user.email || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function isAdminUser(user) {
  return user.role?.name === 'admin';
}

export default function UserPicker({ users = [], value, onChange, loading = false, emptyMessage }) {
  const [search, setSearch] = useState('');

  const createdUsers = useMemo(
    () => users.filter((u) => !isAdminUser(u)),
    [users]
  );

  const selectedUser = useMemo(
    () => createdUsers.find((u) => u.id === value),
    [createdUsers, value]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return createdUsers;
    return createdUsers.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.role?.name?.toLowerCase().includes(q)
    );
  }, [createdUsers, search]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (createdUsers.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-warning/10 border border-warning/20 text-sm text-warning">
        {emptyMessage || 'No users yet. Click "Add user" at the top of this page to create one, then come back here.'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selectedUser && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border-2 border-success/40">
          <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
            <Check className="w-5 h-5 text-success" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-success font-bold uppercase tracking-wide">Selected user</p>
            <p className="text-base text-white font-semibold">
              {selectedUser.full_name || selectedUser.email}
            </p>
            <p className="text-xs text-slate-400">{selectedUser.email}</p>
          </div>
        </div>
      )}

      {!value && (
        <p className="text-xs text-primary-light bg-primary/10 border border-primary/20 rounded-lg px-3 py-2.5">
          <strong className="text-white">{createdUsers.length} user(s)</strong> found — click one to select
        </p>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your users by name or email..."
          className="w-full pl-10 pr-4 py-2.5 bg-surface rounded-xl border border-border text-white text-sm placeholder-slate-600 focus:border-primary focus:outline-none"
        />
      </div>

      <div className="max-h-60 overflow-y-auto scrollbar-thin space-y-2 pr-1 border border-border rounded-xl p-2 bg-surface/30">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No users match your search</p>
        ) : (
          filtered.map((user) => {
            const selected = value === user.id;
            const pending = !user.is_approved;
            return (
              <button
                key={user.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(user.id);
                }}
                aria-pressed={selected}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                  selected
                    ? 'bg-primary/15 border-primary ring-2 ring-primary/40'
                    : 'bg-surface border-border hover:border-primary/60 hover:bg-surface-lighter'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    selected ? 'bg-primary text-white' : 'bg-surface-lighter text-primary-light border border-border'
                  }`}
                >
                  {userInitials(user)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">
                      {user.full_name || 'No name'}
                    </p>
                    {user.role?.name && (
                      <Badge variant={ROLE_VARIANTS[user.role.name] || 'neutral'}>
                        {user.role.name}
                      </Badge>
                    )}
                    {pending ? (
                      <Badge variant="warning">Pending</Badge>
                    ) : (
                      <Badge variant="success">Approved</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-1">
                    <Mail className="w-3 h-3 shrink-0" />
                    {user.email}
                  </p>
                  {pending && (
                    <p className="text-[10px] text-slate-500 mt-1">Will be approved when you save access</p>
                  )}
                </div>
                {selected ? (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <User className="w-5 h-5 text-slate-600 shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
