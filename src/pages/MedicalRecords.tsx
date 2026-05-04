import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Plus, Edit2, Trash2, X, FileText, Paperclip, ExternalLink, Download } from 'lucide-react';
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

interface Attachment {
  id: string;
  patientId: string;
  professionalId: string;
  name: string;
  type: string;
  url: string;
  fileData: string;
  createdAt: any;
}

interface Patient {
  id: string;
  name: string;
}

export default function MedicalRecords() {
  const { profile, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const patientParam = searchParams.get('patientId');
  const tabParam = searchParams.get('tab') as 'records' | 'attachments';

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patientParam || '');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'records' | 'attachments'>(tabParam || 'records');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    content: ''
  });

  const [attachmentData, setAttachmentData] = useState({
    name: '',
    type: 'exam',
    url: '',
    fileData: ''
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
      
      // Only set initial patient if none is selected via param
      if (patientsData.length > 0 && !selectedPatientId && !patientParam) {
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

    let qAtt = query(collection(db, 'attachments'), where('patientId', '==', selectedPatientId));
    if (!isAdmin) {
      qAtt = query(
        collection(db, 'attachments'),
        where('patientId', '==', selectedPatientId),
        where('professionalId', '==', profile.uid)
      );
    }
    const unsubscribeAttachments = onSnapshot(qAtt, (snapshot) => {
      const attachmentsData: Attachment[] = [];
      snapshot.forEach((doc) => {
        attachmentsData.push({ id: doc.id, ...doc.data() } as Attachment);
      });
      attachmentsData.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      setAttachments(attachmentsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attachments'));

    return () => {
      unsubscribeRecords();
      unsubscribeAttachments();
    };
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
          createdAt: serverTimestamp()
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

  const handleAttachmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedPatientId) return;
    
    if (!attachmentData.name || (!attachmentData.url && !attachmentData.fileData)) {
      alert('Por favor, informe um nome e anexe um arquivo ou insira um link externo.');
      return;
    }

    try {
      await addDoc(collection(db, 'attachments'), {
        patientId: selectedPatientId,
        professionalId: profile.uid,
        name: attachmentData.name,
        type: attachmentData.type,
        url: attachmentData.url || '',
        fileData: attachmentData.fileData || '',
        createdAt: serverTimestamp()
      });
      setIsAttachmentModalOpen(false);
      setAttachmentData({ name: '', type: 'exam', url: '', fileData: '' });
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'attachments');
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    if (window.confirm('Tem certeza que deseja apagar este anexo? A ação é irreversível.')) {
      try {
        await deleteDoc(doc(db, 'attachments', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `attachments/${id}`);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 800000) { // Limit roughly to ~800kb
      alert('O arquivo é muito grande. O tamanho máximo permitido é de 800KB para armazenamento direto em nuvem. Para arquivos maiores, utilize um link externo.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachmentData(prev => ({
        ...prev,
        fileData: reader.result as string,
        url: '' // clear url if uploading file
      }));
    };
    reader.readAsDataURL(file);
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
            onChange={(e) => {
              const id = e.target.value;
              setSelectedPatientId(id);
              setSearchParams({ patientId: id, tab: activeTab });
            }}
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

      {!selectedPatientId ? (
        <div className="text-center py-12 bg-white shadow sm:rounded-lg">
          <p className="text-sm text-gray-500">Selecione um paciente para ver seus prontuários.</p>
        </div>
      ) : loading ? (
        <div className="p-4">Carregando dados...</div>
      ) : (
        <div className="space-y-4">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => {
                  setActiveTab('records');
                  setSearchParams({ patientId: selectedPatientId, tab: 'records' });
                }}
                className={`${
                  activeTab === 'records'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <FileText className="w-4 h-4 mr-2" />
                Registros Clínicos
              </button>
              <button
                onClick={() => {
                  setActiveTab('attachments');
                  setSearchParams({ patientId: selectedPatientId, tab: 'attachments' });
                }}
                className={`${
                  activeTab === 'attachments'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <Paperclip className="w-4 h-4 mr-2" />
                Anexos
              </button>
            </nav>
          </div>

          {activeTab === 'records' ? (
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
          {records.length === 0 && (
            <div className="text-center py-12 bg-white shadow sm:rounded-lg">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum registro</h3>
              <p className="mt-1 text-sm text-gray-500">Comece criando um novo registro no prontuário.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsAttachmentModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
              <Paperclip className="w-5 h-5 mr-2" />
              Adicionar Anexo
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {attachments.map((att) => (
              <div key={att.id} className="bg-white shadow rounded-lg border border-gray-200 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-900 break-words">{att.name}</h4>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="text-gray-400 hover:text-red-600 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mb-4 capitalize">
                    {att.type === 'exam' && 'Exame'}
                    {att.type === 'test' && 'Teste'}
                    {att.type === 'opinion' && 'Parecer'}
                    {att.type === 'certificate' && 'Atestado'}
                    {att.type === 'other' && 'Outro'}
                    {' • '}
                    {format(att.createdAt.toDate(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                </div>
                <div className="mt-auto">
                  {att.fileData ? (
                    <a
                      href={att.fileData}
                      download={att.name}
                      className="inline-flex w-full items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar Arquivo
                    </a>
                  ) : (
                    <a
                      href={att.url.startsWith('http') ? att.url : `https://${att.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Acessar Link Externo
                    </a>
                  )}
                </div>
              </div>
            ))}
            {attachments.length === 0 && (
              <div className="col-span-full text-center py-12 bg-white shadow sm:rounded-lg">
                <Paperclip className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum anexo</h3>
                <p className="mt-1 text-sm text-gray-500">Faça o upload de exames, atestados ou relatórios.</p>
              </div>
            )}
          </div>
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

      {/* Attachment Modal */}
      {isAttachmentModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsAttachmentModalOpen(false)} />
            <div className="relative inline-block w-full max-w-md p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  Adicionar Anexo
                </h3>
                <button onClick={() => setIsAttachmentModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleAttachmentSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome do Anexo *</label>
                  <input
                    type="text"
                    required
                    value={attachmentData.name}
                    onChange={(e) => setAttachmentData({...attachmentData, name: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    placeholder="Ex: Hemograma Completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo de Documento *</label>
                  <select
                    required
                    value={attachmentData.type}
                    onChange={(e) => setAttachmentData({...attachmentData, type: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  >
                    <option value="exam">Exame de Imagem / Labor laboratorial</option>
                    <option value="test">Teste / Avaliação</option>
                    <option value="opinion">Parecer / Relatório Médico</option>
                    <option value="certificate">Atestado / Receita</option>
                    <option value="other">Outro Arquivo</option>
                  </select>
                </div>

                <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800">
                  <p>Escolha fazer upload de um arquivo do seu computador <strong>OU</strong> colar um link direto para o arquivo (Drive, Dropbox, etc).</p>
                </div>

                {!attachmentData.url && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fazer Upload de Arquivo (Máx 800KB)
                    </label>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                )}
                
                {(!attachmentData.fileData && !attachmentData.url) && (
                  <div className="text-center font-bold text-gray-300 text-sm my-2">OU</div>
                )}

                {!attachmentData.fileData && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Link Externo para o Arquivo
                    </label>
                    <input
                      type="url"
                      value={attachmentData.url}
                      onChange={(e) => setAttachmentData({...attachmentData, url: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                      placeholder="https://drive.google.com/..."
                    />
                  </div>
                )}

                <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAttachmentModalOpen(false)}
                    className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm items-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm items-center"
                  >
                    Salvar Anexo
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
