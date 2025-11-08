import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { salesAPI, expensesAPI } from '../api/api';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [salesStats, setSalesStats] = useState<any>(null);
  const [expensesStats, setExpensesStats] = useState<any>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Charger les stats
      const [salesStatsRes, expensesStatsRes, salesListRes] = await Promise.all([
        salesAPI.getStats().catch(() => ({ data: {} })),
        expensesAPI.getStats().catch(() => ({ data: {} })),
        salesAPI.getAll({ status: '', limit: 5 }).catch(() => ({ data: { sales: [] } }))
      ]);

      setSalesStats(salesStatsRes.data);
      setExpensesStats(expensesStatsRes.data);
      setRecentSales(salesListRes.data.sales || []);

      // Générer les données de revenus par mois
      await generateRevenueData();
      
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRevenueData = async () => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentMonth = new Date().getMonth();
    const data = [];

    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const year = new Date().getFullYear();
      const startDate = new Date(year, monthIndex, 1).toISOString().split('T')[0];
      const endDate = new Date(year, monthIndex + 1, 0).toISOString().split('T')[0];

      try {
        const [salesRes, expensesRes] = await Promise.all([
          salesAPI.getStats({ start_date: startDate, end_date: endDate }).catch(() => ({ data: { totalRevenue: 0 } })),
          expensesAPI.getStats({ start_date: startDate, end_date: endDate }).catch(() => ({ data: { stats: { approved_amount: 0 } } }))
        ]);

        data.push({
          month: months[monthIndex],
          revenue: parseFloat(salesRes.data.totalRevenue || 0),
          expenses: parseFloat(expensesRes.data.stats?.approved_amount || 0),
          profit: parseFloat(salesRes.data.totalRevenue || 0) - parseFloat(expensesRes.data.stats?.approved_amount || 0)
        });
      } catch (error) {
        data.push({
          month: months[monthIndex],
          revenue: 0,
          expenses: 0,
          profit: 0
        });
      }
    }

    setRevenueData(data);
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
          Tableau de bord
        </h1>
        <p style={{ fontSize: '16px', color: '#6b7280' }}>
          Bienvenue, {user?.first_name} {user?.last_name}
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
          title="Chiffre d'affaires"
          value={formatCurrency(salesStats?.totalRevenue || 0)}
          subtitle={`${salesStats?.totalSales || 0} ventes`}
          color="#3b82f6"
          bgColor="#eff6ff"
        />
        <StatCard
          title="Vente moyenne"
          value={formatCurrency(salesStats?.averageSale || 0)}
          subtitle="Par transaction"
          color="#10b981"
          bgColor="#f0fdf4"
        />
        <StatCard
          title="En attente"
          value={formatCurrency(salesStats?.pendingAmount || 0)}
          subtitle="À valider"
          color="#f59e0b"
          bgColor="#fffbeb"
        />
        <StatCard
          title="Dépenses"
          value={formatCurrency(parseFloat(expensesStats?.stats?.approved_amount || 0))}
          subtitle={`${expensesStats?.stats?.approved_count || 0} approuvées`}
          color="#ef4444"
          bgColor="#fef2f2"
        />
      </div>

      {/* Graphique des revenus */}
      <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '24px' }}>
          Évolution des revenus (6 derniers mois)
        </h2>
        
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '600px', height: '300px', position: 'relative' }}>
            {/* Graphique à courbes */}
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

              {/* Courbes */}
              {revenueData.length > 0 && (() => {
                const maxValue = Math.max(...revenueData.map(d => Math.max(d.revenue, d.expenses)));
                const width = 100 / revenueData.length;
                const xStep = (100 - 10) / (revenueData.length - 1);

                // Points pour la courbe des revenus
                const revenuePoints = revenueData.map((data, i) => {
                  const x = 50 + (i * xStep * 5.5);
                  const y = 250 - ((data.revenue / (maxValue || 1)) * 200);
                  return `${x},${y}`;
                }).join(' ');

                // Points pour la courbe des dépenses
                const expensesPoints = revenueData.map((data, i) => {
                  const x = 50 + (i * xStep * 5.5);
                  const y = 250 - ((data.expenses / (maxValue || 1)) * 200);
                  return `${x},${y}`;
                }).join(' ');

                return (
                  <>
                    {/* Courbe des revenus */}
                    <polyline
                      points={revenuePoints}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Points de la courbe des revenus */}
                    {revenueData.map((data, i) => {
                      const x = 50 + (i * xStep * 5.5);
                      const y = 250 - ((data.revenue / (maxValue || 1)) * 200);
                      return (
                        <circle
                          key={`rev-${i}`}
                          cx={x}
                          cy={y}
                          r="5"
                          fill="#3b82f6"
                          stroke="white"
                          strokeWidth="2"
                        >
                          <title>{`Revenus: ${formatCurrency(data.revenue)}`}</title>
                        </circle>
                      );
                    })}

                    {/* Courbe des dépenses */}
                    <polyline
                      points={expensesPoints}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Points de la courbe des dépenses */}
                    {revenueData.map((data, i) => {
                      const x = 50 + (i * xStep * 5.5);
                      const y = 250 - ((data.expenses / (maxValue || 1)) * 200);
                      return (
                        <circle
                          key={`exp-${i}`}
                          cx={x}
                          cy={y}
                          r="5"
                          fill="#ef4444"
                          stroke="white"
                          strokeWidth="2"
                        >
                          <title>{`Dépenses: ${formatCurrency(data.expenses)}`}</title>
                        </circle>
                      );
                    })}

                    {/* Labels des mois */}
                    {revenueData.map((data, i) => {
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

        {/* Légende */}
        <div style={{ display: 'flex', gap: '24px', marginTop: '24px', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#3b82f6', borderRadius: '2px' }} />
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Revenus</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#ef4444', borderRadius: '2px' }} />
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Dépenses</span>
          </div>
        </div>
      </div>

      {/* Ventes récentes */}
      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
          Ventes récentes
        </h2>
        
        {recentSales.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
            Aucune vente récente
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                    Date
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                    Client
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                    Produit/Service
                  </th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                    Montant
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale) => (
                  <tr key={sale.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                      {new Date(sale.sale_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                      {sale.customer_name}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                      {sale.product_service}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#111827', fontWeight: '600', textAlign: 'right' }}>
                      {formatCurrency(parseFloat(sale.amount))}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: 
                          sale.status === 'completed' ? '#d1fae5' :
                          sale.status === 'pending' ? '#fef3c7' : '#fee2e2',
                        color:
                          sale.status === 'completed' ? '#065f46' :
                          sale.status === 'pending' ? '#92400e' : '#991b1b'
                      }}>
                        {sale.status === 'completed' ? 'Complétée' :
                         sale.status === 'pending' ? 'En attente' : 'Annulée'}
                      </span>
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
