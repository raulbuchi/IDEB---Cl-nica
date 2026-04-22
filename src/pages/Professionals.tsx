import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, where, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, secondaryAuth } from '../firebase';
import { useAuth } from '../AuthContext';
import { Edit2, Trash2, X, User as UserIcon, Phone, Mail, MapPin, Briefcase, Hash, Instagram, Plus } from 'lucide-react';

interface Professional {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'professional';
  professionalId?: string;
  specialty?: string;
  phone?: string;
  rg?: string;
  cpfCnpj?: string;
  address?: string;
  socialMedia?: string;
}

export default function Professionals() {
  const { profile, isAdmin } = useAuth();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    professionalId: '',
    specialty: '',
    phone: '',
    rg: '',
    cpfCnpj: '',
    address: '',
    socialMedia: ''
  });

  useEffect(() => {
    if (!profile) return;

    // Fetch all users who are professionals (or admins if we want to show all staff)
    const q = query(collection(db, 'users'), where('role', '==', 'professional'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const profData: Professional[] = [];
      snapshot.forEach((doc) => {
        profData.push({ uid: doc.id, ...doc.data() } as Professional);
      });
      setProfessionals(profData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => unsubscribe();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsSubmitting(true);
    try {
      if (editingProfessional) {
        await updateDoc(doc(db, 'users', editingProfessional.uid), {
          name: formData.name,
          professionalId: formData.professionalId,
          specialty: formData.specialty,
          phone: formData.phone,
          rg: formData.rg,
          cpfCnpj: formData.cpfCnpj,
          address: formData.address,
          socialMedia: formData.socialMedia
        });
      } else {
        // Create new professional
        const result = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        const user = result.user;
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: formData.name,
          email: formData.email,
          role: 'professional',
          professionalId: formData.professionalId,
          specialty: formData.specialty,
          phone: formData.phone,
          rg: formData.rg,
          cpfCnpj: formData.cpfCnpj,
          address: formData.address,
          socialMedia: formData.socialMedia,
          createdAt: new Date()
        });
      }
      closeModal();
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        alert('Este e-mail já está em uso por outro usuário.');
      } else if (error.code === 'auth/weak-password') {
        alert('A senha deve ter pelo menos 6 caracteres.');
      } else {
        handleFirestoreError(error, editingProfessional ? OperationType.UPDATE : OperationType.CREATE, 'users');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (uid: string) => {
    if (!isAdmin) {
      alert('Apenas administradores podem remover profissionais.');
      return;
    }
    if (window.confirm('Tem certeza que deseja remover este profissional?')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
      }
    }
  };

  const openModal = (prof: Professional) => {
    setEditingProfessional(prof);
    setFormData({
      name: prof.name || '',
      email: prof.email || '',
      professionalId: prof.professionalId || '',
      specialty: prof.specialty || '',
      phone: prof.phone || '',
      rg: prof.rg || '',
      cpfCnpj: prof.cpfCnpj || '',
      address: prof.address || '',
      socialMedia: prof.socialMedia || ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProfessional(null);
  };

  if (loading) return <div className="p-4">Carregando profissionais...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Profissionais</h2>
          <p className="mt-1 text-sm text-gray-500">Gerencie o cadastro dos profissionais da clínica.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => openModal()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Profissional
          </button>
        )}
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {professionals.map((prof) => (
            <li key={prof.uid}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-blue-600 truncate">{prof.name}</p>
                      <p className="text-sm text-gray-500 truncate">{prof.specialty || 'Sem especialidade'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openModal(prof)}
                      className="p-2 text-gray-400 hover:text-blue-600"
                      title="Editar Profissional"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(prof.uid)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        title="Remover Profissional"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Mail className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                    {prof.email}
                  </div>
                  <div className="flex items-center">
                    <Phone className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                    {prof.phone || 'Não informado'}
                  </div>
                  <div className="flex items-center">
                    <Briefcase className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                    Registro: {prof.professionalId || 'Não informado'}
                  </div>
                  <div className="flex items-center">
                    <Hash className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                    CPF/CNPJ: {prof.cpfCnpj || 'Não informado'}
                  </div>
                  <div className="flex items-center">
                    <Hash className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                    RG: {prof.rg || 'Não informado'}
                  </div>
                  <div className="flex items-center">
                    <MapPin className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                    {prof.address || 'Não informado'}
                  </div>
                  {prof.socialMedia && (
                    <div className="flex items-center sm:col-span-2">
                      <Instagram className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                      {prof.socialMedia}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
          {professionals.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">Nenhum profissional encontrado.</li>
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
                  {editingProfessional ? 'Editar Profissional' : 'Novo Profissional'}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
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
                    <label className="block text-sm font-medium text-gray-700">E-mail (Acesso) *</label>
                    <input
                      type="email"
                      required
                      disabled={!!editingProfessional}
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border ${editingProfessional ? 'bg-gray-50 text-gray-500' : ''}`}
                    />
                  </div>
                  {!editingProfessional && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Senha Provisória *</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Especialidade</label>
                    <input
                      type="text"
                      value={formData.specialty}
                      onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Registro Profissional (CRM/CRP)</label>
                    <input
                      type="text"
                      value={formData.professionalId}
                      onChange={(e) => setFormData({...formData, professionalId: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">CPF ou CNPJ</label>
                    <input
                      type="text"
                      value={formData.cpfCnpj}
                      onChange={(e) => setFormData({...formData, cpfCnpj: e.target.value})}
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
                    <label className="block text-sm font-medium text-gray-700">Telefone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 11) val = val.slice(0, 11);
                        if (val.length > 2) {
                          val = `(${val.slice(0,2)}) ${val.slice(2)}`;
                        }
                        if (val.length > 10) {
                          val = `${val.slice(0,10)}-${val.slice(10)}`;
                        }
                        setFormData({...formData, phone: val});
                      }}
                      placeholder="(00) 00000-0000"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Redes Sociais (Instagram, LinkedIn)</label>
                    <input
                      type="text"
                      value={formData.socialMedia}
                      onChange={(e) => setFormData({...formData, socialMedia: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
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
                    disabled={isSubmitting}
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Salvando...' : 'Salvar'}
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
