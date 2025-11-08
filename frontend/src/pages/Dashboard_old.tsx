import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { messagesAPI, salesAPI, adminAPI } from '../api/api';

interface Stats {
  unreadMessages: number;
  totalSales: number;
  activeUsers: number;
}

function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState<Stats>({
    unreadMessages: 0,
    totalSales: 0,
    activeUsers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Charger les statistiques en parallèle
      const [conversationsRes, salesRes, usersRes] = await Promise.all([
        messagesAPI.getConversations().catch(() => ({ data: [] })),
        salesAPI.getStats().catch(() => ({ data: { total: 0 } })),
        user?.role === 'admin' 
          ? adminAPI.getUsers().catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] })
      ]);

      // Calculer le nombre de messages non lus
      const conversationsData = conversationsRes.data?.conversations || conversationsRes.data || [];
      const conversations = Array.isArray(conversationsData) ? conversationsData : [];
      const unread = conversations.reduce((sum: number, conv: any) => sum + (conv.unread_count || 0), 0);

      // Total des ventes
      const salesData = salesRes.data;
      const total = salesData.totalRevenue || 0;

      // Nombre d'utilisateurs actifs
      const users = usersRes.data || [];
      const activeCount = users.filter((u: any) => u.is_active).length;

      setStats({
        unreadMessages: unread,
        totalSales: parseFloat(total),
        activeUsers: activeCount
      });
    } catch (error) {
      console.error('Erreur chargement statistiques:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>📊 Tableau de bord</h1>
      <p style={{ fontSize: '18px', color: '#666' }}>
        Bienvenue, <strong>{user?.first_name} {user?.last_name}</strong> ! 
        <span style={{ 
          marginLeft: '10px', 
          padding: '4px 10px', 
          backgroundColor: user?.role === 'admin' ? '#ef4444' : user?.role === 'manager' ? '#f59e0b' : '#3b82f6',
          color: 'white',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {user?.role}
        </span>
      </p>
      
      <div className="grid grid-3" style={{ marginTop: '30px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3>📨 Messages</h3>
          {loading ? (
            <p style={{ fontSize: '24px', color: '#999' }}>Chargement...</p>
          ) : (
            <>
              <p style={{ fontSize: '42px', fontWeight: 'bold', color: '#7c3aed', margin: '10px 0' }}>
                {stats.unreadMessages}
              </p>
              <p style={{ color: '#666' }}>Messages non lus</p>
            </>
          )}
        </div>
        
        <div className="card" style={{ textAlign: 'center' }}>
          <h3>💰 Ventes</h3>
          {loading ? (
            <p style={{ fontSize: '24px', color: '#999' }}>Chargement...</p>
          ) : (
            <>
              <p style={{ fontSize: '42px', fontWeight: 'bold', color: '#10b981', margin: '10px 0' }}>
                {stats.totalSales.toLocaleString('fr-FR')} €
              </p>
              <p style={{ color: '#666' }}>Chiffre d'affaires total</p>
            </>
          )}
        </div>
        
        <div className="card" style={{ textAlign: 'center' }}>
          <h3>👥 Équipe</h3>
          {loading ? (
            <p style={{ fontSize: '24px', color: '#999' }}>Chargement...</p>
          ) : (
            <>
              <p style={{ fontSize: '42px', fontWeight: 'bold', color: '#f59e0b', margin: '10px 0' }}>
                {stats.activeUsers || '-'}
              </p>
              <p style={{ color: '#666' }}>
                {user?.role === 'admin' ? 'Employés actifs' : 'Visible pour admin'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
