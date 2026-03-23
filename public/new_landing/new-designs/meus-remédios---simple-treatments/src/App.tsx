/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './pages/Dashboard';
import Treatments from './pages/Treatments';
import Stock from './pages/Stock';
import Profile from './pages/Profile';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';

const AppContent = () => {
  const location = useLocation();

  // No-op logout for prototype
  const handleLogout = () => console.log('Logout requested');

  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row">
      <Sidebar onLogout={handleLogout} />
      <div className="flex-1 pb-20 md:pb-0 md:pl-64">
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="p-4 md:p-8 max-w-7xl mx-auto"
          >
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/treatments" element={<Treatments />} />
              <Route path="/stock" element={<Stock />} />
              <Route path="/profile" element={<Profile onLogout={handleLogout} />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </motion.main>
        </AnimatePresence>
      </div>
      <BottomNav />
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
