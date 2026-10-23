import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { describe, it } from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const sourcePath = fileURLToPath(
  new URL("./VideoSection.astro", import.meta.url),
);
const source = readFileSync(sourcePath, "utf8");

function extract(tag: "script" | "style"): string {
  const match = source.match(new RegExp(`<${tag}>([\\s\\S]*)</${tag}>`));
  const body = match?.[1];
  if (!body) throw new Error(`missing <${tag}>`);
  return body;
}

function mediaBlock(css: string, query: string): string {
  const header = `@media ${query}`;
  const start = css.indexOf(header);
  assert.notEqual(start, -1, header);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    const char = css[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, index + 1);
    }
  }
  throw new Error(`unclosed ${header}`);
}

describe("video section contract", () => {
  const css = extract("style");
  const mobile = mediaBlock(css, "(max-width: 767px)");
  const mobileFlat = mobile.replace(/\s+/g, " ");
  const desktop = css.replace(mobile, "");

  it("keeps accessible names in the markup", () => {
    assert.match(
      source,
      /data-video-playback[\s\S]*?aria-label="Pausar video"/,
    );
    assert.match(source, /data-video-mute[\s\S]*?aria-label="Activar sonido"/);
    assert.match(source, /data-video-playback-label[\s\S]*?Pausar/);
    assert.match(source, /data-video-mute-label[\s\S]*?Activar sonido/);
    assert.match(source, /data-video-reduced/);
    assert.match(
      source,
      /data-video-play[\s\S]*?aria-label="Reproducir video"/,
    );
  });

  it("uses icon-only 32px controls with a 44px hit target below 768px", () => {
    assert.match(mobileFlat, /\.video-section__controls \{[^}]*right: 8px/);
    assert.match(mobileFlat, /\.video-section__controls \{[^}]*bottom: 8px/);
    assert.match(mobileFlat, /\.video-section__controls \{[^}]*gap: 8px/);
    assert.match(
      mobileFlat,
      /\.video-section__controls \{[^}]*flex-wrap: nowrap/,
    );
    assert.match(
      mobileFlat,
      /\.video-section__controls \{[^}]*background: rgb\(246 246 244 \/ 72%\)/,
    );
    assert.match(mobileFlat, /\.video-section__btn \{[^}]*width: 32px/);
    assert.match(mobileFlat, /\.video-section__btn \{[^}]*height: 32px/);
    assert.match(mobileFlat, /\.video-section__btn \{[^}]*border-width: 0/);
    assert.match(mobileFlat, /\.video-section__btn::before \{[^}]*inset: -6px/);
    assert.match(mobileFlat, /\.video-section__icon svg \{[^}]*width: 16px/);
    assert.match(mobileFlat, /\.video-section__icon svg \{[^}]*height: 16px/);
    assert.match(
      mobileFlat,
      /\.video-section__btn-label \{[^}]*position: absolute/,
    );
    assert.match(
      mobileFlat,
      /\.video-section__btn-label \{[^}]*clip: rect\(0, 0, 0, 0\)/,
    );
    assert.match(
      mobileFlat,
      /\.video-section__btn-label \{[^}]*clip-path: inset\(50%\)/,
    );
  });

  it("keeps text labels on desktop", () => {
    assert.equal(desktop.includes(".video-section__btn-label"), false);
    assert.doesNotMatch(desktop, /max-width:\s*767px/);
  });

  it("draws a keyboard focus ring on the video controls", () => {
    assert.match(
      css,
      /\.video-section__btn:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--neutro-focus\)/,
    );
    assert.match(
      css,
      /\.video-section__play:focus-visible\s*,\s*\.video-section__btn:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--neutro-focus\)/,
    );
    assert.match(
      mobileFlat,
      /\.video-section__btn:focus-visible \{[^}]*outline:\s*2px solid var\(--neutro-focus\)/,
    );
    assert.match(
      mobileFlat,
      /\.video-section__btn:focus-visible \{[^}]*outline-offset:\s*-3px/,
    );
  });
});

type Listener = () => void;

function dataKey(attribute: string): string {
  return attribute
    .slice("data-".length)
    .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

class El {
  readonly tag: string;
  readonly attrs = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly children: El[] = [];
  readonly listeners = new Map<string, Listener[]>();
  hidden: boolean;
  textContent: string;
  paused = true;
  muted = false;
  volume = 1;
  src = "";
  playCalls = 0;
  loadCalls = 0;

  constructor(
    tag: string,
    attrs: Record<string, string> = {},
    textContent = "",
  ) {
    this.tag = tag;
    this.textContent = textContent;
    for (const [name, value] of Object.entries(attrs)) {
      this.attrs.set(name, value);
      if (name.startsWith("data-")) this.dataset[dataKey(name)] = value;
    }
    this.hidden = this.attrs.has("hidden");
  }

  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
  }

  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }

  addEventListener(type: string, fn: Listener) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  emit(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }

  querySelector(selector: string): El | null {
    return queryAll(this, selector)[0] ?? null;
  }

  querySelectorAll(selector: string): El[] {
    return queryAll(this, selector);
  }

  append(child: El) {
    this.children.push(child);
  }

  load() {
    this.loadCalls += 1;
  }

  play() {
    this.playCalls += 1;
    this.paused = false;
    this.emit("play");
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.emit("pause");
  }
}

function parseSelector(selector: string): { tag: string | null; attr: string } {
  const match = selector.match(/^(?:([a-z]+))?\[([^\]]+)\]$/);
  if (!match?.[2]) throw new Error(`unsupported selector ${selector}`);
  return { tag: match[1] ?? null, attr: match[2] };
}

function queryAll(root: El, selector: string): El[] {
  const { tag, attr } = parseSelector(selector);
  const matches: El[] = [];
  const visit = (node: El) => {
    for (const child of node.children) {
      const tagOk = tag === null || child.tag === tag;
      if (tagOk && child.attrs.has(attr)) matches.push(child);
      visit(child);
    }
  };
  visit(root);
  return matches;
}

class FakeObserver {
  static latest: FakeObserver | null = null;
  readonly callback: (entries: Array<{ isIntersecting: boolean }>) => void;

  constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
    this.callback = callback;
    FakeObserver.latest = this;
  }

  observe() {}

  disconnect() {}
}

function buildTree() {
  const section = new El("section");
  const frame = new El("div", { "data-video-root": "" });
  const video = new El("video", { "data-video": "" });
  video.muted = true;
  const webm = new El("source", { "data-src": "/video/neutro.webm" });
  const mp4 = new El("source", { "data-src": "/video/neutro.mp4" });
  video.append(webm);
  video.append(mp4);

  const reduced = new El("div", { "data-video-reduced": "", hidden: "" });
  const play = new El("button", {
    "data-video-play": "",
    "aria-label": "Reproducir video",
  });
  reduced.append(play);

  const controls = new El("div", { "data-video-controls": "", hidden: "" });
  const playback = new El("button", {
    "data-video-playback": "",
    "aria-pressed": "true",
    "aria-label": "Pausar video",
  });
  const playbackLabel = new El(
    "span",
    { "data-video-playback-label": "" },
    "Pausar",
  );
  playback.append(playbackLabel);
  const mute = new El("button", {
    "data-video-mute": "",
    "aria-pressed": "true",
    "aria-label": "Activar sonido",
  });
  const muteLabel = new El(
    "span",
    { "data-video-mute-label": "" },
    "Activar sonido",
  );
  mute.append(muteLabel);
  controls.append(playback);
  controls.append(mute);

  frame.append(video);
  frame.append(reduced);
  frame.append(controls);
  section.append(frame);

  return {
    section,
    frame,
    video,
    reduced,
    play,
    controls,
    playback,
    playbackLabel,
    mute,
    muteLabel,
    webm,
  };
}

type VideoUi = ReturnType<typeof buildTree>;

const doc = {
  tree: new El("body"),
  listeners: new Map<string, Listener[]>(),
  querySelector(selector: string) {
    return queryAll(this.tree, selector)[0] ?? null;
  },
  addEventListener(type: string, fn: Listener) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  },
  emit(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn();
  },
};

let reducedMotion = false;

const win = {
  matchMedia(query: string) {
    return {
      matches:
        query === "(prefers-reduced-motion: reduce)" ? reducedMotion : false,
      media: query,
    };
  },
};

const context = vm.createContext({
  document: doc,
  window: win,
  IntersectionObserver: FakeObserver,
  console,
});

const script = stripTypeScriptTypes(extract("script"), {
  mode: "strip",
  sourceUrl: "VideoSection.astro",
});

let scriptReady = false;
let queue: Promise<void> = Promise.resolve();

function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function takeObserver(): FakeObserver {
  const observer = FakeObserver.latest;
  if (observer === null) throw new Error("expected an IntersectionObserver");
  return observer;
}

async function boot(reduced: boolean): Promise<VideoUi> {
  reducedMotion = reduced;
  const ui = buildTree();
  doc.tree = ui.section;
  FakeObserver.latest = null;
  if (!scriptReady) {
    scriptReady = true;
    vm.runInContext(script, context, { filename: "VideoSection.astro" });
  } else {
    doc.emit("astro:page-load");
  }
  const observer = takeObserver();
  assert.equal(ui.frame.dataset.ready, "true");
  observer.callback([{ isIntersecting: true }]);
  await settle();
  return ui;
}

function exclusive(run: () => Promise<void>): Promise<void> {
  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function assertPlayback(
  ui: VideoUi,
  playing: boolean,
  label: "Pausar" | "Reproducir",
  accessibleName: "Pausar video" | "Reproducir video",
) {
  assert.equal(ui.video.paused, !playing);
  assert.equal(ui.playback.getAttribute("aria-pressed"), String(playing));
  assert.equal(ui.playback.getAttribute("aria-label"), accessibleName);
  assert.equal(ui.playbackLabel.textContent, label);
  assert.equal(ui.frame.dataset.playing, String(playing));
}

describe("video section playback", () => {
  it("autoplays and shows labeled controls when motion is allowed", () =>
    exclusive(async () => {
      const ui = await boot(false);
      assert.equal(ui.reduced.hidden, true);
      assert.equal(ui.controls.hidden, false);
      assert.equal(ui.frame.dataset.reduced, "false");
      assert.ok(ui.video.playCalls >= 1);
      assert.equal(ui.webm.src, "/video/neutro.webm");
      assertPlayback(ui, true, "Pausar", "Pausar video");
      assert.equal(ui.mute.getAttribute("aria-label"), "Activar sonido");
      assert.equal(ui.muteLabel.textContent, "Activar sonido");
    }));

  it("toggles pause and play from the video and the button together", () =>
    exclusive(async () => {
      const ui = await boot(false);
      ui.video.emit("click");
      await settle();
      assertPlayback(ui, false, "Reproducir", "Reproducir video");

      ui.playback.emit("click");
      await settle();
      assertPlayback(ui, true, "Pausar", "Pausar video");

      ui.video.emit("click");
      await settle();
      assertPlayback(ui, false, "Reproducir", "Reproducir video");
      assert.equal(ui.mute.getAttribute("aria-pressed"), "true");
      assert.equal(ui.mute.getAttribute("aria-label"), "Activar sonido");
    }));

  it("keeps the reduced-motion gate in front of the video", () =>
    exclusive(async () => {
      const ui = await boot(true);
      assert.equal(ui.frame.dataset.reduced, "true");
      assert.equal(ui.reduced.hidden, false);
      assert.equal(ui.controls.hidden, true);
      assert.equal(ui.video.playCalls, 0);
      assertPlayback(ui, false, "Reproducir", "Reproducir video");

      const playsBefore = ui.video.playCalls;
      ui.video.emit("click");
      await settle();
      assert.equal(ui.video.playCalls, playsBefore);
      assert.equal(ui.reduced.hidden, false);
      assert.equal(ui.controls.hidden, true);
      assertPlayback(ui, false, "Reproducir", "Reproducir video");

      ui.play.emit("click");
      await settle();
      assert.equal(ui.reduced.hidden, true);
      assert.equal(ui.controls.hidden, false);
      assertPlayback(ui, true, "Pausar", "Pausar video");

      ui.video.emit("click");
      await settle();
      assertPlayback(ui, false, "Reproducir", "Reproducir video");
      assert.equal(ui.playback.getAttribute("aria-label"), "Reproducir video");
    }));
});
