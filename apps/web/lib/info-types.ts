import type { InfoId } from "./public-routes";

export type InfoLink =
  | InfoId
  | "repo"
  | "issues"
  | "analysisDocs"
  | "paperDocs"
  | "partnerPrivacy"
  | "adCenter"
  | "uodo";
export type Inline = string | [destination: InfoLink, label: string];
export type InfoCopy = Record<
  InfoId,
  {
    title: string;
    description: string;
    sections: {
      title: string;
      publisher?: true;
      paragraphs?: (string | Inline[])[];
    }[];
  }
>;
