import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  AlertCircle,
  Plus,
  Search,
  Filter,
  X,
  RefreshCw,
  Calendar,
  MapPin,
  User,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  List,
  Check,
  ShieldAlert,
  Flag,
  Trash2,
  Edit3,
  ExternalLink,
  Building,
  Phone,
  Mail,
  CheckCircle2,
  ArrowUpDown,
  ChevronDown,
  Layers,
  Sparkles,
  Eye,
  CalendarCheck
} from 'lucide-react';

const formatDate = (dateStr) => {
  if (!dateStr) return 'Not Scheduled';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return 'Not Scheduled';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

const isDateToday = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

const isDateThisWeek = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  return d >= now && d <= weekEnd;
};

// Priority configurations
const PRIORITY_CONFIG = {
  URGENT: {
    label: 'Critical',
    badge: 'bg-slate-100 text-slate-900 border-slate-200 font-bold',
    dot: 'bg-[#F50046]',
    border: 'border-l-[#F50046]'
  },
  HIGH: {
    label: 'High',
    badge: 'bg-slate-100 text-slate-800 border-slate-200 font-semibold',
    dot: 'bg-slate-600',
    border: 'border-l-slate-600'
  },
  MEDIUM: {
    label: 'Medium',
    badge: 'bg-slate-50 text-slate-700 border-slate-200 font-medium',
    dot: 'bg-slate-400',
    border: 'border-l-slate-400'
  },
  LOW: {
    label: 'Low',
    badge: 'bg-slate-50 text-slate-500 border-slate-200/60 font-medium',
    dot: 'bg-slate-300',
    border: 'border-l-slate-300'
  }
};

// Status configurations
const STATUS_CONFIG = {
  PENDING: {
    label: 'To Do',
    pill: 'bg-slate-50 text-slate-600 border-slate-200',
    dot: 'bg-slate-400'
  },
  IN_PROGRESS: {
    label: 'In Progress',
    pill: 'bg-slate-100 text-slate-900 border-slate-200 font-medium',
    dot: 'bg-slate-900'
  },
  COMPLETED: {
    label: 'Completed',
    pill: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-500'
  },
  BLOCKED: {
    label: 'Blocked',
    pill: 'bg-rose-50 text-[#F50046] border-rose-200 font-semibold',
    dot: 'bg-[#F50046]'
  }
};

const TASK_CATEGORIES = [
  'Event Preparation',
  'Partner Coordination',
  'Venue Arrangement',
  'Equipment and Inventory',
  'Customer Communication',
  'Documentation',
  'Event Execution',
  'Post-Event Activities'
];

export default function CompanyTasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary data states
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Top-Level Navigation View Switcher: 'all_tasks' | 'my_tasks' | 'milestones'
  const [mainView, setMainView] = useState(searchParams.get('view') || 'all_tasks');

  // Presentation Mode for Tasks: 'list' (Default table) | 'kanban' (Kanban board)
  const [taskPresentation, setTaskPresentation] = useState('list');

  // Filter toolbar state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterBookingId, setFilterBookingId] = useState(searchParams.get('bookingId') || '');
  const [filterStaffId, setFilterStaffId] = useState('');
  const [filterDeadline, setFilterDeadline] = useState('');
  const [sortBy, setSortBy] = useState('due_asc'); // 'due_asc', 'due_desc', 'priority_desc', 'created_desc'

  // Pagination for List View
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected task for side-drawer inspection
  const [selectedTask, setSelectedTask] = useState(null);

  // Milestone Tab specific filter
  const [milestoneEventFilter, setMilestoneEventFilter] = useState('ALL');

  // Modals state
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [createMilestoneModalOpen, setCreateMilestoneModalOpen] = useState(false);
  const [editTaskModal, setEditTaskModal] = useState({ open: false, task: null });
  const [incidentModal, setIncidentModal] = useState({ open: false, task: null });

  // Form states
  const [taskForm, setTaskForm] = useState({
    bookingId: '',
    title: '',
    description: '',
    category: 'Event Preparation',
    assignedStaffId: '',
    priority: 'MEDIUM',
    dueDate: ''
  });
  const [submittingTask, setSubmittingTask] = useState(false);

  const [milestoneForm, setMilestoneForm] = useState({
    bookingId: '',
    title: '',
    targetDate: '',
    targetTime: '14:00',
    order: 1
  });
  const [submittingMilestone, setSubmittingMilestone] = useState(false);

  const [incidentForm, setIncidentForm] = useState({
    incidentType: 'Equipment Delay',
    severity: 'HIGH',
    description: ''
  });
  const [submittingIncident, setSubmittingIncident] = useState(false);

  // 1. Data Loader
  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [tasksRes, milestonesRes, bookingsRes, staffRes] = await Promise.allSettled([
        api.getTasks(),
        api.getAllMilestones(),
        api.getAllBookings('?limit=100'),
        api.getStaffMembers()
      ]);

      if (tasksRes.status === 'fulfilled' && tasksRes.value?.data?.tasks) {
        setTasks(tasksRes.value.data.tasks);
      }
      if (milestonesRes.status === 'fulfilled' && milestonesRes.value?.data?.milestones) {
        setMilestones(milestonesRes.value.data.milestones);
      }
      if (bookingsRes.status === 'fulfilled' && bookingsRes.value?.data?.bookings) {
        setBookings(bookingsRes.value.data.bookings);
      }
      if (staffRes.status === 'fulfilled' && staffRes.value?.data?.staffUsers) {
        setStaffMembers(staffRes.value.data.staffUsers);
      }
    } catch (err) {
      console.error('Failed to load operational tasks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync selected task when list updates
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find((t) => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  }, [tasks, selectedTask]);

  const handleMainViewChange = (view) => {
    setMainView(view);
    setCurrentPage(1);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('view', view);
    setSearchParams(newParams);
  };

  // 2. Summary Metric Calculations (Real authoritative counts)
  const metrics = useMemo(() => {
    const now = new Date();
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;

    // Base collection depending on current view (All Tasks vs My Tasks)
    const baseTasks =
      mainView === 'my_tasks' && user?.id
        ? tasks.filter((t) => t.assignedStaffId === user.id)
        : tasks;

    baseTasks.forEach((t) => {
      if (t.status === 'COMPLETED') {
        completed++;
      } else if (t.status === 'IN_PROGRESS') {
        inProgress++;
      }

      const isOverdue = t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED';
      if (isOverdue) {
        overdue++;
      }
    });

    const myTasksCount = user?.id ? tasks.filter((t) => t.assignedStaffId === user.id).length : 0;

    // Deduplicate unique milestones
    const uniqueMilestoneKeys = new Set(
      milestones.map((m) => `${m.bookingId || ''}-${m.title?.trim().toLowerCase()}`)
    );

    return {
      total: baseTasks.length,
      inProgress,
      completed,
      overdue,
      allTasksCount: tasks.length,
      myTasksCount,
      milestonesCount: uniqueMilestoneKeys.size
    };
  }, [tasks, milestones, mainView, user?.id]);

  // 3. Filtered Tasks Calculation
  const filteredTasks = useMemo(() => {
    const now = new Date();

    // First filter by View scope (All vs My Tasks)
    let list = tasks;
    if (mainView === 'my_tasks') {
      list = list.filter((t) => t.assignedStaffId === user?.id);
    }

    // Apply Toolbar Filters
    return list
      .filter((t) => {
        // Status filter
        if (filterStatus) {
          if (filterStatus === 'OVERDUE') {
            const isOverdue = t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED';
            if (!isOverdue) return false;
          } else if (t.status !== filterStatus) {
            return false;
          }
        }

        // Priority filter
        if (filterPriority && t.priority !== filterPriority) return false;

        // Event filter
        if (filterBookingId && t.bookingId !== filterBookingId) return false;

        // Staff filter
        if (filterStaffId && t.assignedStaffId !== filterStaffId) return false;

        // Deadline filter
        if (filterDeadline === 'TODAY' && !isDateToday(t.dueDate)) return false;
        if (filterDeadline === 'WEEK' && !isDateThisWeek(t.dueDate)) return false;
        if (filterDeadline === 'OVERDUE') {
          const isOverdue = t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED';
          if (!isOverdue) return false;
        }

        // Keyword Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = (t.title || '').toLowerCase().includes(q);
          const matchDesc = (t.description || '').toLowerCase().includes(q);
          const matchRef = (t.booking?.reference || '').toLowerCase().includes(q);
          const matchEvent = (t.booking?.title || '').toLowerCase().includes(q);
          const matchStaff = (t.assignedStaff?.fullName || '').toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchRef && !matchEvent && !matchStaff) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Sorting logic
        if (sortBy === 'due_asc') {
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
          return dateA - dateB;
        }
        if (sortBy === 'due_desc') {
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          return dateB - dateA;
        }
        if (sortBy === 'priority_desc') {
          const weight = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return (weight[b.priority] || 0) - (weight[a.priority] || 0);
        }
        if (sortBy === 'created_desc') {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        return 0;
      });
  }, [tasks, mainView, user?.id, filterStatus, filterPriority, filterBookingId, filterStaffId, filterDeadline, searchQuery, sortBy]);

  // Paginated tasks for list view
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTasks.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTasks, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage) || 1;

  // 4. Filtered Milestones with Task Progress
  const filteredMilestones = useMemo(() => {
    let list = milestones;
    if (milestoneEventFilter !== 'ALL') {
      list = list.filter((m) => m.bookingId === milestoneEventFilter);
    }

    // Deduplicate any repeated milestones by bookingId + title
    const seen = new Set();
    const uniqueList = [];
    for (const m of list) {
      const key = `${m.bookingId || ''}-${m.title?.trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueList.push(m);
      }
    }

    // Map each milestone with related event task progress
    return uniqueList
      .map((m) => {
        const relatedTasks = tasks.filter((t) => t.bookingId === m.bookingId);
        const completedRelated = relatedTasks.filter((t) => t.status === 'COMPLETED').length;
        const progressPct =
          relatedTasks.length > 0 ? Math.round((completedRelated / relatedTasks.length) * 100) : m.isCompleted ? 100 : 0;

        return {
          ...m,
          relatedTasksCount: relatedTasks.length,
          completedTasksCount: completedRelated,
          progressPct
        };
      })
      .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));
  }, [milestones, tasks, milestoneEventFilter]);

  // 5. Action Handlers

  // Fast Summary Card Filter Click
  const handleSummaryCardClick = (statusKey) => {
    if (filterStatus === statusKey) {
      setFilterStatus('');
    } else {
      setFilterStatus(statusKey);
    }
    setCurrentPage(1);
  };

  // 1-Click Status Update
  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await api.updateTaskStatus(taskId, newStatus);
      toast.success(`Task status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}.`);
      await loadData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to update task status.');
    }
  };

  // Toggle Milestone Complete
  const handleToggleMilestone = async (milestoneId, currentVal) => {
    try {
      const nextVal = !currentVal;
      await api.updateMilestone(milestoneId, { isCompleted: nextVal });
      toast.success(nextVal ? 'Milestone achieved.' : 'Milestone reopened.');
      await loadData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to update milestone.');
    }
  };

  // Delete Milestone
  const handleDeleteMilestone = async (milestoneId) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) return;
    try {
      await api.deleteMilestone(milestoneId);
      toast.success('Milestone removed.');
      await loadData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to delete milestone.');
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.deleteTask(taskId);
      toast.success('Task deleted successfully.');
      if (selectedTask?.id === taskId) setSelectedTask(null);
      await loadData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to delete task.');
    }
  };

  // 1-Click Direct Assign / Reassign Staff Member (Coordinator / Admin)
  const handleAssignStaff = async (taskId, newStaffId) => {
    try {
      const assignedUser = staffMembers.find((s) => s.id === newStaffId);
      await api.updateTask(taskId, { assignedStaffId: newStaffId || null });
      toast.success(
        newStaffId
          ? `Task assigned to ${assignedUser?.fullName || 'employee'}.`
          : 'Task marked as unassigned.'
      );
      await loadData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to update task assignment.');
    }
  };

  // Open Create Task
  const handleOpenCreateTask = (initialBookingId = '', initialStatus = 'PENDING') => {
    setTaskForm({
      bookingId: initialBookingId || filterBookingId || bookings[0]?.id || '',
      title: '',
      description: '',
      category: 'Event Preparation',
      assignedStaffId: '',
      priority: 'MEDIUM',
      status: initialStatus,
      dueDate: ''
    });
    setCreateTaskModalOpen(true);
  };

  // Submit Create Task
  const handleSubmitCreateTask = async (e) => {
    e.preventDefault();
    if (!taskForm.bookingId || !taskForm.title.trim()) {
      toast.error('Related event and task title are required.');
      return;
    }

    try {
      setSubmittingTask(true);
      const combinedDesc = taskForm.category
        ? `[${taskForm.category}] ${taskForm.description ? taskForm.description.trim() : ''}`
        : taskForm.description;

      const createdRes = await api.createTask({
        bookingId: taskForm.bookingId,
        title: taskForm.title.trim(),
        description: combinedDesc,
        assignedStaffId: taskForm.assignedStaffId || null,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null
      });

      const newTaskId = createdRes?.data?.task?.id;
      if (newTaskId && taskForm.status && taskForm.status !== 'PENDING') {
        try {
          await api.updateTaskStatus(newTaskId, taskForm.status);
        } catch (statusErr) {
          console.warn('Initial status update warning:', statusErr);
        }
      }

      toast.success('Task created and assigned successfully.');
      setCreateTaskModalOpen(false);
      await loadData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to create task.');
    } finally {
      setSubmittingTask(false);
    }
  };

  // Open Edit Task
  const handleOpenEditTask = (task) => {
    setEditTaskModal({ open: true, task });
    setTaskForm({
      bookingId: task.bookingId,
      title: task.title,
      description: task.description || '',
      category: 'Event Preparation',
      assignedStaffId: task.assignedStaffId || '',
      priority: task.priority || 'MEDIUM',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : ''
    });
  };

  // Submit Edit Task
  const handleSubmitEditTask = async (e) => {
    e.preventDefault();
    if (!editTaskModal.task || !taskForm.title.trim()) return;

    try {
      setSubmittingTask(true);
      await api.updateTask(editTaskModal.task.id, {
        title: taskForm.title.trim(),
        description: taskForm.description ? taskForm.description.trim() : null,
        assignedStaffId: taskForm.assignedStaffId || null,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null
      });

      toast.success('Task details updated.');
      setEditTaskModal({ open: false, task: null });
      await loadData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to update task.');
    } finally {
      setSubmittingTask(false);
    }
  };

  // Open Add Milestone
  const handleOpenCreateMilestone = (initialBookingId = '') => {
    const targetB = bookings.find((b) => b.id === initialBookingId) || bookings[0];
    const defaultDate = targetB?.preferredDate ? targetB.preferredDate.split('T')[0] : new Date().toISOString().split('T')[0];

    setMilestoneForm({
      bookingId: targetB?.id || '',
      title: '',
      targetDate: defaultDate,
      targetTime: '14:00',
      order: filteredMilestones.length + 1
    });
    setCreateMilestoneModalOpen(true);
  };

  // Submit Add Milestone
  const handleSubmitCreateMilestone = async (e) => {
    e.preventDefault();
    if (!milestoneForm.bookingId || !milestoneForm.title.trim()) {
      toast.error('Related event and milestone title are required.');
      return;
    }

    try {
      setSubmittingMilestone(true);
      const combinedDateTime = new Date(`${milestoneForm.targetDate}T${milestoneForm.targetTime || '12:00'}:00`);

      await api.addBookingMilestone(milestoneForm.bookingId, {
        title: milestoneForm.title.trim(),
        targetDate: combinedDateTime.toISOString(),
        order: parseInt(milestoneForm.order, 10) || 1
      });

      toast.success('Milestone created.');
      setCreateMilestoneModalOpen(false);
      await loadData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to add milestone.');
    } finally {
      setSubmittingMilestone(false);
    }
  };

  // Open Incident Blocker Report Modal
  const handleOpenFileIncident = (task) => {
    setIncidentModal({ open: true, task });
    setIncidentForm({
      incidentType: 'Equipment Delay',
      severity: 'HIGH',
      description: ''
    });
  };

  // Submit Blocker Report
  const handleSubmitIncident = async (e) => {
    e.preventDefault();
    if (!incidentModal.task || !incidentForm.description.trim()) {
      toast.error('Please describe the blocker.');
      return;
    }

    try {
      setSubmittingIncident(true);
      await api.createTaskIncident(incidentModal.task.id, {
        incidentType: incidentForm.incidentType,
        severity: incidentForm.severity,
        description: incidentForm.description.trim()
      });

      toast.success('Blocker logged. Task moved to BLOCKED.');
      setIncidentModal({ open: false, task: null });
      await loadData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to log incident report.');
    } finally {
      setSubmittingIncident(false);
    }
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterStatus('');
    setFilterPriority('');
    setFilterBookingId('');
    setFilterStaffId('');
    setFilterDeadline('');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchQuery || filterStatus || filterPriority || filterBookingId || filterStaffId || filterDeadline
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* =========================================================
          1. HEADER & PRIMARY ACTIONS
          ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
            <Link to="/company/dashboard" className="hover:text-[#F50046] transition-colors">
              Company Portal
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Tasks & Milestones</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Tasks & Milestones
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Organize work, assign responsibilities, and track event preparation from start to completion.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60"
            title="Sync registry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F50046]' : 'text-slate-500'}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync Registry'}</span>
          </button>

          {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && (
            <button
              onClick={() => handleOpenCreateMilestone()}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-300" />
              <span>New Milestone</span>
            </button>
          )}

          {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && (
            <button
              onClick={() => handleOpenCreateTask()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#F50046] hover:bg-[#d9003f] text-white text-xs font-bold rounded-xl shadow-sm shadow-[#F50046]/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================
          2. SUMMARY METRIC CARDS (Interactive Fast Filters)
          ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Tasks */}
        <button
          onClick={() => handleSummaryCardClick('')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            !filterStatus
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${!filterStatus ? 'text-slate-300' : 'text-slate-500'}`}>
              Total Tasks
            </span>
            <CheckSquare className={`w-4 h-4 ${!filterStatus ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{metrics.total}</div>
          <p className={`text-[11px] mt-1.5 font-medium ${!filterStatus ? 'text-slate-300' : 'text-slate-400'}`}>
            {mainView === 'my_tasks' ? 'Assigned to your queue' : 'Across all celebrations'}
          </p>
        </button>

        {/* Card 2: In Progress */}
        <button
          onClick={() => handleSummaryCardClick('IN_PROGRESS')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'IN_PROGRESS'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${filterStatus === 'IN_PROGRESS' ? 'text-slate-300' : 'text-slate-600'}`}>
              In Progress
            </span>
            <Clock className={`w-4 h-4 ${filterStatus === 'IN_PROGRESS' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{metrics.inProgress}</div>
          <p className={`text-[11px] mt-1.5 font-medium ${filterStatus === 'IN_PROGRESS' ? 'text-slate-300' : 'text-slate-400'}`}>
            Actively being executed
          </p>
        </button>

        {/* Card 3: Completed */}
        <button
          onClick={() => handleSummaryCardClick('COMPLETED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'COMPLETED'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${filterStatus === 'COMPLETED' ? 'text-slate-300' : 'text-slate-600'}`}>
              Completed
            </span>
            <CheckCircle2 className={`w-4 h-4 ${filterStatus === 'COMPLETED' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{metrics.completed}</div>
          <p className={`text-[11px] mt-1.5 font-medium ${filterStatus === 'COMPLETED' ? 'text-slate-300' : 'text-slate-400'}`}>
            Delivered and confirmed
          </p>
        </button>

        {/* Card 4: Overdue */}
        <button
          onClick={() => handleSummaryCardClick('OVERDUE')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'OVERDUE'
              ? 'bg-[#F50046] text-white border-[#F50046] shadow-md ring-2 ring-rose-500/20'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-rose-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${filterStatus === 'OVERDUE' ? 'text-rose-100' : 'text-rose-600'}`}>
              Overdue
            </span>
            <AlertTriangle className={`w-4 h-4 ${filterStatus === 'OVERDUE' ? 'text-rose-100' : 'text-rose-500'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{metrics.overdue}</div>
          <p className={`text-[11px] mt-1.5 font-medium ${filterStatus === 'OVERDUE' ? 'text-rose-100' : 'text-slate-400'}`}>
            Passed execution deadline
          </p>
        </button>
      </div>

      {/* =========================================================
          3. VIEW SWITCHER TABS (All Tasks / My Tasks / Milestones)
          ========================================================= */}
      <div className="border-b border-slate-200 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-8 -mb-px">
          {/* All Tasks */}
          <button
            onClick={() => handleMainViewChange('all_tasks')}
            className={`pb-3.5 text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              mainView === 'all_tasks'
                ? 'border-[#F50046] text-[#F50046]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>All Tasks</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                mainView === 'all_tasks' ? 'bg-[#F50046]/10 text-[#F50046]' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {metrics.allTasksCount}
            </span>
          </button>

          {/* My Tasks */}
          <button
            onClick={() => handleMainViewChange('my_tasks')}
            className={`pb-3.5 text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              mainView === 'my_tasks'
                ? 'border-[#F50046] text-[#F50046]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>My Tasks</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                mainView === 'my_tasks' ? 'bg-[#F50046]/10 text-[#F50046]' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {metrics.myTasksCount}
            </span>
          </button>

          {/* Milestones */}
          <button
            onClick={() => handleMainViewChange('milestones')}
            className={`pb-3.5 text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              mainView === 'milestones'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Milestones</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                mainView === 'milestones' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {metrics.milestonesCount}
            </span>
          </button>
        </div>

        {/* Task Presentation Toggler (List vs Kanban - only on task views) */}
        {mainView !== 'milestones' && (
          <div className="flex items-center gap-1.5 pb-2">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden sm:inline">Presentation:</span>
            <button
              onClick={() => setTaskPresentation('list')}
              className={`p-1.5 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                taskPresentation === 'list'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => setTaskPresentation('kanban')}
              className={`p-1.5 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                taskPresentation === 'kanban'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
          </div>
        )}
      </div>

      {/* =========================================================
          4. TASK MANAGEMENT TOOLBAR (For All Tasks & My Tasks)
          ========================================================= */}
      {mainView !== 'milestones' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
            {/* Search Input */}
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by title, event ref, staff..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="BLOCKED">Blocked</option>
                <option value="OVERDUE">Overdue Only</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <select
                value={filterPriority}
                onChange={(e) => {
                  setFilterPriority(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 cursor-pointer"
              >
                <option value="">All Priorities</option>
                <option value="URGENT">Critical Priority</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>
            </div>

            {/* Related Event Filter */}
            <div>
              <select
                value={filterBookingId}
                onChange={(e) => {
                  setFilterBookingId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 cursor-pointer truncate"
              >
                <option value="">All Events</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.reference} — {b.title || 'Event'}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned Staff Filter (Hidden on My Tasks) */}
            {mainView === 'all_tasks' ? (
              <div>
                <select
                  value={filterStaffId}
                  onChange={(e) => {
                    setFilterStaffId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 cursor-pointer"
                >
                  <option value="">All Employees</option>
                  {staffMembers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.role})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <select
                  value={filterDeadline}
                  onChange={(e) => {
                    setFilterDeadline(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 cursor-pointer"
                >
                  <option value="">All Deadlines</option>
                  <option value="TODAY">Due Today</option>
                  <option value="WEEK">Due This Week</option>
                  <option value="OVERDUE">Overdue Tasks</option>
                </select>
              </div>
            )}
          </div>

          {/* Filter Metadata & Clear Action */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span>
                Found <strong className="text-slate-800">{filteredTasks.length}</strong> tasks
              </span>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="due_asc">Deadline (Earliest First)</option>
                <option value="due_desc">Deadline (Latest First)</option>
                <option value="priority_desc">Priority (High to Low)</option>
                <option value="created_desc">Recently Created</option>
              </select>
            </div>
          </div>
        </div>
      )}


      {/* =========================================================
          5. CONTENT PRESENTATION (List View vs Kanban vs Milestones)
          ========================================================= */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <RefreshCw className="w-8 h-8 text-[#F50046] animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading operational data...
          </p>
        </div>
      ) : mainView !== 'milestones' ? (
        /* TASK PRESENTATION: LIST or KANBAN */
        taskPresentation === 'list' ? (
          /* =========================================================
             A. LIST VIEW (Default High-Density Operations Table)
             ========================================================= */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-10 text-center">Done</th>
                    <th className="py-3 px-4">Task Details</th>
                    <th className="py-3 px-4">Related Event</th>
                    <th className="py-3 px-4">Assigned To</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedTasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-700">No tasks found</p>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                          {hasActiveFilters
                            ? 'No tasks match the active filters.'
                            : mainView === 'my_tasks'
                            ? 'You have no assigned tasks in your queue.'
                            : 'No operational tasks have been scheduled.'}
                        </p>
                        {hasActiveFilters && (
                          <button
                            onClick={handleClearFilters}
                            className="mt-3 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                          >
                            Reset Filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedTasks.map((t) => {
                      const prio = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.MEDIUM;
                      const stat = STATUS_CONFIG[t.status] || STATUS_CONFIG.PENDING;
                      const isCompleted = t.status === 'COMPLETED';
                      const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && !isCompleted;

                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                          onClick={() => setSelectedTask(t)}
                        >
                          {/* Checkbox */}
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleUpdateStatus(t.id, isCompleted ? 'PENDING' : 'COMPLETED')}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer mx-auto ${
                                isCompleted
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-white border-slate-300 hover:border-slate-400 text-transparent'
                              }`}
                              title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </td>

                          {/* Title & Desc */}
                          <td className="py-3 px-4 max-w-xs sm:max-w-sm">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold group-hover:text-[#F50046] transition-colors truncate ${
                                  isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                                }`}
                              >
                                {t.title}
                              </span>
                              {t.incidentReports?.length > 0 && (
                                <span className="px-1.5 py-0.2 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold rounded flex items-center gap-0.5 shrink-0">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  Blocker
                                </span>
                              )}
                            </div>
                            {t.description && !t.description.toLowerCase().includes('critical operational duty') && (
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                {t.description}
                              </div>
                            )}
                          </td>

                          {/* Related Event Link */}
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            {t.booking ? (
                              <Link
                                to={`/company/events?selectedEventId=${t.booking.id}`}
                                className="hover:text-[#F50046] transition-colors block group/link"
                                title="Open in Events & Schedule"
                              >
                                <div className="font-mono font-bold text-slate-700 text-[11px] flex items-center gap-1">
                                  <span>{t.booking.reference}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/link:opacity-100 text-[#F50046]" />
                                </div>
                                <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                                  {t.booking.title}
                                </div>
                              </Link>
                            ) : (
                              <span className="text-slate-400 text-xs">General Task</span>
                            )}
                          </td>

                          {/* Assigned To */}
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            {user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR' ? (
                              <div className="flex items-center gap-2">
                                {t.assignedStaff ? (
                                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 ring-1 ring-slate-200">
                                    {t.assignedStaff.fullName.charAt(0)}
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 rounded-full border border-dashed border-slate-300 bg-slate-50 text-slate-400 flex items-center justify-center shrink-0">
                                    <User className="w-3 h-3 text-slate-400" />
                                  </div>
                                )}
                                <select
                                  value={t.assignedStaffId || ''}
                                  onChange={(e) => handleAssignStaff(t.id, e.target.value)}
                                  className={`text-xs font-medium py-1 px-2 rounded-lg border focus:outline-none cursor-pointer transition-all max-w-[140px] truncate ${
                                    t.assignedStaff
                                      ? 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                                      : 'bg-slate-50/80 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-white'
                                  }`}
                                  title="Click to assign employee"
                                >
                                  <option value="">Assign staff...</option>
                                  {staffMembers.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.fullName} ({s.role})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                                  {t.assignedStaff?.fullName ? t.assignedStaff.fullName.charAt(0) : <User className="w-3 h-3 text-slate-400" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-700 text-xs truncate max-w-[120px]">
                                    {t.assignedStaff?.fullName || 'Unassigned'}
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 text-[10px] rounded-md border ${prio.badge}`}>
                              {prio.label}
                            </span>
                          </td>

                          {/* Due Date */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-medium ${isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-600'}`}>
                                {formatDate(t.dueDate)}
                              </span>
                              {isOverdue && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200/60">
                                  Overdue
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status Dropdown */}
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={t.status}
                              onChange={(e) => handleUpdateStatus(t.id, e.target.value)}
                              className={`text-xs font-bold px-2.5 py-1 rounded-xl border focus:outline-none cursor-pointer ${stat.pill}`}
                            >
                              <option value="PENDING">To Do</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                              <option value="BLOCKED">Blocked</option>
                            </select>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleOpenFileIncident(t)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Report Blocker"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>

                              {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && (
                                <button
                                  onClick={() => handleOpenEditTask(t)}
                                  className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Edit Task"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => setSelectedTask(t)}
                                className="p-1.5 text-slate-400 hover:text-[#F50046] hover:bg-rose-50 rounded-lg transition-colors"
                                title="Inspect Details"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredTasks.length > 0 && (
              <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                <span className="text-[11px] font-medium text-slate-500">
                  Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredTasks.length)} of {filteredTasks.length} tasks
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
        ) : (
          /* =========================================================
             B. KANBAN BOARD VIEW (Clean, Natural Height Operational Lanes)
             ========================================================= */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {[
              { status: 'PENDING' },
              { status: 'IN_PROGRESS' },
              { status: 'COMPLETED' },
              { status: 'BLOCKED' }
            ].map(({ status: colStatus }) => {
              const colConfig = STATUS_CONFIG[colStatus];
              const colTasks = filteredTasks.filter((t) => t.status === colStatus);

              return (
                <div
                  key={colStatus}
                  className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex flex-col"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/70 px-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${colConfig.dot}`} />
                      <h3 className="text-xs font-bold text-slate-800">{colConfig.label}</h3>
                      <span className="px-1.5 py-0.5 bg-white text-slate-500 text-[10px] font-semibold rounded-md border border-slate-200/80 shadow-2xs">
                        {colTasks.length}
                      </span>
                    </div>

                    {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && (
                      <button
                        onClick={() => handleOpenCreateTask('', colStatus)}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white rounded-md border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                        title={`Add Task to ${colConfig.label}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Column Task Cards List */}
                  <div className="space-y-2.5">
                    {colTasks.length === 0 ? (
                      <div className="py-8 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-white/60 space-y-1.5">
                        <CheckSquare className="w-5 h-5 text-slate-300 mx-auto" />
                        <p className="text-[11px] font-medium text-slate-500">No {colConfig.label.toLowerCase()} tasks</p>
                        {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && (
                          <button
                            onClick={() => handleOpenCreateTask('', colStatus)}
                            className="text-[11px] font-semibold text-[#F20047] hover:underline cursor-pointer pt-1 block mx-auto"
                          >
                            + Add Task
                          </button>
                        )}
                      </div>
                    ) : (
                      colTasks.map((t) => {
                        const prio = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.MEDIUM;
                        const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED';

                        return (
                          <div
                            key={t.id}
                            onClick={() => setSelectedTask(t)}
                            className="p-3 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-white hover:shadow-xs shadow-2xs transition-all cursor-pointer space-y-2 group"
                          >
                            {/* Card Top Row: Booking Reference + Priority (Left) & Due Date (Right) */}
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded truncate">
                                  {t.booking?.reference || 'General'}
                                </span>
                                <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded border ${prio.badge}`}>
                                  {prio.label}
                                </span>
                              </div>

                              {t.dueDate && (
                                <span
                                  className={`text-[10px] shrink-0 font-medium flex items-center gap-1 ${
                                    isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-400'
                                  }`}
                                >
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatDate(t.dueDate)}
                                </span>
                              )}
                            </div>

                            {/* Card Title */}
                            <h4 className="text-xs font-bold text-slate-900 group-hover:text-slate-700 transition-colors line-clamp-2 leading-snug">
                              {t.title}
                            </h4>

                            {/* Event Association Tag */}
                            {t.booking && (
                              <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 font-normal bg-slate-50/80 px-2 py-1 rounded-lg border border-slate-100">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{t.booking.title}</span>
                              </div>
                            )}

                            {/* Card Footer: Assignee (Left) & Discreet Stage Action (Right) */}
                            <div
                              className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Assignee */}
                              <div className="flex items-center gap-1.5 min-w-0">
                                {t.assignedStaff ? (
                                  <div className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[9px] shrink-0">
                                    {t.assignedStaff.fullName.charAt(0)}
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-full border border-dashed border-slate-300 bg-slate-50 text-slate-400 flex items-center justify-center shrink-0">
                                    <User className="w-2.5 h-2.5" />
                                  </div>
                                )}

                                {user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR' ? (
                                  <select
                                    value={t.assignedStaffId || ''}
                                    onChange={(e) => handleAssignStaff(t.id, e.target.value)}
                                    className="text-[10px] text-slate-600 bg-transparent hover:bg-slate-100 py-0.5 px-1 rounded border-none focus:outline-none cursor-pointer max-w-[95px] truncate font-medium"
                                  >
                                    <option value="">Unassigned</option>
                                    {staffMembers.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.fullName}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-medium truncate max-w-[95px]">
                                    {t.assignedStaff?.fullName || 'Unassigned'}
                                  </span>
                                )}
                              </div>

                              {/* Subtle Stage Mover */}
                              <div className="flex items-center gap-1 shrink-0">
                                {colStatus === 'PENDING' && (
                                  <button
                                    onClick={() => handleUpdateStatus(t.id, 'IN_PROGRESS')}
                                    className="px-2 py-1 rounded-md text-[10px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Advance to In Progress"
                                  >
                                    <span>Start</span>
                                    <ChevronRight className="w-3 h-3 text-slate-400" />
                                  </button>
                                )}
                                {colStatus === 'IN_PROGRESS' && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleUpdateStatus(t.id, 'COMPLETED')}
                                      className="px-2 py-1 rounded-md text-[10px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Mark as completed"
                                    >
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span>Done</span>
                                    </button>
                                    <button
                                      onClick={() => handleOpenFileIncident(t)}
                                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Report Blocker"
                                    >
                                      <AlertTriangle className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                                {colStatus === 'COMPLETED' && (
                                  <button
                                    onClick={() => handleUpdateStatus(t.id, 'IN_PROGRESS')}
                                    className="px-2 py-1 rounded-md text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                                    title="Reopen task"
                                  >
                                    <span>Reopen</span>
                                  </button>
                                )}
                                {colStatus === 'BLOCKED' && (
                                  <button
                                    onClick={() => handleUpdateStatus(t.id, 'IN_PROGRESS')}
                                    className="px-2 py-1 rounded-md text-[10px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                                    title="Resolve blocker"
                                  >
                                    <span>Resolve</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Inline "+ Add task" directly below the cards without stretching */}
                    {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && colTasks.length > 0 && (
                      <button
                        onClick={() => handleOpenCreateTask('', colStatus)}
                        className="w-full py-1.5 text-slate-400 hover:text-slate-700 hover:bg-white text-[11px] font-medium rounded-xl border border-dashed border-slate-200 hover:border-slate-300 transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add task</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* =========================================================
           C. MILESTONES VIEW (Master Event Checkpoints Timeline)
           ========================================================= */
        <div className="space-y-4">
          {/* Milestone Filter Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <label className="text-xs font-semibold text-slate-600 shrink-0">Event Runsheet:</label>
              <select
                value={milestoneEventFilter}
                onChange={(e) => setMilestoneEventFilter(e.target.value)}
                className="w-full sm:max-w-md px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
              >
                <option value="ALL">All Active Celebrations ({bookings.length} Events)</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.reference} — {b.title} ({formatDate(b.preferredDate)})
                  </option>
                ))}
              </select>
            </div>

            {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && (
              <button
                onClick={() => handleOpenCreateMilestone(milestoneEventFilter !== 'ALL' ? milestoneEventFilter : '')}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer shrink-0 inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Milestone</span>
              </button>
            )}
          </div>

          {/* Milestones Timeline List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden divide-y divide-slate-100">
            {filteredMilestones.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No milestones found</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Milestones represent important checkpoints like Booking Confirmed, Venue Prepared, Grand Entrance, and Event Completed.
                </p>
                {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && (
                  <button
                    onClick={() => handleOpenCreateMilestone(milestoneEventFilter !== 'ALL' ? milestoneEventFilter : '')}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm"
                  >
                    Create First Milestone
                  </button>
                )}
              </div>
            ) : (
              filteredMilestones.map((m, idx) => (
                <div
                  key={m.id}
                  className="p-4 sm:px-6 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleMilestone(m.id, m.isCompleted)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                        (m.isCompleted && (m.relatedTasksCount === 0 || m.progressPct === 100))
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-slate-300 hover:border-slate-400 text-transparent'
                      }`}
                      title={m.isCompleted ? 'Mark Pending' : 'Mark Completed'}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs sm:text-sm font-semibold truncate ${
                            (m.isCompleted && (m.relatedTasksCount === 0 || m.progressPct === 100))
                              ? 'line-through text-slate-400'
                              : 'text-slate-900 font-bold'
                          }`}
                        >
                          {m.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                        <span className="font-mono font-bold text-slate-600">
                          #{m.order || idx + 1}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatDate(m.targetDate)}
                        </span>
                        {m.booking && (
                          <>
                            <span>•</span>
                            <Link
                              to={`/company/events?selectedEventId=${m.booking.id}`}
                              className="text-slate-600 hover:text-[#F50046] truncate max-w-[200px]"
                            >
                              {m.booking.reference} — {m.booking.title}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Progress & Actions */}
                  <div className="flex items-center gap-4 shrink-0">
                    {/* Task progress percentage */}
                    {m.relatedTasksCount > 0 && (
                      <div className="text-right hidden sm:block">
                        <div className="text-[11px] font-bold text-slate-600">
                          {m.completedTasksCount}/{m.relatedTasksCount} Tasks ({m.progressPct}%)
                        </div>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${m.progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <span
                      className={`px-2.5 py-0.5 text-xs font-semibold rounded-lg border ${
                        (m.isCompleted && (m.relatedTasksCount === 0 || m.progressPct === 100))
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : m.progressPct > 0
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {(m.isCompleted && (m.relatedTasksCount === 0 || m.progressPct === 100))
                        ? 'Completed'
                        : m.progressPct > 0
                        ? `In Progress (${m.progressPct}%)`
                        : 'Pending'}
                    </span>

                    {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && (
                      <button
                        onClick={() => handleDeleteMilestone(m.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Milestone"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          OPERATIONAL WORKLOAD & SLA COMPLIANCE FOOTER
          ========================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">Operational Progress</span>
              <span className="text-[11px] font-black text-slate-500">
                {metrics.completed} of {metrics.total} Tasks Done ({metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0}%)
              </span>
            </div>
            <div className="w-48 sm:w-64 h-2 bg-slate-100 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0}%` }}
              />
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200 hidden md:block" />

          <div className="flex items-center gap-4 text-xs flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-500 font-medium">On Track:</span>
              <strong className="text-slate-800 font-bold">{metrics.inProgress} In Progress</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-slate-500 font-medium">Overdue:</span>
              <strong className={`${metrics.overdue > 0 ? 'text-rose-600 font-bold' : 'text-slate-800 font-bold'}`}>
                {metrics.overdue}
              </strong>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 font-medium">Assigned Staff:</span>
              <strong className="text-slate-800 font-bold">
                {new Set(tasks.filter((t) => t.assignedStaffId).map((t) => t.assignedStaffId)).size} Active
              </strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium shrink-0">
          <CalendarCheck className="w-4 h-4 text-slate-400" />
          <span>Addis Ababa Time (UTC+3)</span>
        </div>
      </div>

      {/* =========================================================
          6. TASK DETAILS DRAWER (Slide-Over Sheet)
          ========================================================= */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-2xs animate-fade-in">
          <div
            className="w-full max-w-lg bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md border ${
                        PRIORITY_CONFIG[selectedTask.priority]?.badge || PRIORITY_CONFIG.MEDIUM.badge
                      }`}
                    >
                      {PRIORITY_CONFIG[selectedTask.priority]?.label || selectedTask.priority}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {selectedTask.booking?.reference || 'General'}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 mt-2">{selectedTask.title}</h2>
                </div>

                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Switcher Strip */}
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-slate-500">Status:</span>
                <div className="inline-flex gap-1">
                  {['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStatus(selectedTask.id, st)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                        selectedTask.status === st
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {STATUS_CONFIG[st]?.label || st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Body */}
              <div className="p-5 space-y-6">
                {/* Description */}
                <div>
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                    Task Instructions & Scope
                  </h4>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
                    {selectedTask.description || 'No detailed instructions recorded.'}
                  </div>
                </div>

                {/* Assigned Employee */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      Assigned Employee
                    </h4>
                    {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && (
                      <span className="text-[10px] font-bold text-[#F50046]">Coordinator Assignment</span>
                    )}
                  </div>
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full border text-slate-800 font-extrabold flex items-center justify-center text-xs ${
                            selectedTask.assignedStaff
                              ? 'bg-slate-100 border-slate-200'
                              : 'bg-amber-50 border-amber-200 text-amber-700'
                          }`}
                        >
                          {selectedTask.assignedStaff?.fullName ? selectedTask.assignedStaff.fullName.charAt(0) : '?'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {selectedTask.assignedStaff?.fullName || 'Currently Unassigned'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {selectedTask.assignedStaff?.email || 'Select an employee below to assign'}
                          </div>
                        </div>
                      </div>

                      {selectedTask.assignedStaff?.phone && (
                        <a
                          href={`tel:${selectedTask.assignedStaff.phone}`}
                          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
                          title="Call Employee"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && (
                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                        <label className="text-[11px] font-bold text-slate-600 shrink-0">
                          Assign / Reassign To:
                        </label>
                        <select
                          value={selectedTask.assignedStaffId || ''}
                          onChange={(e) => handleAssignStaff(selectedTask.id, e.target.value)}
                          className="text-xs font-semibold px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 cursor-pointer max-w-[210px] truncate"
                        >
                          <option value="">Leave Unassigned</option>
                          {staffMembers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.fullName} ({s.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Related Event */}
                <div>
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                    Related Event
                  </h4>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        {selectedTask.booking?.title || 'General Task'}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {selectedTask.booking?.reference}
                      </span>
                    </div>

                    {selectedTask.booking?.preferredDate && (
                      <div className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Event Date: {formatDate(selectedTask.booking.preferredDate)}</span>
                      </div>
                    )}

                    {selectedTask.booking?.locationName && (
                      <div className="text-xs text-slate-600 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{selectedTask.booking.locationName}</span>
                      </div>
                    )}

                    {selectedTask.booking?.id && (
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <Link
                          to={`/company/events?selectedEventId=${selectedTask.booking.id}`}
                          className="text-[11px] font-bold text-[#F50046] hover:underline inline-flex items-center gap-1"
                        >
                          <span>Open in Events & Schedule</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Blocker & Incident Reports */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      Blockers & Incidents
                    </h4>
                    <button
                      onClick={() => handleOpenFileIncident(selectedTask)}
                      className="text-[11px] font-bold text-rose-600 hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Report Blocker</span>
                    </button>
                  </div>

                  {selectedTask.incidentReports && selectedTask.incidentReports.length > 0 ? (
                    <div className="space-y-2">
                      {selectedTask.incidentReports.map((inc) => (
                        <div key={inc.id} className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-rose-800">{inc.incidentType}</span>
                            <span className="px-1.5 py-0.2 bg-rose-200/70 text-rose-900 text-[10px] font-extrabold rounded">
                              {inc.severity}
                            </span>
                          </div>
                          <p className="text-slate-700 text-[11px] leading-relaxed">{inc.description}</p>
                          <div className="text-[10px] text-slate-400 pt-1 border-t border-rose-100 flex items-center justify-between">
                            <span>Reported by {inc.reportedBy?.fullName || 'Staff'}</span>
                            <span>{formatDateTime(inc.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                      No blockers reported.
                    </div>
                  )}
                </div>

                {/* Schedule & History */}
                <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-100">
                  <div>Due Date: {formatDateTime(selectedTask.dueDate)}</div>
                  <div>Created by: {selectedTask.createdBy?.fullName || 'Coordinator'}</div>
                  <div>Created on: {formatDateTime(selectedTask.createdAt)}</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && (
                <button
                  onClick={() => handleDeleteTask(selectedTask.id)}
                  className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                >
                  Delete Task
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && (
                  <button
                    onClick={() => handleOpenEditTask(selectedTask)}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
                  >
                    Edit Task
                  </button>
                )}

                {selectedTask.status !== 'COMPLETED' ? (
                  <button
                    onClick={() => handleUpdateStatus(selectedTask.id, 'COMPLETED')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    Mark Complete
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateStatus(selectedTask.id, 'PENDING')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    Reopen Task
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* =========================================================
          7. CREATE TASK MODAL
          ========================================================= */}
      {createTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Create Task</h3>
                <p className="text-xs text-slate-500 mt-0.5">Assign operational duties and deadlines.</p>
              </div>
              <button onClick={() => setCreateTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Related Event *</label>
                <select
                  required
                  value={taskForm.bookingId}
                  onChange={(e) => setTaskForm({ ...taskForm, bookingId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none cursor-pointer"
                >
                  <option value="">Select Event Booking</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.reference} — {b.title} ({formatDate(b.preferredDate)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="e.g., Confirm photographer attendance and timeline"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Task Category</label>
                <select
                  value={taskForm.category}
                  onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none cursor-pointer"
                >
                  {TASK_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Detailed instructions for the assigned employee..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Employee</label>
                  <select
                    value={taskForm.assignedStaffId}
                    onChange={(e) => setTaskForm({ ...taskForm, assignedStaffId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {staffMembers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority *</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none cursor-pointer"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={taskForm.status || 'PENDING'}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none cursor-pointer"
                  >
                    <option value="PENDING">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateTaskModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTask}
                  className="px-4 py-2 bg-[#F50046] hover:bg-[#d9003f] text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {submittingTask ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* =========================================================
          8. EDIT TASK MODAL
          ========================================================= */}
      {editTaskModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Edit Task</h3>
                <p className="text-xs text-slate-500 mt-0.5">Modify task title, priority, assignee, or deadline.</p>
              </div>
              <button onClick={() => setEditTaskModal({ open: false, task: null })} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEditTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Employee</label>
                  <select
                    value={taskForm.assignedStaffId}
                    onChange={(e) => setTaskForm({ ...taskForm, assignedStaffId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {staffMembers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority *</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none cursor-pointer"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={taskForm.status || 'PENDING'}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none cursor-pointer"
                  >
                    <option value="PENDING">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditTaskModal({ open: false, task: null })}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTask}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {submittingTask ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* =========================================================
          9. CREATE MILESTONE MODAL
          ========================================================= */}
      {createMilestoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Create Milestone</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record major stage checkpoints (e.g., Booking Confirmed, Venue Prepared, Grand Entrance).
                </p>
              </div>
              <button onClick={() => setCreateMilestoneModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreateMilestone} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Related Event *</label>
                <select
                  required
                  value={milestoneForm.bookingId}
                  onChange={(e) => {
                    const bId = e.target.value;
                    const b = bookings.find((item) => item.id === bId);
                    const bDate = b?.preferredDate ? b.preferredDate.split('T')[0] : milestoneForm.targetDate;
                    setMilestoneForm({ ...milestoneForm, bookingId: bId, targetDate: bDate });
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none cursor-pointer"
                >
                  <option value="">Select Event Booking</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.reference} — {b.title} ({formatDate(b.preferredDate)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Milestone Title *</label>
                <input
                  type="text"
                  required
                  value={milestoneForm.title}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                  placeholder="e.g., Venue Preparation Completed & Audio Line Check"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Date *</label>
                  <input
                    type="date"
                    required
                    value={milestoneForm.targetDate}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, targetDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Time</label>
                  <input
                    type="time"
                    value={milestoneForm.targetTime}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, targetTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sequence Order #</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={milestoneForm.order}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, order: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateMilestoneModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMilestone}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {submittingMilestone ? 'Adding...' : 'Create Milestone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* =========================================================
          10. REPORT INCIDENT / BLOCKER MODAL
          ========================================================= */}
      {incidentModal.open && incidentModal.task && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Report Blocker or Incident</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Log an impediment preventing task completion.</p>
              </div>
              <button onClick={() => setIncidentModal({ open: false, task: null })} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitIncident} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Target Task:</span>
                <div className="text-xs font-bold text-slate-900 mt-0.5">{incidentModal.task.title}</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Ref: {incidentModal.task.booking?.reference}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={incidentForm.incidentType}
                    onChange={(e) => setIncidentForm({ ...incidentForm, incidentType: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Equipment Failure">Equipment Failure</option>
                    <option value="Vendor Delay">Vendor / Supplier Delay</option>
                    <option value="Venue Access Issue">Venue Access / Electricity</option>
                    <option value="Staffing Shortage">Staffing Shortage</option>
                    <option value="Client Change">Client Scope Change</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Severity *</label>
                  <select
                    value={incidentForm.severity}
                    onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:outline-none cursor-pointer"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description *</label>
                <textarea
                  rows={4}
                  required
                  value={incidentForm.description}
                  onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                  placeholder="Describe what went wrong and immediate impact..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIncidentModal({ open: false, task: null })}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingIncident}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {submittingIncident ? 'Logging...' : 'File Blocker & Freeze Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}