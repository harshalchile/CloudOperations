import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

export const App = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-[#0b0f19] text-slate-100 selection:bg-blue-500/30 selection:text-blue-200">
            <AppRoutes />
          </div>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
