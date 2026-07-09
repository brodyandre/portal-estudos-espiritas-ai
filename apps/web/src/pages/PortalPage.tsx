import { useEffect, useMemo, useState } from "react";

import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { SectionTitle } from "../components/ui/SectionTitle";
import { Select } from "../components/ui/Select";
import { StatusTag } from "../components/ui/StatusTag";
import { TextArea } from "../components/ui/TextArea";
import type { DemoGroup, DemoMaterial, DemoSummary, GroupSlug } from "../mocks";
import { collectServiceNotice } from "../services/api";
import { listMaterials } from "../services/materialsService";
import { createQuestion } from "../services/questionsService";
import { listStudies } from "../services/studiesService";
import { listSummaries } from "../services/summariesService";

const newcomerTips = [
  "Escolha o grupo que deseja acompanhar e confira o horario do encontro.",
  "Entre no Google Meet alguns minutos antes, quando for possivel.",
  "Leia o resumo e um material curto para chegar ao encontro com mais tranquilidade.",
  "Se surgir uma duvida, registre a pergunta sem precisar informar dados pessoais.",
];

const responsibleUsePoints = [
  "O assistente ajuda a revisar materiais e organizar perguntas.",
  "Em pontos importantes, confirme a orientacao com o professor.",
  "Use apenas os materiais cadastrados e a conversa respeitosa do grupo como base.",
];

export const PortalPage = () => {
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [materials, setMaterials] = useState<DemoMaterial[]>([]);
  const [summaries, setSummaries] = useState<DemoSummary[]>([]);
  const [activeGroupSlug, setActiveGroupSlug] = useState<GroupSlug>("emmanuel");
  const [questionDraft, setQuestionDraft] = useState("");
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [questionNotice, setQuestionNotice] = useState<string | null>(null);
  const [isQuestionSending, setIsQuestionSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadPortal = async () => {
      setIsLoading(true);

      const [studiesResult, materialsResult, summariesResult] = await Promise.all([
        listStudies(),
        listMaterials(),
        listSummaries(),
      ]);

      if (!isActive) {
        return;
      }

      setGroups(studiesResult.data);
      setMaterials(materialsResult.data);
      setSummaries(summariesResult.data);
      setNotice(collectServiceNotice([studiesResult, materialsResult, summariesResult]));
      setActiveGroupSlug((currentSlug) => {
        return studiesResult.data.some((group) => group.slug === currentSlug)
          ? currentSlug
          : (studiesResult.data[0]?.slug ?? currentSlug);
      });
      setIsLoading(false);
    };

    void loadPortal();

    return () => {
      isActive = false;
    };
  }, []);

  const participantTotal = groups.reduce((total, group) => total + group.participantCount, 0);
  const activeGroup = groups.find((group) => group.slug === activeGroupSlug) ?? groups[0] ?? null;
  const activeSummary = useMemo(() => {
    if (!activeGroup) {
      return null;
    }

    return summaries.find((summary) => summary.groupSlug === activeGroup.slug) ?? null;
  }, [activeGroup, summaries]);
  const activeMaterials = useMemo(() => {
    if (!activeGroup) {
      return [];
    }

    return materials.filter((material) => material.groupSlug === activeGroup.slug);
  }, [activeGroup, materials]);

  const handleQuestionSubmit = async () => {
    if (!activeGroup || isQuestionSending) {
      return;
    }

    const normalizedQuestion = questionDraft.trim();

    if (normalizedQuestion.length < 10) {
      setQuestionError("Escreva uma duvida com pelo menos 10 caracteres.");
      return;
    }

    setIsQuestionSending(true);
    setQuestionError(null);
    setQuestionNotice(null);

    const result = await createQuestion({
      groupId: activeGroup.slug,
      lessonId: activeGroup.nextLesson.id,
      authorName: "Participante do portal",
      question: normalizedQuestion,
      visibility: "teacher",
    });

    setQuestionNotice(
      result.notice ??
        `Sua duvida sobre ${activeGroup.name} foi registrada para revisao do professor.`,
    );
    setQuestionDraft("");
    setIsQuestionSending(false);
  };

  return (
    <div className="portal-page page-stack">
      <ProfileHeader
        actions={
          <div className="button-row">
            <Button to="/aluno">Abrir area do aluno</Button>
            <Button to="/professor" variant="secondary">
              Abrir area do professor
            </Button>
          </div>
        }
        badge="Pagina compartilhavel"
        description="Boas-vindas ao portal dos encontros online. Aqui voce encontra os grupos, o tema da semana, materiais de apoio e um caminho simples para enviar duvidas sem login."
        eyebrow="Portal"
        meta={[
          { label: "Grupos ativos", value: String(groups.length || 2) },
          {
            label: "Participantes",
            value: participantTotal > 0 ? `${participantTotal} ao todo` : "Carregando",
          },
          { label: "Acesso", value: "Sem login" },
        ]}
        title="Boas-vindas aos estudos espiritas online"
      />

      <AlertBox
        title={notice ? "Modo demonstrativo ativo" : "Portal aberto e acolhedor"}
        tone={notice ? "info" : "success"}
      >
        {notice ??
          "Esta pagina pode ser compartilhada com novos participantes. Os encontros, materiais e orientacoes aparecem de forma simples, sem exigir cadastro."}
      </AlertBox>

      <section className="page-section">
        <SectionTitle
          description="Os dois grupos ficam visiveis no topo para facilitar o acesso rapido ao encontro e aos detalhes da semana."
          title="Grupos e Google Meet"
        />

        {isLoading ? (
          <LoadingState
            description="Estamos reunindo grupos, materiais e resumos para montar esta pagina."
            title="Carregando o portal"
          />
        ) : groups.length === 0 ? (
          <EmptyState
            description="Nao encontramos grupos para exibir agora. Tente novamente em instantes."
            title="Nenhum grupo disponivel"
          />
        ) : (
          <div className="group-grid">
            {groups.map((group) => {
              const groupSummary =
                summaries.find((summary) => summary.groupSlug === group.slug) ?? null;
              const isActive = activeGroup?.slug === group.slug;

              return (
                <Card
                  className={`group-card portal-group-card ${
                    isActive ? "portal-group-card--active" : ""
                  }`}
                  key={group.slug}
                  tone={isActive ? "brand" : "default"}
                >
                  <div className="group-card__top">
                    <Badge tone="brand">{group.participantCount} participantes</Badge>
                    <StatusTag
                      label={isActive ? "Em destaque" : undefined}
                      tone={group.nextLesson.status === "hoje" ? "active" : "upcoming"}
                    />
                  </div>

                  <div className="group-card__content">
                    <h3>{group.name}</h3>
                    <p>{group.description}</p>
                  </div>

                  <dl className="group-card__meta">
                    <div>
                      <dt>Encontro</dt>
                      <dd>
                        {group.meetingDay}, {group.meetingTime}
                      </dd>
                    </div>
                    <div>
                      <dt>Tema da semana</dt>
                      <dd>{group.nextLesson.title}</dd>
                    </div>
                    <div>
                      <dt>Resumo da ultima aula</dt>
                      <dd>{groupSummary?.title ?? "Resumo demonstrativo da semana"}</dd>
                    </div>
                  </dl>

                  <div className="button-row">
                    <Button href={group.meetUrl} rel="noreferrer" target="_blank">
                      Entrar no Google Meet
                    </Button>
                    <Button
                      onClick={() => setActiveGroupSlug(group.slug)}
                      variant={isActive ? "primary" : "secondary"}
                    >
                      {isActive ? "Detalhes abertos" : "Ver detalhes"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {isLoading || !activeGroup ? null : (
        <>
          <section className="page-section">
            <SectionTitle
              description={`Tudo o que voce precisa para acompanhar o grupo ${activeGroup.name} nesta semana.`}
              title="Tema da semana e resumo da ultima aula"
            />

            <div className="two-column-grid portal-section-grid">
              <Card className="portal-detail-card" tone="brand">
                <p className="card-eyebrow">Tema da semana</p>
                <h3>{activeGroup.nextLesson.title}</h3>
                <p className="card-subtitle">{activeGroup.nextLesson.scheduledLabel}</p>
                <p>{activeGroup.nextLesson.theme}</p>
                <div className="button-row">
                  <Button href={activeGroup.meetUrl} rel="noreferrer" target="_blank">
                    Entrar no Google Meet
                  </Button>
                </div>
              </Card>

              <Card className="portal-detail-card" tone="soft">
                <p className="card-eyebrow">Resumo da ultima aula</p>
                <h3>{activeSummary?.title ?? "Resumo demonstrativo"}</h3>
                <p>{activeSummary?.content ?? "Resumo breve disponivel para acolher novos participantes."}</p>
              </Card>
            </div>
          </section>

          <section className="page-section">
            <SectionTitle
              description="Materiais curtos ajudam novos participantes e alunos regulares a chegar ao encontro com mais serenidade."
              title="Materiais da semana"
            />

            <div className="three-column-grid">
              {activeMaterials.map((material) => (
                <Card key={material.id} tone="soft">
                  <div className="student-panel__header">
                    <h3>{material.title}</h3>
                    <Badge tone="sand">{material.kind}</Badge>
                  </div>
                  <p className="student-panel__note">{material.description}</p>
                  <p className="student-panel__note">{material.publishedLabel}</p>
                </Card>
              ))}
            </div>
          </section>

          <section className="page-section">
            <SectionTitle
              description="Use este campo para registrar uma duvida curta. O professor podera revisar antes do proximo encontro."
              title="Enviar duvida"
            />

            <div className="two-column-grid">
              <Card tone="default">
                <Select
                  id="portal-group"
                  label="Grupo"
                  onChange={(event) => setActiveGroupSlug(event.target.value as GroupSlug)}
                  options={groups.map((group) => ({
                    label: group.name,
                    value: group.slug,
                  }))}
                  value={activeGroup.slug}
                />

                <TextArea
                  id="portal-question"
                  label="Sua duvida"
                  onChange={(event) => setQuestionDraft(event.target.value)}
                  rows={5}
                  value={questionDraft}
                />

                {questionError ? (
                  <AlertBox title="Ajuste sua mensagem" tone="warning">
                    {questionError}
                  </AlertBox>
                ) : null}

                {questionNotice ? (
                  <AlertBox title="Duvida registrada" tone="success">
                    {questionNotice}
                  </AlertBox>
                ) : null}

                <div className="button-row">
                  <Button onClick={() => void handleQuestionSubmit()}>
                    {isQuestionSending ? "Enviando..." : "Enviar duvida"}
                  </Button>
                </div>
              </Card>

              <Card tone="sand">
                <p className="card-eyebrow">Uso responsavel do assistente</p>
                <h3>Apoio simples, sempre com revisao humana</h3>
                <div className="page-stack">
                  {responsibleUsePoints.map((item) => (
                    <p className="student-panel__note" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              </Card>
            </div>
          </section>

          <section className="page-section">
            <SectionTitle
              description="Novos participantes conseguem entender o ritmo do grupo com poucos passos e sem termos tecnicos."
              title="Orientacao para novos participantes"
            />

            <div className="two-column-grid">
              <Card tone="soft">
                <div className="page-stack">
                  {newcomerTips.map((tip) => (
                    <p className="student-panel__note" key={tip}>
                      {tip}
                    </p>
                  ))}
                </div>
              </Card>

              <Card tone="default">
                <p className="card-eyebrow">Apoio ao estudo</p>
                <h3>Sem substituir o professor</h3>
                <p className="student-panel__note">
                  Este portal ajuda a organizar o acesso ao Meet, os materiais e as duvidas da
                  semana. O acompanhamento do professor continua sendo a referencia principal do
                  estudo.
                </p>
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
