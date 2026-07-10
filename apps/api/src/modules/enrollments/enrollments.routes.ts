import { Router } from "express";

import { AppError } from "../../lib/app-error";
import { sendSuccess } from "../../lib/api-response";
import { asyncHandler } from "../../lib/async-handler";
import {
  ENROLLMENT_TEACHER_NOTE_MAX_LENGTH,
  type EnrollmentInput,
  type EnrollmentValidationErrors,
  validateEnrollmentInput,
} from "../../types/enrollment";
import {
  createEnrollment,
  getEnrollmentById,
  isEnrollmentGroupInterest,
  isEnrollmentStatus,
  listEnrollments,
  updateEnrollmentStatus,
  type UpdateEnrollmentStatusInput,
} from "./enrollments.service";

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object";
};

const getRouteParam = (value: string | string[] | undefined): string => {
  return Array.isArray(value) ? value[0] ?? "" : (value ?? "");
};

const buildValidationError = (details: EnrollmentValidationErrors) => {
  throw new AppError({
    statusCode: 400,
    code: "INVALID_ENROLLMENT_INPUT",
    message: "Revise os dados informados para continuar.",
    details,
  });
};

const parseCreateEnrollmentBody = (body: unknown): EnrollmentInput => {
  if (!isObjectRecord(body)) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_REQUEST_BODY",
      message: "Envie um corpo JSON valido.",
    });
  }

  const groupInterest =
    typeof body.groupInterest === "string" && isEnrollmentGroupInterest(body.groupInterest)
      ? body.groupInterest
      : undefined;
  const alreadyParticipates =
    body.alreadyParticipates === "Sim" ||
    body.alreadyParticipates === "Não" ||
    body.alreadyParticipates === "Já participei antes"
      ? body.alreadyParticipates
      : "Não";

  const input: Partial<EnrollmentInput> = {
    fullName: typeof body.fullName === "string" ? body.fullName : "",
    email: typeof body.email === "string" ? body.email : "",
    whatsapp: typeof body.whatsapp === "string" ? body.whatsapp : "",
    groupInterest,
    alreadyParticipates,
    message: typeof body.message === "string" ? body.message : "",
    teacherNote: typeof body.teacherNote === "string" ? body.teacherNote : "",
  };

  const errors = validateEnrollmentInput(input);

  if (Object.keys(errors).length > 0) {
    buildValidationError(errors);
  }

  return {
    fullName: input.fullName!.trim(),
    email: input.email!.trim(),
    whatsapp: input.whatsapp!.trim(),
    groupInterest: input.groupInterest!,
    alreadyParticipates:
      input.alreadyParticipates === "Sim" ||
      input.alreadyParticipates === "Não" ||
      input.alreadyParticipates === "Já participei antes"
        ? input.alreadyParticipates
        : "Não",
    message: input.message?.trim() ?? "",
    teacherNote: input.teacherNote?.trim() ?? "",
  };
};

const parseUpdateEnrollmentStatusBody = (body: unknown): UpdateEnrollmentStatusInput => {
  if (!isObjectRecord(body)) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_REQUEST_BODY",
      message: "Envie um corpo JSON valido.",
    });
  }

  const status = body.status;
  const teacherNote = typeof body.teacherNote === "string" ? body.teacherNote.trim() : "";

  if (status !== "approved" && status !== "rejected" && status !== "needs_contact") {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ENROLLMENT_STATUS",
      message: "Informe um status valido para revisao do cadastro.",
    });
  }

  if (teacherNote.length > ENROLLMENT_TEACHER_NOTE_MAX_LENGTH) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_TEACHER_NOTE",
      message: `A observacao do professor deve ter no maximo ${ENROLLMENT_TEACHER_NOTE_MAX_LENGTH} caracteres.`,
    });
  }

  return {
    status,
    teacherNote,
  };
};

export const enrollmentsRouter = Router();

enrollmentsRouter.post(
  "/",
  asyncHandler((request, response) => {
    const input = parseCreateEnrollmentBody(request.body);
    const createdEnrollment = createEnrollment(input);

    return sendSuccess(response, {
      status: 201,
      message: "Sua solicitação foi recebida. Os professores revisarão seu cadastro.",
      data: createdEnrollment,
    });
  }),
);

enrollmentsRouter.get(
  "/",
  asyncHandler((request, response) => {
    const rawStatus =
      typeof request.query.status === "string" ? request.query.status : undefined;
    const rawGroupInterest =
      typeof request.query.groupInterest === "string" ? request.query.groupInterest : undefined;

    if (rawStatus && !isEnrollmentStatus(rawStatus)) {
      throw new AppError({
        statusCode: 400,
        code: "INVALID_ENROLLMENT_STATUS",
        message: "Informe um status valido para o filtro.",
      });
    }

    if (rawGroupInterest && !isEnrollmentGroupInterest(rawGroupInterest)) {
      throw new AppError({
        statusCode: 400,
        code: "INVALID_GROUP_INTEREST",
        message: "Informe um grupo de interesse valido para o filtro.",
      });
    }

    const status = rawStatus && isEnrollmentStatus(rawStatus) ? rawStatus : undefined;
    const groupInterest =
      rawGroupInterest && isEnrollmentGroupInterest(rawGroupInterest)
        ? rawGroupInterest
        : undefined;

    const items = listEnrollments({
      status,
      groupInterest,
    });

    return sendSuccess(response, {
      message: "Interessados carregados com sucesso.",
      data: items,
      meta: {
        count: items.length,
        status: status ?? null,
        groupInterest: groupInterest ?? null,
      },
    });
  }),
);

enrollmentsRouter.get(
  "/:id",
  asyncHandler((request, response) => {
    const enrollment = getEnrollmentById(getRouteParam(request.params.id));

    if (!enrollment) {
      throw new AppError({
        statusCode: 404,
        code: "ENROLLMENT_NOT_FOUND",
        message: "Cadastro de interesse nao encontrado.",
      });
    }

    return sendSuccess(response, {
      message: "Cadastro de interesse carregado com sucesso.",
      data: enrollment,
    });
  }),
);

enrollmentsRouter.patch(
  "/:id/status",
  asyncHandler((request, response) => {
    const input = parseUpdateEnrollmentStatusBody(request.body);
    const updatedEnrollment = updateEnrollmentStatus(getRouteParam(request.params.id), input);

    if (!updatedEnrollment) {
      throw new AppError({
        statusCode: 404,
        code: "ENROLLMENT_NOT_FOUND",
        message: "Cadastro de interesse nao encontrado.",
      });
    }

    return sendSuccess(response, {
      message: "Status do cadastro atualizado com sucesso.",
      data: updatedEnrollment,
    });
  }),
);
