import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bell,
  Globe,
  Menu,
  User,
  LogOut,
  Shield,
  Key,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Plus,
  Trash2,
  Info,
  Layers,
  Server,
  Database,
  Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifications, formatRelativeTime } from '../../context/NotificationContext';

export const Navbar = ({ onOpenCommandPalette, onOpenMobileSidebar }) => {
  const { user, avatarInitial, logout, awsAccounts, selectedAccountId, setSelectedAccountId } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const {
    notifications,
    unreadCount,
    loading: loadingNotifications,
    resourceFilter,
    setResourceFilter,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  } = useNotifications();

  const [activeDropdown, setActiveDropdown] = useState(null); // null | 'account' | 'notifications' | 'profile'
  const navbarRef = useRef(null);

  const toggleDropdown = (name) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  // Close dropdowns on outside click & Escape key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (navbarRef.current && !navbarRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleNotificationClick = (n) => {
    if (!n.is_read) {
      markAsRead(n.id);
    }
    setActiveDropdown(null);

    const rType = (n.resource_type || '').toUpperCase();
    if (rType === 'EC2') navigate('/ec2');
    else if (rType === 'S3') navigate('/s3');
    else if (rType === 'CLOUDWATCH') navigate('/cloudwatch');
    else if (rType === 'AWS_ACCOUNT') navigate('/aws/accounts');
  };

  const handleSignOut = () => {
    logout();
    setActiveDropdown(null);
    showToast('Signed out of CloudOps Enterprise');
    navigate('/login');
  };

  const dropdownAnimation = {
    initial: { opacity: 0, scale: 0.95, y: -4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: -4 },
    transition: { duration: 0.15, ease: 'easeOut' },
  };

  const filterTabs = [
    { id: 'ALL', label: 'All' },
    { id: 'UNREAD', label: 'Unread' },
    { id: 'EC2', label: 'EC2' },
    { id: 'S3', label: 'S3' },
    { id: 'CLOUDWATCH', label: 'CloudWatch' },
    { id: 'AWS_ACCOUNT', label: 'AWS' },
    { id: 'AUTH', label: 'Auth' },
  ];

  return (
    <header
      ref={navbarRef}
      className="h-14 bg-[#0d121f]/90 backdrop-blur-md border-b border-slate-800/80 px-4 flex items-center justify-between sticky top-0 z-30 select-none"
    >
      {/* Left: Mobile Menu & Search trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-3 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-md text-xs text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-colors w-48 sm:w-64 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">Search resources, logs...</span>
          <span className="ml-auto hidden sm:inline-block px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-[10px] font-mono-tabular rounded text-slate-300">
            Ctrl+K
          </span>
        </button>
      </div>

      {/* Right: Region Selector, System Health, Notifications, User Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* AWS Account Switcher Dropdown */}
        <div className="relative font-mono-tabular">
          <button
            onClick={() => toggleDropdown('account')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 border rounded-md text-xs transition-colors focus:ring-2 focus:ring-blue-500/50 focus:outline-none ${
              activeDropdown === 'account'
                ? 'border-blue-500/60 text-white bg-slate-800'
                : 'border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="font-bold text-white max-w-[120px] truncate">
              {selectedAccountId === 'all'
                ? 'All Accounts'
                : awsAccounts.find((a) => String(a.id) === String(selectedAccountId))?.account_name || 'Personal'}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${
                activeDropdown === 'account' ? 'rotate-180 text-blue-400' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {activeDropdown === 'account' && (
              <motion.div
                {...dropdownAnimation}
                className="absolute right-0 mt-1 w-60 bg-slate-900 border border-slate-800 rounded-md shadow-2xl py-1 z-50 origin-top-right font-mono-tabular"
              >
                <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-slate-500 border-b border-slate-800">
                  Select Active AWS Account
                </div>

                <button
                  onClick={() => {
                    setSelectedAccountId('all');
                    setActiveDropdown(null);
                    showToast('Switched to All Connected AWS Accounts');
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors flex items-center justify-between ${
                    selectedAccountId === 'all' ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-300'
                  }`}
                >
                  <span className="font-bold">All Accounts</span>
                  <span className="px-1.5 py-0.2 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-400">
                    {awsAccounts.length} Connected
                  </span>
                </button>

                <div className="border-t border-slate-800/80 my-1" />

                {awsAccounts.map((acc) => {
                  const isSelected = String(selectedAccountId) === String(acc.id);
                  return (
                    <button
                      key={acc.id}
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setActiveDropdown(null);
                        showToast(`Switched active account to ${acc.account_name}`);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors flex items-center justify-between ${
                        isSelected ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-300'
                      }`}
                    >
                      <div className="truncate flex flex-col">
                        <span className="font-bold">{acc.account_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{acc.account_id || acc.region}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                    </button>
                  );
                })}

                <div className="border-t border-slate-800/80 my-1" />

                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    navigate('/aws/accounts');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-blue-400 hover:bg-blue-600/10 flex items-center gap-1.5 font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add AWS Account</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live System Status Dot */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/60 border border-slate-800/60 rounded-md text-xs text-slate-400 font-mono-tabular">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-medium text-slate-300">All Systems Operational</span>
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('notifications')}
            className={`relative p-2 rounded-md transition-colors focus:ring-2 focus:ring-blue-500/50 focus:outline-none ${
              activeDropdown === 'notifications'
                ? 'text-slate-100 bg-slate-800'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 px-1 py-0.2 text-[9px] font-bold bg-blue-500 text-white rounded-full min-w-[14px] text-center font-mono-tabular ring-2 ring-[#0d121f]">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {activeDropdown === 'notifications' && (
              <motion.div
                {...dropdownAnimation}
                className="absolute right-0 mt-1 w-96 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-2 z-50 origin-top-right font-mono-tabular"
              >
                {/* Header */}
                <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-100">
                    <Bell className="w-3.5 h-3.5 text-blue-400" />
                    <span>Notifications</span>
                    <span className="px-1.5 py-0.2 text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded font-mono">
                      {unreadCount} unread
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={clearAll}
                        className="text-[10px] text-slate-400 hover:text-rose-400 hover:underline cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>

                {/* Resource Filter Tabs */}
                <div className="px-2 py-1.5 border-b border-slate-800 flex items-center gap-1 overflow-x-auto text-[10px]">
                  {filterTabs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setResourceFilter(t.id)}
                      className={`px-2 py-0.5 rounded font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        resourceFilter === t.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Notifications List */}
                <div className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
                  {loadingNotifications ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Syncing real-time notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-1.5">
                      <Bell className="w-6 h-6 text-slate-600" />
                      <span>No notifications found.</span>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const isUnread = !n.is_read;
                      const sev = (n.severity || n.type || '').toUpperCase();

                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3 hover:bg-slate-800/70 transition-colors flex items-start gap-2.5 cursor-pointer relative group ${
                            isUnread ? 'bg-blue-600/10' : ''
                          }`}
                        >
                          {/* Severity Icon */}
                          {sev === 'ERROR' ? (
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          ) : sev === 'WARNING' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          ) : sev === 'SUCCESS' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                          )}

                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-xs truncate ${isUnread ? 'font-bold text-white' : 'text-slate-200'}`}>
                                {n.title}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {isUnread && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                )}
                                <span className="text-[10px] text-slate-500">{formatRelativeTime(n.created_at)}</span>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed select-text">
                              {n.message}
                            </p>

                            {/* Resource & Account Tags */}
                            <div className="flex items-center gap-1.5 pt-1 text-[9px] font-mono">
                              <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded border border-slate-700/60 font-semibold uppercase">
                                {n.resource_type}
                              </span>
                              {n.aws_account_name && (
                                <span className="px-1.5 py-0.2 bg-blue-500/10 text-blue-300 rounded border border-blue-500/20 truncate max-w-[140px]">
                                  {n.aws_account_name}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Delete Item Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(n.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-opacity"
                            title="Delete Notification"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('profile')}
            className={`flex items-center gap-2 p-1 rounded-md transition-colors focus:ring-2 focus:ring-blue-500/50 focus:outline-none ${
              activeDropdown === 'profile' ? 'bg-slate-800 ring-1 ring-blue-500/50' : 'hover:bg-slate-800'
            }`}
            title="User Profile Menu"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold text-xs flex items-center justify-center font-mono-tabular">
              {avatarInitial}
            </div>
            <span className="text-xs font-semibold text-slate-200 hidden md:inline-block max-w-[100px] truncate">
              {user?.name || 'Administrator'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline-block" />
          </button>

          <AnimatePresence>
            {activeDropdown === 'profile' && (
              <motion.div
                {...dropdownAnimation}
                className="absolute right-0 mt-1 w-56 bg-slate-900 border border-slate-800 rounded-md shadow-2xl py-1 z-50 origin-top-right font-mono-tabular"
              >
                <div className="px-3 py-2 border-b border-slate-800">
                  <p className="text-xs font-bold text-slate-100 truncate">{user?.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                </div>

                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    navigate('/profile');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>Profile & Security</span>
                </button>

                <div className="border-t border-slate-800/80 my-1" />

                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Sign Out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
