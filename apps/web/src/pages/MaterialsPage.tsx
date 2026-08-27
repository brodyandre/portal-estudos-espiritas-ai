import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { SectionTitle } from "../components/ui/SectionTitle";
import { StatusTag } from "../components/ui/StatusTag";
import { collectServiceNotice } from "../services/api";
import {
  getPublicKnowledgeGroupId,
  listKnowledgeFilesByGroup,
  type KnowledgeSupportFile,
} from "../services/knowledgeService";
import { listStudies } from "../services/studiesService";
import type { StudyGroupId } from "../types/studyGroup";

const genericGroupShortGoal =
  "Apoiar o estudo com constancia, escuta respeitosa e perguntas serenas para o grupo.";

const groupShortGoals: Partial<Record<StudyGroupId, string>> = {
  emmanuel:
    "Apoiar o estudo com constancia, escuta respeitosa e aplicacao pratica no dia a dia.",
  "a-caminho-da-luz":
    "Apoiar a leitura com prudencia, boa convivencia e perguntas serenas para o grupo.",
};

export const MaterialsPage = () => {
  const { groupSlug: routeGroupSlug } = useParams<{ groupSlug?: string }>();
  const selectedRouteGroupSlug = routeGroupSlug?.trim() || null;
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof listStudies>>["data"]>([]);
  const [supportFiles, setSupportFiles] = useState<Record<string, KnowledgeSupportFile[]>>({
    emmanuel: [],
    "a-caminho-da-luz": [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadMaterials = async () => {
      setIsLoading(true);
      setCatalogError(null);

      const studiesResult = await listStudies();
      const groupsToLoad = selectedRouteGroupSlug
        ? studiesResult.data.filter((group) => group.slug === selectedRouteGroupSlug)
        : studiesResult.data;
      const knowledgeResults = await Promise.all(
        groupsToLoad.map(async (group) => {
          const result = await listKnowledgeFilesByGroup(group.slug);
          return [group.slug, result] as const;
        }),
      );

      if (!isActive) {
        return;
      }

      setGroups(studiesResult.data);
      setSupportFiles(
        Object.fromEntries(
          knowledgeResults.map(([groupSlug, result]) => [groupSlug, result.data]),
        ),
      );
      setNotice(
        collectServiceNotice([studiesResult, ...knowledgeResults.map(([, result]) => result)]),
      );
      setIsLoading(false);
    };

    void loadMaterials().catch(() => {
      if (!isActive) {
        return;
      }

      setGroups([]);
      setSupportFiles({});
      setCatalogError("Não foi possível carregar o catálogo público de grupos agora.");
      setNotice(null);
      setIsLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [selectedRouteGroupSlug]);

  const activeGroup = useMemo(() => {
    if (!selectedRouteGroupSlug) {
      return null;
    }

    return groups.find((group) => group.slug === selectedRouteGroupSlug) ?? null;
  }, [groups, selectedRouteGroupSlug]);

  const activeFiles = activeGroup ? supportFiles[activeGroup.slug] ?? [] : [];
  const activeFaqFiles = activeFiles.filter((file) => file.type === "faq");
  const activeSensitiveFiles = activeFiles.filter((file) => file.teacherReviewRecommended);
  const activeHasPublicKnowledge = activeGroup
    ? getPublicKnowledgeGroupId(activeGroup.slug) !== null
    : false;
  const isTrueNotFound = Boolean(selectedRouteGroupSlug) && !isLoading && !catalogError && !activeGroup;
  const groupsCountLabel =
    groups.length > 0 ? `${groups.length} grupo${groups.length === 1 ? "" : "s"}` : "A carregar";

  if (isTrueNotFound) {
    return (
      <div className="materials-page page-stack">
        <EmptyState
          action={
            <Button to="/materiais" variant="secondary">
              Voltar para materiais
            </Button>
          }
          description="O livro solicitado nao foi encontrado. Escolha um dos grupos disponiveis para continuar."
          title="Material nao encontrado"
        />
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="materials-page page-stack">
        <EmptyState
          action={
            <Button to="/portal" variant="secondary">
              Voltar ao portal
            </Button>
          }
          description="Não foi possível consultar o catálogo público de grupos agora. Tente novamente em instantes."
          title="Materiais indisponíveis"
        />
      </div>
    );
  }

  return (
    <div className="materials-page page-stack">
      <div className="page-anchor" id="materiais-inicio">
        <ProfileHeader
          actions={
            <div className="button-row">
              <Button to="/portal" variant="secondary">
                Voltar ao portal
              </Button>
              <Button to={selectedRouteGroupSlug ? `/aluno?grupo=${selectedRouteGroupSlug}` : "/aluno"}>
                Perguntar ao assistente
              </Button>
            </div>
          }
          badge="Biblioteca simples"
          description={
            selectedRouteGroupSlug && activeGroup
              ? `Arquivos curtos do livro ${activeGroup.name} para apoiar alunos e professores com linguagem simples e revisavel.`
              : "Escolha um livro para ver arquivos curtos, tags, duvidas frequentes e orientacoes de revisao humana."
          }
          eyebrow="Materiais"
          meta={
            selectedRouteGroupSlug && activeGroup
              ? [
                  { label: "Livro", value: activeGroup.name },
                  { label: "Arquivos", value: String(activeFiles.length) },
                  { label: "Duvidas frequentes", value: String(activeFaqFiles.length) },
                ]
              : [
                  { label: "Livros", value: groupsCountLabel },
                  { label: "Uso", value: "Aluno e professor" },
                  { label: "Acesso", value: "Sem login" },
                ]
          }
          title={
            selectedRouteGroupSlug && activeGroup
              ? `Materiais de ${activeGroup.name}`
              : "Materiais dos livros"
          }
        />
      </div>

      <AlertBox
        title={notice ? "Modo demonstrativo ativo" : "Leitura curta e revisavel"}
        tone={notice ? "info" : "success"}
      >
        {notice ??
          "Os materiais abaixo foram organizados para consulta rapida. Em temas sensiveis, vale conversar com o professor antes de fechar uma conclusao."}
      </AlertBox>

      {isLoading ? (
        <LoadingState
          description="Estamos reunindo os materiais dos livros para montar esta pagina."
          title="Carregando materiais"
        />
      ) : !selectedRouteGroupSlug ? (
        <>
          <section className="page-section" id="materiais-grupos">
            <SectionTitle
              description="Cada grupo tem uma base curta de apoio com arquivos escaneaveis, perguntas frequentes e lembretes de revisao humana."
              title="Escolha um livro"
            />

            <div className="group-grid">
              {groups.map((group) => {
                const groupFiles = supportFiles[group.slug] ?? [];
                const hasPublicKnowledge = getPublicKnowledgeGroupId(group.slug) !== null;
                const fileTags = [...new Set(groupFiles.flatMap((file) => file.tags))].slice(0, 5);
                const faqCount = groupFiles.filter((file) => file.type === "faq").length;

                return (
                  <Card
                    className="group-card materials-group-card"
                    key={group.slug}
                    tone="default"
                  >
                    <div className="group-card__top">
                      <Badge tone="brand">
                        {hasPublicKnowledge
                          ? `${groupFiles.length} arquivos`
                          : "Materiais em preparação"}
                      </Badge>
                      <StatusTag
                        label={hasPublicKnowledge ? `${faqCount} FAQ` : "Em preparação"}
                        tone="upcoming"
                      />
                    </div>

                    <div className="group-card__content">
                      <h3>{group.name}</h3>
                      {group.description ? <p>{group.description}</p> : null}
                    </div>

                    <p className="portal-card-note">
                      {groupShortGoals[group.slug] ?? genericGroupShortGoal}
                    </p>

                    <div className="materials-tag-row" aria-label="Tags do livro">
                      {fileTags.map((tag) => (
                        <Badge key={`${group.slug}-${tag}`} tone="neutral">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="button-row">
                      <Button to={`/materiais/${group.slug}`}>Ver materiais</Button>
                      <Button to={`/aluno?grupo=${group.slug}`} variant="secondary">
                        Perguntar ao assistente
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="page-section" id="materiais-aviso">
            <AlertBox title="Revisao humana" tone="warning">
              Os arquivos ajudam a preparar leitura, duvidas e aulas, mas nao substituem a orientacao
              do professor.
            </AlertBox>
          </section>
        </>
      ) : !activeGroup ? (
        <EmptyState
          action={
            <Button to="/materiais" variant="secondary">
              Voltar para materiais
            </Button>
          }
          description="Nao foi possivel carregar os dados deste grupo agora."
          title="Grupo indisponivel"
        />
      ) : (
        <>
          <section className="page-section">
            <div className="two-column-grid materials-overview-grid">
              <Card className="materials-overview-card" tone="brand">
                <p className="card-eyebrow">Titulo do livro</p>
                <h3>{activeGroup.name}</h3>
                <p className="card-subtitle">Objetivo do grupo</p>
                <p>{activeGroup.description}</p>
                <p className="portal-card-note">
                  {groupShortGoals[activeGroup.slug] ?? genericGroupShortGoal}
                </p>
              </Card>

              <Card className="materials-overview-card" tone="soft">
                <p className="card-eyebrow">Uso rapido</p>
                <h3>Bom para alunos e professores</h3>
                <p className="student-panel__note">
                  Alunos podem revisar os temas antes da aula. Professores podem usar a base para
                  preparar o encontro e observar pontos que pedem cuidado.
                </p>
                <div className="button-row">
                  <Button to={`/aluno?grupo=${activeGroup.slug}`}>Perguntar ao assistente</Button>
                  <Button to="/portal" variant="secondary">
                    Voltar ao portal
                  </Button>
                </div>
              </Card>
            </div>
          </section>

          <section className="page-section" id="materiais-arquivos">
            <SectionTitle
              description="A lista abaixo mostra os arquivos da base com um resumo curto, tags e sinais de atencao quando houver temas mais delicados."
              title="Arquivos da base"
            />

            {activeFiles.length > 0 ? (
              <div className="materials-file-list">
                {activeFiles.map((file) => (
                  <Card className="materials-file-card" key={file.id} tone="soft">
                    <div className="student-panel__header">
                      <div>
                        <h3>{file.title}</h3>
                        <p className="stack-list__meta">{file.typeLabel}</p>
                      </div>
                      <Badge tone="sand">{file.typeLabel}</Badge>
                    </div>

                    <p className="student-panel__note">{file.summary}</p>

                    <div className="materials-tag-row" aria-label="Tags do arquivo">
                      {file.tags.slice(0, 5).map((tag) => (
                        <Badge key={`${file.id}-${tag}`} tone="neutral">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {file.sensitiveTopics.length > 0 ? (
                      <div className="materials-sensitive-block">
                        <p className="stack-list__meta">Temas sensiveis</p>
                        <div className="materials-tag-row" aria-label="Temas sensiveis">
                          {file.sensitiveTopics.map((topic) => (
                            <Badge key={`${file.id}-${topic}`} tone="sand">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                description={
                  activeHasPublicKnowledge
                    ? "Ainda nao encontramos arquivos curtos para este livro."
                    : "Ainda não há materiais públicos disponíveis para este livro."
                }
                title={activeHasPublicKnowledge ? "Sem arquivos disponiveis" : "Materiais em preparação"}
              />
            )}
          </section>

          <section className="page-section" id="materiais-duvidas">
            <SectionTitle
              description="Estas duvidas frequentes ajudam a retomar pontos recorrentes com linguagem simples e prudente."
              title="Duvidas frequentes"
            />

            {activeFaqFiles.length > 0 ? (
              <div className="two-column-grid">
                {activeFaqFiles.map((file) => (
                  <Card className="materials-faq-card" key={file.id} tone="default">
                    <div className="student-panel__header">
                      <h3>{file.title}</h3>
                      <Badge tone="sand">FAQ</Badge>
                    </div>
                    <p className="student-panel__note">{file.summary}</p>
                    <div className="materials-tag-row" aria-label="Tags das duvidas frequentes">
                      {file.tags.slice(0, 5).map((tag) => (
                        <Badge key={`${file.id}-faq-${tag}`} tone="neutral">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                description="Ainda nao ha um bloco de duvidas frequentes para este livro."
                title="Sem duvidas frequentes"
              />
            )}
          </section>

          <section className="page-section" id="materiais-aviso">
            <AlertBox title="Aviso de revisao humana" tone="warning">
              {activeSensitiveFiles.length > 0
                ? "Alguns arquivos deste livro tratam temas que pedem cuidado. Use o material como apoio e leve os pontos mais delicados ao professor."
                : "Use os resumos como apoio ao estudo. Mesmo em temas mais tranquilos, o professor continua sendo a referencia principal do grupo."}
            </AlertBox>
          </section>
        </>
      )}
    </div>
  );
};
