import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  CheckSquare,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Play,
  Check,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Info,
  MessageSquare,
  AlertCircle,
  X,
  User,
  ShieldCheck,
  Building,
  Flag,
  LayoutGrid,
  List
} from 'lucide-react';

export default function StaffTasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search params from URL (e.g. /company/tasks?status=IN_PROGRESS)
  const [searchParams] = useSearchParams();
  const queryStatus = searchParams.get('status');

  // Filters
  const [statusFilter, setStatusFilter] = useState(queryStatus || 'ALL'); // 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'BLOCKED'
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'cards'

  // Update status filter whenever URL parameter changes
  useEffect(() => {
    if (queryStatus) {
      setStatusFilter(queryStatus);
    }
  }, [queryStatus]);

  // Modals
  const [selectedTask, setSelectedTask] = useState(null);
  const [incidentModal, setIncidentModal] = useState({ open: false, task: null });
  const [incidentForm, setIncidentForm] = useState({
    incidentType: 'Equipment Malfunction',
    severity: 'MEDIUM',
    description: ''
  });
  const [submittingIncident, setSubmittingIncident] = useState(false);

  const [noteModal, setNoteModal] = useState({ open: false, task: null });
  const [noteText, setNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  const loadTasks = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);

      // Backend automatically scopes where assignedStaffId = req.user.id for role STAFF
      const res = await api.getTasks();
      if (res?.data?.tasks) {
        setTasks(res.data.tasks);
      }
    } catch (err) {
      console.error('Staff tasks load error:', err);
      setError(err.message || 'Failed to load assigned duties.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // Update status (Start or Mark Completed)
  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await api.updateTaskStatus(taskId, newStatus);
      toast.success(
        newStatus === 'COMPLETED'
          ? 'Duty marked as completed! Coordinator notified.'
          : `Task status updated to ${newStatus}`
      );
      loadTasks(true);
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update task.');
    }
  };

  // Submit Incident / Blocker
  const handleSubmitIncident = async (e) => {
    e.preventDefault();
    if (!incidentModal.task) return;
    try {
      setSubmittingIncident(true);
      await api.createTaskIncident(incidentModal.task.id, incidentForm);
      toast.success('Blocker report filed. Coordinator notified immediately.');
      setIncidentModal({ open: false, task: null });
      setIncidentForm({ incidentType: 'Equipment Malfunction', severity: 'MEDIUM', description: '' });
      loadTasks(true);
    } catch (err) {
      toast.error(err.message || 'Failed to file blocker.');
    } finally {
      setSubmittingIncident(false);
    }
  };

  // Submit Progress Note
  const handleSubmitNote = async (e) => {
    e.preventDefault();
    if (!noteModal.task || !noteText.trim()) return;
    try {
      setSubmittingNote(true);
      await api.addTaskProgressNote(noteModal.task.id, noteText.trim());
      toast.success('Progress note recorded.');
      setNoteModal({ open: false, task: null });
      setNoteText('');
      loadTasks(true);
    } catch (err) {
      toast.error(err.message || 'Failed to record note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return tasks.filter((t) => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        q === '' ||
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.booking?.reference || '').toLowerCase().includes(q) ||
        (t.booking?.title || '').toLowerCase().includes(q) ||
        (t.booking?.locationName || '').toLowerCase().includes(q);

      // Status
      let matchesStatus = true;
      if (statusFilter === 'PENDING') matchesStatus = t.status === 'PENDING';
      else if (statusFilter === 'IN_PROGRESS') matchesStatus = t.status === 'IN_PROGRESS';
      else if (statusFilter === 'COMPLETED') matchesStatus = t.status === 'COMPLETED';
      else if (statusFilter === 'BLOCKED') matchesStatus = t.status === 'BLOCKED';
      else if (statusFilter === 'OVERDUE') {
        matchesStatus = t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < startOfToday;
      }

      // Priority
      const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter]);

  // Counts for tab badges
  const counts = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      all: tasks.length,
      pending: tasks.filter((t) => t.status === 'PENDING').length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      completed: tasks.filter((t) => t.status === 'COMPLETED').length,
      blocked: tasks.filter((t) => t.status === 'BLOCKED').length,
      overdue: tasks.filter((t) => t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < startOfToday).length
    };
  }, [tasks]);

  // Pagination for tasks
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = viewMode === 'list' ? 8 : 6;
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTasks.slice(start, start + itemsPerPage);
  }, [filteredTasks, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, priorityFilter, viewMode]);

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-900 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F50046]" />
            Critical
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 className="w-3 h-3 text-slate-600" />
            Completed
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-900 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
            In Progress
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-[#F50046] border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F50046]" />
            Blocked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Assigned
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-pulse">
        <div className="h-20 bg-slate-200 rounded-2xl"></div>
        <div className="h-14 bg-slate-200 rounded-xl"></div>
        <div className="h-96 bg-slate-200 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-left font-sans text-slate-800">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
        <span>Company Portal</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span>Staff Portal</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-[#F50046] font-semibold">My Tasks</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <CheckSquare className="w-7 h-7 text-[#F50046]" />
            <span>My Assigned Duties & Tasks</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View instructions, start executions, log progress notes, and report site blockers.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => loadTasks(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F50046]' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 pt-3 border-b border-slate-200/80 bg-slate-50/50 overflow-x-auto [scrollbar-width:none]">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'border-[#F50046] text-[#F50046]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>All Tasks</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{counts.all}</span>
          </button>

          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'PENDING'
                ? 'border-[#F50046] text-[#F50046]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Assigned</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{counts.pending}</span>
          </button>

          <button
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'IN_PROGRESS'
                ? 'border-[#F50046] text-[#F50046]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>In Progress</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">{counts.inProgress}</span>
          </button>

          <button
            onClick={() => setStatusFilter('OVERDUE')}
            className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'OVERDUE'
                ? 'border-[#F50046] text-[#F50046]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Overdue</span>
            {counts.overdue > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-[#F50046]">{counts.overdue}</span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('BLOCKED')}
            className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'BLOCKED'
                ? 'border-[#F50046] text-[#F50046]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Blocked</span>
            {counts.blocked > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-[#F50046]">{counts.blocked}</span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'COMPLETED'
                ? 'border-[#F50046] text-[#F50046]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Completed</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">{counts.completed}</span>
          </button>
        </div>

        {/* Toolbar: Search, Priority Filter & View Mode Switcher */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by duty title, event ref, venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-[#F50046] transition-all"
            />
          </div>

          <div className="flex items-center gap-2.5 shrink-0 justify-end">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-hidden focus:border-[#F50046]"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* View Mode Switcher: Table List vs Cards Grid */}
            <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="List Table View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Cards Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tasks Container */}
        {filteredTasks.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <CheckSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">No duties found matching your current filter.</p>
            <p className="text-xs mt-1">Try resetting the status or search filter above.</p>
          </div>
        ) : viewMode === 'list' ? (
          /* Table List View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-200/80">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Duty & Instructions</th>
                  <th className="py-3.5 px-4">Event Booking</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedTasks.map((t) => {
                  const isOverdue = t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < new Date();

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-slate-900">{t.title}</div>
                        {t.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {t.description}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{t.booking?.reference || 'N/A'}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[160px]">
                          {t.booking?.title}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{t.booking?.locationName || 'Addis Ababa'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {getPriorityBadge(t.priority)}
                      </td>

                      <td className="py-3.5 px-4">
                        {getStatusBadge(t.status)}
                      </td>

                      <td className="py-3.5 px-4">
                        {t.dueDate ? (
                          <div className={isOverdue ? 'text-[#F50046] font-bold' : 'text-slate-600'}>
                            <div>{new Date(t.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(t.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No deadline</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {t.status === 'PENDING' && (
                            <button
                              onClick={() => handleUpdateStatus(t.id, 'IN_PROGRESS')}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                              title="Start Task"
                            >
                              <Play className="w-3.5 h-3.5 inline mr-1" />
                              <span>Start</span>
                            </button>
                          )}

                          {t.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleUpdateStatus(t.id, 'COMPLETED')}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                              title="Mark Done"
                            >
                              <Check className="w-3.5 h-3.5 inline mr-1" />
                              <span>Done</span>
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedTask(t)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View Details & Instructions"
                          >
                            <Info className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setIncidentModal({ open: true, task: t })}
                            className="p-1.5 text-slate-400 hover:text-[#F50046] hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Report Blocker"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Cards Grid View */
          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedTasks.map((t) => {
              const isOverdue = t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < new Date();

              return (
                <div
                  key={t.id}
                  className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 p-4 shadow-2xs flex flex-col justify-between transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getPriorityBadge(t.priority)}
                        {getStatusBadge(t.status)}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {t.booking?.reference || 'GENERAL'}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm mb-1 line-clamp-1">
                      {t.title}
                    </h3>
                    {t.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                        {t.description}
                      </p>
                    )}

                    <div className="space-y-1 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3">
                      <div className="flex items-center gap-1.5 font-medium text-slate-700 truncate">
                        <span>Event: {t.booking?.title || 'General Event'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 truncate">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{t.booking?.locationName || 'Addis Ababa'}</span>
                      </div>
                      {t.dueDate && (
                        <div className={`flex items-center gap-1 ${isOverdue ? 'text-[#F50046] font-bold' : 'text-slate-600'}`}>
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            Due {new Date(t.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(t.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedTask(t)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setIncidentModal({ open: true, task: t })}
                        className="p-1.5 text-slate-400 hover:text-[#F50046] hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Report Blocker"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {t.status === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateStatus(t.id, 'IN_PROGRESS')}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Start
                        </button>
                      )}
                      {t.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleUpdateStatus(t.id, 'COMPLETED')}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                        >
                          Done
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tasks Pagination Footer (Always visible when tasks exist) */}
        {filteredTasks.length > 0 && (
          <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <span className="text-[11px] font-medium text-slate-500">
              Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredTasks.length)} of {filteredTasks.length} duties
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs cursor-pointer"
              >
                Previous
              </button>
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-6 h-6 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      currentPage === p
                        ? 'bg-[#F50046] text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: VIEW DETAILS & INSTRUCTIONS */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-[#F50046]" />
                <h3 className="text-base font-bold text-slate-900">Task Details & Instructions</h3>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Duty Title</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedTask.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedTask.status)}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Priority</span>
                  <div className="mt-1">{getPriorityBadge(selectedTask.priority)}</div>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Event & Venue</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {selectedTask.booking?.title} ({selectedTask.booking?.reference})
                </p>
                <p className="text-[11px] text-slate-500">{selectedTask.booking?.locationName}</p>
              </div>

              {selectedTask.dueDate && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Due Deadline</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {new Date(selectedTask.dueDate).toLocaleString()}
                  </p>
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Instructions & Progress Notes</span>
                <div className="mt-1 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {selectedTask.description || 'No additional instructions provided.'}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setNoteModal({ open: true, task: selectedTask })}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
                >
                  + Add Progress Note
                </button>

                <div className="flex items-center gap-2">
                  {selectedTask.status === 'PENDING' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedTask.id, 'IN_PROGRESS')}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Start Task
                    </button>
                  )}
                  {selectedTask.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedTask.id, 'COMPLETED')}
                      className="px-3 py-1.5 bg-[#F50046] hover:bg-[#d0003b] text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer shadow-2xs"
                    >
                      Mark Completed
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REPORT BLOCKER */}
      {incidentModal.open && incidentModal.task && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Report Blocker / Issue</h3>
              </div>
              <button
                onClick={() => setIncidentModal({ open: false, task: null })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Reporting on: <strong className="text-slate-800">{incidentModal.task.title}</strong>
            </p>

            <form onSubmit={handleSubmitIncident} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Issue Category *</label>
                <select
                  value={incidentForm.incidentType}
                  onChange={(e) => setIncidentForm({ ...incidentForm, incidentType: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-hidden focus:border-[#F50046]"
                >
                  <option value="Equipment Malfunction">Equipment Malfunction</option>
                  <option value="Access / Venue Restriction">Access / Venue Restriction</option>
                  <option value="Severe Weather / Ambient Delay">Severe Weather / Ambient Delay</option>
                  <option value="Power Outage">Power Outage / Generator Failure</option>
                  <option value="Vendor / Partner Delay">Vendor / Partner Delay</option>
                  <option value="Safety Hazard">Safety Hazard</option>
                  <option value="Other Operational Blocker">Other Operational Blocker</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Severity *</label>
                <select
                  value={incidentForm.severity}
                  onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-hidden focus:border-[#F50046]"
                >
                  <option value="LOW">Low (Minor delay, task can proceed)</option>
                  <option value="MEDIUM">Medium (Requires attention soon)</option>
                  <option value="HIGH">High (Task is blocked from proceeding)</option>
                  <option value="URGENT">Critical (Immediate coordinator intervention needed)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description & Details *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain what is happening on-site and what assistance is needed..."
                  value={incidentForm.description}
                  onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-hidden focus:border-[#F50046]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIncidentModal({ open: false, task: null })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingIncident}
                  className="px-4 py-2 bg-[#F50046] hover:bg-[#d0003b] text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submittingIncident ? 'Filing...' : 'Submit Blocker Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD PROGRESS NOTE */}
      {noteModal.open && noteModal.task && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800">
                <MessageSquare className="w-5 h-5 text-[#F50046]" />
                <h3 className="text-base font-bold text-slate-900">Add Progress Note</h3>
              </div>
              <button
                onClick={() => setNoteModal({ open: false, task: null })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNote} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Progress Details</label>
                <textarea
                  required
                  rows={4}
                  placeholder="e.g. Sound check completed at 14:15. All 4 wireless mics tested and ready."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-hidden focus:border-[#F50046]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNoteModal({ open: false, task: null })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNote}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {submittingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

