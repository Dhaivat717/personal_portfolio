interface GraphQLResponse {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: {
          totalContributions?: unknown;
        };
      };
    };
  };
}

export function isValidContributions(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function extractGraphQLContributions(payload: unknown): number | null {
  const raw = (payload as GraphQLResponse | null | undefined)?.data?.user
    ?.contributionsCollection?.contributionCalendar?.totalContributions;
  return isValidContributions(raw) ? raw : null;
}
