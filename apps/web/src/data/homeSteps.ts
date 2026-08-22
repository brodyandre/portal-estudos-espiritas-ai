export interface HomeStep {
  step: number;
  title: string;
  description: string;
  state?: "pending" | "active" | "done";
}

export const homeSteps: HomeStep[] = [
  {
    step: 1,
    title: "Escolha seu espaco",
    description: "Entre pelo Portal, pela area do aluno ou pela area do professor.",
  },
  {
    step: 2,
    title: "Veja o proximo encontro",
    description: "Confirme grupo, horario e link do Google Meet com poucos toques.",
  },
  {
    step: 3,
    title: "Consulte materiais",
    description: "Leia orientacoes, resumos e atividades de apoio com linguagem simples.",
  },
  {
    step: 4,
    title: "Participe com clareza",
    description: "Leve duvidas, acompanhe o fluxo da aula e revise os pontos principais.",
  },
  {
    step: 5,
    title: "Revise com apoio humano",
    description: "Use o assistente como apoio de estudo, sempre com espaco para revisao do professor.",
  },
];
