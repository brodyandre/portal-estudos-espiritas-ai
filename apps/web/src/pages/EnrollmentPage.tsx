import { useMemo, useState } from "react";

import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SectionTitle } from "../components/ui/SectionTitle";
import { Select } from "../components/ui/Select";
import { TextArea } from "../components/ui/TextArea";
import { TextInput } from "../components/ui/TextInput";
import {
  ENROLLMENT_GROUP_INTERESTS,
  ENROLLMENT_MESSAGE_MAX_LENGTH,
  ENROLLMENT_PARTICIPATION_OPTIONS,
  type EnrollmentInput,
  type EnrollmentValidationErrors,
  validateEnrollmentInput,
} from "../types/enrollment";
import { createEnrollment } from "../services/enrollmentsService";
import { writeStudentAccessStatus } from "../services/studentAccessService";

type EnrollmentFormState = EnrollmentInput & {
  consentAccepted: boolean;
};

type EnrollmentFormErrors = EnrollmentValidationErrors & {
  consentAccepted?: string;
};

const initialFormState: EnrollmentFormState = {
  fullName: "",
  email: "",
  whatsapp: "",
  groupInterest: "Ainda não sei",
  alreadyParticipates: "Não",
  message: "",
  teacherNote: "",
  consentAccepted: false,
};

const buildFormErrors = (values: EnrollmentFormState): EnrollmentFormErrors => {
  const errors: EnrollmentFormErrors = {
    ...validateEnrollmentInput(values),
  };

  if (!values.consentAccepted) {
    errors.consentAccepted = "Autorize o uso dos dados para continuar.";
  }

  return errors;
};

export const EnrollmentPage = () => {
  const [formState, setFormState] = useState<EnrollmentFormState>(initialFormState);
  const [formErrors, setFormErrors] = useState<EnrollmentFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const remainingCharacters = useMemo(() => {
    return ENROLLMENT_MESSAGE_MAX_LENGTH - (formState.message?.length ?? 0);
  }, [formState.message]);

  const updateField = <T extends keyof EnrollmentFormState>(field: T, value: EnrollmentFormState[T]) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
    setFormErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = buildFormErrors(formState);

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmittedNotice(null);

    const result = await createEnrollment(formState);

    setSubmittedNotice(result.notice);
    writeStudentAccessStatus("pending");
    setHasSubmitted(true);
    setIsSubmitting(false);
    setFormState(initialFormState);
    setFormErrors({});
  };

  if (hasSubmitted) {
    return (
      <div className="enrollment-page page-stack">
        <div className="page-anchor" id="inscricao-inicio">
          <ProfileHeader
            actions={
              <div className="button-row">
                <Button to="/portal">Voltar ao portal</Button>
                <Button to="/educacao-continuada" variant="secondary">
                  Rever os grupos
                </Button>
              </div>
            }
            badge="Solicitacao enviada"
            description="Recebemos seu interesse com os dados basicos para organizacao do acolhimento."
            eyebrow="Inscricao"
            meta={[
              { label: "Etapa atual", value: "Aguardando revisao" },
              { label: "Acesso ao encontro", value: "Somente apos confirmacao" },
            ]}
            title="Solicitacao recebida"
          />
        </div>

        <AlertBox title="Tudo certo" tone="success">
          Sua solicitacao foi recebida. Os professores revisarao seu cadastro e enviarao a
          confirmacao de acesso.
        </AlertBox>

        {submittedNotice ? (
          <AlertBox title="Modo demonstrativo ativo" tone="info">
            {submittedNotice}
          </AlertBox>
        ) : null}

        <Card className="enrollment-success-card" tone="soft">
          <p className="card-eyebrow">Proximo passo</p>
          <h3>Os professores farão a revisao antes de liberar o encontro.</h3>
          <p className="student-panel__note">
            Enquanto isso, voce pode conhecer melhor o portal, os grupos e os materiais curtos de
            apoio. O link do Google Meet nao aparece nesta etapa publica.
          </p>
          <div className="button-row">
            <Button to="/portal">Ir para o portal</Button>
            <Button to="/materiais" variant="secondary">
              Ver materiais dos grupos
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="enrollment-page page-stack">
      <div className="page-anchor" id="inscricao-inicio">
        <ProfileHeader
          actions={
            <div className="button-row">
              <Button to="/educacao-continuada" variant="secondary">
                Voltar aos grupos
              </Button>
              <Button to="/portal" variant="ghost">
                Abrir portal
              </Button>
            </div>
          }
          badge="Cadastro simples"
          description="Preencha apenas os dados basicos para que os professores possam organizar o acolhimento dos proximos encontros."
          eyebrow="Inscricao"
          meta={[
            { label: "Tempo", value: "Menos de 2 minutos" },
            { label: "Dados pedidos", value: "Somente contato e interesse" },
            { label: "Meet", value: "Nao exibido nesta etapa" },
          ]}
          title="Quero participar dos estudos online"
        />
      </div>

      <AlertBox title="Uso dos dados apenas para organizacao" tone="info">
        Informe apenas dados basicos de contato. O grupo nao pede documento, endereco, religiao ou
        informacoes pessoais sensiveis nesta etapa.
      </AlertBox>

      <section className="page-section" id="inscricao-formulario">
        <SectionTitle
          description="O cadastro e curto, acolhedor e pensado para funcionar bem no celular e no desktop."
          title="Cadastro de interesse"
        />

        <div className="two-column-grid enrollment-layout">
          <Card className="enrollment-form-card" tone="default">
            <form className="form-grid enrollment-form" noValidate onSubmit={handleSubmit}>
              <TextInput
                autoComplete="name"
                error={formErrors.fullName}
                id="enrollment-full-name"
                label="Nome completo"
                onChange={(event) => updateField("fullName", event.target.value)}
                placeholder="Como voce prefere ser identificado"
                required
                value={formState.fullName}
              />

              <TextInput
                autoComplete="email"
                error={formErrors.email}
                id="enrollment-email"
                inputMode="email"
                label="E-mail"
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="voce@exemplo.com"
                required
                type="email"
                value={formState.email}
              />

              <TextInput
                autoComplete="tel"
                error={formErrors.whatsapp}
                id="enrollment-whatsapp"
                inputMode="tel"
                label="WhatsApp"
                onChange={(event) => updateField("whatsapp", event.target.value)}
                placeholder="(11) 99999-0000"
                required
                value={formState.whatsapp}
              />

              <Select
                error={formErrors.groupInterest}
                id="enrollment-group-interest"
                label="Grupo de interesse"
                onChange={(event) =>
                  updateField("groupInterest", event.target.value as EnrollmentFormState["groupInterest"])
                }
                options={ENROLLMENT_GROUP_INTERESTS.map((option) => ({
                  label: option,
                  value: option,
                }))}
                required
                value={formState.groupInterest}
              />

              <Select
                id="enrollment-already-participates"
                label="Voce ja participa da casa espirita?"
                onChange={(event) =>
                  updateField(
                    "alreadyParticipates",
                    event.target.value as EnrollmentFormState["alreadyParticipates"],
                  )
                }
                options={ENROLLMENT_PARTICIPATION_OPTIONS.map((option) => ({
                  label: option,
                  value: option,
                }))}
                required
                value={formState.alreadyParticipates}
              />

              <TextArea
                error={formErrors.message}
                helperText={`${remainingCharacters} caracteres restantes.`}
                id="enrollment-message"
                label="Conte brevemente seu interesse pelo estudo"
                maxLength={ENROLLMENT_MESSAGE_MAX_LENGTH}
                onChange={(event) => updateField("message", event.target.value)}
                placeholder="Mensagem opcional"
                rows={5}
                value={formState.message}
              />

              <label className="enrollment-consent" htmlFor="enrollment-consent">
                <span className="enrollment-consent__control">
                  <input
                    checked={formState.consentAccepted}
                    id="enrollment-consent"
                    onChange={(event) => updateField("consentAccepted", event.target.checked)}
                    required
                    type="checkbox"
                  />
                  <span className="enrollment-consent__text">
                    Autorizo o uso dos meus dados apenas para organizacao das aulas online.
                  </span>
                </span>
                {formErrors.consentAccepted ? (
                  <span className="field__message field__message--error">
                    {formErrors.consentAccepted}
                  </span>
                ) : null}
              </label>

              <div className="button-row">
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Enviando..." : "Enviar inscricao"}
                </Button>
              </div>
            </form>
          </Card>

          <div className="page-stack">
            <Card tone="soft">
              <p className="card-eyebrow">O que vamos pedir</p>
              <div className="stack-list">
                <p className="stack-list__item student-panel__note">Nome completo</p>
                <p className="stack-list__item student-panel__note">E-mail</p>
                <p className="stack-list__item student-panel__note">WhatsApp</p>
                <p className="stack-list__item student-panel__note">Grupo de interesse</p>
                <p className="stack-list__item student-panel__note">Mensagem curta, se desejar</p>
              </div>
            </Card>

            <Card tone="sand">
              <p className="card-eyebrow">Importante</p>
              <h3>O encontro so aparece depois da revisao.</h3>
              <p className="student-panel__note">
                O Google Meet nao fica aberto nesta etapa publica. Primeiro, os professores revisam
                a solicitacao e confirmam o proximo passo com voce.
              </p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};
