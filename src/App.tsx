import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n/I18nContext";
import AuthGuard from "@/components/AuthGuard";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import AdminPage from "./pages/AdminPage.tsx";
import ClientPage from "./pages/ClientPage.tsx";
import BrandBrainPage from "./pages/BrandBrainPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import AcceptInvitePage from "./pages/AcceptInvitePage.tsx";
import SocialDashboard from "./pages/SocialDashboard.tsx";
import SocialCallbackPage from "./pages/SocialCallbackPage.tsx";
import TeamManagementPage from "./pages/TeamManagementPage.tsx";
import TeamDashboard from "./pages/TeamDashboard.tsx";
import AgendaPage from "./pages/AgendaPage.tsx";
import IdeasPage from "./pages/IdeasPage.tsx";
import CalendarPage from "./pages/CalendarPage.tsx";
import BriefsPage from "./pages/BriefsPage.tsx";
import CommemorativeDatesPage from "./pages/CommemorativeDatesPage.tsx";
// ActivityLogPage removed — logs simplified to approval/feedback only
import ReportsPage from "./pages/ReportsPage.tsx";
import CreateReportPage from "./pages/CreateReportPage.tsx";
import ReportViewPage from "./pages/ReportViewPage.tsx";
import BillingPage from "./pages/BillingPage.tsx";
import BillingInvoicePage from "./pages/BillingInvoicePage.tsx";
import ProposalsPage from "./pages/ProposalsPage.tsx";
import PublicProposalPage from "./pages/PublicProposalPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import ApprovalPage from "./pages/ApprovalPage.tsx";
import ContractsPage from "./pages/ContractsPage.tsx";
import DesignBriefsPage from "./pages/DesignBriefsPage.tsx";
import PublicBriefPage from "./pages/PublicBriefPage.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <I18nProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/proposta/:token" element={<PublicProposalPage />} />
              <Route path="/aprovacao/:token" element={<ApprovalPage />} />
              <Route path="/brief/:token" element={<PublicBriefPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/accept-invite" element={<AcceptInvitePage />} />
              <Route path="/" element={<AuthGuard allowedRoles={["super_admin", "admin", "colaborador"]}><AdminDashboard /></AuthGuard>} />
              <Route path="/admin" element={<AuthGuard allowedRoles={["super_admin", "admin", "colaborador"]}><AdminDashboard /></AuthGuard>} />
              <Route path="/admin/:slug" element={<AuthGuard allowedRoles={["super_admin", "admin", "colaborador"]}><AdminPage /></AuthGuard>} />
              <Route path="/social" element={<AuthGuard allowedRoles={["super_admin", "admin"]}><SocialDashboard /></AuthGuard>} />
              <Route path="/social/callback" element={<SocialCallbackPage />} />
              <Route path="/team" element={<AuthGuard allowedRoles={["super_admin", "admin", "colaborador"]}><TeamDashboard /></AuthGuard>} />
              <Route path="/team-management" element={<AuthGuard allowedRoles={["super_admin", "admin"]}><TeamManagementPage /></AuthGuard>} />
              <Route path="/agenda" element={<AuthGuard allowedRoles={["super_admin", "admin", "colaborador"]}><AgendaPage /></AuthGuard>} />
              <Route path="/ideas" element={<AuthGuard allowedRoles={["super_admin", "admin", "colaborador"]}><IdeasPage /></AuthGuard>} />
              <Route path="/calendar" element={<AuthGuard allowedRoles={["super_admin", "admin", "colaborador"]}><CalendarPage /></AuthGuard>} />
              <Route path="/briefs" element={<AuthGuard allowedRoles={["super_admin", "admin", "colaborador"]}><BriefsPage /></AuthGuard>} />
              <Route path="/commemorative-dates" element={<AuthGuard allowedRoles={["super_admin", "admin", "colaborador"]}><CommemorativeDatesPage /></AuthGuard>} />
              {/* activity-log route removed */}
              <Route path="/reports" element={<AuthGuard allowedRoles={["super_admin"]}><ReportsPage /></AuthGuard>} />
              <Route path="/reports/new" element={<AuthGuard allowedRoles={["super_admin"]}><CreateReportPage /></AuthGuard>} />
              <Route path="/reports/:id/edit" element={<AuthGuard allowedRoles={["super_admin"]}><CreateReportPage /></AuthGuard>} />
              <Route path="/reports/:id" element={<AuthGuard allowedRoles={["super_admin", "admin", "colaborador", "client"]}><ReportViewPage /></AuthGuard>} />
              <Route path="/billing/:id" element={<AuthGuard allowedRoles={["super_admin"]} temporaryAccess="billing_preview"><BillingInvoicePage /></AuthGuard>} />
              <Route path="/billing" element={<AuthGuard allowedRoles={["super_admin"]} temporaryAccess="billing_preview"><BillingPage /></AuthGuard>} />
              <Route path="/proposals" element={<AuthGuard allowedRoles={["super_admin"]}><ProposalsPage /></AuthGuard>} />
              <Route path="/contracts" element={<AuthGuard allowedRoles={["super_admin"]}><ContractsPage /></AuthGuard>} />
              <Route path="/design-briefs" element={<AuthGuard allowedRoles={["super_admin", "admin", "colaborador"]}><DesignBriefsPage /></AuthGuard>} />
              <Route path="/client/:slug" element={<AuthGuard allowedRoles={["super_admin", "admin", "colaborador", "client"]}><ClientPage /></AuthGuard>} />
              <Route path="/client/:slug/brand-brain" element={<AuthGuard allowedRoles={["super_admin", "admin", "colaborador", "client"]}><BrandBrainPage /></AuthGuard>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </I18nProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
