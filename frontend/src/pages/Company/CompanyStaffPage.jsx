import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export default function CompanyStaffPage() {
  const { toast } = useToast();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleModal, setRoleModal] = useState({ open: false, staffUser: null, newRole: '', newStatus: '' });
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  const loadStaff = async () => {
    try {
      setLoading(true);
      const res = await api.getStaffMembers();
      if (res?.data?.staff) {
        setStaffList(res.data.staff);
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!roleModal.staffUser) return;
    try {
      await api.updateStaffRole(roleModal.staffUser.id, {
        role: roleModal.newRole,
        status: roleModal.newStatus
      });
      setActionSuccessMsg(`Updated role for ${roleModal.staffUser.fullName} to ${roleModal.newRole}`);
      setRoleModal({ open: false, staffUser: null, newRole: '', newStatus: '' });
      loadStaff();
    } catch (err) {
      toast.error(err.message || 'Failed to update role.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between">
          <span className="font-semibold">{actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg('')} className="text-emerald-400 font-bold">Dismiss</button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Staff Accounts & Access Control</h1>
        <p className="text-xs text-slate-400 mt-1">
          Role-Based Access Control (RBAC) governance for Eventora coordinators, finance officers, inventory managers, and staff.
        </p>
      </div>

      <div className="bg-slate-800/40 rounded-xl border border-slate-700/60 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 animate-pulse text-xs">Loading staff accounts...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider border-b border-slate-700/60">
                <tr>
                  <th className="p-3.5">Full Name</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Phone</th>
                  <th className="p-3.5">System Role</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {staffList.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-bold text-white">{s.fullName}</td>
                    <td className="p-3.5 text-slate-300">{s.email}</td>
                    <td className="p-3.5 text-slate-400">{s.phone}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                        {s.role}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setRoleModal({
                          open: true,
                          staffUser: s,
                          newRole: s.role,
                          newStatus: s.status
                        })}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded text-[11px]"
                      >
                        Change Role
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {roleModal.open && roleModal.staffUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-800 text-slate-100">
            <h3 className="text-lg font-bold text-white">Update Staff Role</h3>
            <p className="text-xs text-slate-400 mt-1">
              Account: <span className="text-white font-semibold">{roleModal.staffUser.fullName}</span>
            </p>

            <form onSubmit={handleUpdateRole} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">New Role</label>
                <select
                  value={roleModal.newRole}
                  onChange={(e) => setRoleModal({ ...roleModal, newRole: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
                >
                  <option value="COORDINATOR">COORDINATOR</option>
                  <option value="FINANCE">FINANCE</option>
                  <option value="STAFF">STAFF</option>
                  <option value="INVENTORY">INVENTORY</option>
                  <option value="ADMIN_DIRECTOR">ADMIN_DIRECTOR</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Status</label>
                <select
                  value={roleModal.newStatus}
                  onChange={(e) => setRoleModal({ ...roleModal, newStatus: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRoleModal({ open: false, staffUser: null, newRole: '', newStatus: '' })}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F50046] hover:bg-[#d0003b] text-white font-bold rounded-lg shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
