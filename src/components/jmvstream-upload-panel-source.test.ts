import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("JmvstreamUploadPanel upload lifecycle", () => {
  it("does not mark completed uploads as failed when player sync fails", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("let uploadCompleted = false");
    expect(source).toContain("uploadCompleted = true");
    expect(source).toContain("if (activeVideoHash && !uploadCompleted)");
  });

  it("removes the lesson video through a server action instead of only local form state", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("removeJmvstreamVideoFromLessonAction");
    expect(source).toContain("await removeJmvstreamVideoFromLessonAction");
    expect(source).toContain("onRemoveVideo?.()");
  });

  it("shows a pending-delete status when JMVStream rejects remote deletion", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("result.deletePending");
    expect(source).toContain(
      "Video removido da aula. Exclusao na JMVStream pendente."
    );
  });

  it("notifies the lesson editor when the official player url is ready", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("onPlayerReady?: (playerUrl: string) => void");
    expect(source).toContain("onPlayerReady?.(playerSync.playerUrl)");
    expect(source).toContain("playerUrl: playerSync.playerUrl");
  });

  it("shows retry delete failures without relying on a thrown server action error", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain(
      "const retryResult = await retryJmvstreamDeleteAction"
    );
    expect(source).toContain("if (!retryResult.ok)");
    expect(source).toContain("throw new Error(retryResult.error)");
  });

  it("keeps processing uploads visible and allows manual player sync", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('asset?.uploadStatus === "processing"');
    expect(source).toContain("Verificar player agora");
    expect(source).toContain("syncProcessingPlayer");
  });

  it("warns before leaving the page while video bytes are uploading", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('window.addEventListener("beforeunload"');
    expect(source).toContain("isUploading");
    expect(source).toContain("event.preventDefault()");
  });

  it("keeps failed uploads recoverable with a replacement and discard path", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('asset?.uploadStatus === "failed"');
    expect(source).toContain("Selecionar outro arquivo");
    expect(source).toContain("Descartar sessao");
    expect(source).toContain("discardJmvstreamUploadAction");
  });

  it("uses the file input button instead of a non-semantic clickable dropzone", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("<label");
    expect(source).toContain("htmlFor={inputId}");
    expect(source).not.toContain("useKeyWithClickEvents: Dropzone Container");
  });

  it("keeps the manual-link replacement path available while a video is active", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("Substituir por link");
    expect(source).toContain("manualLinkSlot &&");
  });

  it("lets the administrator cancel an in-progress browser transfer", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("AbortController");
    expect(source).toContain("Cancelar upload");
  });
});
