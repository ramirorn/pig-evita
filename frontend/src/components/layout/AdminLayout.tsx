// ===========================================
// Admin Layout
// ===========================================
import { useState } from 'react';
import { Outlet } from 'react-router';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { AdminHeader } from './AdminHeader';

export function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main content area */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]',
        )}
      >
        <AdminHeader />

        <main className="p-6" id="admin-main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
