import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DiningInvoicesPage } from './pages/DiningInvoicesPage';
import { HomePage } from './pages/HomePage';
import { ReimbursementPage } from './pages/ReimbursementPage';
import { SettingsPage } from './pages/SettingsPage';
import { TemplatesPage } from './pages/TemplatesPage';

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dining-invoices" element={<DiningInvoicesPage />} />
          <Route path="/reimbursements/:id" element={<ReimbursementPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
