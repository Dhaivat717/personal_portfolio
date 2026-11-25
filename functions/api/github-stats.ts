import { handleGitHubStats, type GitHubStatsEnv } from "../../src/api/githubStats";

export const onRequestGet: PagesFunction<GitHubStatsEnv> = ({ env }) => handleGitHubStats(env);
