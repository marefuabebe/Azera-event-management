import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  Calendar,
  Clock,
  MapPin,
  CheckSquare,
  Search,
  Filter,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  User,
  Info,
  X,
  ShieldCheck,
  Building,
  CheckCircle2,
  LayoutGrid,
  List
} from 'lucide-react';

export default function StaffEventsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UPCOMING' | 'COMPLETED'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [selectedEvent, setSelectedEvent] = useState(null);

  const loadEvents = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await api.getMyStaffEvents();
      if (res?.data?.events) {
        setEvents(res.data.events);
      }
    } catch (err) {
      console.error('Staff events load error:', err);
      setError(err.message || 'Failed to load assigned events.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return events.filter((e) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        q === '' ||
        (e.booking?.reference || '').toLowerCase().includes(q) ||
        (e.booking?.title || '').toLowerCase().includes(q) ||
        (e.booking?.locationName || '').toLowerCase().includes(q) ||
        (e.role || '').toLowerCase().includes(q);

      let matchesStatus = true;
      const isPast = e.assignmentEndTime ? new Date(e.assignmentEndTime) < startOfToday : (e.assignmentStartTime ? new Date(e.assignmentStartTime) < startOfToday : false);
      if (statusFilter === 'UPCOMING') matchesStatus = !isPast;
      else if (statusFilter === 'COMPLETED') matchesStatus = isPast || e.assignmentStatus === 'COMPLETED';

      return matchesSearch && matchesStatus;
    });
  }, [events, searchQuery, statusFilter]);

  const counts = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcoming = events.filter((e) => {
      const isPast = e.assignmentEndTime ? new Date(e.assignmentEndTime) < startOfToday : false;
      return !isPast;
    }).length;
    return {
      all: events.length,
      upcoming,
      completed: events.length - upcoming
    };
  }, [events]);

  // Pagination for events
  const [currentPage, setCurrentPage] = useState(1);
  const EVENTS_PER_PAGE = viewMode === 'grid' ? 6 : 8;
  const totalPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * EVENTS_PER_PAGE;
    return filteredEvents.slice(start, start + EVENTS_PER_PAGE);
  }, [filteredEvents, currentPage, EVENTS_PER_PAGE]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, viewMode]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-pulse">
        <div className="h-20 bg-slate-200 rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-200 rounded-2xl"></div>
          ))}
        </div>
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
        <span className="text-[#F50046] font-semibold">My Events</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Calendar className="w-7 h-7 text-[#F50046]" />
            <span>My Assigned Events ({events.length})</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational details and runsheet responsibilities for events you are staffed to execute.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => loadEvents(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F50046]' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-[#F50046] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Events ({counts.all})
          </button>
          <button
            onClick={() => setStatusFilter('UPCOMING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'UPCOMING'
                ? 'bg-[#F50046] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Upcoming ({counts.upcoming})
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'COMPLETED'
                ? 'bg-[#F50046] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Past & Completed ({counts.completed})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search event reference, title, venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-[#F50046] transition-all"
            />
          </div>

          {/* View Mode Switcher: Cards (Grid) vs List (Table) */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => { setViewMode('grid'); setCurrentPage(1); }}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('list'); setCurrentPage(1); }}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="List Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Events View: Grid or List */}
      {filteredEvents.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <h3 className="font-bold text-slate-700 text-sm">No assigned events found</h3>
          <p className="text-xs text-slate-400 mt-1">
            When Lead Coordinators assign you to on-site duties, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {viewMode === 'grid' ? (
            /* Cards Grid Mode */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedEvents.map((e) => (
                <div
                  key={e.id}
                  className="bg-white rounded-2xl border border-slate-200/80 hover:border-rose-200 shadow-2xs p-5 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                        {e.role}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-400">
                        {e.booking?.reference}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm mb-1 leading-snug">
                      {e.booking?.title}
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                      {e.booking?.eventType}
                    </p>

                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {e.assignmentStartTime ? new Date(e.assignmentStartTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {e.assignmentStartTime ? new Date(e.assignmentStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'} - {e.assignmentEndTime ? new Date(e.assignmentEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{e.assignmentLocation || e.booking?.locationName || 'Addis Ababa'}</span>
                      </div>
                    </div>

                    {/* Related Assigned Duties Count */}
                    {e.tasks && e.tasks.length > 0 && (
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          <CheckSquare className="w-3.5 h-3.5 text-[#F50046]" />
                          <span>{e.tasks.length} specific duties</span>
                        </span>
                        <span className="text-[11px] text-slate-600 font-semibold">
                          {e.tasks.filter((t) => t.status === 'COMPLETED').length} done
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">
                      Status: <strong className="text-slate-700">{e.booking?.eventStatus || e.assignmentStatus}</strong>
                    </span>

                    <button
                      onClick={() => setSelectedEvent(e)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-[#FFF0F4] hover:text-[#F50046] text-slate-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>Event Brief</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List (Table) Mode */
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Event & Ref</th>
                      <th className="py-3.5 px-4">Event Type</th>
                      <th className="py-3.5 px-4">Assigned Duty Role</th>
                      <th className="py-3.5 px-4">Date & Timing</th>
                      <th className="py-3.5 px-4">Venue & Location</th>
                      <th className="py-3.5 px-4">Duties</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedEvents.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{e.booking?.title}</div>
                          <div className="font-mono text-[10px] text-slate-400">{e.booking?.reference}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {e.booking?.eventType || 'EVENT'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 text-xs">{e.role}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">
                            {e.assignmentStartTime ? new Date(e.assignmentStartTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {e.assignmentStartTime ? new Date(e.assignmentStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'} - {e.assignmentEndTime ? new Date(e.assignmentEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-800 font-medium truncate max-w-[160px]">
                            {e.assignmentLocation || e.booking?.locationName || 'Addis Ababa'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-700">
                            {e.tasks ? `${e.tasks.filter((t) => t.status === 'COMPLETED').length}/${e.tasks.length} done` : '0 done'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {e.booking?.eventStatus || e.assignmentStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setSelectedEvent(e)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Event Brief
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Events Pagination (Always visible when items exist) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3.5 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 font-medium">
              Showing {(currentPage - 1) * EVENTS_PER_PAGE + 1}–{Math.min(currentPage * EVENTS_PER_PAGE, filteredEvents.length)} of {filteredEvents.length} events
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs cursor-pointer"
              >
                Previous
              </button>
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EVENT OPERATIONAL BRIEF */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#F50046]" />
                <h3 className="text-base font-bold text-slate-900">Event Operational Brief</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Event Title & Reference</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedEvent.booking?.title} ({selectedEvent.booking?.reference})
                </p>
                <p className="text-xs text-slate-500 font-medium">{selectedEvent.booking?.eventType}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-900">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Your Assigned Duty
                </span>
                <p className="text-sm font-bold text-slate-900">{selectedEvent.role}</p>
                <p className="text-xs text-slate-600 mt-1">
                  Schedule: {selectedEvent.assignmentStartTime ? new Date(selectedEvent.assignmentStartTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'TBD'} to {selectedEvent.assignmentEndTime ? new Date(selectedEvent.assignmentEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Venue & City</span>
                <div className="mt-1 flex items-start gap-1.5 text-slate-700 font-medium">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">{selectedEvent.booking?.locationName}</p>
                    {selectedEvent.booking?.locationAddress && (
                      <p className="text-[11px] text-slate-500">{selectedEvent.booking.locationAddress}</p>
                    )}
                    <p className="text-[10px] text-slate-400">{selectedEvent.booking?.city || 'Addis Ababa'}</p>
                  </div>
                </div>
              </div>

              {selectedEvent.booking?.assignedCoordinator && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lead Coordinator Contact</span>
                  <div className="mt-1 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{selectedEvent.booking.assignedCoordinator.fullName}</p>
                      <p className="text-[11px] text-slate-500">{selectedEvent.booking.assignedCoordinator.email}</p>
                    </div>
                    {selectedEvent.booking.assignedCoordinator.phone && (
                      <a
                        href={`tel:${selectedEvent.booking.assignedCoordinator.phone}`}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                      >
                        {selectedEvent.booking.assignedCoordinator.phone}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Related tasks for this event */}
              {selectedEvent.tasks && selectedEvent.tasks.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Your Specific Duties for this Event ({selectedEvent.tasks.length})
                  </span>
                  <div className="space-y-1.5">
                    {selectedEvent.tasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between"
                      >
                        <div>
                          <strong className="text-slate-800 block">{t.title}</strong>
                          <span className="text-[10px] text-slate-400">Status: {t.status}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          t.status === 'COMPLETED' ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-slate-50 text-slate-500 border border-slate-100'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
                >
                  Close Brief
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

