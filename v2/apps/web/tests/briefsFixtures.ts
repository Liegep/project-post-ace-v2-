// Local visual review only. This module is never imported by the production entry.
import { seasonalFixture, previewClients } from "./seasonalFixtures";
import type {
  BriefDetail,
  BriefField,
  BriefForm,
  BriefTemplate,
} from "../src/api";
const date = "2026-10-05T10:00:00Z";
const field = (
  id: string,
  type: BriefField["type"],
  label: string,
  required = true,
  options: string[] = [],
): BriefField => ({
  id,
  type,
  label,
  required,
  options,
  help: "",
  validation: {},
});
export const previewBriefForm: BriefForm = {
  title: "Identidade visual · Casa Lume",
  introduction:
    "Vamos conhecer a essência da sua marca. Reserve um momento para compartilhar suas ideias, referências e o que você deseja construir com a gente.",
  category: "branding",
  locale: "pt",
  fields: [
    field("brand", "short", "Qual é o nome da sua marca?"),
    {
      ...field("story", "long", "Conte a história por trás do projeto"),
      help: "O que trouxe você até aqui? O que torna a sua marca especial?",
    },
    field(
      "personality",
      "checklist",
      "Como você descreveria a personalidade da marca?",
      true,
      ["Acolhedora", "Contemporânea", "Elegante", "Ousada"],
    ),
    field("audience", "choice", "Qual público você quer alcançar?", true, [
      "Consumidor final",
      "Outras empresas",
      "Ambos",
    ]),
    {
      ...field(
        "scale",
        "scale",
        "Quão importante é renovar a sua presença visual?",
      ),
      validation: { min: 1, max: 5 },
    },
    field("references", "file", "Compartilhe suas referências", false),
  ],
};
export function briefsFixture(empty = false) {
  const fallback = seasonalFixture("empty").fetch;
  const templates = (
    empty
      ? []
      : [
          [
            "Logotipo",
            "logo",
            "As primeiras perguntas para dar forma à marca.",
          ],
          [
            "Identidade visual",
            "branding",
            "Essência, personalidade e referências para um universo visual consistente.",
          ],
          [
            "Social Media",
            "social_media",
            "Objetivos, público e rotina de conteúdo para redes sociais.",
          ],
          [
            "Site",
            "website",
            "Uma presença digital pensada para o seu negócio.",
          ],
          [
            "Material editorial",
            "editorial",
            "Conteúdo, formato e direção visual da publicação.",
          ],
          [
            "Projeto personalizado",
            "custom",
            "Um ponto de partida aberto para novas ideias.",
          ],
        ]
  ).map(([name, category, description], i) => ({
    id: "template-" + i,
    name,
    description,
    status: i === 5 ? "archived" : "active",
    version: i === 1 ? 3 : 1,
    createdAt: date,
    updatedAt: date,
    form: { ...structuredClone(previewBriefForm), title: name, category },
  })) as BriefTemplate[];
  const records: Record<string, BriefDetail> = {};
  const answers = {
    brand: "Casa Lume",
    story:
      "A Casa Lume nasceu da vontade de transformar a casa em um lugar de encontro. Criamos objetos com materiais naturais, feitos para durar e acompanhar histórias.",
    personality: ["Acolhedora", "Contemporânea"],
    audience: "Consumidor final",
    scale: 5,
    references: ["attachment-1"],
  };
  if (!empty)
    for (const [i, status, title] of [
      [1, "answered", "Identidade visual · Casa Lume"],
      [2, "sent", "Campanha de lançamento · Estúdio Aurora"],
      [
        3,
        "draft",
        "Um projeto com um nome mais longo para testar a leitura em telas menores",
      ],
      [4, "reopened", "Estratégia de conteúdo · Casa Lume"],
    ] as const) {
      const id = "brief-" + i,
        submitted = status === "answered" || status === "reopened";
      const form = { ...structuredClone(previewBriefForm), title };
      records[id] = {
        brief: {
          id,
          clientAccountId: i === 2 ? "client-a" : "client-b",
          templateId: "template-1",
          templateVersion: 3,
          form,
          status,
          version: 3,
          sentAt: status === "draft" ? null : "2026-10-02T10:00:00Z",
          createdAt: "2026-10-01T10:00:00Z",
          updatedAt: date,
        },
        response: {
          id: "response-" + i,
          status: status === "answered" ? "submitted" : "draft",
          version: 1,
          answers: submitted ? answers : {},
          respondentUserId: "preview-client",
          submittedAt: submitted ? date : null,
          updatedAt: date,
        },
        revisions: submitted
          ? [
              {
                id: "revision-" + i + "-2",
                revision: 2,
                answers,
                submittedByUserId: "preview-client",
                submittedAt: date,
              },
              {
                id: "revision-" + i + "-1",
                revision: 1,
                answers: {
                  ...answers,
                  story: "Queremos uma marca mais próxima das pessoas.",
                  references: [],
                },
                submittedByUserId: "preview-client",
                submittedAt: "2026-10-03T09:00:00Z",
              },
            ]
          : [],
        attachments: submitted
          ? [
              {
                id: "attachment-1",
                fieldId: "references",
                name: "Referências da marca.png",
                contentType: "image/png",
                size: 2048,
              },
            ]
          : [],
        events: [
          {
            id: "event-" + i,
            action: "send",
            actorUserId: "preview-user",
            revision: null,
            createdAt: "2026-10-02T10:00:00Z",
          },
          ...(submitted
            ? [
                {
                  id: "event-response-" + i,
                  action: "submitted",
                  actorUserId: "preview-client",
                  revision: 2,
                  createdAt: date,
                },
              ]
            : []),
        ],
      };
    }
  const calls: { path: string; method: string }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input), "http://localhost"),
      path = url.pathname,
      method = init?.method ?? "GET";
    calls.push({ path, method });
    let result: unknown;
    if (path === "/api/clients") result = { items: previewClients };
    else if (path === "/api/portal/accounts")
      result = {
        items: [{ clientAccountId: "client-b", clientSlug: "casa-lume" }],
      };
    else if (path === "/api/briefs/templates") {
      if (method === "POST") {
        const body = JSON.parse(String(init?.body));
        templates.push({
          ...body,
          id: body.id ?? crypto.randomUUID(),
          status: "active",
          version: 1,
          updatedAt: date,
        });
        result = { template: templates.at(-1) };
      } else result = { items: templates };
    } else if (path.startsWith("/api/briefs/templates/")) {
      const id = path.split("/")[4],
        t = templates.find((t) => t.id === id)!;
      if (path.endsWith("/archive")) t.status = "archived";
      else
        Object.assign(t, JSON.parse(String(init?.body)), {
          version: t.version + 1,
          updatedAt: date,
        });
      result = { template: t };
    } else if (
      path === "/api/briefs" ||
      path === "/api/portal/accounts/client-b/briefs"
    ) {
      if (method === "POST") {
        const body = JSON.parse(String(init?.body)),
          id = body.id ?? crypto.randomUUID();
        records[id] = {
          brief: {
            ...body,
            id,
            status: "draft",
            version: 1,
            createdAt: date,
            updatedAt: date,
            sentAt: null,
          },
          response: null,
          revisions: [],
          attachments: [],
          events: [],
        };
        result = records[id];
      } else
        result = {
          items: Object.values(records)
            .map((d) => d.brief)
            .filter(
              (b) =>
                !path.includes("/portal/") ||
                (b.clientAccountId === "client-b" && b.status !== "draft"),
            ),
        };
    } else if (
      path.startsWith("/api/briefs/") ||
      path.startsWith("/api/portal/accounts/client-b/briefs/")
    ) {
      const id = path.includes("/portal/")
          ? path.split("/")[6]
          : path.split("/")[3],
        d = records[id];
      if (path.includes("/attachments/")) {
        if (!new Headers(init?.headers).get("authorization"))
          return new Response("", { status: 403 });
        return new Response(
          Uint8Array.from(
            atob(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRF0AAAAASUVORK5CYII=",
            ),
            (c) => c.charCodeAt(0),
          ),
          { headers: { "content-type": "image/png" } },
        );
      }
      if (!d)
        return new Response(
          JSON.stringify({ message: "Brief não encontrado" }),
          { status: 404 },
        );
      if (method === "PATCH") {
        Object.assign(d.brief, JSON.parse(String(init?.body)), {
          version: d.brief.version + 1,
          updatedAt: date,
        });
      }
      if (path.endsWith("/send")) {
        d.brief.status = "sent";
        d.brief.sentAt = date;
        d.brief.version++;
      }
      if (path.endsWith("/reopen")) {
        d.brief.status = "reopened";
        d.brief.version++;
      }
      if (path.endsWith("/archive")) {
        d.brief.status = "archived";
        d.brief.version++;
      }
      result = d;
    } else return fallback(input, init);
    return new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json" },
    });
  };
  return { fetch: fetcher, calls, templates, records };
}
