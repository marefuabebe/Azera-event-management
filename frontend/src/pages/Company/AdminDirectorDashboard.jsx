import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  MapPin,
  Calendar,
  Users,
  ShieldCheck,
  FileText,
  CreditCard,
  CheckCircle2,
  Settings,
  X,
  ChevronRight,
  ShieldAlert,
  Clock,
  UserCheck,
  UserPlus,
  ArrowRightLeft,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export default function AdminDirectorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [activeCoordinators, setActiveCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roleModal, setRoleModal] = useState({ open: false, staffUser: null, newRole: '', newStatus: '' });
  const [reassignModal, setReassignModal] = useState({ open: false, booking: null, targetCoordinatorId: '', reason: '' });
  const [reassigning, setReassigning] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    companyName: 'Azera Events & Celebrations',
    contactEmail: 'contact@azeraevents.com',
    contactPhone: '+251 911 234 567',
    officeAddress: 'Bole Road, Morning Star Mall 4th Floor, Addis Ababa',
    initialPaymentPercent: 50.00
  });
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  const getTimeOfDayGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const directorFirstName = user?.fullName?.split(' ')[0] || 'Director';

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [summaryRes, staffRes, settingsRes, coordsRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getStaffMembers(),
        api.getCompanySettings().catch(() => ({ data: { settings: {} } })),
        api.getActiveCoordinators().catch(() => ({ data: { coordinators: [] } }))
      ]);

      if (summaryRes?.data) setData(summaryRes.data);
      if (staffRes?.data?.staff) setStaffList(staffRes.data.staff);
      if (settingsRes?.data?.settings) setSettingsForm(settingsRes.data.settings);
      if (coordsRes?.data?.coordinators) setActiveCoordinators(coordsRes.data.coordinators);
    } catch (err) {
      console.error('Admin director load error:', err);
      setError(err.message || 'Failed to load executive director dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReassignCoordinator = async (e) => {
    e.preventDefault();
    if (!reassignModal.booking || !reassignModal.targetCoordinatorId) {
      toast.error('Please select a coordinator.');
      return;
    }
    if (!reassignModal.reason?.trim()) {
      toast.error('A reassignment reason is required for the audit trail.');
      return;
    }

    try {
      setReassigning(true);
      await api.reassignBooking(
        reassignModal.booking.id,
        reassignModal.targetCoordinatorId,
        reassignModal.reason.trim()
      );
      setActionSuccessMsg(`Booking ${reassignModal.booking.reference} coordinator assignment updated.`);
      setReassignModal({ open: false, booking: null, targetCoordinatorId: '', reason: '' });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to assign coordinator.');
    } finally {
      setReassigning(false);
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!roleModal.staffUser) return;
    try {
      await api.updateStaffRole(roleModal.staffUser.id, {
        role: roleModal.newRole,
        status: roleModal.newStatus
      });
      setActionSuccessMsg(`Staff account ${roleModal.staffUser.fullName} updated to ${roleModal.newRole}.`);
      setRoleModal({ open: false, staffUser: null, newRole: '', newStatus: '' });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update staff permissions.');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await api.updateCompanySettings(settingsForm);
      setActionSuccessMsg('Company operational policies and settings saved successfully.');
      setSettingsModal(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update settings.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-pulse pb-12">
        <div className="h-28 bg-slate-100 rounded-3xl border border-slate-200/80"></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl border border-slate-200/80"></div>
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-2xl border border-slate-200/80"></div>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const bookings = data?.bookings || [];
  const auditLogs = data?.auditLogs || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 text-slate-800">
      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg('')}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Executive Overview Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-2xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF0F4] text-[#F20047] border border-rose-100">
                Executive Leadership
              </span>
              <span>•</span>
              <span>Managing Director Portal</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
              {getTimeOfDayGreeting()}, {directorFirstName}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl font-normal">
              Company-wide KPIs, multi-event pipeline, staff access management, verified revenue reconciliation, and audit logs.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setSettingsModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Company Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Executive Metrics 6-Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Bookings */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Bookings</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{metrics.totalBookings || 0}</p>
          <p className="text-[10px] text-slate-500 mt-1">{metrics.pendingRequests || 0} pending review</p>
        </div>

        {/* Confirmed Events */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Confirmed Events</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{metrics.confirmedBookings || 0}</p>
          <p className="text-[10px] text-slate-500 mt-1">{metrics.completedEvents || 0} completed</p>
        </div>

        {/* Verified Revenue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Verified Revenue</p>
          <p className="text-lg font-black text-slate-900 mt-1">
            ETB {(metrics.totalVerifiedRevenueETB || 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Audited in bank</p>
        </div>

        {/* Payment Reviews */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment Reviews</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{metrics.pendingPaymentReviews || 0}</p>
          <p className="text-[10px] text-slate-500 mt-1">Awaiting Finance audit</p>
        </div>

        {/* Contracts Signed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contracts Signed</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{metrics.signedContracts || 0}</p>
          <p className="text-[10px] text-slate-500 mt-1">{metrics.pendingContracts || 0} pending sign</p>
        </div>

        {/* Staff Tasks */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Staff Tasks</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{metrics.totalTasks || 0}</p>
          <p className="text-[10px] text-slate-500 mt-1">{metrics.pendingTasks || 0} active</p>
        </div>
      </div>

      {/* Staff Accounts Management & Security RBAC */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200/80">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Staff Accounts & Role Governance ({staffList.length})
              </h2>
              <p className="text-[11px] text-slate-400">
                Manage authorized roles and operational privileges across Azera departments.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="p-3.5">Staff Member</th>
                <th className="p-3.5">Contact Details</th>
                <th className="p-3.5">Assigned Role</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Active Duties</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffList.map((staff) => (
                <tr key={staff.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-3.5 font-bold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200">
                        {staff.fullName ? staff.fullName.charAt(0) : 'U'}
                      </div>
                      <span>{staff.fullName}</span>
                    </div>
                  </td>
                  <td className="p-3.5 text-slate-600">
                    <div>{staff.email}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{staff.phone}</div>
                  </td>
                  <td className="p-3.5">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                      {staff.role}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        staff.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${staff.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {staff.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-500 font-medium">
                    {staff._count?.assignedTasks || 0} tasks • {staff._count?.coordinatedBookings || 0} coordinated
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() =>
                        setRoleModal({
                          open: true,
                          staffUser: staff,
                          newRole: staff.role,
                          newStatus: staff.status
                        })
                      }
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Configure Role
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: All Events & Live Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bookings & Pipeline Overview */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h2 className="text-sm font-bold text-slate-900">
              Company Bookings & Pipeline ({bookings.length})
            </h2>
            <Link
              to="/company/bookings"
              className="text-xs font-semibold text-[#F20047] hover:underline flex items-center gap-0.5"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {bookings.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No active bookings recorded.</p>
            ) : (
              bookings.slice(0, 6).map((b) => (
                <div key={b.id} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-900">{b.title}</span>
                    <span className="text-slate-600 font-semibold">{b.status}</span>
                  </div>
                  <p className="text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span>Client: <strong className="text-slate-700">{b.customer?.fullName}</strong></span>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {b.locationName || 'Addis Ababa'}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {new Date(b.preferredDate).toLocaleDateString()}
                    </span>
                  </p>
                  <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-200/60 pt-2">
                    <div className="flex items-center gap-1.5">
                      <span>Coordinator:</span>
                      {b.assignedCoordinator?.fullName ? (
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {b.assignedCoordinator.fullName}
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px]">
                          Unassigned
                        </span>
                      )}
                      <button
                        onClick={() =>
                          setReassignModal({
                            open: true,
                            booking: b,
                            targetCoordinatorId: b.assignedCoordinator?.id || '',
                            reason: ''
                          })
                        }
                        className="text-[10px] text-[#B95650] hover:underline font-bold cursor-pointer ml-1 inline-flex items-center gap-0.5"
                        title="Assign or reassign coordinator as Executive Administration"
                      >
                        <ArrowRightLeft className="w-2.5 h-2.5" />
                        <span>{b.assignedCoordinator?.fullName ? 'Reassign' : 'Assign'}</span>
                      </button>
                    </div>
                    <span className="font-mono text-slate-500">{b.reference}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Security Audit Trail */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <span>Security Audit Trail ({auditLogs.length})</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">Immutable Action Log</span>
          </div>

          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No recent audit records.</p>
            ) : (
              auditLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{log.action}</span>
                    <span className="text-slate-400 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-600 mt-1">
                    Actor: <span className="font-semibold text-slate-800">{log.actor?.fullName || 'System'}</span> ({log.actor?.role || 'SYSTEM'})
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Target: {log.entity} • ID: {log.entityId} • IP: {log.ipAddress || '127.0.0.1'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Role Assignment Modal */}
      {roleModal.open && roleModal.staffUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Configure Staff Permissions</h3>
              <button
                onClick={() => setRoleModal({ open: false, staffUser: null, newRole: '', newStatus: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Account: <strong className="text-slate-800">{roleModal.staffUser.fullName}</strong> ({roleModal.staffUser.email})
            </p>

            <form onSubmit={handleUpdateRole} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Application Role</label>
                <select
                  value={roleModal.newRole}
                  onChange={(e) => setRoleModal({ ...roleModal, newRole: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:border-[#F20047]"
                >
                  <option value="COORDINATOR">COORDINATOR (Event Manager)</option>
                  <option value="FINANCE">FINANCE (Payment Verifier)</option>
                  <option value="STAFF">STAFF (Operations Field Staff)</option>
                  <option value="ADMIN_DIRECTOR">ADMIN_DIRECTOR (Managing Director)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Account Status</label>
                <select
                  value={roleModal.newStatus}
                  onChange={(e) => setRoleModal({ ...roleModal, newStatus: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:border-[#F20047]"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRoleModal({ open: false, staffUser: null, newRole: '', newStatus: '' })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F20047] hover:bg-[#d0003b] text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Apply Role Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Company Settings Modal */}
      {settingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Company Settings</h3>
              <button
                onClick={() => setSettingsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Operational parameters and business governance.
            </p>

            <form onSubmit={handleSaveSettings} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Company Legal Name</label>
                <input
                  type="text"
                  required
                  value={settingsForm.companyName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, companyName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:border-[#F20047]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Official Email</label>
                  <input
                    type="email"
                    value={settingsForm.contactEmail}
                    onChange={(e) => setSettingsForm({ ...settingsForm, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:border-[#F20047]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Official Phone</label>
                  <input
                    type="text"
                    value={settingsForm.contactPhone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:border-[#F20047]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Addis Ababa Office Address</label>
                <input
                  type="text"
                  value={settingsForm.officeAddress}
                  onChange={(e) => setSettingsForm({ ...settingsForm, officeAddress: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:border-[#F20047]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Standard Initial Payment Percentage (%)</label>
                <input
                  type="number"
                  value={settingsForm.initialPaymentPercent}
                  onChange={(e) => setSettingsForm({ ...settingsForm, initialPaymentPercent: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:border-[#F20047]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSettingsModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F20047] hover:bg-[#d0003b] text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Save Policies
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coordinator Assignment / Reassignment Modal (Executive Administration) */}
      {reassignModal.open && reassignModal.booking && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-800 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {reassignModal.booking.assignedCoordinator?.fullName ? 'Reassign Primary Coordinator' : 'Assign Primary Coordinator'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {reassignModal.booking.reference} • {reassignModal.booking.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReassignModal({ open: false, booking: null, targetCoordinatorId: '', reason: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReassignCoordinator} className="mt-4 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Current Owner</span>
                <span className="text-xs font-bold text-slate-800">
                  {reassignModal.booking.assignedCoordinator?.fullName || 'Unassigned (In Shared Queue)'}
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Executive override will record previous and new coordinator in immutable audit history.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Select Primary Coordinator <span className="text-rose-600">*</span>
                </label>
                <select
                  value={reassignModal.targetCoordinatorId}
                  onChange={(e) => setReassignModal({ ...reassignModal, targetCoordinatorId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:border-[#B95650] cursor-pointer"
                  required
                >
                  <option value="">-- Choose Coordinator --</option>
                  {activeCoordinators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.role}) — {c.activeBookingsCount || 0} active bookings
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Assignment Reason <span className="text-rose-600">* (Required for Audit Trail)</span>
                </label>
                <textarea
                  rows={2}
                  value={reassignModal.reason}
                  onChange={(e) => setReassignModal({ ...reassignModal, reason: e.target.value })}
                  placeholder="e.g., Assigned by Executive Director for specialized corporate event coordination..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-[#B95650]"
                  required
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReassignModal({ open: false, booking: null, targetCoordinatorId: '', reason: '' })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning || !reassignModal.targetCoordinatorId || !reassignModal.reason.trim()}
                  className="px-4 py-2 bg-[#B95650] hover:bg-[#a24944] text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {reassigning ? 'Assigning...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
