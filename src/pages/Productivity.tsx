import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download } from 'lucide-react';

interface Appointment {
  id: string;
  professionalId: string;
  professionalName?: string; // Some might have this depending on how it was saved, assuming it's useful for export
  patientName: string;
  office: string;
  date: any;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
}

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export default function Productivity() {
  const { profile, isAdmin } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  useEffect(() => {
    if (!profile) return;

    let q = query(collection(db, 'appointments'));
    if (!isAdmin) {
      q = query(collection(db, 'appointments'), where('professionalId', '==', profile.uid));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apptsData: Appointment[] = [];
      snapshot.forEach((doc) => {
        apptsData.push({ id: doc.id, ...doc.data() } as Appointment);
      });
      setAppointments(apptsData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'appointments'));

    return () => unsubscribe();
  }, [profile, isAdmin]);

  const stats = useMemo(() => {
    const now = new Date();
    let interval: { start: Date; end: Date };

    switch (timeRange) {
      case 'daily':
        interval = { start: startOfDay(now), end: endOfDay(now) };
        break;
      case 'weekly':
        interval = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
        break;
      case 'monthly':
        interval = { start: startOfMonth(now), end: endOfMonth(now) };
        break;
      case 'yearly':
        interval = { start: startOfYear(now), end: endOfYear(now) };
        break;
      case 'custom':
        interval = { start: startOfDay(new Date(customStartDate + 'T00:00:00')), end: endOfDay(new Date(customEndDate + 'T00:00:00')) };
        break;
    }

    const filtered = appointments.filter(apt => {
      const aptDate = apt.date.toDate();
      return isWithinInterval(aptDate, interval);
    });

    const completed = filtered.filter(a => a.status === 'completed');
    const cancelled = filtered.filter(a => a.status === 'cancelled');
    const scheduled = filtered.filter(a => a.status === 'scheduled');

    const totalDuration = completed.reduce((acc, curr) => acc + curr.duration, 0);

    // Group for chart
    const chartData = [];
    if (timeRange === 'daily') {
      // Group by hour
      const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8h to 19h
      hours.forEach(hour => {
        const count = completed.filter(a => a.date.toDate().getHours() === hour).length;
        chartData.push({ name: `${hour}h`, Consultas: count });
      });
    } else if (timeRange === 'weekly') {
      // Group by day of week
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      days.forEach((day, index) => {
        const count = completed.filter(a => a.date.toDate().getDay() === index).length;
        chartData.push({ name: day, Consultas: count });
      });
    } else if (timeRange === 'monthly') {
      // Group by week or day (simplifying to weeks)
      for (let i = 1; i <= 4; i++) {
        chartData.push({ name: `Semana ${i}`, Consultas: Math.floor(completed.length / 4) + (i === 1 ? completed.length % 4 : 0) }); // Mock distribution for simplicity
      }
    } else if (timeRange === 'custom') {
      const grouped = completed.reduce((acc, curr) => {
        const dateStr = format(curr.date.toDate(), 'dd/MM/yyyy');
        acc[dateStr] = (acc[dateStr] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const [d1, m1, y1] = a.split('/');
        const [d2, m2, y2] = b.split('/');
        return new Date(Number(y1), Number(m1)-1, Number(d1)).getTime() - new Date(Number(y2), Number(m2)-1, Number(d2)).getTime();
      });

      sortedKeys.forEach(key => {
        chartData.push({ name: key.substring(0, 5), Consultas: grouped[key] });
      });
    } else {
      // Group by month
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      months.forEach((month, index) => {
        const count = completed.filter(a => a.date.toDate().getMonth() === index).length;
        chartData.push({ name: month, Consultas: count });
      });
    }

    return {
      filtered,
      total: filtered.length,
      completed: completed.length,
      cancelled: cancelled.length,
      scheduled: scheduled.length,
      totalHours: (totalDuration / 60).toFixed(1),
      chartData
    };
  }, [appointments, timeRange, customStartDate, customEndDate]);

  const exportCSV = () => {
    const headers = ['Data e Hora', 'Status', 'Duração (min)', 'Paciente', 'Consultório'];
    
    const rows = stats.filtered.map(app => {
      let statusStr = 'Agendado';
      if (app.status === 'completed') statusStr = 'Concluído';
      if (app.status === 'cancelled') statusStr = 'Cancelado';

      return [
        format(app.date.toDate(), "dd/MM/yyyy HH:mm"),
        statusStr,
        app.duration.toString(),
        app.patientName || '',
        app.office || ''
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(';') + '\n' 
      + rows.map(r => r.join(';')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `produtividade_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const COLORS = ['#10b981', '#ef4444', '#3b82f6'];
  const pieData = [
    { name: 'Concluídas', value: stats.completed },
    { name: 'Canceladas', value: stats.cancelled },
    { name: 'Agendadas', value: stats.scheduled }
  ].filter(d => d.value > 0);

  if (loading) return <div className="p-4">Carregando dados...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Produtividade</h2>
          <p className="mt-1 text-sm text-gray-500">Acompanhe seus indicadores de atendimento.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <button
            onClick={exportCSV}
            className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </button>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="block w-full sm:w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          >
            <option value="daily">Hoje</option>
            <option value="weekly">Esta Semana</option>
            <option value="monthly">Este Mês</option>
            <option value="yearly">Este Ano</option>
            <option value="custom">Personalizado</option>
          </select>

          {timeRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
              <span className="text-gray-500">até</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-blue-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Agendado</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.total}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-green-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Concluídas</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.completed}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-red-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Canceladas</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.cancelled}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-purple-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Horas de Atendimento</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalHours}h</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 flex flex-col">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Proporção de Consultas</h3>
          <div className="flex-1 min-h-[200px]">
            {stats.total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Concluídas', value: stats.completed, color: '#10b981' },
                      { name: 'Canceladas', value: stats.cancelled, color: '#ef4444' },
                      { name: 'Agendadas', value: stats.scheduled, color: '#3b82f6' }
                    ].filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {
                      [
                        { name: 'Concluídas', value: stats.completed, color: '#10b981' },
                        { name: 'Canceladas', value: stats.cancelled, color: '#ef4444' },
                        { name: 'Agendadas', value: stats.scheduled, color: '#3b82f6' }
                      ].filter(item => item.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))
                    }
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value} consultas`, 'Quantidade']} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Nenhum dado no período
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Consultas Concluídas (Volume)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} dy={10} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} dx={-10} />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar 
                  dataKey="Consultas" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]} 
                  animationDuration={1500}
                  activeBar={{ fill: '#2563eb', stroke: '#1d4ed8', strokeWidth: 1 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Tendência de Consultas</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} dy={10} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line 
                  type="monotone" 
                  dataKey="Consultas" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  animationDuration={1500}
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                  activeDot={{ r: 8, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2, style: { filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))' } }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
