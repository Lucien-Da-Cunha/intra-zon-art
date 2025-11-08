import { useState, useEffect } from 'react';
import { expensesAPI } from '../api/api';
import { useAuthStore } from '../store/authStore';

export default function Expenses() {
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    start_date: '',
    end_date: ''
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    category: 'Transport',
    expense_date: new Date().toISOString().split('T')[0]
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const categories = [
    'Transport',
    'Hébergement',
    'Restauration',
    'Fournitures',
    'Formation',
    'Télécom',
    'Autre'
  ];

  const statusLabels: any = {
    pending: { label: 'En attente', color: '#f59e0b', bg: '#fef3c7' },
    approved: { label: 'Approuvée', color: '#10b981', bg: '#d1fae5' },
    rejected: { label: 'Rejetée', color: '#ef4444', bg: '#fee2e2' }
  };

  useEffect(() => {
    loadExpenses();
    loadStats();
  }, [filters]);

  const loadExpenses = async () => {
    try {
      const response = await expensesAPI.getAll(filters);
      setExpenses(response.data.expenses || []);
    } catch (error) {
      console.error('Erreur chargement dépenses:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await expensesAPI.getStats(filters);
      setStats(response.data);
    } catch (error) {
      console.error('Erreur chargement statistiques:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (selectedExpense) {
        await expensesAPI.update(selectedExpense.id, formData);
      } else {
        await expensesAPI.create(formData, receiptFile || undefined);
      }
      
      setShowForm(false);
      setSelectedExpense(null);
      resetForm();
      loadExpenses();
      loadStats();
    } catch (error: any) {
      console.error('Erreur:', error);
      alert('Erreur: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) return;
    
    try {
      await expensesAPI.delete(id);
      loadExpenses();
      loadStats();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleEdit = (expense: any) => {
    setSelectedExpense(expense);
    setFormData({
      title: expense.title,
      description: expense.description || '',
      amount: expense.amount,
      category: expense.category,
      expense_date: expense.expense_date.split('T')[0]
    });
    setShowForm(true);
  };

  const handleApprove = async (id: number, newStatus: string) => {
    try {
      const expense = expenses.find(e => e.id === id);
      await expensesAPI.update(id, { ...expense, status: newStatus });
      loadExpenses();
      loadStats();
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const downloadReceipt = async (id: number, title: string) => {
    try {
      const response = await expensesAPI.downloadReceipt(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `recu_${title.replace(/\s+/g, '_')}.pdf`;
      link.click();
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      alert('Erreur lors du téléchargement du reçu');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      amount: '',
      category: 'Transport',
      expense_date: new Date().toISOString().split('T')[0]
    });
    setReceiptFile(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="container">
      <h1>Gestion des Dépenses</h1>

      {/* Statistiques */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div className="card" style={{ textAlign: 'center', padding: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{formatCurrency(parseFloat(stats.stats.total_amount))}</div>
            <div style={{ fontSize: '14px', marginTop: '5px', opacity: 0.9 }}>Montant total</div>
          </div>
          
          <div className="card" style={{ textAlign: 'center', padding: '20px', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.stats.pending_count}</div>
            <div style={{ fontSize: '14px', marginTop: '5px', opacity: 0.9 }}>En attente</div>
            <div style={{ fontSize: '12px', marginTop: '2px', opacity: 0.8 }}>{formatCurrency(parseFloat(stats.stats.pending_amount))}</div>
          </div>
          
          <div className="card" style={{ textAlign: 'center', padding: '20px', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.stats.approved_count}</div>
            <div style={{ fontSize: '14px', marginTop: '5px', opacity: 0.9 }}>Approuvées</div>
            <div style={{ fontSize: '12px', marginTop: '2px', opacity: 0.8 }}>{formatCurrency(parseFloat(stats.stats.approved_amount))}</div>
          </div>
          
          <div className="card" style={{ textAlign: 'center', padding: '20px', background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.stats.rejected_count}</div>
            <div style={{ fontSize: '14px', marginTop: '5px', opacity: 0.9 }}>Rejetées</div>
            <div style={{ fontSize: '12px', marginTop: '2px', opacity: 0.8 }}>{formatCurrency(parseFloat(stats.stats.rejected_amount))}</div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <h3 style={{ marginTop: 0 }}>Filtres</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Statut</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
            >
              <option value="">Tous</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvée</option>
              <option value="rejected">Rejetée</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Catégorie</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
            >
              <option value="">Toutes</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Date début</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({...filters, start_date: e.target.value})}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Date fin</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({...filters, end_date: e.target.value})}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
            />
          </div>
        </div>
      </div>

      {/* Bouton nouvelle dépense */}
      <button
        onClick={() => {
          setShowForm(!showForm);
          setSelectedExpense(null);
          resetForm();
        }}
        className="btn-primary"
        style={{ marginBottom: '20px' }}
      >
        {showForm ? '✕ Annuler' : '+ Nouvelle Dépense'}
      </button>

      {/* Formulaire */}
      {showForm && (
        <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
          <h3 style={{ marginTop: 0 }}>
            {selectedExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
          </h3>
          
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                  Titre *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                  placeholder="Ex: Taxi vers aéroport"
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Détails supplémentaires..."
                  rows={3}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Montant (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    required
                    placeholder="0.00"
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Catégorie *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => setFormData({...formData, expense_date: e.target.value})}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                  />
                </div>
              </div>

              {!selectedExpense && (
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Reçu (PDF ou image)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                  />
                </div>
              )}

              <button type="submit" className="btn-primary">
                {selectedExpense ? 'Mettre à jour' : 'Créer la dépense'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des dépenses */}
      <div className="card" style={{ padding: '0' }}>
        {expenses.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
            Aucune dépense trouvée
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Titre</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Catégorie</th>
                  <th style={{ padding: '15px', textAlign: 'right' }}>Montant</th>
                  {user?.role === 'admin' && <th style={{ padding: '15px', textAlign: 'left' }}>Utilisateur</th>}
                  <th style={{ padding: '15px', textAlign: 'center' }}>Statut</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>Reçu</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{ padding: '15px' }}>
                      {new Date(expense.expense_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ fontWeight: '500' }}>{expense.title}</div>
                      {expense.description && (
                        <div style={{ fontSize: '13px', color: '#666', marginTop: '3px' }}>
                          {expense.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '15px' }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        fontSize: '13px',
                        backgroundColor: '#e0e7ff',
                        color: '#4338ca'
                      }}>
                        {expense.category}
                      </span>
                    </td>
                    <td style={{ padding: '15px', textAlign: 'right', fontWeight: '600', fontSize: '16px' }}>
                      {formatCurrency(parseFloat(expense.amount))}
                    </td>
                    {user?.role === 'admin' && (
                      <td style={{ padding: '15px', fontSize: '13px' }}>
                        {expense.user_name}
                      </td>
                    )}
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <span style={{
                        padding: '5px 12px',
                        borderRadius: '15px',
                        fontSize: '13px',
                        fontWeight: '500',
                        backgroundColor: statusLabels[expense.status]?.bg,
                        color: statusLabels[expense.status]?.color
                      }}>
                        {statusLabels[expense.status]?.label}
                      </span>
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      {expense.receipt_path && (
                        <button
                          onClick={() => downloadReceipt(expense.id, expense.title)}
                          style={{
                            padding: '5px 10px',
                            fontSize: '12px',
                            backgroundColor: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            borderRadius: '5px',
                            cursor: 'pointer'
                          }}
                        >
                          Voir reçu
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        {expense.status === 'pending' && (
                          <>
                            {expense.user_id === user?.id && (
                              <button
                                onClick={() => handleEdit(expense)}
                                style={{
                                  padding: '5px 10px',
                                  fontSize: '12px',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '5px',
                                  cursor: 'pointer'
                                }}
                              >
                                ✏️ Modifier
                              </button>
                            )}
                            
                            {user?.role === 'admin' && (
                              <>
                                <button
                                  onClick={() => handleApprove(expense.id, 'approved')}
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: '12px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  ✓ Approuver
                                </button>
                                <button
                                  onClick={() => handleApprove(expense.id, 'rejected')}
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: '12px',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  ✕ Rejeter
                                </button>
                              </>
                            )}
                          </>
                        )}
                        
                        {(expense.user_id === user?.id || user?.role === 'admin') && (
                          <button
                            onClick={() => handleDelete(expense.id)}
                            style={{
                              padding: '5px 10px',
                              fontSize: '12px',
                              backgroundColor: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: 'pointer'
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
