import { useEffect, useMemo, useState } from "react";

import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { SectionTitle } from "../components/ui/SectionTitle";
import type { DemoGroup } from "../mocks";
import { collectServiceNotice } from "../services/api";
import { listStudies } from "../services/studiesService";

const teacherNames = ["Professora Ariete", "Professor Luiz"];

const publicFlow = [
  "Conheca os grupos, dias e proposta de estudo antes de pedir participacao.",
  "Envie seu interesse pelo portal para que os professores revisem a solicitacao com calma.",
  "Depois da revisao, o acesso ao encontro e confirmado de forma acolhedora e organizada.",
];

export const EducationContinuedPage = () => {
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadPage = async () => {
      setIsLoading(true);

      const studiesResult = await listStudies();

      if (!isActive) {
        return;
      }

      setGroups(studiesResult.data);
      setNotice(collectServiceNotice([studiesResult]));
      setIsLoading(false);
    };

    void loadPage();

    return () => {
      isActive = false;
    };
  }, []);

  const teacherList = useMemo(() => teacherNames.join(" e "), []);

  const scrollToGroups = () => {
    document.getElementById("educacao-continuada-grupos")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="education-page page-stack">
      <div className="page-anchor" id="educacao-continuada-inicio">
        <ProfileHeader
          actions={
            <div className="button-row">
              <Button to="/inscricao">Quero participar</Button>
              <Button onClick={scrollToGroups} variant="secondary">
                Conhecer os grupos
              </Button>
            </div>
          }
          badge="Pagina publica"
          description="Um caminho simples para quem chegou pelo QR Code conhecer a proposta dos encontros online antes de pedir participacao."
          eyebrow="Entrada pelo QR Code"
          meta={[
            { label: "Formato", value: "Online e gratuito" },
            { label: "Professores", value: teacherList },
            { label: "Acesso ao encontro", value: "Liberado apos revisao" },
          ]}
          title="Educacao Continuada Online"
        />
      </div>

      <AlertBox
        title={notice ? "Modo demonstrativo ativo" : "Acolhimento antes do encontro"}
        tone={notice ? "info" : "success"}
      >
        {notice ??
          "Apos o cadastro, os professores revisarao sua solicitacao e enviarao a confirmacao de acesso."}
      </AlertBox>

      <section className="page-section" id="educacao-continuada-proposta">
        <SectionTitle
          description="A proposta desta pagina e acolher novos participantes sem expor o link do encontro antes da revisao pelos professores."
          title="Como funciona"
        />

        <div className="two-column-grid education-intro-grid">
          <Card className="education-intro-card" tone="brand">
            <p className="card-eyebrow">Proposta</p>
            <h3>Estudos gratuitos, online e acolhedores.</h3>
            <p className="student-panel__note">
              Os encontros apoiam grupos de estudo com linguagem simples, materiais curtos e
              revisao humana. O foco e acolher bem quem esta chegando e manter o grupo organizado.
            </p>
            <div className="stack-list">
              {publicFlow.map((item) => (
                <p className="stack-list__item student-panel__note" key={item}>
                  {item}
                </p>
              ))}
            </div>
          </Card>

          <Card className="education-intro-card" tone="soft">
            <p className="card-eyebrow">Professores</p>
            <h3>Referencia humana em cada etapa</h3>
            <div className="education-teachers" role="list" aria-label="Professores responsaveis">
              {teacherNames.map((teacher) => (
                <Badge key={teacher} tone="sand">
                  {teacher}
                </Badge>
              ))}
            </div>
            <p className="student-panel__note">
              O acesso ao encontro e organizado pelos professores depois da revisao do interesse.
              Isso ajuda a proteger o ambiente do grupo e a receber cada pessoa com mais clareza.
            </p>
          </Card>
        </div>
      </section>

      <section className="page-section" id="educacao-continuada-grupos">
        <SectionTitle
          description="Veja os grupos disponiveis, os horarios fixos e o tom de cada encontro antes de seguir para o portal."
          title="Grupos disponiveis"
        />

        {isLoading ? (
          <LoadingState
            description="Estamos reunindo os grupos e os horarios desta semana."
            title="Carregando grupos"
          />
        ) : groups.length === 0 ? (
          <EmptyState
            description="Nao encontramos grupos para exibir agora. Tente novamente em instantes."
            title="Nenhum grupo disponivel"
          />
        ) : (
          <div className="group-grid">
            {groups.map((group) => (
              <Card className="education-group-card" key={group.slug} tone="default">
                <div className="education-group-card__top">
                  <div>
                    <p className="card-eyebrow">Grupo disponivel</p>
                    <h3>{group.name}</h3>
                  </div>
                  <Badge tone="brand">{group.participantCount} participantes</Badge>
                </div>

                <p className="education-group-card__schedule">
                  {group.name}: {group.meetingDay}, {group.meetingTime}
                </p>
                <p className="student-panel__note">{group.description}</p>

                <dl className="student-detail-list">
                  <div>
                    <dt>Livro e foco do grupo</dt>
                    <dd>{group.bookTitle}</dd>
                  </div>
                  <div>
                    <dt>Tema da proxima conversa</dt>
                    <dd>{group.nextLesson.title}</dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="page-section" id="educacao-continuada-acoes">
        <SectionTitle
          description="O proximo passo acontece pelo portal compartilhavel, onde o visitante pode seguir para o contato inicial."
          title="Proximo passo"
        />

        <Card className="education-cta-card" tone="sand">
          <div className="education-cta-card__content">
            <div>
              <p className="card-eyebrow">Participacao com revisao</p>
              <h3>Entre pelo portal para pedir participacao</h3>
              <p className="student-panel__note">
                O link do Google Meet nao aparece nesta pagina publica. Primeiro, o visitante
                conhece os grupos e envia seu interesse para revisao.
              </p>
            </div>

            <div className="button-row">
              <Button to="/inscricao">Quero participar</Button>
              <Button to="/materiais" variant="secondary">
                Ver materiais dos grupos
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};
