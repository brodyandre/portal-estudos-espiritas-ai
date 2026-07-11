import { ProfileHeader } from "../display/ProfileHeader";
import { AlertBox } from "../ui/AlertBox";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { StudentAccessStatus } from "../../services/studentAccessService";

interface StudentAccessGateProps {
  status: StudentAccessStatus;
}

const buildTitle = (status: StudentAccessStatus) => {
  if (status === "pending") {
    return "Aguardando aprovacao";
  }

  return "Acesso nao liberado";
};

const buildDescription = (status: StudentAccessStatus) => {
  if (status === "pending") {
    return "Seu cadastro foi recebido e esta em revisao. Assim que os professores aprovarem, esta area passara a mostrar os materiais e o link da aula.";
  }

  return "Seu acesso ainda nao foi liberado. A area do aluno e o link da aula aparecem apenas depois da aprovacao dos professores.";
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
        badge="Protecao demonstrativa"
        description="Nesta fase do projeto, o acesso do aluno usa um controle simples no navegador. A liberacao real podera evoluir depois para autenticacao completa."
        eyebrow="Area do aluno"
        meta={[
          { label: "Status atual", value: status === "pending" ? "Aguardando revisao" : "Visitante" },
          { label: "Link da aula", value: "Liberado somente apos aprovacao" },
        ]}
        title={buildTitle(status)}
      />

      <AlertBox title="Revisao antes do acesso" tone="warning">
        A aprovacao dos professores libera o acesso a area do aluno e ao link da aula.
      </AlertBox>

      <Card className="student-access-gate__card" tone="soft">
        <h2>Acesso ainda nao liberado</h2>
        <p className="student-panel__note">
          Seu acesso ainda nao foi liberado. Apos a aprovacao dos professores, voce podera ver os
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
