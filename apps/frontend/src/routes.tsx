import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from './features/home/HomePage';
import { ItemsPage } from './features/items/ItemsPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { LoginPage } from './features/auth/LoginPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/items" element={<ItemsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
