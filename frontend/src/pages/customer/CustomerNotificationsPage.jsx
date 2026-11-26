import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  FileText,
  Calendar,
  MessageSquare,
  CreditCard,
  Star,
  ChevronRight,
  CheckCheck,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';

export default function CustomerNotificationsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread' | 'read'
  const [loading, setLoading] = useState(false);

  // Initial preset notifications matching the uploaded screenshot design
  const defaultNotifications = [
    {
      id: 'notif-1',
      title: 'Contract Updated',
      message: 'Your contract (CT-2025-0178) has been updated. Please review the latest version.',
      type: 'CONTRACT',
      time: '2 hours ago',
      isRead: false,
      link: '/portal/contracts'
    },
    {
      id: 'notif-2',
      title: 'Event Reminder',
      message: 'Your event "Wedding Celebration" is coming up on May 24, 2025 at Skyline Hotel, Addis Ababa.',
      type: 'EVENT',
      time: '5 hours ago',
      isRead: false,
      link: '/portal/bookings'
    },
    {
      id: 'notif-3',
      title: 'New Message',
      message: 'You have a new message from the coordinator.',
      type: 'MESSAGE',
      time: '1 day ago',
      isRead: false,
      link: '/portal/messages'
    },
    {
      id: 'notif-4',
      title: 'Payment Confirmed',
      message: 'Your initial payment of 10,000 ETB has been received and verified.',
      type: 'PAYMENT',
      time: '1 day ago',
      isRead: true,
      link: '/portal/payments'
    },
    {
      id: 'notif-5',
      title: 'Review Invitation',
      message: 'Your event "Birthday Party" is completed. Please share your review.',
      type: 'REVIEW',
      time: '2 days ago',
      isRead: true,
      link: '/portal/reviews'
    }
  ];

  const [notifications, setNotifications] = useState(defaultNotifications);

  // Sync with live backend API
  const fetchNotifications = async () => {
    try {
      const response = await api.getNotifications();
      if (response?.data?.notifications && response.data.notifications.length > 0) {
        const mapped = response.data.notifications.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type || 'SYSTEM',
          time: formatTimeAgo(n.createdAt),
          isRead: n.isRead,
          link: n.link || '/portal/dashboard'
        }));
        setNotifications(mapped);
      }
    } catch (err) {
      // Fallback stays active gracefully
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Just now';
    const now = new Date();
    const date = new Date(dateString);
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleMarkAsRead = async (id, link) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    window.dispatchEvent(new CustomEvent('eventora:notifications-updated'));

    // Call backend
    if (!id.startsWith('notif-')) {
      try {
        await api.markNotificationRead(id);
      } catch (e) {
        // quiet
      }
    }

    if (link) {
      navigate(link);
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    window.dispatchEvent(new CustomEvent('eventora:notifications-updated'));
    try {
      await api.markAllNotificationsRead();
    } catch (e) {
      // quiet
    }
  };

  // Counts
  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const readCount = notifications.filter((n) => n.isRead).length;

  // Filter based on active tab
  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.isRead;
    if (activeTab === 'read') return n.isRead;
    return true;
  });

  // Render left icon matching screenshot
  const renderIcon = (type) => {
    switch (type) {
      case 'CONTRACT':
        return (
          <div className="w-11 h-11 rounded-full bg-[#B95650] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <FileText className="w-5 h-5 text-white" />
          </div>
        );
      case 'EVENT':
        return (
          <div className="w-11 h-11 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Calendar className="w-5 h-5 text-white" />
          </div>
        );
      case 'MESSAGE':
        return (
          <div className="w-11 h-11 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
        );
      case 'PAYMENT':
        return (
          <div className="w-11 h-11 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
        );
      case 'REVIEW':
        return (
          <div className="w-11 h-11 rounded-full bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Star className="w-5 h-5 text-white fill-white" />
          </div>
        );
      default:
        return (
          <div className="w-11 h-11 rounded-full bg-[#FCECE8] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Bell className="w-5 h-5 text-white" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-12">
      {/* Top Header: Bell Icon in Pink Box, Title, and Subtitle */}
      <div className="flex items-start gap-4">
        {/* Soft Pink Icon Square */}
        <div className="w-13 h-13 rounded-2xl bg-[#FFF0F4] flex items-center justify-center shrink-0 border border-[#E8B5A6]/60 shadow-2xs">
          <Bell className="w-6 h-6 text-[#B95650]" />
        </div>

        {/* Title & Description */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#211D1B] tracking-tight">
            Notifications
          </h1>
          <p className="text-xs sm:text-sm text-[#756B65] mt-1 font-normal leading-relaxed">
            Stay updated with the latest changes and important information about your events.
          </p>
        </div>

        {/* Mark All as Read button */}
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFFDFC] border border-[#E8DDD3]/90 hover:border-slate-300 text-xs font-semibold text-slate-600 hover:text-[#B95650] shadow-2xs transition-all cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 text-[#B95650]" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Main Container Card */}
      <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)]/80 shadow-2xs overflow-hidden">
        {/* Tabs Bar Header (All 5, Unread 3, Read 2) */}
        <div className="px-6 pt-5 pb-0 border-b border-[#E8DDD3] flex items-center gap-8">
          {/* Tab: All */}
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3.5 flex items-center gap-2 text-sm font-semibold transition-all relative cursor-pointer ${
              activeTab === 'all'
                ? 'text-[#B95650] font-bold border-b-2 border-[#B95650]'
                : 'text-slate-600 hover:text-[#B95650]'
            }`}
          >
            <span>All</span>
            <span
              className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors ${
                activeTab === 'all'
                  ? 'bg-[#B95650] text-white'
                  : 'bg-[#FCECE8]/80 text-[#B95650]'
              }`}
            >
              {totalCount}
            </span>
          </button>

          {/* Tab: Unread */}
          <button
            onClick={() => setActiveTab('unread')}
            className={`pb-3.5 flex items-center gap-2 text-sm font-semibold transition-all relative cursor-pointer ${
              activeTab === 'unread'
                ? 'text-[#B95650] font-bold border-b-2 border-[#B95650]'
                : 'text-slate-600 hover:text-[#B95650]'
            }`}
          >
            <span>Unread</span>
            <span
              className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors ${
                activeTab === 'unread'
                  ? 'bg-[#B95650] text-white'
                  : 'bg-[#FCECE8]/80 text-[#B95650]'
              }`}
            >
              {unreadCount}
            </span>
          </button>

          {/* Tab: Read */}
          <button
            onClick={() => setActiveTab('read')}
            className={`pb-3.5 flex items-center gap-2 text-sm font-semibold transition-all relative cursor-pointer ${
              activeTab === 'read'
                ? 'text-[#B95650] font-bold border-b-2 border-[#B95650]'
                : 'text-slate-600 hover:text-[#B95650]'
            }`}
          >
            <span>Read</span>
            <span
              className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors ${
                activeTab === 'read'
                  ? 'bg-[#B95650] text-white'
                  : 'bg-[#FCECE8]/80 text-[#B95650]'
              }`}
            >
              {readCount}
            </span>
          </button>
        </div>

        {/* Notifications List Body */}
        <div className="p-5 sm:p-6 space-y-3.5">
          {filteredNotifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#FCECE8] text-[#B95650] flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#211D1B]">No notifications</h3>
              <p className="text-xs text-[#756B65] mt-1">
                {activeTab === 'unread'
                  ? "You have no unread notifications right now."
                  : "No notifications found in this tab."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif, index) => {
              // Exact design match: top unread card has delicate pink background #FFF0F4
              const isFirstUnread = !notif.isRead && index === 0;

              return (
                <div
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif.id, notif.link)}
                  className={`group rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-all border cursor-pointer ${
                    !notif.isRead
                      ? isFirstUnread
                        ? 'bg-[#FFF0F4]/60 border-[#E8B5A6]/90 hover:bg-[#FFF0F4]/90 hover:shadow-2xs'
                        : 'bg-[#FFFDFC] border-[#E8DDD3]/90 hover:bg-[#F7F2EC]/50/70 hover:shadow-2xs'
                      : 'bg-[#FFFDFC] border-[#E8DDD3]/80 hover:bg-[#F7F2EC]/50/60'
                  }`}
                >
                  {/* Left: Icon & Text */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {renderIcon(notif.type)}

                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-[#211D1B] group-hover:text-[#B95650] transition-colors truncate">
                        {notif.title}
                      </h4>
                      <p className="text-xs text-[#756B65] font-normal mt-0.5 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                    </div>
                  </div>

                  {/* Right: Time, Status Dot, Chevron */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-[#756B65] font-normal hidden sm:inline">
                      {notif.time}
                    </span>

                    {/* Unread dot (#B95650 red) vs Read dot (slate-300 gray) */}
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        !notif.isRead ? 'bg-[#B95650]' : 'bg-slate-300'
                      }`}
                    ></span>

                    <ChevronRight className="w-4 h-4 text-[#756B65] group-hover:text-[#B95650] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })
          )}

          {/* Centered Footer Text (Matches Screenshot) */}
          <div className="pt-6 pb-2 text-center">
            <p className="text-xs text-[#756B65] font-normal">
              You've reached the end of your notifications.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
