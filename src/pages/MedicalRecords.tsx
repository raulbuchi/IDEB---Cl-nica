import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Plus, Edit2, Trash2, X, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MedicalRecord {
  id: string;
  patientId: string;
  professionalId: string;
  date: any; // Timestamp
  content: string;
  createdAt: any;
}

interface Patient {
  id: string;
  name: string;
}

export default function MedicalRecords() {
  const { profile, isAdmin } = useAuth();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  
  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    content: ''
  });

  useEffect(() => {
    if (!profile) return;

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
      if (patientsData.length > 0 && !selectedPatientId) {
        setSelectedPatientId(patientsData[0].id);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'patients'));

    return () => unsubscribePatients();
  }, [profile, isAdmin]);

  useEffect(() => {
    if (!profile || !selectedPatientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let q = query(
      collection(db, 'medicalRecords'),
      where('patientId', '==', selectedPatientId)
    );

    if (!isAdmin) {
      q = query(
        collection(db, 'medicalRecords'),
        where('patientId', '==', selectedPatientId),
        where('professionalId', '==', profile.uid)
      );
    }

    const unsubscribeRecords = onSnapshot(q, (snapshot) => {
      const recordsData: MedicalRecord[] = [];
      snapshot.forEach((doc) => {
        recordsData.push({ id: doc.id, ...doc.data() } as MedicalRecord);
      });
      // Sort by date descending
      recordsData.sort((a, b) => b.date.seconds - a.date.seconds);
      setRecords(recordsData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'medicalRecords'));

    return () => unsubscribeRecords();
  }, [profile, isAdmin, selectedPatientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedPatientId) return;

    try {
      const recordDate = Timestamp.fromDate(new Date(formData.date));
      
      if (editingRecord) {
        await updateDoc(doc(db, 'medicalRecords', editingRecord.id), {
          date: recordDate,
          content: formData.content
        });
      } else {
        await addDoc(collection(db, 'medicalRecords'), {
          patientId: selectedPatientId,
          professionalId: profile.uid,
          date: recordDate,
          content: formData.content,
          createdAt: new Date()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingRecord ? OperationType.UPDATE : OperationType.CREATE, 'medicalRecords');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este prontuário?')) {
      try {
        await deleteDoc(doc(db, 'medicalRecords', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `medicalRecords/${id}`);
      }
    }
  };

  const openModal = (record?: MedicalRecord) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        date: format(record.date.toDate(), "yyyy-MM-dd'T'HH:mm"),
        content: record.content
      });
    } else {
      setEditingRecord(null);
      setFormData({
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        content: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Prontuários</h2>
          <p className="mt-1 text-sm text-gray-500">Acompanhamento clínico dos pacientes.</p>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          >
            <option value="" disabled>Selecione um paciente</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          
          <button
            onClick={() => openModal()}
            disabled={!selectedPatientId}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Registro
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-4">Carregando prontuários...</div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => {
            const date = record.date.toDate();
            return (
              <div key={record.id} className="bg-white shadow sm:rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-400 mr-2" />
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {format(date, "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openModal(record)}
                      className="p-2 text-gray-400 hover:text-blue-600"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-4 py-5 sm:p-6">
                  <div className="text-sm text-gray-900 whitespace-pre-wrap">
                    {record.content}
                  </div>
                </div>
              </div>
            );
          })}
          {records.length === 0 && selectedPatientId && (
            <div className="text-center py-12 bg-white shadow sm:rounded-lg">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum registro</h3>
              <p className="mt-1 text-sm text-gray-500">Comece criando um novo registro no prontuário.</p>
            </div>
          )}
          {!selectedPatientId && (
            <div className="text-center py-12 bg-white shadow sm:rounded-lg">
              <p className="text-sm text-gray-500">Selecione um paciente para ver seus prontuários.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={closeModal} />
            <div className="relative inline-block w-full max-w-2xl p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {editingRecord ? 'Editar Registro' : 'Novo Registro no Prontuário'}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Data e Hora *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="mt-1 block w-full sm:w-1/2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Evolução Clínica *</label>
                  <textarea
                    required
                    rows={10}
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    placeholder="Descreva a evolução do paciente..."
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
                    Salvar Registro
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
