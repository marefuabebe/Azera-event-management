import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  CheckSquare,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Play,
  Check,
  RefreshCw,
  MapPin,
  ChevronRight,
  ShieldAlert,
  Bell,
  User,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Info,
  X
} from 'lucide-react';

export default function StaffDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

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

  const loadData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await api.getDashboardSummary();
      if (res?.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Staff dashboard load error:', err);
      setError(err.message || 'Failed to load staff operational dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const metrics = data?.metrics || {};
  const todaysTasks = data?.todaysTasks || [];
  const upcomingEvents = data?.upcomingEvents || [];
  const notifications = data?.notifications || [];
  const allTasks = data?.tasks || [];

  // Display up to 4 most recent items directly for clean, unpaginated dashboard presentation
  const displayTodaysTasks = useMemo(() => todaysTasks.slice(0, 4), [todaysTasks]);
  const displayUpcomingEvents = useMemo(() => upcomingEvents.slice(0, 4), [upcomingEvents]);
  const displayNotifications = useMemo(() => notifications.slice(0, 4), [notifications]);

  // Dynamic real-time greeting based on time of day
  const getTimeOfDayGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const staffFirstName = user?.fullName?.split(' ')[0] || 'Staff Member';

  // Handle task status quick update
  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await api.updateTaskStatus(taskId, newStatus);
      toast.success(
        newStatus === 'COMPLETED'
          ? 'Task marked as completed! Coordinator notified.'
          : `Task status updated to ${newStatus}`
      );
      loadData(true);
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update task status.');
    }
  };

  // Submit blocker/incident report
  const handleSubmitIncident = async (e) => {
    e.preventDefault();
    if (!incidentModal.task) return;
    try {
      setSubmittingIncident(true);
      await api.createTaskIncident(incidentModal.task.id, incidentForm);
      toast.success('Blocker report filed. Lead Coordinator notified immediately.');
      setIncidentModal({ open: false, task: null });
      setIncidentForm({ incidentType: 'Equipment Malfunction', severity: 'MEDIUM', description: '' });
      loadData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to file blocker report.');
    } finally {
      setSubmittingIncident(false);
    }
  };

  // Submit progress note
  const handleSubmitNote = async (e) => {
    e.preventDefault();
    if (!noteModal.task || !noteText.trim()) return;
    try {
      setSubmittingNote(true);
      await api.addTaskProgressNote(noteModal.task.id, noteText.trim());
      toast.success('Progress note recorded successfully.');
      setNoteModal({ open: false, task: null });
      setNoteText('');
      loadData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to add progress note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Priority badge styling
  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-900 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F50046]" />
            Critical
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-700 border border-slate-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            Low
          </span>
        );
    }
  };

  // Status badge styling
  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 className="w-3 h-3 text-slate-600" />
            Completed
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-900 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
            In Progress
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-[#F50046] border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F50046]" />
            Blocked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
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
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-96 bg-slate-200 rounded-2xl"></div>
          <div className="lg:col-span-4 h-96 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-left font-sans text-slate-800">
      {/* Unified Executive Operational Header Card (Eliminates Top-Right Empty Space) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
        {/* Top Row: Breadcrumbs (Left) + Duty Shift Telemetry & Time (Right) */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="font-semibold text-slate-700">Operations</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span>Staff Workspace</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              On Duty • Shift Active
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200/80">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>08:00 AM – 05:00 PM (EAT)</span>
            </span>
          </div>
        </div>

        {/* Main Row: Greeting & Meta (Left) + Action Controls (Right) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              {getTimeOfDayGreeting()}, {staffFirstName}!
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage your daily duties, on-site event execution, and personal schedule.
            </p>
          </div>

          {/* Action Trio: Sync, My Schedule, Report Blocker, View Tasks */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="Refresh duties"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F50046]' : 'text-slate-500'}`} />
              <span>Sync</span>
            </button>

            <Link
              to="/company/schedule"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>My Schedule</span>
            </Link>

            <button
              onClick={() => {
                const targetTask = todaysTasks.find((t) => t.status === 'IN_PROGRESS') || todaysTasks[0] || tasks[0];
                if (!targetTask) {
                  toast.info('No active tasks currently assigned to file a blocker on.');
                  return;
                }
                setIncidentModal({ open: true, task: targetTask });
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              title="Report operational blocker to Coordinator"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#F50046]" />
              <span>Report Blocker</span>
            </button>

            <Link
              to="/company/tasks"
              className="flex items-center gap-1.5 px-4 py-2 bg-[#F50046] hover:bg-[#d0003b] text-white rounded-xl text-xs font-bold shadow-xs shadow-rose-500/20 transition-all cursor-pointer"
            >
              <CheckSquare className="w-4 h-4" />
              <span>My Tasks</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 6 Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. My Assigned Tasks */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Assigned Tasks</span>
            <CheckSquare className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 leading-none">
            {metrics.myAssignedTasksCount || 0}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Active assigned</p>
        </div>

        {/* 2. Tasks Due Today */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Due Today</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 leading-none">
            {metrics.tasksDueTodayCount || 0}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Targeted today</p>
        </div>

        {/* 3. Overdue Tasks */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 leading-none">
            {metrics.overdueTasksCount || 0}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Needs action</p>
        </div>

        {/* 4. In Progress */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Progress</span>
            <Play className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 leading-none">
            {metrics.tasksInProgressCount || 0}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Currently working</p>
        </div>

        {/* 5. Completed Tasks */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 leading-none">
            {metrics.completedTasksCount || 0}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Done & verified</p>
        </div>

        {/* 6. Upcoming Assigned Events */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">My Events</span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 leading-none">
            {metrics.upcomingAssignedEventsCount || 0}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Scheduled dates</p>
        </div>
      </div>

      {/* Main Grid: Left Column (8 cols) & Right Column (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Today's Tasks + Upcoming Events */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card: Today's Tasks & Immediate Priorities */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#F50046] flex items-center justify-center border border-rose-100/70">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Today's Priority Duties ({todaysTasks.length})
                  </h2>
                  <p className="text-[11px] text-slate-400">Immediate tasks scheduled for execution today</p>
                </div>
              </div>

              <Link
                to="/company/tasks"
                className="text-xs font-semibold text-[#F50046] hover:underline flex items-center gap-0.5"
              >
                <span>View all tasks</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {todaysTasks.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700 text-xs">No pending tasks scheduled for today!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Check upcoming days in your schedule or view all tasks.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayTodaysTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-slate-900 text-xs">{t.title}</span>
                        {getPriorityBadge(t.priority)}
                        {getStatusBadge(t.status)}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                        <span>Event: <strong className="text-slate-700">{t.booking?.reference || 'General'}</strong></span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{t.booking?.locationName || 'Addis Ababa'}</span>
                        </span>
                        {t.dueDate && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600 font-medium">Due {new Date(t.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {t.status === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateStatus(t.id, 'IN_PROGRESS')}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>Start</span>
                        </button>
                      )}

                      {t.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleUpdateStatus(t.id, 'COMPLETED')}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                        >
                          <Check className="w-3 h-3" />
                          <span>Complete</span>
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedTask(t)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors"
                        title="View Details"
                      >
                        <Info className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setIncidentModal({ open: true, task: t })}
                        className="p-1.5 text-slate-400 hover:text-[#F50046] hover:bg-rose-50 rounded-lg text-xs font-medium transition-colors"
                        title="Report Blocker"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* View All Duties Footer */}
                {todaysTasks.length > 4 && (
                  <div className="pt-3 border-t border-slate-100 text-center">
                    <Link
                      to="/company/tasks"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#F50046] hover:text-[#d0003b] transition-colors"
                    >
                      <span>View all {todaysTasks.length} assigned duties</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card: Upcoming Assigned Events */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200/80">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    My Assigned Events ({upcomingEvents.length})
                  </h2>
                  <p className="text-[11px] text-slate-400">Events scheduled where you have on-site responsibilities</p>
                </div>
              </div>

              <Link
                to="/company/events"
                className="text-xs font-semibold text-[#F50046] hover:underline flex items-center gap-0.5"
              >
                <span>View all events</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700 text-xs">No upcoming event assignments found.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">When coordinators assign duties, they will appear here.</p>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {displayUpcomingEvents.map((a) => (
                    <div
                      key={a.id}
                      className="p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 bg-white hover:bg-slate-50/50 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                            Duty: {a.role}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {a.booking?.reference}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-xs mb-1">
                          {a.booking?.title || 'Private Event'}
                        </h3>

                        <div className="space-y-1 text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{a.startTime ? new Date(a.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {a.startTime ? new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'} - {a.endTime ? new Date(a.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{a.location || a.booking?.locationName || 'Addis Ababa'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-slate-400">Status: <strong className="text-slate-700">{a.status}</strong></span>
                        <Link
                          to="/company/events"
                          className="text-[#F50046] hover:underline font-semibold text-xs flex items-center gap-1"
                        >
                          <span>Details</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {/* View All Events Footer */}
                {upcomingEvents.length > 4 && (
                  <div className="pt-3 border-t border-slate-100 text-center mt-3">
                    <Link
                      to="/company/events"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#F50046] hover:text-[#d0003b] transition-colors"
                    >
                      <span>View all {upcomingEvents.length} assigned events</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Task Progress Overview + Notifications + Operating Guidelines */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card: Task Progress Overview */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 text-left">
            <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 mb-4">
              Duty Execution Progress
            </h2>

            {allTasks.length === 0 ? (
              <p className="text-xs text-slate-400">No active assigned duties yet.</p>
            ) : (
              <div className="space-y-4">
                {/* Visual Ratio Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                    <span>Completion Rate</span>
                    <span className="text-[#F50046]">
                      {allTasks.length > 0 ? Math.round(((metrics.completedTasksCount || 0) / allTasks.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
                    <div
                      style={{ width: `${allTasks.length > 0 ? ((metrics.completedTasksCount || 0) / allTasks.length) * 100 : 0}%` }}
                      className="h-full bg-slate-900 rounded-full"
                    ></div>
                    <div
                      style={{ width: `${allTasks.length > 0 ? ((metrics.tasksInProgressCount || 0) / allTasks.length) * 100 : 0}%` }}
                      className="h-full bg-slate-400"
                    ></div>
                    <div
                      style={{ width: `${allTasks.length > 0 ? ((metrics.blockedTasksCount || 0) / allTasks.length) * 100 : 0}%` }}
                      className="h-full bg-[#F50046]"
                    ></div>
                  </div>
                </div>

                {/* Status Breakdown Legend */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Pending:</span>
                    <strong className="text-slate-800">{metrics.pendingTasksCount || 0}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500 font-medium">In Progress:</span>
                    <strong className="text-slate-800">{metrics.tasksInProgressCount || 0}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Completed:</span>
                    <strong className="text-slate-800">{metrics.completedTasksCount || 0}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-50/60 border border-rose-100 flex items-center justify-between">
                    <span className="text-[#F50046] font-medium">Blocked:</span>
                    <strong className="text-rose-800">{metrics.blockedTasksCount || 0}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card: Recent Notifications */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#F50046]" />
                <h2 className="text-sm font-bold text-slate-900">Notifications</h2>
              </div>
              <Link to="/company/notifications" className="text-[11px] text-[#F50046] hover:underline font-semibold">
                View all
              </Link>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No new notifications.</p>
            ) : (
              <div className="space-y-2.5">
                {displayNotifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 text-xs transition-colors"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <strong className="text-slate-800 font-bold truncate max-w-[180px]">{n.title}</strong>
                      <span className="text-[10px] text-slate-400">
                        {n.createdAt ? new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                ))}

                {/* View All Notifications Footer */}
                {notifications.length > 4 && (
                  <div className="pt-2 border-t border-slate-100 text-center mt-2">
                    <Link
                      to="/company/notifications"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F50046] hover:text-[#d0003b] transition-colors"
                    >
                      <span>View all notifications</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: TASK DETAILS */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-[#F50046]" />
                <h3 className="text-base font-bold text-slate-900">Task Details</h3>
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Title</span>
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Related Event</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {selectedTask.booking?.title} ({selectedTask.booking?.reference})
                </p>
                <p className="text-[11px] text-slate-500">{selectedTask.booking?.locationName}</p>
              </div>

              {selectedTask.description && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Instructions & Notes</span>
                  <div className="mt-1 p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {selectedTask.description}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setNoteModal({ open: true, task: selectedTask });
                  }}
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

      {/* MODAL 2: REPORT BLOCKER / INCIDENT */}
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
              Reporting on task: <strong className="text-slate-800">{incidentModal.task.title}</strong>
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
                  <option value="LOW">Low (Minor delay, task can continue)</option>
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
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-slate-700" />
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
