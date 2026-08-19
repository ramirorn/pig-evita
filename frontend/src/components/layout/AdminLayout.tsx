// ===========================================
// Admin Layout
// ===========================================
import { Suspense, useState } from 'react';
import { Outlet } from 'react-router';
import { cn } from '@/lib/utils';
import { PageSkeleton } from '@/components/shared/PageSkeleton';
import { Sidebar } from './Sidebar';
import { AdminHeader } from './AdminHeader';

export function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main content area */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          // On desktop, shift based on sidebar state
          'md:ml-[260px]',
          sidebarCollapsed && 'md:ml-[72px]',
          // On mobile, no margin since sidebar is overlay
          'ml-0',
        )}
      >
        <AdminHeader onMenuClick={() => setMobileSidebarOpen(true)} />

        <main className="p-4 sm:p-6" id="admin-main-content">
          {/* Las páginas admin se cargan bajo demanda (ver router.tsx): este
              boundary cubre la descarga del chunk. Está acá y no en cada ruta
              para que el sidebar y el header no parpadeen al navegar. */}
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
