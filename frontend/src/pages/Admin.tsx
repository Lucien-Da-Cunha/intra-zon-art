import { useState, useEffect } from 'react';
import { adminAPI } from '../api/api';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'manager' | 'employee';
  department_id: number;
  position: string;
  is_active: boolean;
  department_name?: string;
}

interface Department {
  id: number;
  name: string;
  description: string;
}

function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'employee' as 'admin' | 'manager' | 'employee',
    department_id: 0,
    position: ''
  });

  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await adminAPI.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await adminAPI.getDepartments();
      setDepartments(response.data);
    } catch (error) {
      console.error('Erreur chargement départements:', error);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'employee',
      department_id: departments.length > 0 ? departments[0].id : 0,
      position: ''
    });
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      department_id: user.department_id,
      position: user.position
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingUser) {
        // Mise à jour
        await adminAPI.updateUser(editingUser.id, formData);
        alert('Utilisateur modifié avec succès !');
      } else {
        // Création
        if (!formData.password) {
          alert('Le mot de passe est requis pour créer un utilisateur');
          return;
        }
        await adminAPI.createUser(formData);
        alert('Utilisateur créé avec succès !');
      }
      
      setShowModal(false);
      loadUsers();
    } catch (error: any) {
      console.error('Erreur sauvegarde utilisateur:', error);
      alert(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (userId: number, userName: string) => {
    try {
      await adminAPI.deleteUser(userId);
      alert('Utilisateur supprimé avec succès !');
      loadUsers();
    } catch (error: any) {
      console.error('Erreur suppression utilisateur:', error);
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
          Administration
        </h1>
        <p style={{ fontSize: '16px', color: '#6b7280' }}>
          Gestion des utilisateurs et des départements
        </p>
      </div>

      {/* Statistiques */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '20px', 
        marginBottom: '32px' 
      }}>
        <div className="card" style={{ 
          padding: '24px', 
          borderLeft: '4px solid #3b82f6',
          backgroundColor: '#eff6ff'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500', marginBottom: '8px' }}>
            Total utilisateurs
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
            {users.length}
          </div>
        </div>

        <div className="card" style={{ 
          padding: '24px', 
          borderLeft: '4px solid #ef4444',
          backgroundColor: '#fef2f2'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500', marginBottom: '8px' }}>
            Administrateurs
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
            {users.filter(u => u.role === 'admin').length}
          </div>
        </div>

        <div className="card" style={{ 
          padding: '24px', 
          borderLeft: '4px solid #f59e0b',
          backgroundColor: '#fffbeb'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500', marginBottom: '8px' }}>
            Managers
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
            {users.filter(u => u.role === 'manager').length}
          </div>
        </div>

        <div className="card" style={{ 
          padding: '24px', 
          borderLeft: '4px solid #10b981',
          backgroundColor: '#f0fdf4'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500', marginBottom: '8px' }}>
            Employés
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
            {users.filter(u => u.role === 'employee').length}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#111827' }}>
            Gestion des utilisateurs
          </h2>
          <button 
            onClick={openCreateModal}
            style={{
              padding: '10px 20px',
              backgroundColor: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            + Ajouter un utilisateur
          </button>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Nom
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Email
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Rôle
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Département
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Poste
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                    {user.first_name} {user.last_name}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                    {user.email}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: user.role === 'admin' ? '#fef2f2' : user.role === 'manager' ? '#fffbeb' : '#eff6ff',
                      color: user.role === 'admin' ? '#991b1b' : user.role === 'manager' ? '#92400e' : '#1e40af'
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                    {user.department_name}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                    {user.position}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                      <button 
                        onClick={() => openEditModal(user)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Éditer
                      </button>
                      <button 
                        onClick={() => handleDelete(user.id, `${user.first_name} ${user.last_name}`)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
            Aucun utilisateur trouvé
          </div>
        )}
      </div>

      {/* Modal Créer/Éditer Utilisateur */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxHeight: '90vh', overflow: 'auto', padding: '24px' }}>
            <h2 style={{ marginTop: 0, fontSize: '22px', fontWeight: '600', color: '#111827' }}>
              {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Prénom *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Nom *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                  Mot de passe {editingUser ? '(laisser vide pour ne pas changer)' : '*'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? 'Laisser vide pour ne pas modifier' : ''}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Rôle *
                  </label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Département *
                  </label>
                  <select
                    required
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: parseInt(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                  Poste *
                </label>
                <input
                  type="text"
                  required
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Ex: Développeur, Manager Commercial..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#7c3aed',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {editingUser ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
