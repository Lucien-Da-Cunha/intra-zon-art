import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/api';
import { useAuthStore } from '../store/authStore';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(email, password);
      if (response.data.token && response.data.user) {
        setAuth(response.data.token, response.data.user);
        setTimeout(() => navigate('/dashboard', { replace: true }), 100);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>🏢 Intranet</h1>
        <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#666', fontSize: '18px' }}>
          Connexion
        </h2>
        
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="input"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          {error && <div className="error">{error}</div>}
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px', fontSize: '13px' }}>
          <strong>Comptes de test :</strong><br />
          <div style={{ marginTop: '8px' }}>
            <strong>Admin:</strong> admin@company.com<br />
            <strong>Manager:</strong> manager@company.com<br />
            <strong>Employé:</strong> john@company.com<br />
            <strong>Mot de passe:</strong> password123
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
