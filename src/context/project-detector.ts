import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import fg from "fast-glob";

export interface ProjectContext {
  language: string;
  framework?: string;
  packageManager?: string;
  testFramework?: string;
  isMonorepo: boolean;
  cicd?: string;
  projectRoot: string;
}

const ROOT_MARKERS = [
  ".git",
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  ".curio-code",
];

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readText(targetPath: string): Promise<string | null> {
  try {
    return await fs.readFile(targetPath, "utf8");
  } catch {
    return null;
  }
}

async function findProjectRoot(startDir: string): Promise<string> {
  let current = path.resolve(startDir);
  const home = os.homedir();

  while (true) {
    for (const marker of ROOT_MARKERS) {
      if (await exists(path.join(current, marker))) {
        return current;
      }
    }
    const parent = path.dirname(current);
    if (parent === current || current === home) {
      return path.resolve(startDir);
    }
    current = parent;
  }
}

function parsePackageJsonDeps(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return new Set([
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {}),
    ]);
  } catch {
    return new Set();
  }
}

function detectFrameworkFromDeps(deps: Set<string>): string | undefined {
  if (deps.has("next")) return "Next.js";
  if (deps.has("nuxt")) return "Nuxt";
  if (deps.has("@angular/core")) return "Angular";
  if (deps.has("@sveltejs/kit")) return "SvelteKit";
  if (deps.has("react") || deps.has("react-dom")) return "React";
  if (deps.has("django")) return "Django";
  if (deps.has("flask")) return "Flask";
  if (deps.has("fastapi")) return "FastAPI";
  if (deps.has("rails")) return "Rails";
  if (deps.has("spring-boot-starter")) return "Spring Boot";
  return undefined;
}

function detectTestFrameworkFromDeps(deps: Set<string>): string | undefined {
  if (deps.has("vitest")) return "Vitest";
  if (deps.has("jest")) return "Jest";
  if (deps.has("mocha")) return "Mocha";
  if (deps.has("pytest")) return "pytest";
  if (deps.has("rspec")) return "RSpec";
  if (deps.has("junit")) return "JUnit";
  return undefined;
}

export async function detectProjectContext(
  cwd: string = process.cwd(),
): Promise<ProjectContext> {
  const projectRoot = await findProjectRoot(cwd);

  const packageJsonPath = path.join(projectRoot, "package.json");
  const tsconfigPath = path.join(projectRoot, "tsconfig.json");
  const cargoPath = path.join(projectRoot, "Cargo.toml");
  const goModPath = path.join(projectRoot, "go.mod");
  const pyprojectPath = path.join(projectRoot, "pyproject.toml");
  const setupPyPath = path.join(projectRoot, "setup.py");
  const requirementsPath = path.join(projectRoot, "requirements.txt");
  const pomPath = path.join(projectRoot, "pom.xml");
  const gradlePath = path.join(projectRoot, "build.gradle");
  const gradleKtsPath = path.join(projectRoot, "build.gradle.kts");
  const gemfilePath = path.join(projectRoot, "Gemfile");
  const makefilePath = path.join(projectRoot, "Makefile");
  const cmakePath = path.join(projectRoot, "CMakeLists.txt");
  const pubspecPath = path.join(projectRoot, "pubspec.yaml");
  const mixPath = path.join(projectRoot, "mix.exs");
  const stackPath = path.join(projectRoot, "stack.yaml");
  const composerPath = path.join(projectRoot, "composer.json");
  const dockerfilePath = path.join(projectRoot, "Dockerfile");

  const packageJson = await readText(packageJsonPath);
  const pyproject = await readText(pyprojectPath);
  const cargoToml = await readText(cargoPath);
  const pomXml = await readText(pomPath);
  const gemfile = await readText(gemfilePath);
  const deps = parsePackageJsonDeps(packageJson);

  const hasSlnOrCsproj = (
    await fg(["*.sln", "*.csproj"], {
      cwd: projectRoot,
      onlyFiles: true,
      deep: 3,
      suppressErrors: true,
    })
  ).length > 0;

  const languageSignals: string[] = [];
  if (await exists(packageJsonPath)) languageSignals.push("Node.js");
  if (await exists(tsconfigPath)) languageSignals.push("TypeScript");
  if (await exists(cargoPath)) languageSignals.push("Rust");
  if (await exists(goModPath)) languageSignals.push("Go");
  if (
    (await exists(pyprojectPath)) ||
    (await exists(setupPyPath)) ||
    (await exists(requirementsPath))
  ) {
    languageSignals.push("Python");
  }
  if (
    (await exists(pomPath)) ||
    (await exists(gradlePath)) ||
    (await exists(gradleKtsPath))
  ) {
    languageSignals.push("Java/Kotlin");
  }
  if (await exists(gemfilePath)) languageSignals.push("Ruby");
  if (hasSlnOrCsproj) languageSignals.push("C#/.NET");
  if ((await exists(makefilePath)) || (await exists(cmakePath))) {
    languageSignals.push("C/C++");
  }
  if (await exists(pubspecPath)) languageSignals.push("Dart/Flutter");
  if (await exists(mixPath)) languageSignals.push("Elixir");
  if (
    (await exists(stackPath)) ||
    (
      await fg(["*.cabal"], {
        cwd: projectRoot,
        onlyFiles: true,
        deep: 2,
        suppressErrors: true,
      })
    ).length > 0
  ) {
    languageSignals.push("Haskell");
  }
  if (await exists(composerPath)) languageSignals.push("PHP");
  if (await exists(dockerfilePath)) languageSignals.push("Containerized");

  const language =
    languageSignals.length > 0 ? languageSignals.join(", ") : "Unknown";

  let framework: string | undefined;
  const frameworkMarkers: Array<[string, string]> = [
    ["next.config.js", "Next.js"],
    ["next.config.mjs", "Next.js"],
    ["next.config.ts", "Next.js"],
    ["nuxt.config.ts", "Nuxt"],
    ["nuxt.config.js", "Nuxt"],
    ["vite.config.ts", "Vite"],
    ["vite.config.js", "Vite"],
    ["angular.json", "Angular"],
    ["svelte.config.js", "SvelteKit"],
    ["svelte.config.ts", "SvelteKit"],
  ];

  for (const [marker, name] of frameworkMarkers) {
    if (await exists(path.join(projectRoot, marker))) {
      framework = name;
      break;
    }
  }

  framework = framework ?? detectFrameworkFromDeps(deps);
  if (!framework && pyproject?.match(/\b(django|flask|fastapi)\b/i)) {
    framework = pyproject.match(/\bdjango\b/i)
      ? "Django"
      : pyproject.match(/\bflask\b/i)
        ? "Flask"
        : "FastAPI";
  }
  if (!framework && gemfile?.match(/\brails\b/i)) {
    framework = "Rails";
  }
  if (!framework && pomXml?.match(/spring-boot/i)) {
    framework = "Spring Boot";
  }

  const isMonorepoSignals = [
    await exists(path.join(projectRoot, "lerna.json")),
    await exists(path.join(projectRoot, "nx.json")),
    await exists(path.join(projectRoot, "turbo.json")),
    await exists(path.join(projectRoot, "pnpm-workspace.yaml")),
    Boolean(cargoToml?.match(/\[workspace\]/)),
  ];
  const isMonorepo = isMonorepoSignals.some(Boolean);

  let cicd: string | undefined;
  if (await exists(path.join(projectRoot, ".github", "workflows"))) {
    cicd = "GitHub Actions";
  } else if (await exists(path.join(projectRoot, ".gitlab-ci.yml"))) {
    cicd = "GitLab CI";
  } else if (await exists(path.join(projectRoot, ".circleci"))) {
    cicd = "CircleCI";
  } else if (await exists(path.join(projectRoot, "Jenkinsfile"))) {
    cicd = "Jenkins";
  }

  let testFramework = detectTestFrameworkFromDeps(deps);
  if (!testFramework && pyproject?.match(/\bpytest\b/i)) {
    testFramework = "pytest";
  } else if (!testFramework && gemfile?.match(/\brspec\b/i)) {
    testFramework = "RSpec";
  } else if (!testFramework && (await exists(cargoPath))) {
    testFramework = "cargo test";
  } else if (!testFramework && (await exists(goModPath))) {
    testFramework = "go test";
  } else if (!testFramework && pomXml?.match(/junit/i)) {
    testFramework = "JUnit";
  }

  let packageManager: string | undefined;
  if (await exists(path.join(projectRoot, "bun.lock"))) packageManager = "bun";
  else if (await exists(path.join(projectRoot, "pnpm-lock.yaml"))) {
    packageManager = "pnpm";
  } else if (await exists(path.join(projectRoot, "yarn.lock"))) {
    packageManager = "yarn";
  } else if (await exists(path.join(projectRoot, "package-lock.json"))) {
    packageManager = "npm";
  } else if (await exists(path.join(projectRoot, "poetry.lock"))) {
    packageManager = "poetry";
  } else if (
    (await exists(pyprojectPath)) ||
    (await exists(requirementsPath)) ||
    (await exists(setupPyPath))
  ) {
    packageManager = "pip";
  } else if (await exists(cargoPath)) {
    packageManager = "cargo";
  } else if (await exists(goModPath)) {
    packageManager = "go modules";
  }

  return {
    language,
    framework,
    packageManager,
    testFramework,
    isMonorepo,
    cicd,
    projectRoot,
  };
}
