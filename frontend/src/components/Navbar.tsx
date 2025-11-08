import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useState, useEffect } from 'react';
import { messagesAPI } from '../api/api';

function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Charger le compteur de messages non lus au démarrage
    loadUnreadCount();
    
    // Rafraîchir toutes les 5 secondes
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const response = await messagesAPI.getUnreadCount();
      setUnreadCount(response.data.total_unread || 0);
    } catch (error) {
      console.error('Erreur chargement compteur non lus:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{
      background: 'white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      padding: '15px 20px',
      position: 'relative'
    }}>
      {/* Desktop & Tablet Layout */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#1f2937', whiteSpace: 'nowrap' }}>
            Intranet
          </h2>
        </div>

        {/* Desktop Menu */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flex: 1, justifyContent: 'center' }} className="desktop-menu">
            <Link to="/dashboard" style={{ textDecoration: 'none', color: '#333', fontSize: '14px' }}>Dashboard</Link>
            <Link 
              to="/messages" 
              style={{ 
                textDecoration: 'none', 
                color: '#333',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '14px'
              }}
            >
              Messages
              {unreadCount > 0 && (
                <span style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  minWidth: '18px',
                  textAlign: 'center'
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <Link to="/sales" style={{ textDecoration: 'none', color: '#333', fontSize: '14px' }}>Ventes</Link>
            <Link to="/expenses" style={{ textDecoration: 'none', color: '#333', fontSize: '14px' }}>Dépenses</Link>
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <Link to="/drive" style={{ textDecoration: 'none', color: '#333', fontSize: '14px' }}>Drive</Link>
            )}
            {user?.role === 'admin' && (
              <Link to="/admin" style={{ textDecoration: 'none', color: '#333', fontSize: '14px' }}>Admin</Link>
            )}
          </div>

        {/* User Info & Logout (Desktop) */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }} className="desktop-user">
          <span style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>
            {user?.firstName} {user?.lastName}
          </span>
          <button 
            className="btn btn-secondary" 
            onClick={handleLogout}
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            Déconnexion
          </button>
        </div>

        {/* Mobile Burger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '5px',
            color: '#333'
          }}
          className="mobile-menu-toggle"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          padding: '10px 0',
          zIndex: 1000
        }}
        className="mobile-menu-dropdown"
        >
          <Link 
            to="/dashboard" 
            onClick={() => setMobileMenuOpen(false)}
            style={{ 
              display: 'block',
              padding: '12px 20px',
              textDecoration: 'none',
              color: '#333',
              borderBottom: '1px solid #f0f0f0'
            }}
          >
            📊 Dashboard
          </Link>
          <Link 
            to="/messages"
            onClick={() => setMobileMenuOpen(false)}
            style={{ 
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 20px',
              textDecoration: 'none',
              color: '#333',
              borderBottom: '1px solid #f0f0f0'
            }}
          >
            <span>💬 Messages</span>
            {unreadCount > 0 && (
              <span style={{
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
          <Link 
            to="/sales"
            onClick={() => setMobileMenuOpen(false)}
            style={{ 
              display: 'block',
              padding: '12px 20px',
              textDecoration: 'none',
              color: '#333',
              borderBottom: '1px solid #f0f0f0'
            }}
          >
            💰 Ventes
          </Link>
          <Link 
            to="/expenses"
            onClick={() => setMobileMenuOpen(false)}
            style={{ 
              display: 'block',
              padding: '12px 20px',
              textDecoration: 'none',
              color: '#333',
              borderBottom: '1px solid #f0f0f0'
            }}
          >
            💸 Dépenses
          </Link>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <Link 
              to="/drive"
              onClick={() => setMobileMenuOpen(false)}
              style={{ 
                display: 'block',
                padding: '12px 20px',
                textDecoration: 'none',
                color: '#333',
                borderBottom: '1px solid #f0f0f0'
              }}
            >
              📁 Drive
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link 
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              style={{ 
                display: 'block',
                padding: '12px 20px',
                textDecoration: 'none',
                color: '#333',
                borderBottom: '1px solid #f0f0f0'
              }}
            >
              ⚙️ Admin
            </Link>
          )}
          <div style={{
            padding: '12px 20px',
            fontSize: '13px',
            color: '#666',
            borderBottom: '1px solid #f0f0f0'
          }}>
            👤 {user?.firstName} {user?.lastName} ({user?.role})
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={handleLogout}
            style={{ 
              width: '100%',
              margin: '0',
              borderRadius: '0',
              padding: '12px 20px',
              fontSize: '14px',
              textAlign: 'left',
              backgroundColor: 'transparent',
              color: '#ef4444',
              border: 'none',
              borderBottom: '1px solid #f0f0f0'
            }}
          >
            🚪 Déconnexion
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-menu {
            display: none !important;
          }
          .desktop-user {
            display: none !important;
          }
          .mobile-menu-toggle {
            display: block !important;
            position: absolute;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
          }
          .mobile-logout {
            display: block !important;
          }
        }
      `}</style>
    </nav>
  );
}

export default Navbar;
