import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [awsAccounts, setAwsAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [selectedAccountId, setSelectedAccountIdState] = useState(() => {
    return localStorage.getItem('selectedAccountId') || 'all';
  });
  const [loading, setLoading] = useState(true);

  const clearSessionStorage = useCallback(() => {
    const sessionKeys = [
      'access_token',
      'authToken',
      'user',
      'cached_user',
      'selectedAccountId',
      'aws_accounts',
      'active_account',
      'dashboard_cache',
      'refresh_token'
    ];
    sessionKeys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    setUser(null);
    setAwsAccounts([]);
    setLoadingAccounts(false);
    setSelectedAccountIdState('all');
  }, []);

  const setSelectedAccountId = (accId) => {
    const newId = String(accId);
    setSelectedAccountIdState(newId);
    localStorage.setItem('selectedAccountId', newId);
    window.dispatchEvent(new CustomEvent('aws-account-changed', { detail: { accountId: newId } }));
  };

  const fetchAwsAccounts = useCallback(async () => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('authToken');
    if (!token) {
      setAwsAccounts([]);
      setLoadingAccounts(false);
      return [];
    }
    setLoadingAccounts(true);
    try {
      const res = await api.get('/aws/accounts');
      if (res.data && res.data.accounts) {
        setAwsAccounts(res.data.accounts);
        return res.data.accounts;
      } else {
        setAwsAccounts([]);
        return [];
      }
    } catch (err) {
      console.error('Failed to fetch AWS accounts:', err);
      setAwsAccounts([]);
      return [];
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('authToken');
    if (!token || token === 'null' || token === 'undefined') {
      clearSessionStorage();
      setLoading(false);
      setLoadingAccounts(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      if (res.data && res.data.user) {
        setUser(res.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        await fetchAwsAccounts();
      } else {
        clearSessionStorage();
      }
    } catch (err) {
      console.error('Failed to fetch current user session:', err);
      clearSessionStorage();
    } finally {
      setLoading(false);
    }
  }, [clearSessionStorage, fetchAwsAccounts]);

  useEffect(() => {
    fetchCurrentUser();

    const handleUnauthorized = () => {
      clearSessionStorage();
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, [fetchCurrentUser, clearSessionStorage]);

  // Derived single source of truth for AWS account state
  const hasConnectedAccount = useMemo(() => awsAccounts.length > 0, [awsAccounts]);

  const awsAccount = useMemo(() => {
    if (awsAccounts.length === 0) return null;
    if (selectedAccountId && selectedAccountId !== 'all') {
      const matched = awsAccounts.find((a) => String(a.id) === String(selectedAccountId) || String(a.account_id) === String(selectedAccountId));
      if (matched) return matched;
    }
    return awsAccounts[0];
  }, [awsAccounts, selectedAccountId]);

  const avatarInitial = useMemo(() => {
    return user?.name ? user.name.charAt(0).toUpperCase() : 'U';
  }, [user]);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const { user: userData, access_token } = res.data;
      if (access_token) {
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('authToken', access_token);
      }
      if (userData) {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      }
      await fetchAwsAccounts();
      return { success: true, user: userData };
    } catch (err) {
      if (!err.response) {
        return { success: false, error: 'Backend server is unavailable.' };
      }
      if (err.response.status === 401) {
        return { success: false, error: 'Invalid email or password.' };
      }
      if (err.response.status >= 500) {
        return { success: false, error: 'Server error. Please try again.' };
      }
      const msg = err.response?.data?.error || err.response?.data?.message || 'Login failed. Invalid credentials.';
      return { success: false, error: msg };
    }
  };

  const register = async (name, email, password, confirmPassword) => {
    try {
      const res = await api.post('/auth/register', { name, email, password, confirmPassword });
      const { user: userData, access_token } = res.data;
      if (access_token) {
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('authToken', access_token);
      }
      if (userData) {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      }
      return { success: true, user: userData };
    } catch (err) {
      if (!err.response) {
        return { success: false, error: 'Backend server is unavailable.' };
      }
      const msg = err.response?.data?.error || err.response?.data?.message || 'Registration failed.';
      return { success: false, error: msg };
    }
  };

  const updateProfile = async (name, email) => {
    try {
      const res = await api.put('/profile', { name, email });
      const updatedUser = res.data?.user;
      if (updatedUser) {
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      return {
        success: true,
        message: res.data?.message || 'Profile updated successfully.',
        user: updatedUser
      };
    } catch (err) {
      if (!err.response) {
        return { success: false, error: 'Unable to connect to backend.' };
      }
      if (err.response.status === 401) {
        return { success: false, error: 'Session expired. Please login again.' };
      }
      if (err.response.status === 409) {
        return { success: false, error: 'Email address is already in use.' };
      }
      if (err.response.status === 422) {
        return { success: false, error: err.response.data?.error || 'Validation error.' };
      }
      if (err.response.status >= 500) {
        return { success: false, error: err.response.data?.error || 'Server error. Please try again.' };
      }
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to update profile.';
      return { success: false, error: msg };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const res = await api.put('/change-password', {
        currentPassword,
        newPassword,
        current_password: currentPassword,
        new_password: newPassword
      });
      return {
        success: true,
        message: res.data?.message || 'Password updated successfully.'
      };
    } catch (err) {
      if (!err.response) {
        return { success: false, error: 'Unable to connect to backend.' };
      }
      if (err.response.status === 401) {
        return { success: false, error: 'Session expired. Please login again.' };
      }
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to change password.';
      return { success: false, error: msg };
    }
  };

  const resetPassword = async (email, masterKey, newPassword, confirmPassword) => {
    try {
      const res = await api.post('/auth/reset-password', {
        email,
        master_key: masterKey,
        new_password: newPassword,
        confirm_password: confirmPassword
      });
      return { success: true, message: res.data?.message || 'Password Updated Successfully' };
    } catch (err) {
      if (!err.response) {
        return { success: false, error: 'Backend server is unavailable.' };
      }
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to reset password.';
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearSessionStorage();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        avatarInitial,
        loading,
        awsAccounts,
        loadingAccounts,
        hasConnectedAccount,
        awsAccount,
        selectedAccountId,
        setSelectedAccountId,
        fetchAwsAccounts,
        login,
        register,
        updateProfile,
        changePassword,
        resetPassword,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
