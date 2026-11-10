import { authorSections, withoutCode } from "./check-pr-body.mjs";

const CAPTURAS = "Capturas";

const CHANGE_KINDS = ["visual", "flow"];

const MEDIA = {
  image: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"],
  video: [".mp4", ".webm", ".mov"],
};

const APP_VISUAL =
  /^apps\/[^/]+\/src\/(?:components|layouts|pages|styles)\/.+\.(?:astro|css|tsx|jsx)$/;

const ADMIN_VISUAL = /^apps\/admin\/src\/.+\.(?:css|tsx|jsx)$/;

const UI_VISUAL = /^packages\/ui\/src\/.+\.(?:css|tsx|jsx)$/;

const PUBLIC_FILE = /^apps\/[^/]+\/public\/.+/;

const GITHUB_ATTACHMENT =
  /^https:\/\/github\.com\/user-attachments\/(?:assets|files)\/[^/?#\s]+/i;

const PATH_CLASSES = [
  {
    kind: "flow",
    match(path) {
      return (
        path === "apps/web/src/pages/contacto.astro" ||
        path === "apps/web/src/components/sections/ContactoForm.astro" ||
        (path.startsWith("apps/web/worker/contacto/") &&
          path.endsWith(".ts") &&
          !path.endsWith(".test.ts"))
      );
    },
  },
  {
    kind: "visual",
    match(path) {
      if (
        APP_VISUAL.test(path) ||
        ADMIN_VISUAL.test(path) ||
        UI_VISUAL.test(path)
      ) {
        return !path.endsWith(".test.ts") && !path.endsWith(".test.tsx");
      }
      if (!PUBLIC_FILE.test(path)) {
        return false;
      }
      return MEDIA.image.concat(MEDIA.video).some((ext) => path.endsWith(ext));
    },
  },
];

const EVIDENCE_RULES = [
  {
    gate: { all: ["flow"], none: [] },
    need: "video",
    pathsFrom: "flow",
    missingSection(paths) {
      return `El diff cambia un flujo (${formatPaths(paths)}) y falta la sección «Capturas» con un video (.mp4, .webm, .mov o un adjunto de GitHub).`;
    },
    missingEvidence(paths) {
      return `La sección «Capturas» tiene que incluir un video (.mp4, .webm, .mov o un adjunto de GitHub). Una imagen sola no alcanza. El diff cambia un flujo (${formatPaths(paths)}).`;
    },
  },
  {
    gate: { all: ["visual"], none: ["flow"] },
    need: "image",
    pathsFrom: "visual",
    missingSection(paths) {
      return `El diff cambia UI (${formatPaths(paths)}) y falta la sección «Capturas» con una imagen.`;
    },
    missingEvidence(paths) {
      return `La sección «Capturas» tiene que incluir una imagen real (markdown o <img>). El diff cambia UI (${formatPaths(paths)}).`;
    },
  },
];

function formatPaths(paths) {
  const shown = paths.slice(0, 5);
  const extra = paths.length - shown.length;
  const list = shown.join(", ");
  return extra > 0 ? `${list} y ${extra} más` : list;
}

function gateMatches(gate, profile) {
  const has = (kind) => profile.byKind[kind].length > 0;
  return gate.all.every(has) && gate.none.every((kind) => !has(kind));
}

function normalizeRepoPath(value) {
  if (typeof value !== "string") {
    return null;
  }
  const slashed = value.replaceAll("\\", "/").trim();
  if (slashed === "" || /[\0\r\n]/.test(slashed)) {
    return null;
  }
  const stripped = slashed.startsWith("./") ? slashed.slice(2) : slashed;
  if (
    stripped === "" ||
    stripped.startsWith("/") ||
    /^[A-Za-z]:\//.test(stripped)
  ) {
    return null;
  }
  if (stripped.split("/").some((segment) => segment === "..")) {
    return null;
  }
  return stripped;
}

function classifyPaths(paths) {
  const byKind = { visual: [], flow: [] };
  const seen = { visual: new Set(), flow: new Set() };
  for (const value of paths) {
    const path = normalizeRepoPath(value);
    if (path === null) {
      continue;
    }
    for (const row of PATH_CLASSES) {
      if (!CHANGE_KINDS.includes(row.kind)) {
        throw new Error("Clase de path desconocida.");
      }
      if (!row.match(path) || seen[row.kind].has(path)) {
        continue;
      }
      seen[row.kind].add(path);
      byKind[row.kind].push(path);
    }
  }
  return { byKind };
}

function urlPath(url) {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

function isVideoUrl(url) {
  const path = urlPath(url).toLowerCase();
  return MEDIA.video.some((ext) => path.endsWith(ext));
}

function isImageUrl(url) {
  const path = urlPath(url).toLowerCase();
  return MEDIA.image.some((ext) => path.endsWith(ext));
}

function isGithubAttachment(url) {
  return GITHUB_ATTACHMENT.test(url);
}

function isCursorBadge(url) {
  return /cursor\.com\/assets\/images\/open-in-/i.test(url);
}

function countsAsVideo(url) {
  if (isVideoUrl(url)) {
    return true;
  }
  return isGithubAttachment(url) && !isImageUrl(url);
}

function scanMedia(text) {
  const occupied = [];
  let image = 0;
  let video = 0;

  function covered(index) {
    return occupied.some((span) => index >= span[0] && index < span[1]);
  }

  function occupy(start, end) {
    occupied.push([start, end]);
  }

  function attrUrl(tag, name) {
    const match = new RegExp(
      `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`,
      "i",
    ).exec(tag);
    if (!match) {
      return "";
    }
    return match[1] ?? match[2] ?? match[3] ?? "";
  }

  const markdownImage =
    /(?<!\\)!\[(?:\\.|[^\]])*\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
  const htmlTag = /<(img|video|source|a)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  for (const match of text.matchAll(markdownImage)) {
    occupy(match.index, match.index + match[0].length);
    if (isVideoUrl(match[1])) {
      video += 1;
    } else if (!isCursorBadge(match[1])) {
      image += 1;
    }
  }
  for (const match of text.matchAll(htmlTag)) {
    if (covered(match.index)) {
      continue;
    }
    const tag = match[0];
    const kind = match[1].toLowerCase();
    const url = kind === "a" ? attrUrl(tag, "href") : attrUrl(tag, "src");
    if (url === "") {
      continue;
    }
    occupy(match.index, match.index + match[0].length);
    if (kind === "img") {
      if (isCursorBadge(url)) {
        continue;
      }
      if (isVideoUrl(url)) {
        video += 1;
      } else {
        image += 1;
      }
      continue;
    }
    if (countsAsVideo(url)) {
      video += 1;
    }
  }

  function addVideo(start, end, url) {
    if (covered(start) || !countsAsVideo(url)) {
      return;
    }
    occupy(start, end);
    video += 1;
  }

  const markdownLink =
    /\[(?:\\.|[^\]])*\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
  for (const match of text.matchAll(markdownLink)) {
    if (covered(match.index)) {
      continue;
    }
    occupy(match.index, match.index + match[0].length);
    if (countsAsVideo(match[1])) {
      video += 1;
    }
  }
  const autolink = /<(https?:\/\/[^>\s]+)>/gi;
  for (const match of text.matchAll(autolink)) {
    addVideo(match.index, match.index + match[0].length, match[1]);
  }
  const bareUrl = /\bhttps?:\/\/[^\s<>\]]+/gi;
  for (const match of text.matchAll(bareUrl)) {
    const url = match[0].replace(/[.,;:!?)"']+$/u, "");
    addVideo(match.index, match.index + match[0].length, url);
  }

  return { image, video };
}

export function checkChangeEvidence(raw, paths) {
  const profile = classifyPaths(paths);
  const capturas = authorSections(raw).filter(
    (section) => section.title === CAPTURAS,
  );
  const media = scanMedia(
    withoutCode(capturas.map((section) => section.content).join("\n")),
  );
  const problems = [];
  for (const rule of EVIDENCE_RULES) {
    if (!gateMatches(rule.gate, profile)) {
      continue;
    }
    const watched = profile.byKind[rule.pathsFrom];
    if (capturas.length === 0) {
      problems.push(rule.missingSection(watched));
      continue;
    }
    if (media[rule.need] < 1) {
      problems.push(rule.missingEvidence(watched));
    }
  }
  return { ok: problems.length === 0, problems };
}
