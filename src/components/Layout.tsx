import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Calendar, Users, FileText, BarChart2, Settings, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { logout } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Layout Component
const Layout = ({ children }: { children: React.ReactNode }) => {
  const { profile, isAdmin } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navigation = [
    { name: 'Agenda', href: '/', icon: Calendar },
    { name: 'Pacientes', href: '/patients', icon: Users },
    { name: 'Prontuários', href: '/records', icon: FileText },
    { name: 'Produtividade', href: '/productivity', icon: BarChart2 },
    ...(isAdmin ? [{ name: 'Administração', href: '/admin', icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:flex-shrink-0 flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">IDEB Clínica</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="px-3 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                    isActive 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <item.icon className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    isActive ? "text-blue-700" : "text-gray-400"
                  )} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold mr-3">
              {profile?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile?.name}</p>
              <p className="text-xs text-gray-500 truncate">{profile?.role === 'admin' ? 'Administrador' : 'Profissional'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sair
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden h-16 bg-white border-b border-gray-200 flex items-center px-4 justify-between">
          <h1 className="text-lg font-bold text-gray-900">IDEB Clínica</h1>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -mr-2 text-gray-500 hover:text-gray-900"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
