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

const css = extract("style");
const scriptSource = extract("script");

describe("video section contract", () => {
  it("defaults to a muted looping inline video without controls", () => {
    const videoTag = source.match(/<video[\s\S]*?>/)?.[0] ?? "";
    assert.match(videoTag, /\sautoplay(?:\s|>)/);
    assert.match(videoTag, /\smuted(?:\s|>)/);
    assert.match(videoTag, /\sloop(?:\s|>)/);
    assert.match(videoTag, /\splaysinline(?:\s|>)/);
    assert.match(videoTag, /poster=\{posterSrc\}/);
    assert.match(videoTag, /aria-hidden="true"/);
    assert.doesNotMatch(videoTag, /\scontrols(?:\s|=|>)/);
    assert.doesNotMatch(source, /<button/);
    assert.doesNotMatch(source, /from "@lucide\/astro"/);
  });

  it("lists mp4 before webm among video sources", () => {
    const mp4 = source.indexOf('"/video/neutro.mp4"');
    const webm = source.indexOf('"/video/neutro.webm"');
    assert.ok(mp4 >= 0, "expected mp4 source path");
    assert.ok(webm >= 0, "expected webm source path");
    assert.ok(mp4 < webm, "mp4 must come before webm");
  });

  it("drops playback and sound controls from markup, css, and script", () => {
    assert.doesNotMatch(
      source,
      /data-video-(controls|playback|mute|play|reduced)/,
    );
    assert.doesNotMatch(css, /video-section__(controls|btn|play|icon|reduced)/);
    assert.doesNotMatch(css, /cursor:\s*pointer/);
    assert.doesNotMatch(scriptSource, /addEventListener\(\s*["']click["']/);
    assert.doesNotMatch(scriptSource, /data-video-(playback|mute|play)/);
    assert.match(css, /\.video-section__video\s*\{[^}]*object-fit:\s*cover/);
  });

  it("keeps a poster fallback when autoplay is refused or motion is reduced", () => {
    assert.match(scriptSource, /prefers-reduced-motion:\s*reduce/);
    assert.match(scriptSource, /pending\.catch/);
    assert.match(scriptSource, /function showPoster/);
    assert.match(scriptSource, /removeAttribute\(\s*["']autoplay["']\s*\)/);
    assert.match(scriptSource, /removeAttribute\(\s*["']src["']\s*\)/);
  });

  it("keeps preload none on the video element markup", () => {
    const videoTag = source.match(/<video[\s\S]*?>/)?.[0] ?? "";
    assert.match(videoTag, /\spreload="none"(?:\s|>)/);
    assert.doesNotMatch(videoTag, /\spreload="auto"(?:\s|>)/);
  });

  it("puts media URLs only in data-src on source markup", () => {
    const tags = [...source.matchAll(/<source\b[^>]*>/g)].map((match) => match[0]);
    assert.ok(tags.length >= 1, "expected at least one source tag");
    for (const tag of tags) {
      assert.match(tag, /\bdata-src=/);
      const withoutDataSrc = tag.replaceAll(/\bdata-src=/g, "");
      assert.doesNotMatch(withoutDataSrc, /\bsrc=/);
    }
  });
});

type Listener = () => void;

const videoRequests: string[] = [];

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
  hidden = false;
  textContent: string;
  paused = true;
  muted = false;
  defaultMuted = false;
  autoplay = false;
  volume = 1;
  playCalls = 0;
  loadCalls = 0;
  rejectPlay = false;
  throwPlay = false;
  #src = "";

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
    this.autoplay = this.attrs.has("autoplay");
    this.muted = this.attrs.has("muted");
  }

  get src() {
    return this.#src;
  }

  set src(value: string) {
    this.#src = value;
    if (value) {
      this.attrs.set("src", value);
      if (this.tag === "source" || this.tag === "video") {
        videoRequests.push(value);
      }
    } else {
      this.attrs.delete("src");
    }
  }

  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
    if (name === "src") this.#src = value;
  }

  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }

  removeAttribute(name: string) {
    this.attrs.delete(name);
    if (name === "src") this.#src = "";
    if (name === "autoplay") this.autoplay = false;
    if (name.startsWith("data-")) delete this.dataset[dataKey(name)];
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
    if (this.throwPlay) throw new Error("NotAllowedError");
    if (this.rejectPlay) return Promise.reject(new Error("NotAllowedError"));
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
  const video = new El("video", {
    "data-video": "",
    autoplay: "",
    muted: "",
    loop: "",
    playsinline: "",
    preload: "none",
    poster: "/video/neutro-poster.jpg",
  });
  const mp4 = new El("source", { "data-src": "/video/neutro.mp4" });
  const webm = new El("source", { "data-src": "/video/neutro.webm" });
  video.append(mp4);
  video.append(webm);
  frame.append(video);
  section.append(frame);
  return { section, frame, video, webm, mp4 };
}

type VideoUi = ReturnType<typeof buildTree>;

const doc = {
  tree: new El("body"),
  listeners: new Map<string, Listener[]>(),
  readyState: "complete",
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

type WinListener = Listener & { once?: boolean };

const win = {
  listeners: new Map<string, WinListener[]>(),
  matchMedia(query: string) {
    return {
      matches:
        query === "(prefers-reduced-motion: reduce)" ? reducedMotion : false,
      media: query,
    };
  },
  addEventListener(
    type: string,
    fn: Listener,
    options?: boolean | { once?: boolean },
  ) {
    const list = this.listeners.get(type) ?? [];
    const wrapped: WinListener = () => fn();
    wrapped.once =
      typeof options === "object" && options !== null
        ? options.once === true
        : false;
    list.push(wrapped);
    this.listeners.set(type, list);
  },
  emit(type: string) {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      list.filter((fn) => !fn.once),
    );
    for (const fn of list) fn();
  },
};

const nav = {
  connection: undefined as { saveData?: boolean } | undefined,
};

const context = vm.createContext({
  document: doc,
  window: win,
  navigator: nav,
  IntersectionObserver: FakeObserver,
  console,
});

const script = stripTypeScriptTypes(scriptSource, {
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

function assertSourcesIdle(ui: VideoUi) {
  assert.equal(ui.video.playCalls, 0);
  assert.equal(ui.video.loadCalls, 0);
  assert.equal(ui.mp4.src, "");
  assert.equal(ui.webm.src, "");
  assert.equal(ui.video.paused, true);
  assert.equal(videoRequests.length, 0);
}

function assertPreloadDeferred(ui: VideoUi) {
  const preload = ui.video.getAttribute("preload");
  assert.ok(
    preload === null || preload === "none",
    `preload before load must be none or absent, got ${String(preload)}`,
  );
}

async function boot(options?: {
  reduced?: boolean;
  rejectPlay?: boolean;
  throwPlay?: boolean;
  saveData?: boolean | null;
  readyState?: "loading" | "interactive" | "complete";
  intersect?: boolean;
  fireLoad?: boolean;
}): Promise<VideoUi> {
  reducedMotion = options?.reduced ?? false;
  doc.readyState = options?.readyState ?? "complete";
  win.listeners.clear();
  videoRequests.length = 0;
  if (options?.saveData === null) {
    nav.connection = undefined;
  } else if (options?.saveData === undefined) {
    nav.connection = undefined;
  } else {
    nav.connection = { saveData: options.saveData };
  }
  const ui = buildTree();
  ui.video.rejectPlay = options?.rejectPlay ?? false;
  ui.video.throwPlay = options?.throwPlay ?? false;
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
  if (options?.intersect === false) return ui;
  observer.callback([{ isIntersecting: true }]);
  if (options?.fireLoad) {
    doc.readyState = "complete";
    win.emit("load");
  }
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

function assertPoster(ui: VideoUi) {
  assert.equal(ui.video.paused, true);
  assert.equal(ui.video.muted, true);
  assert.equal(ui.webm.src, "");
  assert.equal(ui.mp4.src, "");
  assert.equal(ui.webm.getAttribute("data-src"), "/video/neutro.webm");
  assert.equal(ui.mp4.getAttribute("data-src"), "/video/neutro.mp4");
  assert.equal(ui.video.getAttribute("poster"), "/video/neutro-poster.jpg");
  assert.equal(ui.video.getAttribute("autoplay"), null);
  assert.equal(ui.video.autoplay, false);
}

describe("video section playback", () => {
  it("autoplays muted once the frame is visible after load", () =>
    exclusive(async () => {
      const ui = await boot();
      assert.equal(ui.video.paused, false);
      assert.equal(ui.video.muted, true);
      assert.equal(ui.video.defaultMuted, true);
      assert.ok(ui.video.playCalls >= 1);
      assert.equal(ui.mp4.src, "/video/neutro.mp4");
      assert.equal(ui.webm.src, "/video/neutro.webm");
      assert.equal(ui.video.getAttribute("autoplay"), "");
      assert.equal(ui.video.loadCalls, 1);
      assert.equal(
        ui.video.children.findIndex((child) => child === ui.mp4),
        0,
      );
      assert.equal(
        ui.video.children.findIndex((child) => child === ui.webm),
        1,
      );
    }));

  it("does not attach sources when the frame intersects before load", () =>
    exclusive(async () => {
      const ui = await boot({
        readyState: "loading",
        fireLoad: false,
      });
      assertPreloadDeferred(ui);
      assertSourcesIdle(ui);
      assert.equal(ui.video.getAttribute("autoplay"), "");
      doc.readyState = "complete";
      win.emit("load");
      await settle();
      assert.equal(ui.video.paused, false);
      assert.ok(ui.video.playCalls >= 1);
      assert.equal(ui.mp4.src, "/video/neutro.mp4");
      assert.equal(ui.webm.src, "/video/neutro.webm");
      assert.equal(ui.video.loadCalls, 1);
      assert.deepEqual(videoRequests, [
        "/video/neutro.mp4",
        "/video/neutro.webm",
      ]);
    }));

  it("keeps preload none and issues no video request before window load", () =>
    exclusive(async () => {
      const ui = await boot({
        readyState: "loading",
        fireLoad: false,
      });
      assertPreloadDeferred(ui);
      assert.equal(ui.video.getAttribute("preload"), "none");
      assertSourcesIdle(ui);
      assert.equal(ui.mp4.getAttribute("src"), null);
      assert.equal(ui.webm.getAttribute("src"), null);
      assert.equal(ui.mp4.getAttribute("data-src"), "/video/neutro.mp4");
      assert.equal(ui.webm.getAttribute("data-src"), "/video/neutro.webm");
    }));

  it("shows the poster and does not download video when Save-Data is on", () =>
    exclusive(async () => {
      const ui = await boot({ saveData: true });
      assert.equal(ui.video.playCalls, 0);
      assert.equal(ui.video.loadCalls, 0);
      assertPoster(ui);
    }));

  it("still autoplays when the connection API is missing", () =>
    exclusive(async () => {
      const ui = await boot({ saveData: null });
      assert.equal(ui.video.paused, false);
      assert.ok(ui.video.playCalls >= 1);
      assert.equal(ui.mp4.src, "/video/neutro.mp4");
      assert.equal(ui.webm.src, "/video/neutro.webm");
    }));

  it("does not toggle playback when the video is clicked", () =>
    exclusive(async () => {
      const ui = await boot();
      const plays = ui.video.playCalls;
      ui.video.emit("click");
      ui.frame.emit("click");
      await settle();
      assert.equal(ui.video.paused, false);
      assert.equal(ui.video.muted, true);
      assert.equal(ui.video.playCalls, plays);
      assert.equal(ui.video.listeners.has("click"), false);
    }));

  it("shows the poster and does not autoplay when motion is reduced", () =>
    exclusive(async () => {
      const ui = await boot({ reduced: true });
      assert.equal(ui.video.playCalls, 0);
      assert.equal(ui.video.loadCalls, 0);
      assertPoster(ui);
      ui.video.emit("click");
      await settle();
      assert.equal(ui.video.playCalls, 0);
      assert.equal(ui.video.paused, true);
    }));

  it("shows the poster when play() rejects", () =>
    exclusive(async () => {
      const ui = await boot({ rejectPlay: true });
      assert.ok(ui.video.playCalls >= 1);
      assert.ok(ui.video.loadCalls >= 2);
      assertPoster(ui);
    }));

  it("shows the poster when play() throws", () =>
    exclusive(async () => {
      const ui = await boot({ throwPlay: true });
      assert.equal(ui.video.playCalls, 1);
      assertPoster(ui);
    }));
});
