import type { APIRoute, GetStaticPaths } from "astro";
import { renderSocialCard, type SocialCardSpec } from "../../og";
import { getProjects } from "../../projects";

export const getStaticPaths = (async () => {
  const projects = await getProjects();
  return [
    { params: { page: "home" }, props: { kind: "home" } satisfies SocialCardSpec },
    { params: { page: "projects" }, props: { kind: "projects", projects } satisfies SocialCardSpec },
    ...projects.map((project) => ({
      params: { page: `projects/${project.id}` },
      props: { kind: "deep-dive", project } satisfies SocialCardSpec,
    })),
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderSocialCard(props as SocialCardSpec);
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
};
