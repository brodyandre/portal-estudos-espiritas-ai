import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/layout/AppLayout";
import { AlunoPage } from "./pages/AlunoPage";
import { HomePage } from "./pages/HomePage";
import { PortalPage } from "./pages/PortalPage";
import { ProfessorPage } from "./pages/ProfessorPage";

export const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route element={<HomePage />} path="/" />
          <Route element={<PortalPage />} path="/portal" />
          <Route element={<AlunoPage />} path="/aluno" />
          <Route element={<ProfessorPage />} path="/professor" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Route>
      </Routes>
    </HashRouter>
  );
};
