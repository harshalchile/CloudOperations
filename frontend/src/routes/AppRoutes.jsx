import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { LandingPage } from '../pages/Landing/LandingPage';
import { LoginPage } from '../pages/Login/LoginPage';
import { RegisterPage } from '../pages/Register/RegisterPage';
import { DashboardPage } from '../pages/Dashboard/DashboardPage';
import { ConnectAWSPage } from '../pages/AWSConnect/ConnectAWSPage';
import { AWSAccountsPage } from '../pages/AWSAccounts/AWSAccountsPage';
import { EC2Page } from '../pages/EC2/EC2Page';
import { S3Page } from '../pages/S3/S3Page';
import { CloudWatchPage } from '../pages/CloudWatch/CloudWatchPage';
import { SettingsPage } from '../pages/Settings/SettingsPage';
import { ProfilePage } from '../pages/Profile/ProfilePage';
import { DiagnosticsPage } from '../pages/Diagnostics/DiagnosticsPage';
import { NotFoundPage } from '../pages/NotFound/NotFoundPage';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected Routes (Unauthenticated auto-redirected to /login) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ec2" element={<EC2Page />} />
          <Route path="/s3" element={<S3Page />} />
          <Route path="/s3/:bucketName/*" element={<S3Page />} />
          <Route path="/s3/:bucketName" element={<S3Page />} />
          <Route path="/cloudwatch" element={<CloudWatchPage />} />
          <Route path="/diagnostics" element={<DiagnosticsPage />} />
          <Route path="/aws/accounts" element={<AWSAccountsPage />} />
          <Route path="/aws/connect" element={<AWSAccountsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
};
