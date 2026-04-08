import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/Toast";
import Navbar from "@/components/Navbar";
import MobileTabBar from "@/components/MobileTabBar";
import HomePage from "@/pages/HomePage";
import GamesPage from "@/pages/GamesPage";
import UploadPage from "@/pages/UploadPage";
import ShortsPage from "@/pages/ShortsPage";
import SearchPage from "@/pages/SearchPage";
import MyGamesPage from "@/pages/MyGamesPage";
import AdminPage from "@/pages/AdminPage";
import DashboardPage from "@/pages/DashboardPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
            <Navbar />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/shorts" element={<ShortsPage />} />
              <Route path="/games" element={<GamesPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/my-games" element={<MyGamesPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
            </Routes>
            <MobileTabBar />
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
