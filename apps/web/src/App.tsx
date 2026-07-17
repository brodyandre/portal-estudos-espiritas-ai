import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import { AuthenticatedRoute } from "./components/access/AuthenticatedRoute";
import { ProtectedRoute } from "./components/access/ProtectedRoute";
import { AccountLayout } from "./components/layout/AccountLayout";
import { AdminLayout } from "./components/layout/AdminLayout";
import { PublicLayout } from "./components/layout/PublicLayout";
import { StudentLayout } from "./components/layout/StudentLayout";
import { TeacherLayout } from "./components/layout/TeacherLayout";
import { AccountSecurityPage } from "./pages/AccountSecurityPage";
import { ActivateAccountPage } from "./pages/ActivateAccountPage";
import { AdminAccountInvitationsPage } from "./pages/AdminAccountInvitationsPage";
import { AdminGroupsPage } from "./pages/AdminGroupsPage";
import { AdminKnowledgePage } from "./pages/AdminKnowledgePage";
import { AdminPage } from "./pages/AdminPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AlunoPage } from "./pages/AlunoPage";
import { EducationContinuedPage } from "./pages/EducationContinuedPage";
import { EnrollmentPage } from "./pages/EnrollmentPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MaterialsPage } from "./pages/MaterialsPage";
import { PasswordChangePage } from "./pages/PasswordChangePage";
import { PortalPage } from "./pages/PortalPage";
import { ProfessorPage } from "./pages/ProfessorPage";
import { PromotionPage } from "./pages/PromotionPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { normalizeBrowserBasename } from "./routing/publicUrls";

export const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route element={<HomePage />} path="/" />
        <Route element={<PortalPage />} path="/portal" />
        <Route element={<EducationContinuedPage />} path="/educacao-continuada" />
        <Route element={<EnrollmentPage />} path="/inscricao" />
        <Route element={<LoginPage />} path="/login" />
        <Route element={<ForgotPasswordPage />} path="/esqueci-minha-senha" />
        <Route element={<ResetPasswordPage />} path="/redefinir-senha" />
        <Route element={<ActivateAccountPage />} path="/ativar-conta" />
        <Route element={<PasswordChangePage />} path="/primeiro-acesso" />
        <Route element={<PromotionPage />} path="/divulgacao" />
        <Route element={<MaterialsPage />} path="/materiais" />
        <Route element={<MaterialsPage />} path="/materiais/:groupSlug" />
      </Route>

      <Route element={<AccountLayout />}>
        <Route element={<AuthenticatedRoute />}>
          <Route element={<AccountSecurityPage />} path="/minha-conta/seguranca" />
        </Route>
      </Route>

      <Route element={<StudentLayout />}>
        <Route element={<ProtectedRoute routeType="student" />}>
          <Route element={<AlunoPage />} path="/aluno" />
        </Route>
      </Route>

      <Route element={<TeacherLayout />}>
        <Route element={<ProtectedRoute routeType="teacher" />}>
          <Route element={<ProfessorPage />} path="/professor" />
        </Route>
      </Route>

      <Route element={<AdminLayout />}>
        <Route element={<ProtectedRoute routeType="admin" />}>
          <Route element={<Navigate replace to="/admin/dashboard" />} path="/admin" />
          <Route element={<AdminPage section="dashboard" />} path="/admin/dashboard" />
          <Route element={<AdminUsersPage />} path="/admin/usuarios" />
          <Route element={<AdminAccountInvitationsPage />} path="/admin/convites" />
          <Route element={<AdminGroupsPage />} path="/admin/grupos" />
          <Route element={<AdminKnowledgePage />} path="/admin/conteudos" />
          <Route element={<AdminPage section="configuracoes" />} path="/admin/configuracoes" />
          <Route element={<AdminPage section="auditoria" />} path="/admin/auditoria" />
        </Route>
      </Route>

      <Route element={<PublicLayout />}>
        <Route element={<NotFoundPage />} path="*" />
      </Route>
    </Routes>
  );
};

export const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter basename={normalizeBrowserBasename(import.meta.env.BASE_URL)}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};
