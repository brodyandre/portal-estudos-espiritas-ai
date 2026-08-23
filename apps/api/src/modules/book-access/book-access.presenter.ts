import type { BookAccessScope } from "./book-access.types";

export const presentBookAccessScope = (scope: BookAccessScope) => ({
  groups: scope.groups.map((group) => ({
    id: group.id,
    name: group.name,
    knowledgeBook: {
      id: group.knowledgeBook.id,
      slug: group.knowledgeBook.slug,
      title: group.knowledgeBook.title,
    },
  })),
});
