import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppNav } from './components/AppNav';
import { ClipboardPage } from './components/ClipboardPage';
import { AirdropPage } from './pages/AirdropPage';
import { ClipboardRedirect } from './pages/ClipboardRedirect';
import { ManageDetailPage } from './pages/ManageDetailPage';
import { ManageListPage } from './pages/ManageListPage';

export default function App() {
  return (
    <BrowserRouter>
      <AppNav />
      <Routes>
        <Route path="/airdrop" element={<AirdropPage />} />
        <Route path="/manage/list" element={<ManageListPage />} />
        <Route path="/manage/:id" element={<ManageDetailPage />} />
        <Route path="/" element={<ClipboardRedirect />} />
        <Route path="/:id" element={<ClipboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
