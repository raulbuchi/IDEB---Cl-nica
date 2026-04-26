import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Plus, Edit2, Trash2, X, DollarSign, Calendar as CalendarIcon, User as UserIcon, Filter, Download } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Payment {
  id: string;
  amount: number;
  date: any; // Timestamp
  method: 'pix' | 'cash' | 'credit_card' | 'debit_card' | 'health_insurance';
  methodDetails?: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  createdAt: any;
}

interface User {
  uid: string;
  name: string;
}

interface Patient {
  id: string;
  name: string;
  healthInsuranceName?: string;
}

const PAYMENT_METHODS = {
  pix: 'PIX',
  cash: 'Dinheiro',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  health_insurance: 'Convênio'
};

export default function Financial() {
  const { profile, isAdmin } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  // Filters for reporting
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'this_week' | 'this_month' | 'custom'>('this_month');
  const [filterProfessional, setFilterProfessional] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterInsurance, setFilterInsurance] = useState('all');
  const [filterPatient, setFilterPatient] = useState('all');

  const [formData, setFormData] = useState({
    amount: '',
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    method: 'pix' as Payment['method'],
    methodDetails: '',
    patientId: '',
    professionalId: profile?.uid || ''
  });

  useEffect(() => {
    if (!profile) return;

    // Fetch payments
    let q = query(collection(db, 'payments'));
    if (!isAdmin) {
      q = query(collection(db, 'payments'), where('professionalId', '==', profile.uid));
    }

    const unsubscribePayments = onSnapshot(q, (snapshot) => {
      const data: Payment[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Payment);
      });
      data.sort((a, b) => b.date.seconds - a.date.seconds);
      setPayments(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'payments'));

    // Fetch professionals
    const qProfs = query(collection(db, 'users'), where('role', '==', 'professional'));
    const unsubscribeProfs = onSnapshot(qProfs, (snapshot) => {
      const data: User[] = [];
      snapshot.forEach((doc) => {
        data.push({ uid: doc.id, name: doc.data().name } as User);
      });
      setProfessionals(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // Fetch patients
    let qPatients = query(collection(db, 'patients'));
    if (!isAdmin) {
      qPatients = query(collection(db, 'patients'), where('assignedProfessionalId', '==', profile.uid));
    }
    const unsubscribePatients = onSnapshot(qPatients, (snapshot) => {
      const data: Patient[] = [];
      snapshot.forEach((doc) => {
        data.push({ 
          id: doc.id, 
          name: doc.data().name,
          healthInsuranceName: doc.data().healthInsuranceName
        } as Patient);
      });
      setPatients(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'patients'));

    return () => {
      unsubscribePayments();
      unsubscribeProfs();
      unsubscribePatients();
    };
  }, [profile, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const patient = patients.find(p => p.id === formData.patientId);
    if (!patient) {
      alert("Selecione um paciente válido.");
      return;
    }

    let profId = formData.professionalId;
    if (!isAdmin) profId = profile.uid;
    const professional = professionals.find(p => p.uid === profId);
    if (!professional && isAdmin) {
      alert("Selecione um profissional válido.");
      return;
    }

    const amountNum = parseFloat(formData.amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Insira um valor válido.");
      return;
    }

    try {
      const paymentDate = Timestamp.fromDate(new Date(formData.date));

      if (editingPayment) {
        await updateDoc(doc(db, 'payments', editingPayment.id), {
          amount: amountNum,
          date: paymentDate,
          method: formData.method,
          methodDetails: formData.methodDetails,
          patientId: patient.id,
          patientName: patient.name,
          professionalId: professional?.uid || profile.uid,
          professionalName: professional?.name || profile.name
        });
      } else {
        await addDoc(collection(db, 'payments'), {
          amount: amountNum,
          date: paymentDate,
          method: formData.method,
          methodDetails: formData.methodDetails,
          patientId: patient.id,
          patientName: patient.name,
          professionalId: professional?.uid || profile.uid,
          professionalName: professional?.name || profile.name,
          createdAt: serverTimestamp()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingPayment ? OperationType.UPDATE : OperationType.CREATE, 'payments');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este registro de pagamento?')) {
      try {
        await deleteDoc(doc(db, 'payments', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `payments/${id}`);
      }
    }
  };

  const openModal = (payment?: Payment) => {
    if (payment) {
      setEditingPayment(payment);
      setFormData({
        amount: payment.amount.toString(),
        date: format(payment.date.toDate(), "yyyy-MM-dd'T'HH:mm"),
        method: payment.method,
        methodDetails: payment.methodDetails || '',
        patientId: payment.patientId,
        professionalId: payment.professionalId
      });
    } else {
      setEditingPayment(null);
      setFormData({
        amount: '',
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        method: 'pix',
        methodDetails: '',
        patientId: '',
        professionalId: profile?.uid || ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPayment(null);
  };

  const filteredPayments = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (filterPeriod === 'this_week') {
      start = startOfWeek(now, { weekStartsOn: 0 });
      end = endOfWeek(now, { weekStartsOn: 0 });
    } else if (filterPeriod === 'this_month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    }

    return payments.filter(p => {
      let matchesProf = true;
      if (isAdmin && filterProfessional !== 'all') {
        matchesProf = p.professionalId === filterProfessional;
      }

      let matchesMethod = filterMethod === 'all' || p.method === filterMethod;
      if (filterMethod === 'health_insurance' && filterInsurance !== 'all') {
        matchesMethod = matchesMethod && p.methodDetails === filterInsurance;
      }

      let matchesPatient = filterPatient === 'all' || p.patientId === filterPatient;

      let matchesPeriod = true;
      if (start && end) {
        matchesPeriod = isWithinInterval(p.date.toDate(), { start, end });
      }

      return matchesProf && matchesMethod && matchesPatient && matchesPeriod;
    });
  }, [payments, filterPeriod, filterProfessional, filterMethod, filterInsurance, filterPatient, isAdmin]);

  const uniqueInsurances = useMemo(() => {
    const insurances = new Set<string>();
    payments.forEach(p => {
      if (p.method === 'health_insurance' && p.methodDetails) {
        insurances.add(p.methodDetails);
      }
    });
    return Array.from(insurances).sort();
  }, [payments]);

  const totalAmount = filteredPayments.reduce((acc, curr) => acc + curr.amount, 0);

  const exportCSV = () => {
    const headers = ['Data', 'Paciente', 'Profissional', 'Forma de Pagamento', 'Detalhes', 'Valor (R$)'];
    const rows = filteredPayments.map(p => [
      format(p.date.toDate(), "dd/MM/yyyy HH:mm"),
      p.patientName,
      p.professionalName,
      PAYMENT_METHODS[p.method],
      p.methodDetails || '',
      p.amount.toString().replace('.', ',')
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(';') + '\n' 
      + rows.map(r => r.join(';')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_financeiro_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepare chart data
  const chartDataMethod = useMemo(() => {
    const grouped = filteredPayments.reduce((acc, curr) => {
      const methodStr = PAYMENT_METHODS[curr.method];
      acc[methodStr] = (acc[methodStr] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(grouped).map(key => ({
      name: key,
      value: grouped[key]
    }));
  }, [filteredPayments]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const chartDataTimeline = useMemo(() => {
    const grouped = filteredPayments.reduce((acc, curr) => {
      const dateStr = format(curr.date.toDate(), "dd/MM");
      acc[dateStr] = (acc[dateStr] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      const [d1, m1] = a.split('/');
      const [d2, m2] = b.split('/');
      return new Date(2020, Number(m1)-1, Number(d1)).getTime() - new Date(2020, Number(m2)-1, Number(d2)).getTime();
    });

    return sortedKeys.map(key => ({
      name: key,
      Total: grouped[key]
    }));
  }, [filteredPayments]);

  if (loading) return <div className="p-4">Carregando financeiro...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Financeiro</h2>
          <p className="mt-1 text-sm text-gray-500">Controle de pagamentos, convênios e relatórios.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={exportCSV}
            className="flex-1 md:flex-none inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </button>
          <button
            onClick={() => openModal()}
            className="flex-1 md:flex-none inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Registrar Pagamento
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-700">Filtros Avançados / Relatório</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Período</label>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as any)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            >
              <option value="all">Todo o período</option>
              <option value="this_month">Este Mês</option>
              <option value="this_week">Esta Semana</option>
            </select>
          </div>
          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Profissional</label>
              <select
                value={filterProfessional}
                onChange={(e) => setFilterProfessional(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
              >
                <option value="all">Todos os Profissionais</option>
                {professionals.map(p => (
                  <option key={p.uid} value={p.uid}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Paciente</label>
            <select
              value={filterPatient}
              onChange={(e) => setFilterPatient(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            >
              <option value="all">Todos os Pacientes</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Forma de Pagamento</label>
            <select
              value={filterMethod}
              onChange={(e) => {
                setFilterMethod(e.target.value);
                setFilterInsurance('all'); // Reset insurance filter when method changes
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            >
              <option value="all">Todas as Formas</option>
              <option value="pix">PIX</option>
              <option value="cash">Dinheiro</option>
              <option value="credit_card">Cartão de Crédito</option>
              <option value="debit_card">Cartão de Débito</option>
              <option value="health_insurance">Convênio</option>
            </select>
          </div>
          {filterMethod === 'health_insurance' && uniqueInsurances.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Qual Convênio?</label>
              <select
                value={filterInsurance}
                onChange={(e) => setFilterInsurance(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
              >
                <option value="all">Todos os Convênios</option>
                {uniqueInsurances.map(ins => (
                  <option key={ins} value={ins}>{ins}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total do Período/Filtro</h3>
          <p className="text-3xl font-bold text-gray-900">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
          </p>
        </div>
        <DollarSign className="w-12 h-12 text-blue-200" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Faturamento por Período</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                <Bar dataKey="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Por Forma de Pagamento</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartDataMethod}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartDataMethod.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {filteredPayments.map((payment) => (
            <li key={payment.id}>
              <div className="px-4 py-4 flex items-center sm:px-6">
                <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <div className="flex text-sm">
                      <p className="font-medium text-blue-600 truncate">{payment.patientName}</p>
                      <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {PAYMENT_METHODS[payment.method]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-col sm:flex-row sm:gap-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <CalendarIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                        {format(payment.date.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      {isAdmin && (
                        <div className="flex items-center mt-2 sm:mt-0">
                          <UserIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                          {payment.professionalName}
                        </div>
                      )}
                      <div className="flex items-center mt-2 sm:mt-0 font-medium text-gray-700">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount)}
                      </div>
                    </div>
                    {payment.methodDetails && (
                      <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        Info Adicional: {payment.methodDetails}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex-shrink-0 sm:mt-0 sm:ml-5 flex gap-2">
                    <button
                      onClick={() => openModal(payment)}
                      className="p-2 text-gray-400 hover:text-blue-600"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    {(isAdmin || payment.professionalId === profile.uid) && (
                      <button
                        onClick={() => handleDelete(payment.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
          {filteredPayments.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">Nenhum pagamento encontrado para os filtros selecionados.</li>
          )}
        </ul>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={closeModal} />
            <div className="relative inline-block w-full max-w-md p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {editingPayment ? 'Editar Pagamento' : 'Registrar Pagamento'}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Paciente *</label>
                    <select
                      required
                      value={formData.patientId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const pat = patients.find(p => p.id === pid);
                        let mDetails = formData.methodDetails;
                        // auto-fill health insurance name if method is health_insurance
                        if (formData.method === 'health_insurance' && pat?.healthInsuranceName) {
                           mDetails = pat.healthInsuranceName;
                        }
                        setFormData({...formData, patientId: pid, methodDetails: mDetails});
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    >
                      <option value="">Selecione um paciente</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {isAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Profissional *</label>
                      <select
                        required
                        value={formData.professionalId || ''}
                        onChange={(e) => setFormData({...formData, professionalId: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                      >
                        <option value="">Selecione um profissional</option>
                        {professionals.map(p => (
                          <option key={p.uid} value={p.uid}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Valor (R$) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        placeholder="150.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Data e Hora *</label>
                      <input
                        type="datetime-local"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Forma de Pagamento *</label>
                    <select
                      required
                      value={formData.method}
                      onChange={(e) => {
                         const method = e.target.value as Payment['method'];
                         let mDetails = formData.methodDetails;
                         if (method === 'health_insurance') {
                            const pat = patients.find(p => p.id === formData.patientId);
                            if (pat?.healthInsuranceName) mDetails = pat.healthInsuranceName;
                         }
                         setFormData({...formData, method, methodDetails: mDetails});
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    >
                      <option value="pix">PIX</option>
                      <option value="cash">Dinheiro</option>
                      <option value="credit_card">Cartão de Crédito</option>
                      <option value="debit_card">Cartão de Débito</option>
                      <option value="health_insurance">Convênio</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {formData.method === 'health_insurance' ? 'Nome do Convênio / Autorização' : 'Detalhes Adicionais (opcional)'}
                    </label>
                    <input
                      type="text"
                      value={formData.methodDetails}
                      onChange={(e) => setFormData({...formData, methodDetails: e.target.value})}
                      placeholder={formData.method === 'health_insurance' ? 'Ex: Unimed 1234' : 'Anotação, comprovante, etc...'}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>

                </div>

                <div className="mt-5 sm:mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
