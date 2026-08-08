import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { User, Key, Lock, Save, Check, Calendar, Shield, Loader2 } from 'lucide-react';

export const ProfilePage = () => {
  const { user, avatarInitial, updateProfile, changePassword } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (isUpdatingProfile) return;

    if (!name.trim() || !email.trim()) {
      showToast('Name and Email cannot be empty.', 'warning');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const res = await updateProfile(name.trim(), email.trim());
      if (res.success) {
        showToast(res.message || 'Profile updated successfully.', 'success');
      } else {
        showToast(res.error || 'Failed to update profile.', 'error');
      }
    } catch (err) {
      showToast('An unexpected error occurred while updating profile.', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (isChangingPassword) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('All password fields are required.', 'warning');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'warning');
      return;
    }

    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters long.', 'warning');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        showToast(res.message || 'Password changed successfully.', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showToast(res.error || 'Failed to change password.', 'error');
      }
    } catch (err) {
      showToast('An unexpected error occurred while changing password.', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="font-mono-tabular space-y-6">
      <PageHeader
        title="User Profile & Security"
        description="Manage user details, email address, password credentials, and creation metadata."
        arn={`arn:aws:iam::99201482019:user/${user?.name?.toLowerCase().replace(/\s+/g, '-') || 'user'}`}
      />

      {/* User Info Overview Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-5 font-mono-tabular">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
          <div className="w-14 h-14 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-2xl">
            {avatarInitial}
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{user?.name || 'User'}</h3>
            <p className="text-xs text-slate-400">{user?.email || 'N/A'}</p>
            <span className="mt-1.5 inline-block px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[10px] font-semibold uppercase">
              Registered Platform User
            </span>
          </div>
        </div>

        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Account Created Date:{' '}
              <strong className="text-slate-200">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : '2026-08-01'}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Status: <strong className="text-emerald-400 font-semibold">Active & Authenticated</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form 1: Update Profile */}
        <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800">
            <User className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Update Account Details</h3>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500 font-mono-tabular select-text"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-semibold">Work Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500 font-mono-tabular select-text"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isUpdatingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Form 2: Change Password */}
        <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800">
            <Lock className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Change Password</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500 font-mono-tabular select-text"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-semibold">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 chars)"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500 font-mono-tabular select-text"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-semibold">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500 font-mono-tabular select-text"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold shadow transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>Change Password</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
