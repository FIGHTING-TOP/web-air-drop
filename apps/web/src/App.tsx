import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ClipboardPage } from './components/ClipboardPage';
import { AirdropPage } from './pages/AirdropPage';
import { ClipboardRedirect } from './pages/ClipboardRedirect';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AirdropPage />} />
        <Route path="/clipboard" element={<ClipboardRedirect />} />
        <Route path="/clipboard/:id" element={<ClipboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
