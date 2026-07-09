import { Button } from "../ui/Button";

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
        <span className="mobile-header__eyebrow">Portal de estudos</span>
        <strong>{title}</strong>
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
