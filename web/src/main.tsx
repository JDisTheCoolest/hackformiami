import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "@/src/styles/globals.css";
import { MarketingHome } from "@/src/App";
import { ConfirmPage, GuestRoute, LoginPage, ProtectedRoute, SignupPage } from "@/components/auth/AuthRoutes";
import { Dashboard } from "@/components/app/Dashboard";
import { AuthProvider } from "@/lib/auth";
import { AccountPage, AlertsPage, NewReportPage, ReportsPage, SettingsPage } from "@/components/account/AccountPages";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<MarketingHome />} />
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>
          <Route path="/auth/confirm" element={<ConfirmPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app/*" element={<Dashboard />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/new" element={<NewReportPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
