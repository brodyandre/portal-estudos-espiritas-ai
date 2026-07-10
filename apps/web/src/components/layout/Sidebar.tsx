import { NavLink } from "react-router-dom";

import type { NavigationItem, SidebarConfig } from "../../app/navigation";
import { cn } from "../../app/cn";
import { Badge } from "../ui/Badge";

interface SidebarProps {
  mode?: "desktop" | "mobile";
  onNavigate?: () => void;
  config: SidebarConfig;
  activeSectionTargetId?: string | null;
}

const focusSectionTarget = (target: HTMLElement) => {
  const hadTabIndex = target.hasAttribute("tabindex");

  if (!hadTabIndex) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener(
      "blur",
      () => {
        target.removeAttribute("tabindex");
      },
      { once: true },
    );
  }

  window.setTimeout(() => {
    target.focus({ preventScroll: true });
  }, 180);
};

const handleSectionNavigation = (item: Extract<NavigationItem, { type: "section" }>, onNavigate?: () => void) => {
  const target = document.getElementById(item.targetId);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    focusSectionTarget(target);
  }
  onNavigate?.();
};

export const Sidebar = ({
  mode = "desktop",
  onNavigate,
  config,
  activeSectionTargetId,
}: SidebarProps) => {
  return (
    <aside className={cn("sidebar", mode === "mobile" && "sidebar--mobile")}>
      <div className="sidebar__brand">
        <Badge tone="sand">{config.badge}</Badge>
        <h1>{config.title}</h1>
        <p>{config.description}</p>
      </div>

      <nav
        aria-label={config.navLabel}
        className="sidebar__nav"
        id={mode === "mobile" ? "mobile-navigation" : undefined}
      >
        {config.items.map((item) =>
          item.type === "route" ? (
            <NavLink
              key={item.to}
              className={({ isActive }) => cn("sidebar__link", isActive && "sidebar__link--active")}
              onClick={onNavigate}
              to={item.to}
            >
              <span className="sidebar__link-label">{item.label}</span>
              <span className="sidebar__link-description">{item.description}</span>
            </NavLink>
          ) : (
            <button
              key={item.targetId}
              aria-current={activeSectionTargetId === item.targetId ? "location" : undefined}
              className={cn(
                "sidebar__link sidebar__link-button",
                activeSectionTargetId === item.targetId && "sidebar__link--active",
              )}
              onClick={() => handleSectionNavigation(item, onNavigate)}
              type="button"
            >
              <span className="sidebar__link-label">{item.label}</span>
              <span className="sidebar__link-description">{item.description}</span>
            </button>
          ),
        )}
      </nav>

      <div className="sidebar__footer">
        <h2>{config.footerTitle}</h2>
        <p>{config.footerDescription}</p>
      </div>
    </aside>
  );
};
