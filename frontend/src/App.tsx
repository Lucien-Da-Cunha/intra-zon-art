import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Messages from './pages/Messages';
import Sales from './pages/Sales';
import Admin from './pages/Admin';
import Drive from './pages/Drive';
import Expenses from './pages/Expenses';
import Navbar from './components/Navbar';

function App() {
  const token = useAuthStore((state) => state.token);

  return (
    <Router>
      {token && <Navbar />}
      <Routes>
        <Route
          path="/login"
          element={token ? <Navigate to="/dashboard" /> : <Login />}
        />
        <Route
          path="/dashboard"
          element={token ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/messages"
          element={token ? <Messages /> : <Navigate to="/login" />}
        />
        <Route
          path="/sales"
          element={token ? <Sales /> : <Navigate to="/login" />}
        />
        <Route
          path="/admin"
          element={token ? <Admin /> : <Navigate to="/login" />}
        />
        <Route
          path="/drive"
          element={token ? <Drive /> : <Navigate to="/login" />}
        />
        <Route
          path="/expenses"
          element={token ? <Expenses /> : <Navigate to="/login" />}
        />
        <Route path="*" element={<Navigate to={token ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
