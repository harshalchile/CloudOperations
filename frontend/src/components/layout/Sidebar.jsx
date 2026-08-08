import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  HardDrive,
  Activity,
  Key,
  Settings,
  User,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  Cloud,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { cn } from '../../utils/cn';

export const Sidebar = ({ isCollapsed, toggleSidebar, mobileOpen, closeMobile }) => {
  const location = useLocation();

  const mainNavItems = [
    { label: 'Overview', icon: LayoutDashboard, path: '/dashboard', badge: null },
    { label: 'EC2 Virtual Servers', icon: Server, path: '/ec2', badge: 'Boto3' },
    { label: 'S3 Storage Buckets', icon: HardDrive, path: '/s3', badge: 'Active' },
    { label: 'CloudWatch Telemetry', icon: Activity, path: '/cloudwatch', badge: null },
    { label: 'AWS Accounts', icon: Building2, path: '/aws/accounts', badge: 'Multi' },
  ];

  const managementNavItems = [
    { label: 'AWS Account Manager', icon: Key, path: '/aws/accounts' },
    { label: 'Platform Settings', icon: Settings, path: '/settings' },
    { label: 'User Profile & Security', icon: User, path: '/profile' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={closeMobile}
        />
      )}

      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 flex flex-col bg-[#0d121f] border-r border-slate-800/80 transition-all duration-300 select-none font-mono-tabular',
          isCollapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Header / Org Selector */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-slate-800/80">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Cloud className="w-4 h-4" />
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-white tracking-wide truncate">
                  CloudOps Enterprise
                </span>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Multi-AWS Manager
                </span>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto">
              <Cloud className="w-4 h-4" />
            </div>
          )}

          <button
            onClick={toggleSidebar}
            className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Status Banner */}
        {!isCollapsed && (
          <div className="mx-3 mt-3 p-2 bg-slate-900/90 border border-slate-800 rounded-md flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-medium">Multi-AWS Scope</span>
            </div>
            <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-semibold text-[9px] uppercase">
              Active
            </span>
          </div>
        )}

        {/* Navigation Sections */}
        <div className="flex-1 px-2 py-4 space-y-6 overflow-y-auto">
          {/* Core Services */}
          <div>
            {!isCollapsed && (
              <h3 className="px-2 mb-2 text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
                Cloud Core Services
              </h3>
            )}
            <nav className="space-y-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={closeMobile}
                    className={cn(
                      'flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors group',
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={cn(
                          'w-4 h-4 shrink-0 transition-colors',
                          isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                        )}
                      />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!isCollapsed && item.badge && (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 text-[10px] font-mono-tabular rounded border font-medium',
                          isActive
                            ? 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* User Management */}
          <div>
            {!isCollapsed && (
              <h3 className="px-2 mb-2 text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
                Account & Settings
              </h3>
            )}
            <nav className="space-y-1">
              {managementNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={closeMobile}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors group',
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                      )}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Footer Info */}
        {!isCollapsed && (
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>AES-256 Fernet</span>
            </div>
            <span className="font-mono-tabular">v4.0 Multi-AWS</span>
          </div>
        )}
      </aside>
    </>
  );
};
