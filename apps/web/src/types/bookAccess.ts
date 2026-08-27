import type { ServiceSource } from "../services/api";

export interface UserBookAccessKnowledgeBook {
  id: string;
  slug: string;
  title: string;
}

export interface UserBookAccessGroup {
  id: string;
  name: string;
  knowledgeBook: UserBookAccessKnowledgeBook;
}

export interface UserBookAccessResult {
  groups: UserBookAccessGroup[];
  count: number;
  source: ServiceSource;
}
