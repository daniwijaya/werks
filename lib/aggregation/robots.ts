export type RobotsRule = { allow: boolean; path: string };
export type RobotsGroup = { agents: string[]; rules: RobotsRule[] };

export function parseRobotsTxt(text: string): { sitemaps: string[]; groups: RobotsGroup[] } {
  const sitemaps: string[] = [];
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let hasRules = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (!current || hasRules) {
        current = { agents: [], rules: [] };
        groups.push(current);
        hasRules = false;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (current && (key === "allow" || key === "disallow")) {
      if (value) current.rules.push({ allow: key === "allow", path: value });
      hasRules = true;
    }
  }
  return { sitemaps: [...new Set(sitemaps)], groups };
}

function ruleMatches(path: string, pattern: string): boolean {
  const escaped = pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  const anchored = pattern.endsWith("$");
  const regex = new RegExp(`^${escaped.replace(/\\\$$/, "")}${anchored ? "$" : ""}`);
  return regex.test(path);
}

export function isAllowedByRobots(url: string, parsed: ReturnType<typeof parseRobotsTxt>, agent = "werks-job-aggregator"): boolean {
  const matching = parsed.groups.filter((group) => group.agents.some((name) => name === "*" || (name && agent.toLowerCase().includes(name))));
  const specificity = Math.max(0, ...matching.flatMap((group) => group.agents.filter((name) => name !== "*").map((name) => name.length)));
  const selected = matching.filter((group) => group.agents.some((name) => name !== "*" && name.length === specificity));
  const groups = specificity ? selected : matching.filter((group) => group.agents.includes("*"));
  const target = new URL(url);
  const path = target.pathname + target.search;
  const matchingRules = groups.flatMap((group) => group.rules).filter((rule) => ruleMatches(path, rule.path));
  if (!matchingRules.length) return true;
  const longest = Math.max(...matchingRules.map((rule) => rule.path.replace(/\*|\$$/g, "").length));
  return matchingRules.filter((rule) => rule.path.replace(/\*|\$$/g, "").length === longest).some((rule) => rule.allow);
}
