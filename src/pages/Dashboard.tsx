import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Plus, Edit2, Trash2, X, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  date: any; // Timestamp
  duration: number;
  office: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: any;
}

interface Patient {
  id: string;
  name: string;
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  
  const [formData, setFormData] = useState({
    patientId: '',
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    duration: 60,
    office: 'Consultório 1',
    status: 'scheduled' as const,
    notes: ''
  });

  useEffect(() => {
    if (!profile) return;

    // Fetch appointments
    let q = query(collection(db, 'appointments'));
    if (!isAdmin) {
      q = query(collection(db, 'appointments'), where('professionalId', '==', profile.uid));
    }

    const unsubscribeAppts = onSnapshot(q, (snapshot) => {
      const apptsData: Appointment[] = [];
      snapshot.forEach((doc) => {
        apptsData.push({ id: doc.id, ...doc.data() } as Appointment);
      });
      // Sort by date
      apptsData.sort((a, b) => a.date.seconds - b.date.seconds);
      setAppointments(apptsData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'appointments'));

    // Fetch patients for dropdown
    let qPatients = query(collection(db, 'patients'));
    if (!isAdmin) {
      qPatients = query(collection(db, 'patients'), where('assignedProfessionalId', '==', profile.uid));
    }
    const unsubscribePatients = onSnapshot(qPatients, (snapshot) => {
      const patientsData: Patient[] = [];
      snapshot.forEach((doc) => {
        patientsData.push({ id: doc.id, name: doc.data().name } as Patient);
      });
      setPatients(patientsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'patients'));

    return () => {
      unsubscribeAppts();
      unsubscribePatients();
    };
  }, [profile, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const selectedPatient = patients.find(p => p.id === formData.patientId);
    if (!selectedPatient) return;

    try {
      const appointmentDate = Timestamp.fromDate(new Date(formData.date));
      
      if (editingAppointment) {
        await updateDoc(doc(db, 'appointments', editingAppointment.id), {
          patientId: formData.patientId,
          patientName: selectedPatient.name,
          date: appointmentDate,
          duration: Number(formData.duration),
          office: formData.office,
          status: formData.status,
          notes: formData.notes
        });
      } else {
        await addDoc(collection(db, 'appointments'), {
          patientId: formData.patientId,
          patientName: selectedPatient.name,
          professionalId: profile.uid,
          date: appointmentDate,
          duration: Number(formData.duration),
          office: formData.office,
          status: formData.status,
          notes: formData.notes,
          createdAt: new Date()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingAppointment ? OperationType.UPDATE : OperationType.CREATE, 'appointments');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja cancelar/remover esta consulta?')) {
      try {
        await deleteDoc(doc(db, 'appointments', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `appointments/${id}`);
      }
    }
  };

  const openModal = (appointment?: Appointment) => {
    if (appointment) {
      setEditingAppointment(appointment);
      setFormData({
        patientId: appointment.patientId,
        date: format(appointment.date.toDate(), "yyyy-MM-dd'T'HH:mm"),
        duration: appointment.duration,
        office: appointment.office,
        status: appointment.status,
        notes: appointment.notes || ''
      });
    } else {
      setEditingAppointment(null);
      setFormData({
        patientId: '',
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        duration: 60,
        office: 'Consultório 1',
        status: 'scheduled',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAppointment(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Agendado';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  if (loading) return <div className="p-4">Carregando agenda...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Agenda</h2>
          <p className="mt-1 text-sm text-gray-500">Gerencie suas consultas e horários.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Consulta
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {appointments.map((apt) => {
            const date = apt.date.toDate();
            return (
              <li key={apt.id}>
                <div className="px-4 py-4 flex items-center sm:px-6">
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <div className="flex text-sm">
                        <p className="font-medium text-blue-600 truncate">{apt.patientName}</p>
                        <span className={`ml-3 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(apt.status)}`}>
                          {getStatusText(apt.status)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-col sm:flex-row sm:gap-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <CalendarIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                          {format(date, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                        </div>
                        <div className="flex items-center mt-2 sm:mt-0">
                          <Clock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                          {format(date, "HH:mm")} ({apt.duration} min)
                        </div>
                        <div className="flex items-center mt-2 sm:mt-0">
                          <MapPin className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                          {apt.office}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex-shrink-0 sm:mt-0 sm:ml-5 flex gap-2">
                      <button
                        onClick={() => openModal(apt)}
                        className="p-2 text-gray-400 hover:text-blue-600"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(apt.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          {appointments.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">Nenhuma consulta agendada.</li>
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
                  {editingAppointment ? 'Editar Consulta' : 'Nova Consulta'}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Paciente *</label>
                  <select
                    required
                    value={formData.patientId}
                    onChange={(e) => setFormData({...formData, patientId: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  >
                    <option value="">Selecione um paciente</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duração (min) *</label>
                    <input
                      type="number"
                      required
                      min="15"
                      step="15"
                      value={formData.duration}
                      onChange={(e) => setFormData({...formData, duration: Number(e.target.value)})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Consultório *</label>
                    <input
                      type="text"
                      required
                      value={formData.office}
                      onChange={(e) => setFormData({...formData, office: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status *</label>
                    <select
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    >
                      <option value="scheduled">Agendado</option>
                      <option value="completed">Concluído</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Observações</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  />
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
