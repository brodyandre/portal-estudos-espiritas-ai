import { cn } from "../../app/cn";
import { type AppTheme, themeOptions } from "../../app/theme";

interface ThemeSwitcherProps {
  value: AppTheme;
  onChange: (theme: AppTheme) => void;
}

export const ThemeSwitcher = ({ value, onChange }: ThemeSwitcherProps) => {
  return (
    <div className="theme-switcher" role="group" aria-label="Escolher aparência da interface">
      <span className="theme-switcher__label">Aparência</span>
      <div className="theme-switcher__options">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            aria-pressed={value === option.value}
            className={cn(
              "theme-switcher__button",
              value === option.value && "theme-switcher__button--active",
            )}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};
