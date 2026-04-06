import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  cpf?: string;
  rg?: string;
  birthDate?: string;
  birthPlace?: string;
  maritalStatus?: string;
  phone?: string;
  email?: string;
  address?: string;
  healthInsuranceName?: string;
  healthInsuranceNumber?: string;
  assignedProfessionalId: string;
  createdAt: any;
}

interface User {
  uid: string;
  name: string;
}

export default function Patients() {
  const { profile, isAdmin } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfessionalFilter, setSelectedProfessionalFilter] = useState<string>('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    rg: '',
    birthDate: '',
    birthPlace: '',
    maritalStatus: '',
    phone: '',
    email: '',
    address: '',
    healthInsuranceName: '',
    healthInsuranceNumber: '',
    assignedProfessionalId: profile?.uid || ''
  });

  useEffect(() => {
    if (!profile) return;

    // Fetch patients
    let q = query(collection(db, 'patients'));
    if (!isAdmin) {
      q = query(collection(db, 'patients'), where('assignedProfessionalId', '==', profile.uid));
    }

    const unsubscribePatients = onSnapshot(q, (snapshot) => {
      const patientsData: Patient[] = [];
      snapshot.forEach((doc) => {
        patientsData.push({ id: doc.id, ...doc.data() } as Patient);
      });
      setPatients(patientsData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'patients'));

    // Fetch professionals for assignment
    const qProfs = query(collection(db, 'users'), where('role', '==', 'professional'));
    const unsubscribeProfs = onSnapshot(qProfs, (snapshot) => {
      const profsData: User[] = [];
      snapshot.forEach((doc) => {
        profsData.push({ uid: doc.id, name: doc.data().name } as User);
      });
      setProfessionals(profsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => {
      unsubscribePatients();
      unsubscribeProfs();
    };
  }, [profile, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPatient) {
        await updateDoc(doc(db, 'patients', editingPatient.id), {
          name: formData.name,
          cpf: formData.cpf,
          rg: formData.rg,
          birthDate: formData.birthDate,
          birthPlace: formData.birthPlace,
          maritalStatus: formData.maritalStatus,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          healthInsuranceName: formData.healthInsuranceName,
          healthInsuranceNumber: formData.healthInsuranceNumber,
          assignedProfessionalId: formData.assignedProfessionalId
        });
      } else {
        await addDoc(collection(db, 'patients'), {
          ...formData,
          createdAt: new Date()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingPatient ? OperationType.UPDATE : OperationType.CREATE, 'patients');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este paciente?')) {
      try {
        await deleteDoc(doc(db, 'patients', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `patients/${id}`);
      }
    }
  };

  const openModal = (patient?: Patient) => {
    if (patient) {
      setEditingPatient(patient);
      setFormData({
        name: patient.name,
        cpf: patient.cpf || '',
        rg: patient.rg || '',
        birthDate: patient.birthDate || '',
        birthPlace: patient.birthPlace || '',
        maritalStatus: patient.maritalStatus || '',
        phone: patient.phone || '',
        email: patient.email || '',
        address: patient.address || '',
        healthInsuranceName: patient.healthInsuranceName || '',
        healthInsuranceNumber: patient.healthInsuranceNumber || '',
        assignedProfessionalId: patient.assignedProfessionalId
      });
    } else {
      setEditingPatient(null);
      setFormData({
        name: '',
        cpf: '',
        rg: '',
        birthDate: '',
        birthPlace: '',
        maritalStatus: '',
        phone: '',
        email: '',
        address: '',
        healthInsuranceName: '',
        healthInsuranceNumber: '',
        assignedProfessionalId: profile?.uid || ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPatient(null);
  };

  if (loading) return <div className="p-4">Carregando pacientes...</div>;

  const filteredPatients = patients.filter(patient => {
    if (isAdmin && selectedProfessionalFilter !== 'all') {
      return patient.assignedProfessionalId === selectedProfessionalFilter;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pacientes</h2>
          <p className="mt-1 text-sm text-gray-500">Gerencie o cadastro de pacientes da clínica.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          {isAdmin && (
            <select
              value={selectedProfessionalFilter}
              onChange={(e) => setSelectedProfessionalFilter(e.target.value)}
              className="block w-full sm:w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
            >
              <option value="all">Todos os Profissionais</option>
              {professionals.map(p => (
                <option key={p.uid} value={p.uid}>{p.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => openModal()}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Paciente
          </button>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {filteredPatients.map((patient) => {
            const prof = professionals.find(p => p.uid === patient.assignedProfessionalId);
            return (
              <li key={patient.id}>
                <div className="px-4 py-4 flex items-center sm:px-6">
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <div className="flex text-sm">
                        <p className="font-medium text-blue-600 truncate">{patient.name}</p>
                      </div>
                      <div className="mt-2 flex flex-col sm:flex-row sm:gap-4 text-sm text-gray-500">
                        {patient.cpf && <span>CPF: {patient.cpf}</span>}
                        {patient.phone && <span>Tel: {patient.phone}</span>}
                        {isAdmin && prof && <span className="text-purple-600">Profissional: {prof.name}</span>}
                      </div>
                    </div>
                    <div className="mt-4 flex-shrink-0 sm:mt-0 sm:ml-5 flex gap-2">
                      <button
                        onClick={() => openModal(patient)}
                        className="p-2 text-gray-400 hover:text-blue-600"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(patient.id)}
                          className="p-2 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          {filteredPatients.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">Nenhum paciente encontrado.</li>
          )}
        </ul>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={closeModal} />
            <div className="relative inline-block w-full max-w-2xl p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {editingPatient ? 'Editar Paciente' : 'Novo Paciente'}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">E-mail</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Telefone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">CPF</label>
                    <input
                      type="text"
                      value={formData.cpf}
                      onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">RG</label>
                    <input
                      type="text"
                      value={formData.rg}
                      onChange={(e) => setFormData({...formData, rg: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data de Nasc.</label>
                    <input
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Local de Nasc. (Naturalidade)</label>
                    <input
                      type="text"
                      value={formData.birthPlace}
                      onChange={(e) => setFormData({...formData, birthPlace: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Estado Civil</label>
                    <select
                      value={formData.maritalStatus}
                      onChange={(e) => setFormData({...formData, maritalStatus: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    >
                      <option value="">Selecione...</option>
                      <option value="solteiro">Solteiro(a)</option>
                      <option value="casado">Casado(a)</option>
                      <option value="divorciado">Divorciado(a)</option>
                      <option value="viuvo">Viúvo(a)</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Endereço Completo</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Convênio</label>
                    <input
                      type="text"
                      value={formData.healthInsuranceName}
                      onChange={(e) => setFormData({...formData, healthInsuranceName: e.target.value})}
                      placeholder="Ex: Unimed, Bradesco..."
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Número do Convênio</label>
                    <input
                      type="text"
                      value={formData.healthInsuranceNumber}
                      onChange={(e) => setFormData({...formData, healthInsuranceNumber: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>

                  {isAdmin && (
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Profissional Responsável *</label>
                      <select
                        required
                        value={formData.assignedProfessionalId}
                        onChange={(e) => setFormData({...formData, assignedProfessionalId: e.target.value})}
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
