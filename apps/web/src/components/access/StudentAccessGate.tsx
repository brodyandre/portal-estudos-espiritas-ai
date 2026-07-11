import { ProfileHeader } from "../display/ProfileHeader";
import { AlertBox } from "../ui/AlertBox";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { StudentAccessStatus } from "../../services/studentAccessService";
import { DEMO_MODE_NOTICE, PUBLIC_MEET_NOTICE, appConfig } from "../../config/appMode";

interface StudentAccessGateProps {
  status: StudentAccessStatus;
}

const buildTitle = (status: StudentAccessStatus) => {
  if (status === "pending") {
    return "Aguardando aprovação";
  }

  return "Acesso não liberado";
};

const buildDescription = (status: StudentAccessStatus) => {
  if (status === "pending") {
    return "Seu cadastro foi recebido e está em revisão. Assim que os professores aprovarem, esta área passará a mostrar os materiais e o link da aula.";
  }

  return "Seu acesso ainda não foi liberado. A área do aluno e o link da aula aparecem apenas depois da aprovação dos professores.";
};

export const StudentAccessGate = ({ status }: StudentAccessGateProps) => {
  return (
    <div className="student-access-gate page-stack">
      <ProfileHeader
        actions={
          <div className="button-row">
            <Button to="/inscricao">Fazer inscricao</Button>
            <Button to="/portal" variant="secondary">
              Voltar ao portal
            </Button>
          </div>
        }
        badge="Proteção demonstrativa"
        description="Nesta fase do projeto, o acesso do aluno usa um controle simples no navegador. A liberação real poderá evoluir depois para autenticação completa."
        eyebrow="Área do aluno"
        meta={[
          { label: "Status atual", value: status === "pending" ? "Aguardando revisão" : "Visitante" },
          { label: "Link da aula", value: "Liberado somente após aprovação" },
        ]}
        title={buildTitle(status)}
      />

      <AlertBox title="Revisão antes do acesso" tone="warning">
        A aprovação dos professores libera o acesso à área do aluno e ao link da aula.
      </AlertBox>

      {appConfig.appMode === "demo" ? (
        <AlertBox title="Versão pública" tone="info">
          {DEMO_MODE_NOTICE} {PUBLIC_MEET_NOTICE}
        </AlertBox>
      ) : null}

      <Card className="student-access-gate__card" tone="soft">
        <h2>Acesso ainda não liberado</h2>
        <p className="student-panel__note">
          Seu acesso ainda não foi liberado. Após a aprovação dos professores, você poderá ver os
          materiais e o link da aula.
        </p>
        <p className="student-panel__note">{buildDescription(status)}</p>
        <div className="button-row">
          <Button to="/inscricao">Fazer inscricao</Button>
          <Button to="/educacao-continuada" variant="ghost">
            Conhecer os grupos
          </Button>
        </div>
      </Card>
    </div>
  );
};
