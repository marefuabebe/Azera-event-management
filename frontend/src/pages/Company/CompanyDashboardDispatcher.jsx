import React from 'react';
import { useAuth } from '../../context/AuthContext';
import CoordinatorDashboard from './CoordinatorDashboard';
import FinanceDashboard from './FinanceDashboard';
import StaffDashboard from './StaffDashboard';
import AdminExecutiveDashboard from '../admin/AdminExecutiveDashboard';

export default function CompanyDashboardDispatcher() {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.role) {
    case 'COORDINATOR':
      return <CoordinatorDashboard />;
    case 'FINANCE':
      return <FinanceDashboard />;
    case 'STAFF':
      return <StaffDashboard />;
    case 'ADMIN_DIRECTOR':
      return <AdminExecutiveDashboard />;
    default:
      return (
        <div className="p-8 text-center text-slate-500">
          <p className="text-lg font-bold text-slate-900">Unrecognized Operational Role</p>
          <p className="text-xs mt-1">Please contact Eventora administration.</p>
        </div>
      );
  }
}
