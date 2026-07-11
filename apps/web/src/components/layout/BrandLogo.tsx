import { cn } from "../../app/cn";

interface BrandLogoProps {
  className?: string;
  compact?: boolean;
}

const logoSrc = `${import.meta.env.BASE_URL}branding/logo_EC.png`;

export const BrandLogo = ({ className, compact = false }: BrandLogoProps) => {
  return (
    <div className={cn("brand-logo", compact && "brand-logo--compact", className)}>
      <img
        alt="Logotipo Educação Continuada Online do Centro Espírita Ana Vieira"
        className="brand-logo__image"
        src={logoSrc}
      />
    </div>
  );
};
