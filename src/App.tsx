import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { I18nProvider } from './lib/i18n';
import { ThemeProvider } from './lib/ThemeContext';
import { Toaster } from './components/ui/sonner';

// Public Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';

// Onboarding
import OpenAccount from './pages/OpenAccount';
import PendingFile from './pages/PendingFile';
import PortalGate from './pages/PortalGate';

// Layout
import PortalLayout from './components/portal/PortalLayout';

import Dashboard from './pages/Dashboard';
import Transfer from './pages/Transfer';
import TransferForm from './pages/TransferForm';
import Funding from './pages/Funding';
import FundingForm from './pages/FundingForm';
import Cards from './pages/Cards';
import Financing from './pages/Financing';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import About from './pages/About';
import Contact from './pages/Contact';

import ForgotPassword from './pages/ForgotPassword';
const ResetPassword = () => <div className="p-4">Reset Password</div>;

const ProtectedRoute = ({ children, requireAdmin }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const { user, isAdmin, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requireAdmin && !isAdmin) return <Navigate to="/portail" />;
  
  return <>{children}</>;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <I18nProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/a-propos" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              <Route path="/connexion" element={<Navigate to="/login" replace />} />
              <Route path="/ouverture-de-compte" element={<OpenAccount />} />
              <Route path="/dossier-en-cours" element={
                <ProtectedRoute>
                  <PendingFile />
                </ProtectedRoute>
              } />
              <Route path="/portail" element={
                <ProtectedRoute>
                  <PortalGate />
                </ProtectedRoute>
              } />

              <Route path="/espace" element={
                <ProtectedRoute>
                  <PortalLayout />
                </ProtectedRoute>
              }>
                <Route path="tableau-de-bord" element={<Dashboard />} />
                <Route path="virement" element={<Transfer />} />
                <Route path="virement/:carrierId" element={<TransferForm />} />
                <Route path="approvisionnement" element={<Funding />} />
                <Route path="approvisionnement/:channelId" element={<FundingForm />} />
                <Route path="cartes" element={<Cards />} />
                <Route path="financement" element={<Financing />} />
                <Route path="profil" element={<Profile />} />
                <Route path="a-propos" element={<About />} />
              </Route>

              <Route path="/administration" element={
                <ProtectedRoute requireAdmin>
                  <Admin />
                </ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
          <Toaster />
        </I18nProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
