import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/layout/AppLayout";
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
        <Route element={<AppLayout />}>
          <Route element={<HomePage />} path="/" />
          <Route element={<PortalPage />} path="/portal" />
          <Route element={<EducationContinuedPage />} path="/educacao-continuada" />
          <Route element={<EnrollmentPage />} path="/inscricao" />
          <Route element={<PromotionPage />} path="/divulgacao" />
          <Route element={<MaterialsPage />} path="/materiais" />
          <Route element={<MaterialsPage />} path="/materiais/:groupSlug" />
          <Route element={<AlunoPage />} path="/aluno" />
          <Route element={<ProfessorPage />} path="/professor" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Route>
      </Routes>
    </HashRouter>
  );
};
