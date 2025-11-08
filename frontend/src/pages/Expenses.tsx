import { useState, useEffect } from 'react';
import { expensesAPI } from '../api/api';
import { useAuthStore } from '../store/authStore';

export default function Expenses() {
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    loadExpenses();
    loadStats();
    generateExpensesData();
  }, [filters]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const response = await expensesAPI.getAll(filters);
      setExpenses(response.data.expenses || []);
    } catch (error) {
      console.error('Erreur chargement dépenses:', error);
    } finally {
      setLoading(false);
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

  const generateExpensesData = async () => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentMonth = new Date().getMonth();
    const data = [];

    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const year = new Date().getFullYear();
      const startDate = new Date(year, monthIndex, 1).toISOString().split('T')[0];
      const endDate = new Date(year, monthIndex + 1, 0).toISOString().split('T')[0];

      try {
        const res = await expensesAPI.getStats({ start_date: startDate, end_date: endDate }).catch(() => ({ data: { stats: { total_amount: 0 } } }));
        data.push({
          month: months[monthIndex],
          amount: parseFloat(res.data.stats?.total_amount || 0)
        });
      } catch (error) {
        data.push({
          month: months[monthIndex],
          amount: 0
        });
      }
    }

    setExpensesData(data);
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
      generateExpensesData();
    } catch (error: any) {
      console.error('Erreur:', error);
      alert('Erreur: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await expensesAPI.delete(id);
      loadExpenses();
      loadStats();
      generateExpensesData();
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
      generateExpensesData();
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

  const StatCard = ({ title, value, subtitle, color, bgColor }: any) => (
    <div className="card" style={{ 
      padding: '24px', 
      borderLeft: `4px solid ${color}`,
      backgroundColor: bgColor || 'white'
    }}>
      <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500', marginBottom: '8px' }}>
        {title}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: '13px', color: '#6b7280' }}>
          {subtitle}
        </div>
      )}
    </div>
  );

  const getStatusBadge = (status: string) => {
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
        backgroundColor: 
          status === 'approved' ? '#d1fae5' :
          status === 'pending' ? '#fef3c7' : '#fee2e2',
        color:
          status === 'approved' ? '#065f46' :
          status === 'pending' ? '#92400e' : '#991b1b'
      }}>
        {status === 'approved' ? 'Approuvée' :
         status === 'pending' ? 'En attente' : 'Rejetée'}
      </span>
    );
  };

  if (loading && !stats) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>Chargement des données...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
          Gestion des Dépenses
        </h1>
        <p style={{ fontSize: '16px', color: '#6b7280' }}>
          Suivi et gestion des notes de frais
        </p>
      </div>

      {/* Statistiques principales */}
      {stats && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '20px', 
          marginBottom: '32px' 
        }}
        className="stats-grid"
        >
          <StatCard
            title="Montant total"
            value={formatCurrency(parseFloat(stats.stats.total_amount))}
            subtitle="Toutes dépenses"
            color="#7c3aed"
            bgColor="#faf5ff"
          />
          <StatCard
            title="En attente"
            value={stats.stats.pending_count}
            subtitle={formatCurrency(parseFloat(stats.stats.pending_amount))}
            color="#f59e0b"
            bgColor="#fffbeb"
          />
          <StatCard
            title="Approuvées"
            value={stats.stats.approved_count}
            subtitle={formatCurrency(parseFloat(stats.stats.approved_amount))}
            color="#10b981"
            bgColor="#f0fdf4"
          />
          <StatCard
            title="Rejetées"
            value={stats.stats.rejected_count}
            subtitle={formatCurrency(parseFloat(stats.stats.rejected_amount))}
            color="#ef4444"
            bgColor="#fef2f2"
          />
        </div>
      )}

      {/* Graphique des dépenses */}
      <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '24px' }}>
          Évolution des dépenses (6 derniers mois)
        </h2>
        
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '600px', height: '300px', position: 'relative' }}>
            <svg width="100%" height="250" style={{ overflow: 'visible' }}>
              {/* Grille horizontale */}
              {[0, 25, 50, 75, 100].map((percent) => (
                <g key={percent}>
                  <line
                    x1="40"
                    y1={50 + (200 * (100 - percent)) / 100}
                    x2="100%"
                    y2={50 + (200 * (100 - percent)) / 100}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                  <text
                    x="5"
                    y={50 + (200 * (100 - percent)) / 100 + 4}
                    fontSize="11"
                    fill="#9ca3af"
                  >
                    {percent}%
                  </text>
                </g>
              ))}

              {/* Courbe */}
              {expensesData.length > 0 && (() => {
                const maxValue = Math.max(...expensesData.map(d => d.amount), 1);
                const xStep = (100 - 10) / (expensesData.length - 1);

                const points = expensesData.map((data, i) => {
                  const x = 50 + (i * xStep * 5.5);
                  const y = 250 - ((data.amount / maxValue) * 200);
                  return `${x},${y}`;
                }).join(' ');

                return (
                  <>
                    {/* Zone sous la courbe */}
                    <polygon
                      points={`50,250 ${points} ${50 + ((expensesData.length - 1) * xStep * 5.5)},250`}
                      fill="url(#gradientExpenses)"
                      opacity="0.3"
                    />
                    
                    {/* Gradient */}
                    <defs>
                      <linearGradient id="gradientExpenses" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.1" />
                      </linearGradient>
                    </defs>

                    {/* Courbe */}
                    <polyline
                      points={points}
                      fill="none"
                      stroke="#7c3aed"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    
                    {/* Points */}
                    {expensesData.map((data, i) => {
                      const x = 50 + (i * xStep * 5.5);
                      const y = 250 - ((data.amount / maxValue) * 200);
                      return (
                        <circle
                          key={`point-${i}`}
                          cx={x}
                          cy={y}
                          r="5"
                          fill="#7c3aed"
                          stroke="white"
                          strokeWidth="2"
                        >
                          <title>{`${data.month}: ${formatCurrency(data.amount)}`}</title>
                        </circle>
                      );
                    })}

                    {/* Labels des mois */}
                    {expensesData.map((data, i) => {
                      const x = 50 + (i * xStep * 5.5);
                      return (
                        <text
                          key={`label-${i}`}
                          x={x}
                          y="270"
                          textAnchor="middle"
                          fontSize="12"
                          fill="#6b7280"
                          fontWeight="500"
                        >
                          {data.month}
                        </text>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <h3 style={{ marginTop: 0, fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
          Filtres
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Statut
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">Tous</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvée</option>
              <option value="rejected">Rejetée</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Catégorie
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">Toutes</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Date début
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({...filters, start_date: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Date fin
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({...filters, end_date: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Liste des dépenses */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#111827' }}>
            Liste des dépenses
          </h2>
          <button 
            onClick={() => {
              setSelectedExpense(null);
              resetForm();
              setShowForm(true);
            }}
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
            + Nouvelle dépense
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Date
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Titre
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Catégorie
                </th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Montant
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Statut
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Reçu
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                    {new Date(expense.expense_date).toLocaleDateString('fr-FR')}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                    {expense.title}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                    {expense.category}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#111827', fontWeight: '600', textAlign: 'right' }}>
                    {formatCurrency(parseFloat(expense.amount))}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {getStatusBadge(expense.status)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {expense.receipt_path ? (
                      <button
                        onClick={() => downloadReceipt(expense.id, expense.title)}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Voir reçu
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {expense.status === 'pending' && (
                        <button 
                          onClick={() => handleEdit(expense)}
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
                      )}
                      
                      {isAdmin && expense.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleApprove(expense.id, 'approved')}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Approuver
                          </button>
                          <button 
                            onClick={() => handleApprove(expense.id, 'rejected')}
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
                            Rejeter
                          </button>
                        </>
                      )}

                      {(expense.status === 'pending' || isAdmin) && (
                        <button 
                          onClick={() => handleDelete(expense.id)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {expenses.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
            Aucune dépense enregistrée
          </div>
        )}
      </div>

      {/* Modal Créer/Éditer Dépense */}
      {showForm && (
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
              {selectedExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                  Titre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Taxi aéroport"
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
                    Catégorie *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Montant (€) *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="50.00"
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
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
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
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Détails supplémentaires..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {!selectedExpense && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Reçu (PDF)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setSelectedExpense(null);
                    resetForm();
                  }}
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
                  {selectedExpense ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
