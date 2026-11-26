import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import listPlugin from '@fullcalendar/react/list';
import interactionPlugin from '@fullcalendar/react/interaction';
import classicTheme from '@fullcalendar/react/themes/classic';

// FullCalendar styles
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';

import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  Calendar,
  Clock,
  MapPin,
  CheckSquare,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  List,
  LayoutGrid,
  CheckCircle2,
  X,
  TrendingUp,
  Palette,
  Check,
  User,
  Info,
  Search,
  ArrowRight,
  AlertCircle,
  CalendarDays
} from 'lucide-react';

// Format UTC Date / ISO String to local Africa/Addis_Ababa representation without 'Z'
const toEATLocalISO = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(d);
  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}`;
};

// Get real-time current date in Africa/Addis_Ababa formatted as 'YYYY-MM-DD'
const getTodayEATDateStr = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
};

// Format short time in Africa/Addis_Ababa (e.g., "08:30 AM")
const formatEATTime = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
};

// Format full date in Africa/Addis_Ababa (e.g., "Thursday, 5 November 2026")
const formatEATDateFull = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(d);
};

// Calculate duration in hours between two dates; returns "Time not specified" if missing or zero
const computeDurationHours = (startInput, endInput) => {
  if (!startInput || !endInput) return 'Time not specified';
  const s = new Date(startInput).getTime();
  const e = new Date(endInput).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return 'Time not specified';

  const diffMs = e - s;
  if (diffMs === 0) return 'Time not specified';

  const totalMinutes = Math.round(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} Min`;
  if (minutes === 0) return `${hours}.0 Hours`;
  return `${hours}h ${minutes}m`;
};

export default function StaffSchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const calendarRef = useRef(null);

  const [schedule, setSchedule] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Active view: 'month' | 'week' | 'day' | 'list'
  const [currentView, setCurrentView] = useState('month');
  const [scopeFilter, setScopeFilter] = useState('THIS_MONTH');

  // Selected date for Day/Agenda View (defaults to real-time TODAY in Africa/Addis_Ababa)
  const [selectedDate, setSelectedDate] = useState(() => getTodayEATDateStr());
  // Mini Calendar active month & year (0-indexed month: 10 = November)
  const [miniCalMonth, setMiniCalMonth] = useState(() => {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Addis_Ababa', month: 'numeric' });
    return parseInt(formatter.format(d), 10) - 1;
  });
  const [miniCalYear, setMiniCalYear] = useState(() => {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Addis_Ababa', year: 'numeric' });
    return parseInt(formatter.format(d), 10);
  });

  // Real-time ticking clock in Africa/Addis_Ababa
  const [currentLiveTime, setCurrentLiveTime] = useState(() => formatEATTime(new Date()));
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentLiveTime(formatEATTime(new Date()));
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'EVENTS' | 'TASKS'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'PENDING'

  // Selected item for the Slide-Over Drawer
  const [drawerItem, setDrawerItem] = useState(null);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  // Calendar title
  const [calendarTitle, setCalendarTitle] = useState(() => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Addis_Ababa',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  });

  // Pagination State for Day View and List View
  const [dayPage, setDayPage] = useState(1);
  const DAY_PAGE_SIZE = 3;

  const [listPage, setListPage] = useState(1);
  const LIST_PAGE_SIZE = 5;

  // Reset pagination when date or filters change
  useEffect(() => {
    setDayPage(1);
  }, [selectedDate]);

  useEffect(() => {
    setListPage(1);
  }, [searchQuery, typeFilter, statusFilter]);

  // Load real schedule from backend (supports manual refresh & background real-time sync)
  const loadSchedule = async (isManual = false, isBackground = false) => {
    try {
      if (isManual) setRefreshing(true);
      else if (!isBackground) setLoading(true);
      setError(null);

      const res = await api.getMyStaffSchedule();
      if (res?.data?.schedule) {
        setSchedule(res.data.schedule);
        setConflicts(res.data.conflicts || []);
        setLastSyncedAt(new Date());
      }
    } catch (err) {
      console.error('Staff schedule load error:', err);
      if (!isBackground) {
        setError(err.message || 'Failed to load personal staff schedule.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Real-Time Live Sync: 15-second background polling + window focus & network online listeners
  useEffect(() => {
    loadSchedule();

    const interval = setInterval(() => {
      loadSchedule(false, true);
    }, 15000);

    const onFocus = () => loadSchedule(false, true);
    const onOnline = () => loadSchedule(false, true);

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  // Live Metrics
  const overviewMetrics = useMemo(() => {
    const myTasksCount = schedule.filter((i) => i.type === 'TASK_DEADLINE').length;
    const myEventsCount = schedule.filter((i) => i.type === 'EVENT_DUTY').length;
    const completedTasksCount = schedule.filter(
      (i) => i.type === 'TASK_DEADLINE' && i.status === 'COMPLETED'
    ).length;
    const overdueTasksCount = schedule.filter(
      (i) => i.type === 'TASK_DEADLINE' && (i.status === 'OVERDUE' || i.priority === 'URGENT')
    ).length;

    return {
      myTasksCount,
      myEventsCount,
      completedTasksCount,
      overdueTasksCount,
      conflictCount: conflicts.length
    };
  }, [schedule, conflicts]);

  // Color mapping matching Eventora design system:
  const getEventStyling = (item) => {
    if (item.hasConflict) {
      return {
        pillBg: 'bg-slate-100 hover:bg-slate-200/70 text-slate-900 border border-slate-300',
        dotBg: 'bg-slate-700',
        borderColor: 'border-l-slate-700',
        timeColor: 'text-slate-700',
        timedCardBg: 'bg-slate-100 border-slate-300 text-slate-900 border-l-3 border-l-slate-700',
        typeBadge: 'bg-slate-200 text-slate-800 border-slate-300'
      };
    }

    if (item.status === 'COMPLETED') {
      return {
        pillBg: 'bg-slate-50 hover:bg-slate-100/70 text-slate-500 border border-slate-200 line-through',
        dotBg: 'bg-slate-400',
        borderColor: 'border-l-slate-300',
        timeColor: 'text-slate-400',
        timedCardBg: 'bg-slate-50/95 border-slate-200 text-slate-500 border-l-3 border-l-slate-300',
        typeBadge: 'bg-slate-100 text-slate-500 border-slate-200'
      };
    }

    if (item.status === 'OVERDUE' || item.priority === 'URGENT') {
      return {
        pillBg: 'bg-rose-50 hover:bg-rose-100/70 text-rose-900 border border-rose-200',
        dotBg: 'bg-[#F50046]',
        borderColor: 'border-l-[#F50046]',
        timeColor: 'text-rose-700',
        timedCardBg: 'bg-rose-50/95 border-rose-200 text-rose-950 border-l-3 border-l-[#F50046]',
        typeBadge: 'bg-rose-50 text-rose-800 border-rose-200'
      };
    }

    if (item.type === 'EVENT_DUTY') {
      return {
        pillBg: 'bg-rose-50/60 hover:bg-rose-50 text-slate-900 border border-rose-200/80',
        dotBg: 'bg-[#F50046]',
        borderColor: 'border-l-[#F50046]',
        timeColor: 'text-[#F50046]',
        timedCardBg: 'bg-rose-50/70 border-rose-200 text-slate-900 border-l-3 border-l-[#F50046]',
        typeBadge: 'bg-rose-50 text-[#F50046] border-rose-100'
      };
    }

    // Default task deadline: Clean Neutral Slate
    return {
      pillBg: 'bg-slate-50 hover:bg-slate-100/70 text-slate-800 border border-slate-200',
      dotBg: 'bg-slate-600',
      borderColor: 'border-l-slate-500',
      timeColor: 'text-slate-600',
      timedCardBg: 'bg-slate-50/95 border-slate-200 text-slate-900 border-l-3 border-l-slate-500',
      typeBadge: 'bg-slate-100 text-slate-700 border-slate-200'
    };
  };

  // Filtered schedule based on search, type, and status
  const filteredSchedule = useMemo(() => {
    return schedule.filter((item) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesRole = item.assignedRole?.toLowerCase().includes(q);
        const matchesLoc = item.location?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesRole && !matchesLoc) return false;
      }
      // Type filter
      if (typeFilter === 'EVENTS' && item.type !== 'EVENT_DUTY') return false;
      if (typeFilter === 'TASKS' && item.type !== 'TASK_DEADLINE') return false;
      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

      return true;
    });
  }, [schedule, searchQuery, typeFilter, statusFilter]);

  // Group items by local date (YYYY-MM-DD)
  const scheduleByDate = useMemo(() => {
    const map = {};
    filteredSchedule.forEach((item) => {
      const localISO = toEATLocalISO(item.startTime || item.date);
      if (localISO) {
        const dateKey = localISO.slice(0, 10);
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(item);
      }
    });
    return map;
  }, [filteredSchedule]);

  // Dynamic Weekly Date Strip centered around selectedDate's week (Mon-Sun)
  const weekStripDays = useMemo(() => {
    const current = new Date(selectedDate);
    if (isNaN(current.getTime())) return [];

    // Monday = 0, Sunday = 6
    const dayOfWeek = (current.getDay() + 6) % 7;
    const monday = new Date(current);
    monday.setDate(current.getDate() - dayOfWeek);

    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days.push({
        day: dayNames[i],
        date: dateFormatted,
        dateKey,
        count: scheduleByDate[dateKey]?.length || 0
      });
    }

    return days;
  }, [selectedDate, scheduleByDate]);

  // Active Selected Day assignments
  const activeDayAssignments = useMemo(() => {
    return scheduleByDate[selectedDate] || [];
  }, [scheduleByDate, selectedDate]);

  // Actual staff duty shifts for the selected date (derived from EVENT_DUTY records)
  const dutyShiftsForDay = useMemo(() => {
    return activeDayAssignments.filter((i) => i.type === 'EVENT_DUTY' && i.startTime);
  }, [activeDayAssignments]);

  // Dynamic shift time range derived from actual event duty assignments
  const activeShiftTelemetry = useMemo(() => {
    if (dutyShiftsForDay.length === 0) return null;

    let earliestMs = new Date(dutyShiftsForDay[0].startTime).getTime();
    let latestMs = new Date(dutyShiftsForDay[0].endTime || dutyShiftsForDay[0].startTime).getTime();

    dutyShiftsForDay.forEach((shift) => {
      const s = new Date(shift.startTime).getTime();
      const e = new Date(shift.endTime || shift.startTime).getTime();
      if (s < earliestMs) earliestMs = s;
      if (e > latestMs) latestMs = e;
    });

    return {
      startFormatted: formatEATTime(new Date(earliestMs)),
      endFormatted: formatEATTime(new Date(latestMs)),
      count: dutyShiftsForDay.length,
      primaryRole: dutyShiftsForDay[0].assignedRole || 'Field Duty Crew'
    };
  }, [dutyShiftsForDay]);

  // Chronologically sorted date groups for List View
  const sortedDateGroups = useMemo(() => {
    const keys = Object.keys(scheduleByDate).sort();
    return keys.map((key) => ({
      dateKey: key,
      items: scheduleByDate[key]
    }));
  }, [scheduleByDate]);

  // Paginated Day Assignments for Day View
  const totalDayPages = Math.ceil(activeDayAssignments.length / DAY_PAGE_SIZE) || 1;
  const paginatedDayAssignments = useMemo(() => {
    const start = (dayPage - 1) * DAY_PAGE_SIZE;
    return activeDayAssignments.slice(start, start + DAY_PAGE_SIZE);
  }, [activeDayAssignments, dayPage]);

  // Paginated List Items and Groups for List View
  const totalListPages = Math.ceil(filteredSchedule.length / LIST_PAGE_SIZE) || 1;
  const paginatedListItems = useMemo(() => {
    const start = (listPage - 1) * LIST_PAGE_SIZE;
    return filteredSchedule.slice(start, start + LIST_PAGE_SIZE);
  }, [filteredSchedule, listPage]);

  const paginatedListGroups = useMemo(() => {
    const map = {};
    paginatedListItems.forEach((item) => {
      const localISO = toEATLocalISO(item.startTime || item.date);
      if (localISO) {
        const dateKey = localISO.slice(0, 10);
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(item);
      }
    });
    const keys = Object.keys(map).sort();
    return keys.map((key) => ({
      dateKey: key,
      items: map[key]
    }));
  }, [paginatedListItems]);

  // Mathematically accurate dynamic mini-calendar month grid
  const miniCalendarCells = useMemo(() => {
    const firstDay = new Date(miniCalYear, miniCalMonth, 1);
    const lastDay = new Date(miniCalYear, miniCalMonth + 1, 0);

    // Monday = 0, ..., Sunday = 6
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();

    // Previous month trailing days
    const prevMonthLastDay = new Date(miniCalYear, miniCalMonth, 0).getDate();
    const cells = [];

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      cells.push({
        dayNumber: prevMonthLastDay - i,
        isCurrentMonth: false,
        dateKey: null
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const monthStr = String(miniCalMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateKey = `${miniCalYear}-${monthStr}-${dayStr}`;
      cells.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateKey
      });
    }

    // Next month leading days to complete grid
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        dayNumber: d,
        isCurrentMonth: false,
        dateKey: null
      });
    }

    return cells;
  }, [miniCalYear, miniCalMonth]);

  // Transform into FullCalendar objects
  const calendarEvents = useMemo(() => {
    return filteredSchedule.map((item) => {
      const isTask = item.type === 'TASK_DEADLINE';
      const style = getEventStyling(item);

      let allDay = false;
      let start;
      let end;

      if (isTask) {
        if (item.isAllDay) {
          allDay = true;
          const localISO = toEATLocalISO(item.startTime || item.date);
          start = localISO ? localISO.slice(0, 10) : undefined;
          end = undefined;
        } else {
          allDay = false;
          start = toEATLocalISO(item.startTime || item.date);
          if (start) {
            const startDateObj = new Date(item.startTime || item.date);
            const endDateObj = new Date(startDateObj.getTime() + 30 * 60 * 1000);
            end = toEATLocalISO(endDateObj);
          }
        }
      } else {
        allDay = false;
        start = toEATLocalISO(item.startTime);
        if (item.endTime && new Date(item.endTime) > new Date(item.startTime)) {
          end = toEATLocalISO(item.endTime);
        } else {
          const startDateObj = new Date(item.startTime);
          const endDateObj = new Date(startDateObj.getTime() + 2 * 60 * 60 * 1000);
          end = toEATLocalISO(endDateObj);
        }
      }

      return {
        id: item.id,
        title: item.title,
        start,
        end,
        allDay,
        extendedProps: {
          ...item,
          styleConfig: style
        }
      };
    });
  }, [filteredSchedule]);

  // Safe task completion handler (strictly for tasks, never events)
  const handleMarkTaskComplete = async (taskId) => {
    if (!taskId) return;
    try {
      setUpdatingTaskId(taskId);
      await api.updateTaskStatus(taskId, 'COMPLETED');
      toast.success('Task marked as COMPLETED! Coordinator notified.');
      await loadSchedule(true);
      if (drawerItem && drawerItem.id === taskId) {
        setDrawerItem((prev) => ({ ...prev, status: 'COMPLETED' }));
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update task status.');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Navigation & Scope Handlers
  const handleViewChange = (newView) => {
    setCurrentView(newView);
    const apiObj = calendarRef.current?.getApi();
    if (newView === 'month') {
      if (apiObj) {
        apiObj.changeView('dayGridMonth');
        setCalendarTitle(apiObj.view.title || 'November 2026');
      } else {
        setCalendarTitle('November 2026');
      }
    } else if (newView === 'week') {
      if (apiObj) {
        apiObj.changeView('dayGridWeek');
        setCalendarTitle(apiObj.view.title || 'November 2026');
      }
    } else if (newView === 'day') {
      setCalendarTitle(formatEATDateFull(selectedDate));
    } else if (newView === 'list') {
      setCalendarTitle('All Scheduled Duties');
    }
  };

  const handleScopeFilter = (scope) => {
    setScopeFilter(scope);
    if (scope === 'THIS_MONTH') {
      handleViewChange('month');
    } else if (scope === 'THIS_WEEK') {
      handleViewChange('week');
    } else if (scope === 'TODAY') {
      const liveToday = getTodayEATDateStr();
      setSelectedDate(liveToday);
      handleViewChange('day');
      setCalendarTitle(formatEATDateFull(liveToday));
    } else if (scope === 'ALL') {
      handleViewChange('list');
    }
  };

  const handlePrev = () => {
    if (currentView === 'month' || currentView === 'week') {
      const apiObj = calendarRef.current?.getApi();
      if (apiObj) {
        apiObj.prev();
        setCalendarTitle(apiObj.view.title);
      }
    } else if (currentView === 'day') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      const newDateStr = d.toISOString().slice(0, 10);
      setSelectedDate(newDateStr);
      setCalendarTitle(formatEATDateFull(newDateStr));
    } else {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 7);
      setSelectedDate(d.toISOString().slice(0, 10));
    }
  };

  const handleNext = () => {
    if (currentView === 'month' || currentView === 'week') {
      const apiObj = calendarRef.current?.getApi();
      if (apiObj) {
        apiObj.next();
        setCalendarTitle(apiObj.view.title);
      }
    } else if (currentView === 'day') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      const newDateStr = d.toISOString().slice(0, 10);
      setSelectedDate(newDateStr);
      setCalendarTitle(formatEATDateFull(newDateStr));
    } else {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 7);
      setSelectedDate(d.toISOString().slice(0, 10));
    }
  };

  const handleToday = () => {
    const liveToday = getTodayEATDateStr();
    setSelectedDate(liveToday);
    if (currentView === 'month' || currentView === 'week') {
      const apiObj = calendarRef.current?.getApi();
      if (apiObj) {
        apiObj.today();
        setCalendarTitle(apiObj.view.title);
      }
    } else if (currentView === 'day') {
      setCalendarTitle(formatEATDateFull(liveToday));
    }
  };

  // FullCalendar event card renderer
  const renderEventContent = (eventInfo) => {
    const item = eventInfo.event.extendedProps;
    const style = item.styleConfig || getEventStyling(item);
    const isMonthView = eventInfo.view.type === 'dayGridMonth';
    const isAllDay = eventInfo.event.allDay;
    const timeStr = formatEATTime(item.startTime || item.date);
    const endTimeStr = item.endTime && item.endTime !== item.startTime ? formatEATTime(item.endTime) : '';
    const timeDisplay = endTimeStr ? `${timeStr} – ${endTimeStr}` : timeStr;

    if (isMonthView) {
      return (
        <div
          className={`w-full px-2 py-0.5 my-0.5 rounded-md flex items-center justify-between gap-1 text-[11px] font-semibold leading-tight cursor-pointer transition-all shadow-2xs hover:shadow-xs border ${style.pillBg}`}
          title={`${eventInfo.event.title} ${timeStr ? `(${timeStr})` : ''}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {item.type === 'EVENT_DUTY' ? (
              <Calendar className="w-3 h-3 text-[#F50046] shrink-0" />
            ) : item.status === 'COMPLETED' ? (
              <CheckCircle2 className="w-3 h-3 text-slate-500 shrink-0" />
            ) : item.status === 'OVERDUE' || item.priority === 'URGENT' ? (
              <AlertTriangle className="w-3 h-3 text-[#F50046] shrink-0" />
            ) : (
              <CheckSquare className="w-3 h-3 text-slate-600 shrink-0" />
            )}
            <span className="truncate">{eventInfo.event.title}</span>
          </div>
          {timeStr && (
            <span className={`text-[10px] font-mono font-medium ml-1 shrink-0 ${style.timeColor}`}>
              ({timeStr})
            </span>
          )}
        </div>
      );
    }

    // dayGridWeek (Week View): Stacked, readable card in each day column without hourly slots
    return (
      <div
        className={`w-full p-2 my-1 rounded-xl flex flex-col gap-1 text-xs cursor-pointer transition-all shadow-2xs hover:shadow-xs border ${style.pillBg}`}
        title={`${eventInfo.event.title} ${timeDisplay ? `(${timeDisplay})` : ''}`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
            {item.type === 'EVENT_DUTY' ? (
              <>
                <Calendar className="w-3 h-3 text-[#F50046] shrink-0" />
                <span>Event</span>
              </>
            ) : (
              <>
                <CheckSquare className="w-3 h-3 text-slate-600 shrink-0" />
                <span>Task</span>
              </>
            )}
          </span>
          {item.status && (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                item.status === 'COMPLETED'
                  ? 'bg-slate-100 text-slate-700'
                  : item.status === 'OVERDUE' || item.priority === 'URGENT'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-white/80 text-slate-700'
              }`}
            >
              {item.status}
            </span>
          )}
        </div>

        <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
          {eventInfo.event.title}
        </p>

        <div className="flex items-center justify-between gap-1 text-[10px] font-mono pt-1 border-t border-slate-200/50 text-slate-600">
          <span className="flex items-center gap-1 font-semibold truncate">
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{timeDisplay || 'Time not specified'}</span>
          </span>
          {item.hasConflict && (
            <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-200 text-amber-900 shrink-0">
              Clash
            </span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto animate-pulse">
        <div className="h-24 bg-slate-200/80 rounded-2xl" />
        <div className="h-14 bg-slate-200/80 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 h-80 bg-slate-200/80 rounded-2xl" />
          <div className="lg:col-span-4 h-80 bg-slate-200/80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-7xl mx-auto text-left font-sans text-slate-800 pb-1">
      {/* 1. Compact Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
        <span>Company Portal</span>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <span>Staff Portal</span>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <span className="text-[#F50046] font-semibold">My Schedule</span>
      </nav>

      {/* 2. Sleek Compact Hero Banner */}
      <section
        className="relative overflow-hidden border border-rose-100/70 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-3 shadow-2xs"
        style={{
          background: 'linear-gradient(90deg, #FFFFFF 0%, #FFF1F4 45%, #FFDCE3 100%)'
        }}
      >
        <div className="flex items-center gap-3 z-10">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#F50046] to-rose-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Calendar className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none">
              My Schedule
            </h2>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Manage your assigned events, tasks, and upcoming responsibilities.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Conflict Alert Banner (Rendered ONLY if genuine conflicts exist) */}
      {overviewMetrics.conflictCount > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-amber-800 text-xs">
              <strong className="font-bold">Scheduling Conflict ({overviewMetrics.conflictCount} duty shifts overlap):</strong> Two or more event assignments overlap in time.
            </p>
          </div>
          <Link
            to="/company/support"
            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition-colors shadow-2xs"
          >
            Notify Coordinator
          </Link>
        </div>
      )}

      {/* 4. Controls: Scope Filters (Left) and View Switcher (Right) - Image 3 Mockup */}
      <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Scope Tabs: This Month, This Week, Today's Schedule, All Scheduled */}
        <div className="inline-flex p-1 bg-white border border-slate-200/80 rounded-xl shadow-2xs gap-1 self-start overflow-x-auto max-w-full">
          <button
            onClick={() => handleScopeFilter('THIS_MONTH')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              scopeFilter === 'THIS_MONTH'
                ? 'bg-[#F50046] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => handleScopeFilter('THIS_WEEK')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              scopeFilter === 'THIS_WEEK'
                ? 'bg-[#F50046] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => handleScopeFilter('TODAY')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              scopeFilter === 'TODAY'
                ? 'bg-[#F50046] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Today's Schedule ({scheduleByDate[getTodayEATDateStr()]?.length || 0})
          </button>
          <button
            onClick={() => handleScopeFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              scopeFilter === 'ALL'
                ? 'bg-[#F50046] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            All Scheduled ({schedule.length})
          </button>
        </div>

        {/* View Switchers: Month, Week, Day, List */}
        <div className="inline-flex p-1 bg-white border border-slate-200/80 rounded-xl shadow-2xs gap-1 self-start sm:self-auto">
          <button
            onClick={() => handleViewChange('month')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              currentView === 'month'
                ? 'bg-[#F50046] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Month</span>
          </button>
          <button
            onClick={() => handleViewChange('week')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              currentView === 'week'
                ? 'bg-[#F50046] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Week</span>
          </button>
          <button
            onClick={() => handleViewChange('day')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              currentView === 'day'
                ? 'bg-[#F50046] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Day</span>
          </button>
          <button
            onClick={() => handleViewChange('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              currentView === 'list'
                ? 'bg-[#F50046] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List</span>
          </button>
        </div>
      </section>

      {/* 5. Navigation Toolbar: Prev, Next, Today, Title (Left) + Search & Filter (Right) */}
      <section className="bg-white border border-slate-200/80 rounded-xl p-2 sm:p-2.5 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Navigation Toolbar */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="w-7 h-7 rounded-lg border border-slate-200/90 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="w-7 h-7 rounded-lg border border-slate-200/90 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-3 py-1 rounded-lg border border-rose-200 bg-rose-50/70 text-[#F50046] font-bold text-xs hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer"
          >
            Today
          </button>

          <div className="flex items-center gap-2 pl-2">
            <Calendar className="w-4 h-4 text-[#F50046] shrink-0" />
            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
              {calendarTitle}
            </h3>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-44">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search schedule..."
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-rose-400 text-slate-700 placeholder-slate-400 shadow-2xs"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All ({schedule.length})</option>
            <option value="EVENTS">Events ({overviewMetrics.myEventsCount})</option>
            <option value="TASKS">Tasks ({overviewMetrics.myTasksCount})</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="ASSIGNED">Assigned</option>
          </select>

          <button
            onClick={() => loadSchedule(true)}
            disabled={refreshing}
            className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh schedule"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F50046]' : ''}`} />
          </button>
        </div>
      </section>

      {/* 6. Main Content Grid: 8 Cols (Calendar / Day / List) + 4 Cols (Overview & Legend) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* Column 1: Main View (8 Cols) */}
        <div className="lg:col-span-8 space-y-2.5">
          {currentView === 'month' || currentView === 'week' ? (
            /* FullCalendar Grid View (Month or Week) */
            <>
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-2.5 sm:p-3 overflow-hidden">
                <div className="eventora-calendar">
                  <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, listPlugin, interactionPlugin, classicTheme]}
                    initialView={currentView === 'week' ? 'dayGridWeek' : 'dayGridMonth'}
                    initialDate={getTodayEATDateStr()}
                    headerToolbar={false}
                    events={calendarEvents}
                    eventContent={renderEventContent}
                    eventClick={(info) => setDrawerItem(info.event.extendedProps)}
                    dateClick={(info) => setSelectedDate(info.dateStr)}
                    dayMaxEvents={currentView === 'week' ? 10 : 2}
                    moreLinkClick="popover"
                    height="auto"
                    nowIndicator={true}
                    timeZone="Africa/Addis_Ababa"
                    datesSet={(dateInfo) => {
                      setCalendarTitle(dateInfo.view.title || 'November 2026');
                    }}
                  />
                </div>
              </div>

              {/* Operational Briefing for Selected Date & Duties (Eliminates dead space & balances columns) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-[#F50046] shrink-0">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                        Duties for {formatEATDateFull(selectedDate)}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Click any date on the calendar above to inspect assigned responsibilities
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                      {activeDayAssignments.length} {activeDayAssignments.length === 1 ? 'duty' : 'duties'}
                    </span>
                    {selectedDate !== getTodayEATDateStr() && (
                      <button
                        onClick={() => setSelectedDate(getTodayEATDateStr())}
                        className="text-[11px] font-bold text-[#F50046] hover:underline cursor-pointer"
                      >
                        Jump to Today
                      </button>
                    )}
                  </div>
                </div>

                {activeDayAssignments.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 space-y-1">
                    <p className="text-xs font-bold text-slate-600">No duties assigned on this date</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      You are off-duty or in reserve standby. Select highlighted dates on the calendar or review upcoming shifts.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {activeDayAssignments.map((item) => {
                      const isEvent = item.type === 'EVENT_DUTY';
                      const style = getEventStyling(item);
                      const startTimeStr = formatEATTime(item.startTime || item.date);
                      const endTimeStr =
                        item.endTime && item.endTime !== item.startTime ? formatEATTime(item.endTime) : '';
                      const timeDisplay = endTimeStr ? `${startTimeStr} – ${endTimeStr}` : startTimeStr;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setDrawerItem(item)}
                          className={`p-3 rounded-xl border border-slate-200/80 hover:border-rose-300 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 flex flex-col justify-between space-y-2 border-l-4 ${style.borderColor}`}
                        >
                          <div>
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="font-mono text-slate-500 font-semibold">{timeDisplay}</span>
                              <span className={`px-2 py-0.5 rounded-full font-bold ${style.bgColor} ${style.textColor}`}>
                                {item.status}
                              </span>
                            </div>
                            <h5 className="font-bold text-slate-900 text-xs line-clamp-1">{item.title}</h5>
                            {item.location && (
                              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 truncate">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{item.location}</span>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                            <span className="font-medium text-slate-400">
                              {isEvent ? 'Event Assignment' : 'Task Item'}
                            </span>
                            <span className="font-bold text-[#F50046] flex items-center gap-0.5 hover:underline">
                              View Details &rarr;
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : currentView === 'day' ? (
            <>
              {/* Compact Weekly Date Strip for Day View */}
              <section className="bg-white border border-slate-200/80 rounded-xl p-1.5 sm:p-2 shadow-2xs flex items-center justify-between gap-1 overflow-x-auto">
                <button
                  onClick={() => {
                    const prev = new Date(selectedDate);
                    prev.setDate(prev.getDate() - 1);
                    setSelectedDate(prev.toISOString().slice(0, 10));
                  }}
                  className="w-7 h-7 shrink-0 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-around min-w-[360px]">
                  {weekStripDays.map((d) => {
                    const isSelected = d.dateKey === selectedDate;
                    const isRealToday = d.dateKey === getTodayEATDateStr();
                    return (
                      <button
                        key={d.dateKey}
                        onClick={() => setSelectedDate(d.dateKey)}
                        className={`flex flex-col items-center py-1 px-2.5 sm:px-3 rounded-lg transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-[#F50046] text-white shadow-xs border-b-2 border-rose-800'
                            : isRealToday
                            ? 'bg-rose-50 text-[#F50046] font-bold border border-rose-200'
                            : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        {isRealToday && !isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F50046] absolute top-1 right-1" />
                        )}
                        <span className={`text-[10px] ${isSelected || isRealToday ? 'font-extrabold uppercase' : 'font-bold text-slate-700'}`}>
                          {d.day}
                        </span>
                        <span className={`text-[9px] ${isSelected ? 'font-semibold text-rose-100' : 'text-slate-400 font-medium'}`}>
                          {d.date}
                        </span>
                        <span
                          className={`mt-0.5 w-3.5 h-3.5 rounded-full text-[9px] font-bold flex items-center justify-center ${
                            isSelected
                              ? 'bg-white text-[#F50046] font-extrabold shadow-2xs'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {d.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    const next = new Date(selectedDate);
                    next.setDate(next.getDate() + 1);
                    setSelectedDate(next.toISOString().slice(0, 10));
                  }}
                  className="w-7 h-7 shrink-0 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </section>

              {/* Active Day Header */}
              <div className="flex items-center justify-between bg-white border border-slate-200/80 px-3.5 py-2 rounded-xl shadow-2xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#F50046]" />
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                    {formatEATDateFull(selectedDate)}
                  </h3>
                  {selectedDate === getTodayEATDateStr() && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-[#F50046] text-white uppercase tracking-wider">
                      Today
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-rose-50 text-[#F50046] rounded-full border border-rose-100">
                  {activeDayAssignments.length} Assignment{activeDayAssignments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Assignments for Active Day */}
              {activeDayAssignments.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-xl p-5 text-center space-y-1.5 shadow-2xs">
                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-1">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800">No Assignments on this Date</h4>
                  <p className="text-[11px] text-slate-500">
                    You have no scheduled tasks or event assignments for {formatEATDateFull(selectedDate)}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    {paginatedDayAssignments.map((item) => {
                      const style = getEventStyling(item);
                      const isEvent = item.type === 'EVENT_DUTY';
                      const startTimeStr = formatEATTime(item.startTime || item.date);
                      const endTimeStr = item.endTime && item.endTime !== item.startTime ? formatEATTime(item.endTime) : '';
                      const timeDisplay = item.isAllDay
                        ? 'All-day Deadline'
                        : endTimeStr
                          ? `${startTimeStr} – ${endTimeStr} (EAT)`
                          : `${startTimeStr} (EAT)`;

                      return (
                        <article
                          key={item.id}
                          className={`bg-white border-l-4 ${style.borderColor} border border-slate-200/80 rounded-xl p-2.5 sm:p-3 shadow-2xs hover:shadow-xs transition-all relative`}
                        >
                          <div className="flex items-start gap-2.5 sm:gap-3">
                            <div
                              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 border ${
                                isEvent
                                  ? 'bg-rose-50/60 border-rose-200/60 text-[#F50046]'
                                  : 'bg-slate-100 border-slate-200 text-slate-700'
                              }`}
                            >
                              {isEvent ? (
                                <Calendar className="w-5 h-5" />
                              ) : (
                                <div className="relative">
                                  <CheckSquare className="w-5 h-5" />
                                  {item.status === 'COMPLETED' && (
                                    <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-slate-700 text-white flex items-center justify-center text-[7px] font-bold">
                                      ✓
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 space-y-1 min-w-0">
                              <div className="flex items-center justify-between flex-wrap gap-1">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    isEvent
                                      ? 'bg-rose-50 text-[#F50046] border border-rose-200/60'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200/60'
                                  }`}
                                >
                                  {isEvent ? (
                                    <Calendar className="w-2.5 h-2.5 text-[#F50046]" />
                                  ) : (
                                    <CheckSquare className="w-2.5 h-2.5 text-slate-600" />
                                  )}
                                  <span>{isEvent ? 'Event Assignment' : 'Task Deadline'}</span>
                                </span>

                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    item.status === 'COMPLETED'
                                      ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                      : 'bg-slate-50 text-slate-700 border border-slate-200/60'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      item.status === 'COMPLETED' ? 'bg-slate-500' : 'bg-slate-400'
                                    }`}
                                  />
                                  <span>{item.status}</span>
                                </span>
                              </div>

                              <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug tracking-tight truncate">
                                {item.title}
                              </h4>

                              <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5 text-[11px] text-slate-500 font-medium">
                                <div className="flex items-center gap-2 text-slate-600">
                                  <div className="flex items-center gap-1 font-mono text-slate-700">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>{timeDisplay}</span>
                                  </div>
                                  {item.location && (
                                    <>
                                      <span>•</span>
                                      <div className="flex items-center gap-1 text-slate-600 truncate max-w-[200px]">
                                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span className="truncate">{item.location}</span>
                                      </div>
                                    </>
                                  )}
                                </div>

                                <button
                                  onClick={() => setDrawerItem(item)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F50046] hover:text-[#d0003b] border border-rose-200 px-2 py-0.5 rounded-full hover:bg-rose-50 transition-colors shadow-2xs cursor-pointer ml-auto"
                                >
                                  <span>View Details</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* Day View Pagination */}
                  {totalDayPages > 1 && (
                    <div className="flex items-center justify-between pt-2 px-1 border-t border-slate-100 text-xs">
                      <span className="text-[11px] text-slate-500 font-medium">
                        Showing {(dayPage - 1) * DAY_PAGE_SIZE + 1}–{Math.min(dayPage * DAY_PAGE_SIZE, activeDayAssignments.length)} of {activeDayAssignments.length} duties
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDayPage((p) => Math.max(1, p - 1))}
                          disabled={dayPage === 1}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-[11px] cursor-pointer"
                        >
                          Previous
                        </button>
                        <div className="flex items-center gap-1 px-1">
                          {Array.from({ length: totalDayPages }, (_, i) => i + 1).map((p) => (
                            <button
                              key={p}
                              onClick={() => setDayPage(p)}
                              className={`w-6 h-6 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                dayPage === p
                                  ? 'bg-[#F50046] text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setDayPage((p) => Math.min(totalDayPages, p + 1))}
                          disabled={dayPage === totalDayPages}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-[11px] cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* List View of All Scheduled Duties (Grouped by Date) */
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3 sm:p-3.5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <List className="w-4 h-4 text-[#F50046]" />
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm">All Scheduled Duties</h4>
                </div>
                <span className="text-[10px] font-semibold text-slate-400">
                  {filteredSchedule.length} total items
                </span>
              </div>

              {sortedDateGroups.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No scheduled duties found matching your current filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedListGroups.map((group) => {
                    const isToday = group.dateKey === getTodayEATDateStr();
                    return (
                      <div key={group.dateKey} className="space-y-1.5">
                        {/* Date Group Header */}
                        <div
                          className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-bold ${
                            isToday
                              ? 'bg-rose-50/70 border-rose-200/80 text-rose-950'
                              : 'bg-slate-50 border-slate-200/60 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Calendar className={`w-3.5 h-3.5 ${isToday ? 'text-[#F50046]' : 'text-slate-400'}`} />
                            <span>{formatEATDateFull(group.dateKey)}</span>
                            {isToday && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-[#F50046] text-white uppercase tracking-wider">
                                Today
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500">
                            {group.items.length} {group.items.length === 1 ? 'duty' : 'duties'}
                          </span>
                        </div>

                        {/* Items under this date */}
                        <div className="space-y-1.5">
                          {group.items.map((item) => {
                            const style = getEventStyling(item);
                            const isEvent = item.type === 'EVENT_DUTY';
                            const startTimeStr = formatEATTime(item.startTime || item.date);
                            const endTimeStr =
                              item.endTime && item.endTime !== item.startTime ? formatEATTime(item.endTime) : '';
                            const timeDisplay = endTimeStr ? `${startTimeStr} – ${endTimeStr}` : startTimeStr;

                            return (
                              <div
                                key={item.id}
                                onClick={() => setDrawerItem(item)}
                                className={`p-2.5 rounded-xl border border-slate-100 hover:border-rose-200 hover:bg-rose-50/20 transition-all flex items-center justify-between gap-3 cursor-pointer group border-l-4 ${style.borderColor}`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                      isEvent
                                        ? 'bg-rose-50 text-[#F50046] border-rose-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {isEvent ? <Calendar className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-bold text-slate-800 group-hover:text-[#F50046] truncate transition-colors">
                                        {item.title}
                                      </p>
                                      {item.hasConflict && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 text-slate-800 border border-slate-300 shrink-0">
                                          Clash
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        {timeDisplay || 'Time not specified'}
                                      </span>
                                      {item.location && (
                                        <>
                                          <span>•</span>
                                          <span className="truncate flex items-center gap-1 text-slate-500">
                                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                            {item.location}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                      item.status === 'COMPLETED'
                                        ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                        : item.status === 'OVERDUE' || item.priority === 'URGENT'
                                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#F50046] group-hover:translate-x-0.5 transition-all" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* List View Pagination */}
                  {totalListPages > 1 && (
                    <div className="flex items-center justify-between pt-2 px-1 border-t border-slate-100 text-xs">
                      <span className="text-[11px] text-slate-500 font-medium">
                        Showing {(listPage - 1) * LIST_PAGE_SIZE + 1}–{Math.min(listPage * LIST_PAGE_SIZE, filteredSchedule.length)} of {filteredSchedule.length} duties
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setListPage((p) => Math.max(1, p - 1))}
                          disabled={listPage === 1}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-[11px] cursor-pointer"
                        >
                          Previous
                        </button>
                        <div className="flex items-center gap-1 px-1">
                          {Array.from({ length: totalListPages }, (_, i) => i + 1).map((p) => (
                            <button
                              key={p}
                              onClick={() => setListPage(p)}
                              className={`w-6 h-6 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                listPage === p
                                  ? 'bg-[#F50046] text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setListPage((p) => Math.min(totalListPages, p + 1))}
                          disabled={listPage === totalListPages}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-[11px] cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column 2: Quick Overview, Mini Calendar & Priority Cards (Sticky & Balanced) (4 Cols) */}
        <div className="lg:col-span-4 space-y-2.5 lg:sticky lg:top-3.5 self-start">
          {/* Widget 1: Schedule Overview */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
              <TrendingUp className="w-4 h-4 text-[#F50046]" />
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Schedule Overview</h4>
            </div>

            <div className="space-y-2">
              {/* My Tasks */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600 shrink-0" />
                  <span className="font-semibold text-slate-700">My Tasks</span>
                </div>
                <span className="font-black text-slate-900">{overviewMetrics.myTasksCount}</span>
              </div>

              {/* My Events */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F50046] shrink-0" />
                  <span className="font-semibold text-slate-700">My Events</span>
                </div>
                <span className="font-black text-slate-900">{overviewMetrics.myEventsCount}</span>
              </div>

              {/* Completed Tasks */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-700">Completed Tasks</span>
                </div>
                <span className="font-black text-slate-900">{overviewMetrics.completedTasksCount}</span>
              </div>

              {/* Overdue Tasks */}
              {overviewMetrics.overdueTasksCount > 0 && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F50046] shrink-0" />
                    <span className="font-semibold text-rose-700">Overdue Tasks</span>
                  </div>
                  <span className="font-black text-rose-600">{overviewMetrics.overdueTasksCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Widget 2: Interactive Mini Calendar with Dynamic Month Generation */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs space-y-2.5">
            {/* Calendar Navigation with Month & Year */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <button
                onClick={() => {
                  if (miniCalMonth === 0) {
                    setMiniCalMonth(11);
                    setMiniCalYear((y) => y - 1);
                  } else {
                    setMiniCalMonth((m) => m - 1);
                  }
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                {new Date(miniCalYear, miniCalMonth, 1).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric'
                })}
              </h5>
              <button
                onClick={() => {
                  if (miniCalMonth === 11) {
                    setMiniCalMonth(0);
                    setMiniCalYear((y) => y + 1);
                  } else {
                    setMiniCalMonth((m) => m + 1);
                  }
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Calendar Days Header (Mon through Sun) */}
            <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-slate-400">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            {/* Mathematically Correct Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-y-1.5 text-center text-xs font-medium text-slate-700">
              {miniCalendarCells.map((cell, idx) => {
                if (!cell.isCurrentMonth) {
                  return (
                    <span key={idx} className="text-slate-300 py-0.5 select-none text-[11px]">
                      {cell.dayNumber}
                    </span>
                  );
                }

                const isSelected = cell.dateKey === selectedDate;
                const dayItems = scheduleByDate[cell.dateKey] || [];
                const hasEvents = dayItems.some((i) => i.type === 'EVENT_DUTY');
                const hasTasks = dayItems.some((i) => i.type === 'TASK_DEADLINE' && i.status !== 'COMPLETED');
                const hasCompleted = dayItems.some((i) => i.status === 'COMPLETED');

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedDate(cell.dateKey);
                      const apiObj = calendarRef.current?.getApi();
                      if (apiObj) {
                        apiObj.gotoDate(cell.dateKey);
                        setCalendarTitle(apiObj.view.title || 'November 2026');
                      }
                    }}
                    className="flex flex-col items-center justify-center cursor-pointer select-none"
                  >
                    {isSelected ? (
                      <span className="w-5 h-5 rounded-full bg-[#F50046] text-white font-extrabold flex items-center justify-center text-[11px] shadow-xs">
                        {cell.dayNumber}
                      </span>
                    ) : cell.dateKey === getTodayEATDateStr() ? (
                      <span className="w-5 h-5 rounded-full border-2 border-[#F50046] text-[#F50046] font-extrabold flex items-center justify-center text-[10px]">
                        {cell.dayNumber}
                      </span>
                    ) : (
                      <>
                        <span className="py-0.5 text-[11px] hover:text-[#F50046] transition-colors">{cell.dayNumber}</span>
                        <div className="flex items-center gap-0.5 h-1">
                          {hasEvents && <span className="w-1 h-1 bg-[#F50046] rounded-full" />}
                          {hasTasks && <span className="w-1 h-1 bg-slate-600 rounded-full" />}
                          {hasCompleted && !hasEvents && !hasTasks && (
                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Calendar Color Key / Legend */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-medium">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                <span>Tasks</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F50046]" />
                <span>Events</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Completed</span>
              </div>
            </div>
          </div>

          {/* Widget 3: Selected Date Agenda */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock className="w-3.5 h-3.5 text-[#F50046] shrink-0" />
                <h4 className="font-bold text-slate-900 text-xs truncate">
                  Agenda: {formatEATDateFull(selectedDate)}
                </h4>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                {activeDayAssignments.length} {activeDayAssignments.length === 1 ? 'duty' : 'duties'}
              </span>
            </div>

            {activeDayAssignments.length === 0 ? (
              <div className="py-2.5 text-center">
                <p className="text-[11px] text-slate-400">
                  No duties on this date.
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Select a highlighted date in the calendar or view upcoming assignments below.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto [scrollbar-width:thin]">
                {activeDayAssignments.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setDrawerItem(item)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-0.5">
                      <span>{formatEATTime(item.startTime || item.date)}</span>
                      <span className="font-bold text-slate-700">{item.status}</span>
                    </div>
                    <p className="font-bold text-slate-900 text-xs truncate">
                      {item.title}
                    </p>
                    {item.location && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {item.location}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 7. Stitch AI Slide-Over Drawer Component (100% Responsive on mobile & desktop) */}
      {drawerItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200"
        >
          {/* Soft Dark Backdrop Overlay */}
          <div
            onClick={() => setDrawerItem(null)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity cursor-pointer"
          />

          {/* Slide-Over Panel Container (Mobile-first responsive: full-width on mobile, 540px on desktop) */}
          <div className="fixed inset-y-0 right-0 z-50 flex max-w-full w-full sm:w-auto">
            <div className="w-full sm:w-[480px] md:w-[540px] max-w-full bg-white shadow-2xl flex flex-col justify-between h-full animate-in slide-in-from-right duration-250">
              {/* Drawer Header */}
              <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-white sticky top-0 z-10 flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        drawerItem.type === 'EVENT_DUTY'
                          ? 'bg-rose-50 text-[#F50046] border border-rose-200/60'
                          : 'bg-slate-100 text-slate-700 border border-slate-200/60'
                      }`}
                    >
                      {drawerItem.type === 'EVENT_DUTY' ? (
                        <Calendar className="w-3 h-3 text-[#F50046]" />
                      ) : (
                        <CheckSquare className="w-3 h-3 text-slate-600" />
                      )}
                      <span>
                        {drawerItem.type === 'EVENT_DUTY' ? 'Event Assignment' : 'Task Deadline'}
                      </span>
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        drawerItem.status === 'COMPLETED'
                          ? 'bg-slate-100 text-slate-700 border border-slate-200'
                          : 'bg-slate-50 text-slate-700 border border-slate-200/60'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          drawerItem.status === 'COMPLETED' ? 'bg-slate-500' : 'bg-slate-400'
                        }`}
                      />
                      <span>{drawerItem.status}</span>
                    </span>
                  </div>

                  <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug tracking-tight">
                    {drawerItem.title}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium truncate">
                    Ref: #{drawerItem.reference || drawerItem.id?.slice(0, 8).toUpperCase() || 'EVT-2026-0924'} •{' '}
                    {drawerItem.location || 'Addis Ababa'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDrawerItem(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Scrollable Body */}
              <div className="px-4 sm:px-5 py-4 overflow-y-auto space-y-3.5 flex-1 bg-slate-50/40">
                {/* Key Metrics Bar */}
                <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs text-center">
                  <div className="px-1 py-0.5 border-r border-slate-100 flex flex-col items-center">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Priority
                    </span>
                    <span
                      className={`mt-0.5 inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-md border ${
                        drawerItem.priority === 'HIGH' || drawerItem.priority === 'URGENT'
                          ? 'text-[#F50046] bg-rose-50 border-rose-100'
                          : 'text-slate-700 bg-slate-100 border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          drawerItem.priority === 'HIGH' || drawerItem.priority === 'URGENT' ? 'bg-[#F50046]' : 'bg-slate-500'
                        }`}
                      />
                      {drawerItem.priority || 'Standard'}
                    </span>
                  </div>

                  <div className="px-1 py-0.5 border-r border-slate-100 flex flex-col items-center">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Duration
                    </span>
                    <span className="mt-0.5 text-[10px] sm:text-[11px] font-bold text-slate-800">
                      {computeDurationHours(drawerItem.startTime, drawerItem.endTime)}
                    </span>
                  </div>

                  <div className="px-1 py-0.5 flex flex-col items-center">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Time Slot
                    </span>
                    <span className="mt-0.5 text-[10px] sm:text-[11px] font-mono font-bold text-slate-800">
                      {drawerItem.isAllDay
                        ? 'All-day'
                        : formatEATTime(drawerItem.startTime || drawerItem.date) || 'Time not specified'}
                    </span>
                  </div>
                </div>

                {/* Location & Venue Details Card */}
                {drawerItem.location && (
                  <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      <div className="w-6 h-6 rounded-lg bg-rose-50 text-[#F50046] flex items-center justify-center">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <span>Location & Venue</span>
                    </div>
                    <p className="font-semibold text-slate-800 text-xs pl-8">
                      {drawerItem.location}
                    </p>
                  </div>
                )}

                {/* Role / Responsibility */}
                {drawerItem.assignedRole && (
                  <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span>Assigned Responsibility</span>
                    </div>
                    <p className="font-semibold text-slate-800 text-xs pl-8">
                      {drawerItem.assignedRole}
                    </p>
                  </div>
                )}

                {/* Operational Description */}
                {drawerItem.description && (
                  <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                        <Info className="w-3.5 h-3.5" />
                      </div>
                      <span>Operational Brief</span>
                    </div>
                    <p className="text-xs text-slate-700 pl-8 leading-relaxed">
                      {drawerItem.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions (Strictly protects event status; only allows completing eligible tasks) */}
              <div className="p-3.5 px-4 sm:px-5 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDrawerItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  {/* Task Completion is ONLY available for pending/in-progress tasks, never for events */}
                  {drawerItem.type === 'TASK_DEADLINE' && drawerItem.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleMarkTaskComplete(drawerItem.id)}
                      disabled={updatingTaskId === drawerItem.id}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{updatingTaskId === drawerItem.id ? 'Updating...' : 'Mark Completed'}</span>
                    </button>
                  )}

                  {drawerItem.type === 'TASK_DEADLINE' && drawerItem.status === 'COMPLETED' && (
                    <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 stroke-[3] text-slate-600" />
                      <span>Verified Complete</span>
                    </span>
                  )}

                  {drawerItem.type === 'TASK_DEADLINE' ? (
                    <Link
                      to="/company/tasks"
                      className="px-4 py-2 bg-[#F50046] hover:bg-[#d0003b] text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-rose-500/20"
                    >
                      Manage in Tasks
                    </Link>
                  ) : (
                    <Link
                      to="/company/events"
                      className="px-4 py-2 bg-[#F50046] hover:bg-[#d0003b] text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-rose-500/20"
                    >
                      View Event
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
