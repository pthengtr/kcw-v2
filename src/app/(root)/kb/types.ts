export type KbPartListItem = {
  id: number;
  title: string | null;
  keywords: string | null;
  updated_at: string;
};

export type KbPartEditorItem = {
  id?: number;
  title?: string | null;
  keywords?: string | null;
  content?: string | null;
  related?: string | null;
} | null;

export type KbPartImage = {
  name: string;
  path: string;
  publicUrl: string;
  size: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type KbSemanticSearchResult = {
  id: number;
  title: string | null;
  keywords: string | null;
  content: string | null;
  related: string | null;
  similarity: number;
};

export type KbStatusState = {
  created?: string;
  saved?: string;
  deleted?: string;
  image_uploaded?: string;
  image_deleted?: string;
  error?: string;
};

export type KbSearchParams = {
  fixed_q?: string;
  semantic_q?: string;
  mode?: string;
  id?: string;
  created?: string;
  saved?: string;
  deleted?: string;
  image_uploaded?: string;
  image_deleted?: string;
  error?: string;
};

export type KbAdminScreenProps = {
  recentItems: KbPartListItem[];
  fixedResults: KbPartListItem[];
  semanticResults: KbSemanticSearchResult[];
  fixedQuery: string;
  semanticQuery: string;
  selectedId: number | null;
  isNewMode: boolean;
  editorItem: KbPartEditorItem;
  editorImages: KbPartImage[];
  status: KbStatusState;
};
