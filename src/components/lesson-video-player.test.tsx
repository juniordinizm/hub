/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LessonVideoPlayer } from "./lesson-video-player";

const { recordLessonWatchProgressAction, replace, refresh } = vi.hoisted(
  () => ({
    recordLessonWatchProgressAction: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  })
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));
vi.mock("@/app/(student)/app/actions", () => ({
  recordLessonWatchProgressAction,
}));
vi.mock("@/components/lesson-focus-mode", () => ({
  LessonFocusContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/ui/aspect-ratio", () => ({
  AspectRatio: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("LessonVideoPlayer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("restores persisted position after the JMVStream player reports readiness without recording completion", () => {
    act(() => {
      root.render(
        <LessonVideoPlayer
          durationSeconds={300}
          initialPositionSeconds={123}
          initialWatchedPercent={41}
          isPreview={false}
          lessonId="lesson-1"
          title="Aula"
          videoEmbedUrl="https://player.jmvstream.com/evt/example"
          videoProvider="jmvstream"
        >
          <p>Conteúdo</p>
        </LessonVideoPlayer>
      );
    });

    const iframe = container.querySelector("iframe");
    if (!iframe?.contentWindow) {
      throw new Error("Expected the player iframe to be available.");
    }

    const contentWindow = iframe.contentWindow;
    const postMessage = vi.spyOn(contentWindow, "postMessage");

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            currentTime: 0,
            duration: 300,
            event: "jmvplayerout-status",
          },
          origin: "https://player.jmvstream.com",
          source: contentWindow,
        })
      );
    });

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ jump: 123, public_event: "jmvplayer-jump" }),
      "https://player.jmvstream.com"
    );
    expect(recordLessonWatchProgressAction).not.toHaveBeenCalled();
  });
});
