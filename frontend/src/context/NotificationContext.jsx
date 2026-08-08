import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const NotificationContext = createContext(null);

export const formatRelativeTime = (isoString) => {
  if (!isoString) return 'Just now';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 15) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return 'Just now';
  }
};

export const NotificationProvider = ({ children }) => {
  const { user, selectedAccountId } = useAuth();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resourceFilter, setResourceFilter] = useState('ALL'); // ALL | EC2 | S3 | CLOUDWATCH | AWS_ACCOUNT | AUTH | UNREAD
  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL | SUCCESS | ERROR | WARNING | INFO

  const socketRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications/unread-count');
      if (res.data && typeof res.data.count === 'number') {
        setUnreadCount(res.data.count);
      }
    } catch (err) {
      console.error('Failed to fetch unread notification count:', err);
    }
  }, [user]);

  const fetchNotifications = useCallback(async (isSilent = false) => {
    if (!user) return;
    if (!isSilent) setLoading(true);

    try {
      const params = { limit: 40 };
      if (resourceFilter === 'UNREAD') {
        params.unread_only = true;
      } else if (resourceFilter !== 'ALL') {
        params.resource_type = resourceFilter;
      }

      if (typeFilter !== 'ALL') {
        params.type = typeFilter;
      }

      if (selectedAccountId && selectedAccountId !== 'all') {
        params.account_id = selectedAccountId;
      }

      const res = await api.get('/notifications', { params });
      if (res.data) {
        setNotifications(res.data.notifications || []);
        if (typeof res.data.unread_count === 'number') {
          setUnreadCount(res.data.unread_count);
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [user, resourceFilter, typeFilter, selectedAccountId]);

  // Initial fetch and dependency trigger
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, resourceFilter, typeFilter, selectedAccountId, fetchUnreadCount, fetchNotifications]);

  // WebSocket Live Listener + 30s Polling Fallback
  useEffect(() => {
    if (!user) return;

    // Connect Socket.IO
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.hostname;
    const socketUrl = `${protocol}//${host}:5000`;

    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    socketRef.current.on('new_notification', (newNotif) => {
      if (!newNotif || !newNotif.id) return;

      // Toast popup
      const toastType = newNotif.type.toLowerCase() === 'error' ? 'error'
        : newNotif.type.toLowerCase() === 'warning' ? 'warning'
        : newNotif.type.toLowerCase() === 'success' ? 'success' : 'info';

      showToast(newNotif.title, toastType);

      // Prepend to notification list if not duplicate
      setNotifications((prev) => {
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });

      setUnreadCount((prev) => prev + 1);
    });

    // 30s Polling Fallback
    const pollInterval = setInterval(() => {
      fetchUnreadCount();
      fetchNotifications(true);
    }, 30000);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      clearInterval(pollInterval);
    };
  }, [user, showToast, fetchUnreadCount, fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      const res = await api.patch(`/notifications/${id}/read`);
      if (res.data && typeof res.data.unread_count === 'number') {
        setUnreadCount(res.data.unread_count);
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);

      const res = await api.patch('/notifications/read-all');
      if (res.data && typeof res.data.unread_count === 'number') {
        setUnreadCount(res.data.unread_count);
      }
      showToast('All notifications marked as read', 'success');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      const target = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      const res = await api.delete(`/notifications/${id}`);
      if (res.data && typeof res.data.unread_count === 'number') {
        setUnreadCount(res.data.unread_count);
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const clearAll = async () => {
    try {
      setNotifications([]);
      setUnreadCount(0);
      await api.delete('/notifications');
      showToast('All notifications cleared', 'info');
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        resourceFilter,
        setResourceFilter,
        typeFilter,
        setTypeFilter,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
