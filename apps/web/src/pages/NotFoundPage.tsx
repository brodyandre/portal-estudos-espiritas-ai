import { ProfileHeader } from "../components/display/ProfileHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export const NotFoundPage = () => {
  return (
    <div className="page-stack">
      <ProfileHeader
        badge="404"
        description="O endereço informado não corresponde a uma página pública disponível no portal."
        eyebrow="Página não encontrada"
        title="Não encontramos esta página"
      />

      <Card tone="soft">
        <h2>Confira o endereço ou volte para o início</h2>
        <p className="student-panel__note">
          Algumas áreas exigem acesso autorizado. Para sua segurança, esta página não lista rotas
          internas ou administrativas.
        </p>
        <div className="button-row">
          <Button to="/">Voltar ao início</Button>
          <Button to="/portal" variant="secondary">
            Abrir o portal
          </Button>
        </div>
      </Card>
    </div>
  );
};
