// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  router: { refresh: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => dependencies.router,
}));

import { PendingCertificateRefresh } from "./pending-certificate-refresh";

describe("PendingCertificateRefresh", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    dependencies.router.refresh.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const setVisibility = (visibilityState: DocumentVisibilityState): void => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue(
      visibilityState
    );
  };

  it("refreshes every 10 seconds while pending certificates are visible", () => {
    setVisibility("visible");
    act(() => root.render(<PendingCertificateRefresh enabled />));

    act(() => vi.advanceTimersByTime(30_000));

    expect(dependencies.router.refresh).toHaveBeenCalledTimes(3);
  });

  it("does not poll when the server reports no pending certificate", () => {
    setVisibility("visible");
    act(() => root.render(<PendingCertificateRefresh enabled={false} />));

    act(() => vi.advanceTimersByTime(30_000));

    expect(dependencies.router.refresh).not.toHaveBeenCalled();
  });

  it("skips refresh ticks while the document is hidden", () => {
    setVisibility("hidden");
    act(() => root.render(<PendingCertificateRefresh enabled />));

    act(() => vi.advanceTimersByTime(30_000));

    expect(dependencies.router.refresh).not.toHaveBeenCalled();
  });

  it("cleans up the interval when unmounted", () => {
    setVisibility("visible");
    act(() => root.render(<PendingCertificateRefresh enabled />));
    act(() => root.unmount());

    act(() => vi.advanceTimersByTime(30_000));

    expect(dependencies.router.refresh).not.toHaveBeenCalled();
  });
});
