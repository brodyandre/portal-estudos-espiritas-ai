import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SectionTitle } from "../components/ui/SectionTitle";

const posterText =
  "Escaneie o QR Code para conhecer os grupos, fazer sua inscricao e receber o acesso as aulas online.";

const reasons = [
  "Organizacao do acolhimento dos novos participantes.",
  "Mais seguranca para o encontro online.",
  "Acompanhamento simples do cadastro antes da liberacao.",
  "Espaco para o professor orientar melhor quem esta chegando.",
];

export const PromotionPage = () => {
  return (
    <div className="promotion-page page-stack">
      <div className="page-anchor" id="divulgacao-inicio">
        <ProfileHeader
          actions={
            <div className="button-row">
              <Button to="/educacao-continuada">Abrir pagina recomendada</Button>
              <Button to="/inscricao" variant="secondary">
                Abrir inscricao
              </Button>
            </div>
          }
          badge="Apoio para divulgacao"
          description="Uma orientacao curta para professores saberem qual pagina deve virar QR Code no cartaz e por que o encontro nao deve ficar publico."
          eyebrow="Divulgacao"
          meta={[
            { label: "Rota recomendada", value: "/educacao-continuada" },
            { label: "Uso", value: "Cartaz, convite e materiais impressos" },
            { label: "Meet", value: "Nao divulgar diretamente" },
          ]}
          title="Divulgacao do QR Code"
        />
      </div>

      <AlertBox title="Orientacao principal" tone="warning">
        Evite divulgar diretamente o link do Google Meet no cartaz.
      </AlertBox>

      <section className="page-section" id="divulgacao-orientacao">
        <SectionTitle
          description="O ideal e apontar o QR Code para a pagina publica de entrada, que acolhe o visitante e conduz ate a inscricao."
          title="URL recomendada"
        />

        <Card className="promotion-card" tone="brand">
          <p className="card-eyebrow">Use esta rota no QR Code</p>
          <h3>/educacao-continuada</h3>
          <p className="student-panel__note">
            Essa pagina apresenta os grupos, explica o fluxo de aprovacao e orienta o visitante a
            seguir para a inscricao sem expor o encontro online.
          </p>
          <div className="button-row">
            <Button to="/educacao-continuada">Abrir /educacao-continuada</Button>
          </div>
        </Card>
      </section>

      <section className="page-section" id="divulgacao-cartaz">
        <SectionTitle
          description="Um texto curto e acolhedor ajuda o visitante a entender o proximo passo sem tom burocratico."
          title="Texto recomendado para cartaz"
        />

        <Card className="promotion-card" tone="soft">
          <p className="card-eyebrow">Texto sugerido</p>
          <h3>Mensagem para o cartaz</h3>
          <p className="promotion-quote">{posterText}</p>
        </Card>
      </section>

      <section className="page-section" id="divulgacao-motivos">
        <SectionTitle
          description="O QR Code deve abrir uma pagina de acolhimento, e nao o encontro diretamente."
          title="Por que fazer assim"
        />

        <div className="two-column-grid">
          <Card className="promotion-card" tone="sand">
            <p className="card-eyebrow">Orientacao</p>
            <h3>Evite divulgar o encontro diretamente</h3>
            <p className="student-panel__note">
              Quando o visitante entra primeiro pela pagina publica, o professor consegue acolher,
              organizar e acompanhar melhor os novos alunos.
            </p>
          </Card>

          <Card className="promotion-card" tone="default">
            <p className="card-eyebrow">Motivos</p>
            <div className="stack-list">
              {reasons.map((reason) => (
                <p className="stack-list__item student-panel__note" key={reason}>
                  {reason}
                </p>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="page-section" id="divulgacao-acoes">
        <SectionTitle
          description="Use os botoes abaixo para revisar a pagina publica e o formulario antes de montar o cartaz."
          title="Acessos rapidos"
        />

        <Card className="promotion-card" tone="default">
          <div className="promotion-actions">
            <Button to="/educacao-continuada">Abrir /educacao-continuada</Button>
            <Button to="/inscricao" variant="secondary">
              Abrir /inscricao
            </Button>
            <Button to="/professor" variant="ghost">
              Voltar ao painel do professor
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
};
