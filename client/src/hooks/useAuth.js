import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function useAuth() {
  const navigate = useNavigate();
  const { user, token, login, register, logout, isAdmin } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return { user, token, login, register, logout: handleLogout, isAdmin: isAdmin() };
}
