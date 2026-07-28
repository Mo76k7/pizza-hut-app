import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import CustomerApp from './views/CustomerApp';
import KitchenDashboard from './views/KitchenDashboard';
import AdminDashboard from './views/AdminDashboard';

export default function App() {
  const [role, setRole] = useState('customer');

  return (
    <AppProvider>
      {role === 'customer' && (
        <CustomerApp onRoleSwitch={setRole} currentRole={role} />
      )}
      {role === 'kitchen' && (
        <KitchenDashboard onRoleSwitch={setRole} currentRole={role} />
      )}
      {role === 'admin' && (
        <AdminDashboard onRoleSwitch={setRole} currentRole={role} />
      )}
    </AppProvider>
  );
}
