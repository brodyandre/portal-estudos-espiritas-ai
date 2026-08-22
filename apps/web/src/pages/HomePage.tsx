import { useEffect, useState } from "react";

import { FlowStepCard } from "../components/display/FlowStepCard";
import { GroupCard } from "../components/display/GroupCard";
import { ProfileHeader } from "../components/display/ProfileHeader";
import { BrandLogo } from "../components/layout/BrandLogo";
import { AlertBox } from "../components/ui/AlertBox";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { SectionTitle } from "../components/ui/SectionTitle";
import { DEMO_MODE_NOTICE, PUBLIC_MEET_NOTICE, appConfig } from "../config/appMode";
import { homeSteps } from "../data/homeSteps";
import { listStudies, type StudyGroup } from "../services/studiesService";

type HomeGroupsState =
  | { status: "loading" }
  | { status: "success"; groups: StudyGroup[]; notice: string | null }
  | { status: "empty"; notice: string | null }
  | { status: "error" };

export const HomePage = () => {
  const [groupsState, setGroupsState] = useState<HomeGroupsState>({ status: "loading" });

  useEffect(() => {
    let isActive = true;

    void listStudies()
      .then((result) => {
        if (!isActive) {
          return;
        }

        setGroupsState(
          result.data.length > 0
            ? { status: "success", groups: result.data, notice: result.notice }
            : { status: "empty", notice: result.notice },
        );
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setGroupsState({ status: "error" });
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="page-stack">
      <ProfileHeader
        actions={
          <div className="button-row home-hero-actions">
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
        eyebrow="Educação Continuada"
        meta={[
          { label: "Experiencia", value: "Acesso simples em computador, tablet e celular" },
          { label: "Uso", value: "Portal, Aluno e Professor" },
          { label: "Encontros", value: "Google Meet com apoio revisavel" },
        ]}
        title="Estudo online com clareza, acolhimento e organizacao"
        visual={
          <div className="profile-brand-showcase">
            <BrandLogo className="profile-brand-showcase__logo" />
            <p className="profile-brand-showcase__caption">
              Programa de estudo online com acolhimento, organizacao e revisao humana.
            </p>
          </div>
        }
      />

      <AlertBox title="Apoio ao estudo, nao substituicao" tone="warning">
        A plataforma apoia encontros, materiais, resumos e preparacao de aulas, mas nao substitui a
        orientacao de professores nem o cuidado humano no estudo.
      </AlertBox>

      {appConfig.appMode === "demo" ? (
        <AlertBox title="Modo demonstrativo ativo" tone="info">
          {DEMO_MODE_NOTICE} {PUBLIC_MEET_NOTICE}
        </AlertBox>
      ) : null}

      <section className="page-section">
        <SectionTitle
          description="Os dois grupos aparecem em destaque logo no inicio para facilitar o acesso rapido ao encontro e ao planejamento."
          title="Grupos em destaque"
        />
        {groupsState.status === "loading" ? (
          <LoadingState
            description="Estamos consultando os grupos disponiveis no portal."
            title="Carregando grupos"
          />
        ) : groupsState.status === "error" ? (
          <AlertBox title="Grupos temporariamente indisponiveis" tone="warning">
            Nao foi possivel carregar os grupos agora. Tente novamente em instantes.
          </AlertBox>
        ) : groupsState.status === "empty" ? (
          <EmptyState
            description="Nenhum grupo esta disponivel para exibicao publica neste momento."
            title="Nenhum grupo disponivel"
          />
        ) : (
          <>
            {groupsState.notice ? (
              <AlertBox title="Modo demonstrativo ativo" tone="info">
                {groupsState.notice}
              </AlertBox>
            ) : null}
            <div className="group-grid">
              {groupsState.groups.map((group) => (
                <GroupCard
                  actionLabel="Entrar no encontro"
                  actionHref={group.meetUrl ?? undefined}
                  group={group}
                  key={group.slug}
                />
              ))}
            </div>
          </>
        )}
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
