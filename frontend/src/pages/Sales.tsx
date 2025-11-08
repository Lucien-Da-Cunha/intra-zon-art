import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { salesAPI, adminAPI } from '../api/api';

interface Sale {
  id: number;
  customer_name: string;
  product_service: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  sale_date: string;
  description?: string;
  user_id: number;
  first_name?: string;
  last_name?: string;
  contract_file_name?: string;
  contract_file_path?: string;
  invoice_file_name?: string;
  invoice_file_path?: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

interface Stats {
  totalRevenue: number;
  totalSales: number;
  averageSale: number;
  pendingAmount: number;
}

function Sales() {
  const { user } = useAuthStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    customer_name: '',
    product_service: '',
    amount: '',
    status: 'pending' as 'pending' | 'completed' | 'cancelled',
    description: '',
    sale_date: new Date().toISOString().split('T')[0],
    user_id: 0
  });

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    loadSales();
    loadStats();
    generateSalesData();
    if (canManage) {
      loadUsers();
    }
  }, []);

  const loadSales = async () => {
    try {
      const response = await salesAPI.getAll();
      setSales(response.data.sales || response.data);
    } catch (error) {
      console.error('Erreur chargement ventes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await salesAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  };

  const generateSalesData = async () => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentMonth = new Date().getMonth();
    const data = [];

    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const year = new Date().getFullYear();
      const startDate = new Date(year, monthIndex, 1).toISOString().split('T')[0];
      const endDate = new Date(year, monthIndex + 1, 0).toISOString().split('T')[0];

      try {
        const res = await salesAPI.getStats({ start_date: startDate, end_date: endDate }).catch(() => ({ data: { totalRevenue: 0 } }));
        data.push({
          month: months[monthIndex],
          revenue: parseFloat(res.data.totalRevenue || 0)
        });
      } catch (error) {
        data.push({
          month: months[monthIndex],
          revenue: 0
        });
      }
    }

    setSalesData(data);
  };

  const loadUsers = async () => {
    try {
      const response = await adminAPI.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    }
  };

  const openCreateModal = () => {
    setEditingSale(null);
    setFormData({
      customer_name: '',
      product_service: '',
      amount: '',
      status: 'pending',
      description: '',
      sale_date: new Date().toISOString().split('T')[0],
      user_id: canManage ? users[0]?.id || 0 : user?.id || 0
    });
    setShowModal(true);
  };

  const openEditModal = (sale: Sale) => {
    setEditingSale(sale);
    setFormData({
      customer_name: sale.customer_name,
      product_service: sale.product_service,
      amount: sale.amount.toString(),
      status: sale.status,
      description: sale.description || '',
      sale_date: sale.sale_date.split('T')[0],
      user_id: sale.user_id
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSale) {
        await salesAPI.update(editingSale.id, formData);
      } else {
        await salesAPI.create(formData);
      }
      setShowModal(false);
      loadSales();
      loadStats();
      generateSalesData();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    try {
      await salesAPI.delete(id);
      loadSales();
      loadStats();
      generateSalesData();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleFileUpload = async (saleId: number, type: 'contract' | 'invoice', file: File) => {
    try {
      await salesAPI.uploadFile(saleId, type, file);
      alert('Document téléchargé avec succès');
      loadSales();
    } catch (error) {
      console.error('Erreur upload:', error);
      alert('Erreur lors du téléchargement');
    }
  };

  const handleFileDownload = (saleId: number, type: 'contract' | 'invoice') => {
    window.open(`http://localhost:3001/api/sales/${saleId}/${type}`, '_blank');
  };

  const handleFileDelete = async (saleId: number, type: 'contract' | 'invoice') => {
    try {
      await salesAPI.deleteFile(saleId, type);
      alert('Document supprimé');
      loadSales();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
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
          status === 'completed' ? '#d1fae5' :
          status === 'pending' ? '#fef3c7' : '#fee2e2',
        color:
          status === 'completed' ? '#065f46' :
          status === 'pending' ? '#92400e' : '#991b1b'
      }}>
        {status === 'completed' ? 'Complétée' :
         status === 'pending' ? 'En attente' : 'Annulée'}
      </span>
    );
  };

  if (loading) {
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
          Chiffre d'affaires
        </h1>
        <p style={{ fontSize: '16px', color: '#6b7280' }}>
          Gestion des ventes et suivi du chiffre d'affaires
        </p>
      </div>

      {/* Statistiques principales */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: '20px', 
        marginBottom: '32px' 
      }}
      className="stats-grid"
      >
        <StatCard
          title="Chiffre d'affaires total"
          value={formatCurrency(stats?.totalRevenue || 0)}
          subtitle={`${stats?.totalSales || 0} ventes`}
          color="#10b981"
          bgColor="#f0fdf4"
        />
        <StatCard
          title="Vente moyenne"
          value={formatCurrency(stats?.averageSale || 0)}
          subtitle="Par transaction"
          color="#3b82f6"
          bgColor="#eff6ff"
        />
        <StatCard
          title="Montant en attente"
          value={formatCurrency(stats?.pendingAmount || 0)}
          subtitle="À valider"
          color="#f59e0b"
          bgColor="#fffbeb"
        />
        <StatCard
          title="Nombre de ventes"
          value={stats?.totalSales || 0}
          subtitle="Total"
          color="#7c3aed"
          bgColor="#faf5ff"
        />
      </div>

      {/* Graphique des ventes */}
      <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '24px' }}>
          Évolution des ventes (6 derniers mois)
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
              {salesData.length > 0 && (() => {
                const maxValue = Math.max(...salesData.map(d => d.revenue), 1);
                const xStep = (100 - 10) / (salesData.length - 1);

                const points = salesData.map((data, i) => {
                  const x = 50 + (i * xStep * 5.5);
                  const y = 250 - ((data.revenue / maxValue) * 200);
                  return `${x},${y}`;
                }).join(' ');

                return (
                  <>
                    {/* Zone sous la courbe */}
                    <polygon
                      points={`50,250 ${points} ${50 + ((salesData.length - 1) * xStep * 5.5)},250`}
                      fill="url(#gradient)"
                      opacity="0.3"
                    />
                    
                    {/* Gradient */}
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
                      </linearGradient>
                    </defs>

                    {/* Courbe */}
                    <polyline
                      points={points}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    
                    {/* Points */}
                    {salesData.map((data, i) => {
                      const x = 50 + (i * xStep * 5.5);
                      const y = 250 - ((data.revenue / maxValue) * 200);
                      return (
                        <circle
                          key={`point-${i}`}
                          cx={x}
                          cy={y}
                          r="5"
                          fill="#10b981"
                          stroke="white"
                          strokeWidth="2"
                        >
                          <title>{`${data.month}: ${formatCurrency(data.revenue)}`}</title>
                        </circle>
                      );
                    })}

                    {/* Labels des mois */}
                    {salesData.map((data, i) => {
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

      {/* Tableau des ventes */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#111827' }}>
            Historique des ventes
          </h2>
          <button 
            onClick={openCreateModal}
            style={{
              padding: '10px 20px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            + Ajouter une vente
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {canManage && (
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                    Vendeur
                  </th>
                )}
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Client
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Produit/Service
                </th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Montant
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Date
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Statut
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Documents
                </th>
                {canManage && (
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  {canManage && (
                    <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                      {sale.first_name} {sale.last_name}
                    </td>
                  )}
                  <td style={{ padding: '12px', fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                    {sale.customer_name}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                    {sale.product_service}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#111827', fontWeight: '600', textAlign: 'right' }}>
                    {formatCurrency(Number(sale.amount))}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                    {new Date(sale.sale_date).toLocaleDateString('fr-FR')}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {getStatusBadge(sale.status)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                      {/* Contrat */}
                      {sale.contract_file_name ? (
                        <button
                          onClick={() => handleFileDownload(sale.id, 'contract')}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          Contrat
                        </button>
                      ) : (
                        <label style={{ cursor: 'pointer' }}>
                          <input
                            type="file"
                            accept="application/pdf"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(sale.id, 'contract', file);
                            }}
                          />
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#e5e7eb',
                            color: '#6b7280',
                            borderRadius: '4px',
                            fontSize: '11px',
                            display: 'inline-block'
                          }}>
                            + Contrat
                          </span>
                        </label>
                      )}

                      {/* Facture */}
                      {sale.invoice_file_name ? (
                        <button
                          onClick={() => handleFileDownload(sale.id, 'invoice')}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          Facture
                        </button>
                      ) : (
                        <label style={{ cursor: 'pointer' }}>
                          <input
                            type="file"
                            accept="application/pdf"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(sale.id, 'invoice', file);
                            }}
                          />
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#e5e7eb',
                            color: '#6b7280',
                            borderRadius: '4px',
                            fontSize: '11px',
                            display: 'inline-block'
                          }}>
                            + Facture
                          </span>
                        </label>
                      )}
                    </div>
                  </td>
                  {canManage && (
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        <button 
                          onClick={() => openEditModal(sale)}
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
                          onClick={() => handleDelete(sale.id, sale.customer_name)}
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
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sales.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
            Aucune vente enregistrée
          </div>
        )}
      </div>

      {/* Modal Créer/Éditer Vente */}
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
              {editingSale ? 'Modifier la vente' : 'Nouvelle vente'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              {canManage && (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Vendeur *
                  </label>
                  <select
                    required
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: parseInt(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                  Nom du client *
                </label>
                <input
                  type="text"
                  required
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Ex: Entreprise ABC"
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
                  Produit/Service *
                </label>
                <input
                  type="text"
                  required
                  value={formData.product_service}
                  onChange={(e) => setFormData({ ...formData, product_service: e.target.value })}
                  placeholder="Ex: Consultation, Formation..."
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
                  Montant (€) *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="5000.00"
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
                    Statut *
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="pending">En attente</option>
                    <option value="completed">Complétée</option>
                    <option value="cancelled">Annulée</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.sale_date}
                    onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
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

              <div style={{ marginBottom: '20px' }}>
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
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {editingSale ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sales;
