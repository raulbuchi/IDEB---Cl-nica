import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where, Timestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Plus, Edit2, Trash2, X, Calendar as CalendarIcon, Clock, MapPin, RefreshCw, Bell, MessageCircle, Mail, Smartphone, List, Repeat } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, addDays, addWeeks, addMonths, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, dateFnsLocalizer, Event, View } from 'react-big-calendar';
import withDragAndDrop, { EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const locales = {
  'pt-BR': ptBR,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar as any);

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
  reminderTiming?: string;
  createdAt: any;
}

interface Patient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface Professional {
  uid: string;
  name: string;
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [reminderModalApt, setReminderModalApt] = useState<Appointment | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [filterProfessionalId, setFilterProfessionalId] = useState('all');
  const [filterOffice, setFilterOffice] = useState('all');
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);
  
  const [calendarView, setCalendarView] = useState<View>('week');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  const [formData, setFormData] = useState({
    patientId: '',
    professionalId: '',
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    duration: 60,
    office: 'Consultório 1',
    status: 'scheduled' as const,
    notes: '',
    reminderTiming: '24h',
    recurrence: 'none',
    recurrenceCount: 1
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
        patientsData.push({ 
          id: doc.id, 
          name: doc.data().name,
          phone: doc.data().phone,
          email: doc.data().email
        } as Patient);
      });
      setPatients(patientsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'patients'));

    // Fetch professionals
    const qProfessionals = query(collection(db, 'users'), where('role', '==', 'professional'));
    const unsubscribeProfessionals = onSnapshot(qProfessionals, (snapshot) => {
      const profData: Professional[] = [];
      snapshot.forEach((doc) => {
        profData.push({
          uid: doc.data().uid,
          name: doc.data().name || 'Profissional',
        });
      });
      setProfessionals(profData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => {
      unsubscribeAppts();
      unsubscribePatients();
      unsubscribeProfessionals();
    };
  }, [profile, isAdmin]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPatient = patients.find(p => p.id === formData.patientId);
    if (!selectedPatient) {
      alert("Por favor, selecione um paciente.");
      return;
    }
    setIsConfirming(true);
  };

  const confirmAndSave = async () => {
    if (!profile) return;

    const selectedPatient = patients.find(p => p.id === formData.patientId);
    if (!selectedPatient) return;

    try {
      if (editingAppointment) {
        const appointmentDate = Timestamp.fromDate(new Date(formData.date));
        await updateDoc(doc(db, 'appointments', editingAppointment.id), {
          patientId: formData.patientId,
          patientName: selectedPatient.name,
          professionalId: formData.professionalId || profile.uid,
          date: appointmentDate,
          duration: Number(formData.duration),
          office: formData.office,
          status: formData.status,
          notes: formData.notes,
          reminderTiming: formData.reminderTiming
        });
      } else {
        const occurrences = formData.recurrence === 'none' ? 1 : Number(formData.recurrenceCount) || 1;
        const baseDate = new Date(formData.date);
        const batch = writeBatch(db);
        const apptsCollection = collection(db, 'appointments');

        for (let i = 0; i < occurrences; i++) {
          let currDate = new Date(baseDate);
          if (formData.recurrence === 'daily') currDate = addDays(baseDate, i);
          else if (formData.recurrence === 'weekly') currDate = addWeeks(baseDate, i);
          else if (formData.recurrence === 'monthly') currDate = addMonths(baseDate, i);

          const newDocRef = doc(apptsCollection);
          batch.set(newDocRef, {
            patientId: formData.patientId,
            patientName: selectedPatient.name,
            professionalId: formData.professionalId || profile.uid,
            date: Timestamp.fromDate(currDate),
            duration: Number(formData.duration),
            office: formData.office,
            status: formData.status,
            notes: formData.notes,
            reminderTiming: formData.reminderTiming,
            createdAt: new Date()
          });
        }
        await batch.commit();
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

  const onEventDrop = async ({ event, start, end }: EventInteractionArgs<any>) => {
    try {
      const apt = event as Appointment;
      const newDate = Timestamp.fromDate(new Date(start as Date));
      await updateDoc(doc(db, 'appointments', apt.id), {
        date: newDate
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${(event as Appointment).id}`);
    }
  };

  const onEventResize = async ({ event, start, end }: EventInteractionArgs<any>) => {
    try {
      const apt = event as Appointment;
      const newDate = Timestamp.fromDate(new Date(start as Date));
      const durationMs = new Date(end as Date).getTime() - new Date(start as Date).getTime();
      const durationMins = Math.round(durationMs / 60000);
      
      await updateDoc(doc(db, 'appointments', apt.id), {
        date: newDate,
        duration: durationMins
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${(event as Appointment).id}`);
    }
  };

  const openModal = (appointment?: Appointment) => {
    if (appointment) {
      setEditingAppointment(appointment);
      setFormData({
        patientId: appointment.patientId,
        professionalId: appointment.professionalId || '',
        date: format(appointment.date.toDate(), "yyyy-MM-dd'T'HH:mm"),
        duration: appointment.duration,
        office: appointment.office,
        status: appointment.status,
        notes: appointment.notes || '',
        reminderTiming: appointment.reminderTiming || 'none',
        recurrence: 'none',
        recurrenceCount: 1
      });
    } else {
      setEditingAppointment(null);
      setFormData({
        patientId: '',
        professionalId: isAdmin ? '' : profile?.uid || '',
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        duration: 60,
        office: 'Consultório 1',
        status: 'scheduled',
        notes: '',
        reminderTiming: '24h',
        recurrence: 'none',
        recurrenceCount: 1
      });
    }
    setIsModalOpen(true);
  };

  const handleScheduleReturn = (appointment: Appointment) => {
    setEditingAppointment(null);
    setFormData({
      patientId: appointment.patientId,
      professionalId: appointment.professionalId || '',
      date: format(addMonths(appointment.date.toDate(), 1), "yyyy-MM-dd'T'HH:mm"),
      duration: appointment.duration,
      office: appointment.office,
      status: 'scheduled',
      notes: 'Retorno',
      reminderTiming: '24h',
      recurrence: 'none',
      recurrenceCount: 1
    });
    setIsModalOpen(true);
  };

  const handleSendReminder = (method: 'whatsapp' | 'sms' | 'email') => {
    if (!reminderModalApt) return;
    
    const patient = patients.find(p => p.id === reminderModalApt.patientId);
    if (!patient) {
      alert('Paciente não encontrado.');
      return;
    }

    const dateStr = format(reminderModalApt.date.toDate(), "dd/MM/yyyy 'às' HH:mm");
    const msg = `Olá ${patient.name}, este é um lembrete da sua consulta no dia ${dateStr} no ${reminderModalApt.office}.`;

    if (method === 'whatsapp') {
      if (!patient.phone) {
        alert('Paciente não possui telefone cadastrado.');
        return;
      }
      const phone = patient.phone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else if (method === 'sms') {
      if (!patient.phone) {
        alert('Paciente não possui telefone cadastrado.');
        return;
      }
      const phone = patient.phone.replace(/\D/g, '');
      window.open(`sms:+55${phone}?body=${encodeURIComponent(msg)}`, '_self');
    } else if (method === 'email') {
      if (!patient.email) {
        alert('Paciente não possui e-mail cadastrado.');
        return;
      }
      window.open(`mailto:${patient.email}?subject=Lembrete de Consulta&body=${encodeURIComponent(msg)}`, '_self');
    }
    setReminderModalApt(null);
  };

  const handleDirectWhatsApp = (appointment: Appointment) => {
    const patient = patients.find(p => p.id === appointment.patientId);
    if (!patient || !patient.phone) {
      alert('Paciente não encontrado ou sem telefone cadastrado.');
      return;
    }
    const dateStr = format(appointment.date.toDate(), "dd/MM/yyyy 'às' HH:mm");
    const msg = `Olá ${patient.name}, este é um lembrete da sua consulta no dia ${dateStr} no ${appointment.office}.`;
    const phone = patient.phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const setQuickDate = (days: number, months: number = 0) => {
    let newDate = new Date();
    if (days > 0) newDate = addDays(newDate, days);
    if (months > 0) newDate = addMonths(newDate, months);
    setFormData({ ...formData, date: format(newDate, "yyyy-MM-dd'T'HH:mm") });
  };

  const handleQuickSchedule = (daysToAdd: number) => {
    let targetDate = new Date();
    let addedDays = 0;
    while (addedDays < daysToAdd) {
      targetDate = addDays(targetDate, 1);
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (targetDate.getDay() !== 0 && targetDate.getDay() !== 6) {
        addedDays++;
      }
    }
    
    // Set time to 09:00 by default for quick schedules
    targetDate.setHours(9, 0, 0, 0);

    setEditingAppointment(null);
    setFormData({
      patientId: '',
      date: format(targetDate, "yyyy-MM-dd'T'HH:mm"),
      duration: 60,
      office: 'Consultório 1',
      status: 'scheduled',
      notes: '',
      reminderTiming: '24h'
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsConfirming(false);
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

  const filteredAppointments = appointments.filter((apt) => {
    let matchProf = true;
    if (isAdmin && filterProfessionalId !== 'all') {
      matchProf = apt.professionalId === filterProfessionalId;
    }
    
    let matchOffice = true;
    if (filterOffice !== 'all') {
      matchOffice = apt.office === filterOffice;
    }

    return matchProf && matchOffice;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Agenda</h2>
          <p className="mt-1 text-sm text-gray-500">Gerencie suas consultas e horários.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-100 p-1 rounded-md mr-2">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center ${viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <CalendarIcon className="w-4 h-4 mr-1.5" />
              Calendário
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List className="w-4 h-4 mr-1.5" />
              Lista
            </button>
          </div>
          <button
            onClick={() => {
              handleQuickSchedule(1);
              setCalendarDate(addDays(new Date(), 1));
              setCalendarView('day');
              setViewMode('calendar');
            }}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
          >
            Amanhã
          </button>
          <button
            onClick={() => {
              handleQuickSchedule(3);
              setCalendarDate(addDays(new Date(), Math.max(3, 3 + (getDay(new Date()) >= 3 ? 2 : 0))));
            }}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
          >
            Em 3 dias úteis
          </button>
          <button
            onClick={() => {
              handleQuickSchedule(7);
              setCalendarDate(addDays(new Date(), Math.max(7, 7 + (getDay(new Date()) >= 1 ? 2 : 0))));
            }}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
          >
            Em 7 dias úteis
          </button>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Consulta
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4 items-center">
        <div className="text-sm font-medium text-gray-700">Filtros:</div>
        {isAdmin && (
          <select
            value={filterProfessionalId}
            onChange={(e) => setFilterProfessionalId(e.target.value)}
            className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          >
            <option value="all">Todos os Profissionais</option>
            {professionals.map(p => (
              <option key={p.uid} value={p.uid}>{p.name}</option>
            ))}
          </select>
        )}
        <select
          value={filterOffice}
          onChange={(e) => setFilterOffice(e.target.value)}
          className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
        >
          <option value="all">Todas as Salas/Consultórios</option>
          <option value="Consultório 1">Consultório 1</option>
          <option value="Consultório 2">Consultório 2</option>
          <option value="Consultório 3">Consultório 3</option>
          <option value="Sala de Exames">Sala de Exames</option>
        </select>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-white shadow rounded-lg p-4 h-[600px]">
          <DnDCalendar
            localizer={localizer}
            view={calendarView}
            onView={(view) => setCalendarView(view)}
            date={calendarDate}
            onNavigate={(date) => setCalendarDate(date)}
            events={filteredAppointments.map(apt => {
              const start = apt.date.toDate();
              const end = new Date(start.getTime() + apt.duration * 60000);
              const professional = professionals.find(p => p.uid === apt.professionalId);
              const profName = professional ? professional.name : 'Desconhecido';
              return {
                ...apt,
                title: `${profName} - ${apt.office}: ${apt.patientName}`,
                start,
                end,
              };
            })}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            messages={{
              next: "Próximo",
              previous: "Anterior",
              today: "Hoje",
              month: "Mês",
              week: "Semana",
              day: "Dia",
              agenda: "Agenda",
              date: "Data",
              time: "Hora",
              event: "Evento",
              noEventsInRange: "Não há consultas neste período.",
            }}
            onSelectEvent={(event) => setViewingAppointment(event as Appointment)}
            onEventDrop={onEventDrop}
            onEventResize={onEventResize}
            resizable
            selectable
            eventPropGetter={(event) => {
              let backgroundColor = '#3b82f6'; // blue for scheduled
              if (event.status === 'completed') backgroundColor = '#10b981'; // green
              if (event.status === 'cancelled') backgroundColor = '#ef4444'; // red
              return { style: { backgroundColor } };
            }}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(
            filteredAppointments.reduce((acc, apt) => {
              const dateStr = format(apt.date.toDate(), 'yyyy-MM-dd');
              if (!acc[dateStr]) acc[dateStr] = [];
              acc[dateStr].push(apt);
              return acc;
            }, {} as Record<string, Appointment[]>)
          ).sort(([dateA], [dateB]) => dateA.localeCompare(dateB)).map(([dateStr, dayAppointments]) => (
            <div key={dateStr} className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 capitalize flex items-center">
                  <CalendarIcon className="w-5 h-5 mr-2 text-gray-400" />
                  {format(parseISO(dateStr), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </h3>
              </div>
              <ul className="divide-y divide-gray-200">
                {dayAppointments.map((apt) => {
                  const date = apt.date.toDate();
                  const professional = professionals.find(p => p.uid === apt.professionalId);
                  const patient = patients.find(p => p.id === apt.patientId);
                  return (
                    <li key={apt.id} className="hover:bg-gray-50 transition-colors">
                      <div className="px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between sm:px-6 gap-4">
                        <div 
                          className="min-w-0 flex-1 cursor-pointer" 
                          onClick={() => setViewingAppointment(apt)}
                        >
                          <div className="flex items-center justify-between sm:justify-start">
                            <p className="font-medium text-blue-600 truncate text-base">{apt.patientName}</p>
                            <span className={`ml-3 px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(apt.status)}`}>
                              {getStatusText(apt.status)}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Clock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{format(date, "HH:mm")}</span>
                              <span className="ml-1">({apt.duration} min)</span>
                            </div>
                            <div className="flex items-center">
                              <MapPin className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                              {apt.office}
                            </div>
                            {isAdmin && professional && (
                              <div className="flex items-center">
                                <List className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                <span className="truncate">{professional.name}</span>
                              </div>
                            )}
                            {patient?.phone && (
                              <div className="flex items-center">
                                <Smartphone className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                {patient.phone}
                              </div>
                            )}
                          </div>
                          {apt.notes && (
                            <div className="mt-3 text-sm text-gray-600 bg-yellow-50 p-3 rounded-md border border-yellow-100 italic">
                              <span className="font-semibold text-gray-700 not-italic mr-1">Obs:</span> {apt.notes}
                            </div>
                          )}
                        </div>
                        <div className="mt-4 flex-shrink-0 sm:mt-0 flex gap-2 justify-end">
                          <button
                            onClick={() => setReminderModalApt(apt)}
                            title="Enviar Lembrete"
                            className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-full transition-colors divide-x divide-gray-200"
                          >
                            <Bell className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleScheduleReturn(apt)}
                            title="Agendar Retorno"
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                          >
                            <RefreshCw className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => openModal(apt)}
                            title="Editar Consulta"
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(apt.id)}
                            title="Cancelar Consulta"
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {filteredAppointments.length === 0 && (
            <div className="text-center py-12 bg-white shadow sm:rounded-lg">
              <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma consulta</h3>
              <p className="mt-1 text-sm text-gray-500">Você não possui consultas agendadas para este filtro.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={closeModal} />
            <div className="relative inline-block w-full max-w-md p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {isConfirming ? 'Resumo do Agendamento' : (editingAppointment ? 'Editar Consulta' : 'Nova Consulta')}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {isConfirming ? (
                <div className="space-y-4 text-sm">
                  <div className="bg-blue-50 p-4 rounded-md text-blue-900 grid grid-cols-2 gap-y-4">
                    <div>
                      <span className="block text-blue-700 text-xs font-semibold uppercase">Paciente</span>
                      <span className="font-medium">{patients.find(p => p.id === formData.patientId)?.name}</span>
                    </div>
                    <div>
                      <span className="block text-blue-700 text-xs font-semibold uppercase">Data e Hora</span>
                      <span className="font-medium">{format(new Date(formData.date), "dd/MM/yyyy 'às' HH:mm")}</span>
                    </div>
                    <div>
                      <span className="block text-blue-700 text-xs font-semibold uppercase">Consultório</span>
                      <span className="font-medium">{formData.office}</span>
                    </div>
                    <div>
                      <span className="block text-blue-700 text-xs font-semibold uppercase">Duração</span>
                      <span className="font-medium">{formData.duration} min</span>
                    </div>
                    {isAdmin && formData.professionalId && (
                      <div className="col-span-2">
                        <span className="block text-blue-700 text-xs font-semibold uppercase">Profissional</span>
                        <span className="font-medium">{professionals.find(p => p.uid === formData.professionalId)?.name}</span>
                      </div>
                    )}
                    {!editingAppointment && formData.recurrence !== 'none' && (
                      <div className="col-span-2 border-t border-blue-200 mt-2 pt-2">
                        <span className="block text-blue-700 text-xs font-semibold uppercase">Repetição</span>
                        <span className="font-medium">
                          {formData.recurrence === 'daily' ? 'Diárias' : formData.recurrence === 'weekly' ? 'Semanais' : 'Mensais'} ({formData.recurrenceCount} sessões totais)
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => setIsConfirming(false)}
                      className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm items-center"
                    >
                      Voltar e Editar
                    </button>
                    <button
                      type="button"
                      onClick={confirmAndSave}
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm items-center"
                    >
                      Confirmar {formData.recurrence !== 'none' && !editingAppointment ? `(${formData.recurrenceCount})` : ''}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
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
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button type="button" onClick={() => setQuickDate(7)} className="text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-600">+1 Sem</button>
                      <button type="button" onClick={() => setQuickDate(15)} className="text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-600">+15 Dias</button>
                      <button type="button" onClick={() => setQuickDate(0, 1)} className="text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-600">+1 Mês</button>
                    </div>
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
                  <label className="block text-sm font-medium text-gray-700">Lembrete Automático</label>
                  <select
                    value={formData.reminderTiming}
                    onChange={(e) => setFormData({...formData, reminderTiming: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  >
                    <option value="none">Não enviar</option>
                    <option value="24h">24 horas antes</option>
                    <option value="48h">48 horas antes</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Requer configuração de backend para envio automático.</p>
                </div>

                {!editingAppointment && (
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-md border border-gray-100">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Repeat className="w-3 h-3 text-gray-400" />
                        Repetição
                      </label>
                      <select
                        value={formData.recurrence}
                        onChange={(e) => setFormData({...formData, recurrence: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                      >
                        <option value="none">Não Repetir</option>
                        <option value="daily">Diariamente</option>
                        <option value="weekly">Semanalmente</option>
                        <option value="monthly">Mensalmente</option>
                      </select>
                    </div>
                    {formData.recurrence !== 'none' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Quantidade de vezes</label>
                        <input
                          type="number"
                          min="2"
                          max="50"
                          required={formData.recurrence !== 'none'}
                          value={formData.recurrenceCount}
                          onChange={(e) => setFormData({...formData, recurrenceCount: Number(e.target.value)})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        />
                        <p className="text-xs text-gray-500 mt-1">Até 50 consultas geradas.</p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">Observações do Agendamento</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    placeholder="Informações adicionais sobre a consulta (opcional)"
                  />
                </div>

                <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row gap-3">
                  {editingAppointment && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                           e.preventDefault();
                           handleDirectWhatsApp(editingAppointment);
                        }}
                        className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-green-700 shadow-sm hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:text-sm items-center"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Avisar via WhatsApp
                      </button>
                      
                      <button
                        type="button"
                        onClick={(e) => {
                           e.preventDefault();
                           handleScheduleReturn(editingAppointment);
                        }}
                        className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-emerald-700 shadow-sm hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:text-sm items-center"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Agendar Retorno
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm items-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm items-center"
                  >
                    Resumo e Salvar
                  </button>
                </div>
              </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Appointment Modal */}
      {viewingAppointment && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewingAppointment(null)} />
            <div className="relative inline-block w-full max-w-lg p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <div className="flex justify-between items-start mb-5 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    Detalhes da Consulta
                  </h3>
                  <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(viewingAppointment.status)}`}>
                    {getStatusText(viewingAppointment.status)}
                  </span>
                </div>
                <button onClick={() => setViewingAppointment(null)} className="text-gray-400 hover:text-gray-500 bg-gray-100 rounded-full p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4 mb-8">
                <div className="col-span-1 md:col-span-2">
                  <span className="block text-sm font-medium text-gray-500 mb-1">Paciente</span>
                  <div className="text-lg font-semibold text-gray-800 flex items-center">
                    {viewingAppointment.patientName}
                    {patients.find(p => p.id === viewingAppointment.patientId)?.phone && (
                       <span className="ml-3 px-2 py-1 text-sm bg-blue-50 text-blue-700 rounded-md font-medium border border-blue-100 flex items-center">
                         <Smartphone className="w-4 h-4 mr-1.5" />
                         {patients.find(p => p.id === viewingAppointment.patientId)?.phone}
                       </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-medium text-gray-500 mb-1 flex items-center">
                    <CalendarIcon className="w-4 h-4 mr-1.5" />
                    Data e Hora
                  </span>
                  <div className="text-gray-900 font-medium">
                    {format(viewingAppointment.date.toDate(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    <div className="text-sm text-gray-600 mt-0.5">
                      {format(viewingAppointment.date.toDate(), "HH:mm")} ({viewingAppointment.duration} min)
                    </div>
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-medium text-gray-500 mb-1 flex items-center">
                    <MapPin className="w-4 h-4 mr-1.5" />
                    Local
                  </span>
                  <div className="text-gray-900 font-medium">{viewingAppointment.office}</div>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <span className="block text-sm font-medium text-gray-500 mb-1">Profissional</span>
                  <div className="text-gray-900 font-medium bg-gray-50 inline-block px-3 py-1.5 rounded border border-gray-200">
                    {professionals.find(p => p.uid === viewingAppointment.professionalId)?.name || 'Desconhecido'}
                  </div>
                </div>

                {viewingAppointment.notes && (
                  <div className="col-span-1 md:col-span-2 bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                    <span className="block text-sm font-semibold text-gray-700 mb-2 border-b border-yellow-200 pb-2">Observações</span>
                    <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{viewingAppointment.notes}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t border-gray-100">
                <button
                  onClick={() => {
                    const apt = viewingAppointment;
                    setViewingAppointment(null);
                    openModal(apt);
                  }}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Edit2 className="w-4 h-4 mr-2 text-gray-400" />
                  Editar
                </button>
                <button
                  onClick={() => {
                    const apt = viewingAppointment;
                    setViewingAppointment(null);
                    setReminderModalApt(apt);
                  }}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-white border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <Bell className="w-4 h-4 mr-2 text-green-500" />
                  Lembrete
                </button>
                <button
                  onClick={() => {
                    const apt = viewingAppointment;
                    setViewingAppointment(null);
                    handleDelete(apt.id);
                  }}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-white border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <Trash2 className="w-4 h-4 mr-2 text-red-400" />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {reminderModalApt && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setReminderModalApt(null)} />
            <div className="relative inline-block w-full max-w-sm p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  Enviar Lembrete
                </h3>
                <button onClick={() => setReminderModalApt(null)} className="text-gray-400 hover:text-gray-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Escolha como deseja enviar o lembrete para <strong>{reminderModalApt.patientName}</strong>.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => handleSendReminder('whatsapp')}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  WhatsApp
                </button>
                <button
                  onClick={() => handleSendReminder('sms')}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Smartphone className="w-5 h-5 mr-2" />
                  SMS
                </button>
                <button
                  onClick={() => handleSendReminder('email')}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Mail className="w-5 h-5 mr-2" />
                  E-mail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
