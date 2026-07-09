import { groups, homeSteps } from "../data/demo";
import { FlowStepCard } from "../components/display/FlowStepCard";
import { GroupCard } from "../components/display/GroupCard";
import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SectionTitle } from "../components/ui/SectionTitle";

export const HomePage = () => {
  return (
    <div className="page-stack">
      <ProfileHeader
        actions={
          <div className="button-row">
            <Button to="/portal">Abrir Portal</Button>
            <Button to="/aluno" variant="secondary">
              Area do aluno
            </Button>
            <Button to="/professor" variant="ghost">
              Area do professor
            </Button>
          </div>
        }
        badge="Gratuito e responsivo"
        description="Uma aplicacao web acolhedora para apoiar grupos de estudos espiritas online com organizacao, materiais simples e acompanhamento claro."
        eyebrow="Projeto"
        meta={[
          { label: "Experiencia", value: "Mobile-first real desde 360px" },
          { label: "Uso", value: "Portal, Aluno e Professor" },
          { label: "Encontros", value: "Google Meet com apoio revisavel" },
        ]}
        title="Estudo online com clareza, acolhimento e organizacao"
      />

      <AlertBox title="Apoio ao estudo, nao substituicao" tone="warning">
        A plataforma apoia encontros, materiais, resumos e preparacao de aulas, mas nao substitui a
        orientacao de professores nem o cuidado humano no estudo.
      </AlertBox>

      <section className="page-section">
        <SectionTitle
          description="Os dois grupos aparecem em destaque logo no inicio para facilitar o acesso rapido ao encontro e ao planejamento."
          title="Grupos em destaque"
        />
        <div className="group-grid">
          {groups.map((group) => (
            <GroupCard actionLabel="Entrar no encontro" actionHref={group.meetUrl} group={group} key={group.slug} />
          ))}
        </div>
      </section>

      <section className="page-section">
        <SectionTitle
          description="Cinco passos simples mostram como a experiencia foi pensada para alunos e professores."
          title="Como usar"
        />
        <div className="steps-grid">
          {homeSteps.map((step) => (
            <FlowStepCard key={step.step} step={step} />
          ))}
        </div>
      </section>

      <section className="page-section">
        <div className="three-column-grid">
          <Card tone="soft">
            <h3>Leitura simples</h3>
            <p>
              Materiais, resumos e orientacoes foram pensados para leitura tranquila, sem termos
              tecnicos na interface.
            </p>
          </Card>
          <Card tone="soft">
            <h3>Revisao humana</h3>
            <p>
              Todo conteudo de apoio pode ser ajustado, revisado e publicado com responsabilidade pelo
              professor.
            </p>
          </Card>
          <Card tone="soft">
            <h3>Uso em qualquer tela</h3>
            <p>
              O layout prioriza toque, foco visivel, leitura confortavel e navegacao clara no mobile e
              no desktop.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
};
