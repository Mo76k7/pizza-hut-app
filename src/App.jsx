import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import CustomerApp from './views/CustomerApp';
import KitchenDashboard from './views/KitchenDashboard';
import AdminDashboard from './views/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<CustomerApp />} />
        <Route 
          path="/kitchen" 
          element={
            <ProtectedRoute role="kitchen" requiredPin="4567">
              <KitchenDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute role="admin" requiredPin="0749">
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </AppProvider>
  );
}
