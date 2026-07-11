import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import {
  appSidebarConfig,
  pageMeta,
  pageSections,
  studentSidebarConfig,
  teacherSidebarConfig,
} from "../../app/navigation";
import { applyThemePreference, readThemePreference, type AppTheme, writeThemePreference } from "../../app/theme";
import { MobileHeader } from "./MobileHeader";
import { Sidebar } from "./Sidebar";
import { ThemeSwitcher } from "./ThemeSwitcher";

const resolveActiveSection = (sectionIds: string[]) => {
  if (typeof window === "undefined" || sectionIds.length === 0) {
    return null;
  }

  const stickyOffset = window.innerWidth >= 1024 ? 112 : 152;
  const sections = sectionIds
    .map((sectionId) => {
      const element = document.getElementById(sectionId);

      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();

      return {
        sectionId,
        top: rect.top,
        bottom: rect.bottom,
      };
    })
    .filter((section): section is { sectionId: string; top: number; bottom: number } => section !== null);

  if (sections.length === 0) {
    return null;
  }

  sections.sort((firstSection, secondSection) => firstSection.top - secondSection.top);

  let currentSectionId = sections[0].sectionId;

  for (const section of sections) {
    if (section.bottom <= stickyOffset) {
      continue;
    }

    currentSectionId = section.sectionId;

    if (section.top > stickyOffset) {
      break;
    }
  }

  return currentSectionId;
};

export const AppLayout = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [theme, setTheme] = useState<AppTheme>(() => readThemePreference());

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    applyThemePreference(theme);
    writeThemePreference(theme);
  }, [theme]);

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
  const trackedSections = useMemo(() => {
    return pageSections[location.pathname as keyof typeof pageSections] ?? [];
  }, [location.pathname]);

  useEffect(() => {
    if (trackedSections.length === 0) {
      setActiveSectionId(null);
      return;
    }

    let animationFrameId = 0;

    const updateActiveSection = () => {
      const nextSectionId = resolveActiveSection(trackedSections.map((section) => section.targetId));
      setActiveSectionId((currentSectionId) => {
        return currentSectionId === nextSectionId ? currentSectionId : nextSectionId;
      });
    };

    const handleViewportChange = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", handleViewportChange, { passive: true });
    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [trackedSections]);

  const currentSection = trackedSections.find((section) => section.targetId === activeSectionId) ?? null;
  const activeSidebarSectionTargetId = currentSection?.navTargetId ?? currentSection?.targetId ?? null;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>

      <div className="app-shell__sidebar">
        <Sidebar activeSectionTargetId={activeSidebarSectionTargetId} config={sidebarConfig} />
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
              <Sidebar
                activeSectionTargetId={activeSidebarSectionTargetId}
                config={sidebarConfig}
                mode="mobile"
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </div>
          </div>
        ) : null}

        <main className="app-main" id="main-content">
          <div className="app-main__inner">
            <div className="page-context-bar" aria-label="Contexto da página">
              <div className="page-context-bar__body">
                <span className="page-context-bar__eyebrow">Tela atual</span>
                <strong>{currentPage.title}</strong>
              </div>
              <div className="page-context-bar__controls">
                {currentSection ? (
                  <div className="page-context-bar__status">
                    <span className="page-context-bar__label">Seção atual</span>
                    <span className="page-context-bar__value">{currentSection.label}</span>
                  </div>
                ) : null}
                <ThemeSwitcher onChange={setTheme} value={theme} />
              </div>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
