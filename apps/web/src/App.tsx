import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/access/ProtectedRoute";
import { AdminLayout } from "./components/layout/AdminLayout";
import { PublicLayout } from "./components/layout/PublicLayout";
import { StudentLayout } from "./components/layout/StudentLayout";
import { TeacherLayout } from "./components/layout/TeacherLayout";
import { AdminPage } from "./pages/AdminPage";
import { AlunoPage } from "./pages/AlunoPage";
import { EducationContinuedPage } from "./pages/EducationContinuedPage";
import { EnrollmentPage } from "./pages/EnrollmentPage";
import { HomePage } from "./pages/HomePage";
import { MaterialsPage } from "./pages/MaterialsPage";
import { PortalPage } from "./pages/PortalPage";
import { ProfessorPage } from "./pages/ProfessorPage";
import { PromotionPage } from "./pages/PromotionPage";

export const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route element={<HomePage />} path="/" />
          <Route element={<PortalPage />} path="/portal" />
          <Route element={<EducationContinuedPage />} path="/educacao-continuada" />
          <Route element={<EnrollmentPage />} path="/inscricao" />
          <Route element={<PromotionPage />} path="/divulgacao" />
          <Route element={<MaterialsPage />} path="/materiais" />
          <Route element={<MaterialsPage />} path="/materiais/:groupSlug" />
        </Route>

        <Route element={<StudentLayout />}>
          <Route element={<AlunoPage />} path="/aluno" />
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
            <Route element={<AdminPage section="usuarios" />} path="/admin/usuarios" />
            <Route element={<AdminPage section="grupos" />} path="/admin/grupos" />
            <Route element={<AdminPage section="conteudos" />} path="/admin/conteudos" />
            <Route element={<AdminPage section="configuracoes" />} path="/admin/configuracoes" />
            <Route element={<AdminPage section="auditoria" />} path="/admin/auditoria" />
          </Route>
        </Route>

        <Route element={<PublicLayout />}>
          <Route element={<Navigate replace to="/" />} path="*" />
        </Route>
      </Routes>
    </HashRouter>
  );
};
