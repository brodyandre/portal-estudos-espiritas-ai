import { Button } from "../ui/Button";
import { BrandLogo } from "./BrandLogo";

interface MobileHeaderProps {
  title: string;
  description: string;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
}

export const MobileHeader = ({
  title,
  description,
  isMenuOpen,
  onToggleMenu,
}: MobileHeaderProps) => {
  return (
    <header className="mobile-header">
      <div className="mobile-header__brand">
        <div className="mobile-header__brand-row">
          <BrandLogo className="mobile-header__logo" compact />
          <div className="mobile-header__brand-copy">
            <span className="mobile-header__eyebrow">Programa online</span>
            <strong>{title}</strong>
          </div>
        </div>
        <p>{description}</p>
      </div>
      <Button
        aria-controls="mobile-navigation"
        aria-expanded={isMenuOpen}
        aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
        onClick={onToggleMenu}
        size="compact"
        variant="secondary"
      >
        Menu
      </Button>
    </header>
  );
};
