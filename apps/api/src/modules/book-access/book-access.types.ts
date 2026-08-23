export type BookAccessActorRole = "student" | "teacher";
export type BookAccessGroupStatus = "active" | "inactive";
export type BookAccessKnowledgeBookStatus = "active" | "archived";

export interface BookAccessKnowledgeBook {
  id: string;
  slug: string;
  title: string;
}

export interface BookAccessKnowledgeBookRecord extends BookAccessKnowledgeBook {
  status: BookAccessKnowledgeBookStatus;
}

export interface BookAccessGroupRecord {
  id: string;
  name: string;
  status: BookAccessGroupStatus;
  knowledgeBook: BookAccessKnowledgeBookRecord | null;
}

export interface BookAccessUserGroupRecord {
  groupSlug: string | null;
}

export interface BookAccessGroup {
  id: string;
  name: string;
  knowledgeBook: BookAccessKnowledgeBook;
}

export interface BookAccessScope {
  actorId: string;
  role: BookAccessActorRole;
  groups: BookAccessGroup[];
}
