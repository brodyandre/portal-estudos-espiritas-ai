import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import {
  appSidebarConfig,
  pageMeta,
  studentSidebarConfig,
  teacherSidebarConfig,
} from "../../app/navigation";
import { MobileHeader } from "./MobileHeader";
import { Sidebar } from "./Sidebar";

export const AppLayout = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const currentPage = pageMeta[location.pathname as keyof typeof pageMeta] ?? pageMeta["/"];
  const sidebarConfig =
    location.pathname === "/aluno"
      ? studentSidebarConfig
      : location.pathname === "/professor"
        ? teacherSidebarConfig
        : appSidebarConfig;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteudo
      </a>

      <div className="app-shell__sidebar">
        <Sidebar config={sidebarConfig} />
      </div>

      <div className="app-shell__content">
        <MobileHeader
          description={currentPage.description}
          isMenuOpen={isMobileMenuOpen}
          onToggleMenu={() => setIsMobileMenuOpen((current) => !current)}
          title={currentPage.title}
        />

        {isMobileMenuOpen ? (
          <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Menu principal">
            <button
              aria-label="Fechar menu"
              className="mobile-drawer__backdrop"
              onClick={() => setIsMobileMenuOpen(false)}
              type="button"
            />
            <div className="mobile-drawer__panel">
              <Sidebar config={sidebarConfig} mode="mobile" onNavigate={() => setIsMobileMenuOpen(false)} />
            </div>
          </div>
        ) : null}

        <main className="app-main" id="main-content">
          <div className="app-main__inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
