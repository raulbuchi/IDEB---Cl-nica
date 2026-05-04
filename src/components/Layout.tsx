import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Users, FileText, BarChart2, Settings, LogOut, Menu, X, DollarSign } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { logout } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

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
    { name: 'Financeiro', href: '/financial', icon: DollarSign },
    ...(isAdmin ? [{ name: 'Profissionais', href: '/professionals', icon: Users }] : []),
    ...(isAdmin ? [{ name: 'Administração', href: '/admin', icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden">
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 lg:static lg:flex-shrink-0 flex flex-col transform transition-transform lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-sm">
              <span className="text-white font-bold text-lg">I</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">IDEB <span className="text-blue-600">Clínica</span></h1>
          </div>
          <button 
            className="lg:hidden p-2 -mr-2 text-gray-500 hover:text-gray-900"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6">
          <nav className="px-4 space-y-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mx-2">
            Menu Principal
          </nav>
          <nav className="px-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden",
                    isActive 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <item.icon className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                    isActive ? "text-white" : "text-gray-400 group-hover:text-gray-600"
                  )} />
                  <span className="relative z-10">{item.name}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="active-pill"
                      className="absolute inset-0 bg-blue-600 -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 m-4 bg-gray-50 rounded-2xl border border-gray-100">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold mr-3 shadow-md">
              {profile?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate tracking-tight">{profile?.name}</p>
              <p className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
                {profile?.role === 'admin' ? 'Administrador' : 'Profissional'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center w-full px-3 py-2.5 text-sm font-semibold text-gray-700 rounded-xl hover:bg-white hover:text-red-600 hover:shadow-sm border border-transparent hover:border-gray-200 transition-all duration-200"
          >
            <LogOut className="mr-3 h-4 w-4" />
            Sair do sistema
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden h-16 bg-white border-b border-gray-200 flex items-center px-4 justify-between sticky top-0 z-30">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-2 shadow-sm">
              <span className="text-white font-bold">I</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">IDEB Clínica</h1>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto scroll-smooth focus:outline-none relative">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
