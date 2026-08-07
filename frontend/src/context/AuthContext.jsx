import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [awsAccounts, setAwsAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountIdState] = useState(() => {
    return localStorage.getItem('selectedAccountId') || 'all';
  });
  const [loading, setLoading] = useState(true);

  const setSelectedAccountId = (accId) => {
    const newId = String(accId);
    setSelectedAccountIdState(newId);
    localStorage.setItem('selectedAccountId', newId);
    // Dispatch event so active pages can re-fetch data for new account scope
    window.dispatchEvent(new CustomEvent('aws-account-changed', { detail: { accountId: newId } }));
  };

  const fetchAwsAccounts = async () => {
    try {
      const res = await api.get('/aws/accounts');
      if (res.data && res.data.accounts) {
        setAwsAccounts(res.data.accounts);
      }
    } catch (err) {
      console.error('Failed to fetch AWS accounts:', err);
    }
  };

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      if (res.data && res.data.user) {
        setUser(res.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        await fetchAwsAccounts();
      }
    } catch (err) {
      console.error('Failed to fetch user me:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const { user: userData, access_token } = res.data;
      localStorage.setItem('authToken', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      await fetchAwsAccounts();
      return { success: true, user: userData };
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Please check credentials.';
      return { success: false, error: msg };
    }
  };

  const register = async (name, email, password, confirmPassword) => {
    try {
      const res = await api.post('/auth/register', { name, email, password, confirmPassword });
      const { user: userData, access_token } = res.data;
      localStorage.setItem('authToken', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed.';
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore logout errors
    } finally {
      setUser(null);
      setAwsAccounts([]);
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      localStorage.removeItem('selectedAccountId');
    }
  };

  const updateProfile = async (name, email) => {
    try {
      const res = await api.put('/profile', { name, email });
      if (res.data && res.data.user) {
        setUser(res.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      }
      return { success: true, message: res.data.message };
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update profile.';
      return { success: false, error: msg };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const res = await api.put('/change-password', { currentPassword, newPassword });
      return { success: true, message: res.data.message };
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to change password.';
      return { success: false, error: msg };
    }
  };

  const avatarInitial = user?.name ? user.name.trim().charAt(0).toUpperCase() : 'U';

  const awsAccount = awsAccounts.length > 0 ? awsAccounts[0] : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        awsAccount,
        awsAccounts,
        selectedAccountId,
        setSelectedAccountId,
        loading,
        avatarInitial,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        fetchAwsAccounts,
        fetchAwsStatus: fetchAwsAccounts,
        setAwsAccount: setAwsAccounts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
