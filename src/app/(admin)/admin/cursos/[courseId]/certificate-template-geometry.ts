import type { CertificateTemplateField } from "@/features/certificates/template-rules";

export type CertificateFieldGeometry = Pick<
  CertificateTemplateField,
  "height" | "width" | "x" | "y"
>;

export interface CertificatePageSize {
  height: number;
  width: number;
}

export interface CertificatePointerDelta {
  x: number;
  y: number;
}

export interface CertificateContentSize {
  height: number;
  width: number;
}

export type CertificateResizeAnchor = "left" | "center" | "right";

export interface CertificateResizeOptions {
  anchor?: CertificateResizeAnchor;
  preserveAspectRatio?: boolean;
}

export interface CertificateResizeDimensions {
  height?: number;
  width?: number;
}

const roundPercentage = (value: number): number => Math.round(value * 10) / 10;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const getMaxWidthForAnchor = (
  field: CertificateFieldGeometry,
  anchor: CertificateResizeAnchor
): number => {
  if (anchor === "center") {
    const center = field.x + field.width / 2;
    return 2 * Math.min(center, 100 - center);
  }
  if (anchor === "right") {
    return field.x + field.width;
  }
  return 100 - field.x;
};

const getXForAnchor = (
  field: CertificateFieldGeometry,
  width: number,
  anchor: CertificateResizeAnchor
): number => {
  if (anchor === "center") {
    return field.x + (field.width - width) / 2;
  }
  if (anchor === "right") {
    return field.x + field.width - width;
  }
  return field.x;
};

const getMaxHeightForAnchor = (
  field: CertificateFieldGeometry,
  anchor: CertificateResizeAnchor
): number => {
  if (anchor === "center") {
    const center = field.y + field.height / 2;
    return 2 * Math.min(center, 100 - center);
  }
  return 100 - field.y;
};

const getYForAnchor = (
  field: CertificateFieldGeometry,
  height: number,
  anchor: CertificateResizeAnchor
): number => {
  if (anchor === "center") {
    return field.y + (field.height - height) / 2;
  }
  return field.y;
};

const resizeCertificateField = (
  field: CertificateFieldGeometry,
  dimensions: CertificateResizeDimensions,
  options: CertificateResizeOptions = {}
): CertificateFieldGeometry => {
  const anchor = options.anchor ?? "center";
  const maxWidth = Math.max(1, getMaxWidthForAnchor(field, anchor));
  const maxHeight = Math.max(1, getMaxHeightForAnchor(field, anchor));
  let width = clamp(dimensions.width ?? field.width, 1, maxWidth);
  let height = clamp(dimensions.height ?? field.height, 1, maxHeight);

  if (options.preserveAspectRatio) {
    const widthScale = width / field.width;
    const heightScale = height / field.height;
    let scale =
      Math.abs(widthScale - 1) >= Math.abs(heightScale - 1)
        ? widthScale
        : heightScale;
    const minimumScale = Math.max(1 / field.width, 1 / field.height);
    const maximumScale = Math.min(
      maxWidth / field.width,
      maxHeight / field.height
    );
    scale = clamp(scale, minimumScale, Math.max(minimumScale, maximumScale));
    width = clamp(field.width * scale, 1, maxWidth);
    height = clamp(field.height * scale, 1, maxHeight);
  }

  width = roundPercentage(width);
  height = roundPercentage(height);
  const nextX = getXForAnchor(field, width, anchor);
  const nextY = getYForAnchor(field, height, anchor);

  return clampCertificateFieldPosition(
    { ...field, height, width, x: nextX, y: nextY },
    { x: nextX, y: nextY }
  );
};

export const clampCertificateFieldPosition = (
  field: CertificateFieldGeometry,
  position: Pick<CertificateFieldGeometry, "x" | "y">
): CertificateFieldGeometry => ({
  ...field,
  x: clamp(roundPercentage(position.x), 0, Math.max(0, 100 - field.width)),
  y: clamp(roundPercentage(position.y), 0, Math.max(0, 100 - field.height)),
});

export const moveCertificateFieldByPixels = (
  field: CertificateFieldGeometry,
  delta: CertificatePointerDelta,
  page: CertificatePageSize
): CertificateFieldGeometry => {
  if (page.width <= 0 || page.height <= 0) {
    return { ...field };
  }

  return clampCertificateFieldPosition(field, {
    x: field.x + (delta.x / page.width) * 100,
    y: field.y + (delta.y / page.height) * 100,
  });
};

export const resizeCertificateFieldByPixels = (
  field: CertificateFieldGeometry,
  delta: CertificatePointerDelta,
  page: CertificatePageSize,
  options: CertificateResizeOptions = {}
): CertificateFieldGeometry => {
  if (page.width <= 0 || page.height <= 0) {
    return { ...field };
  }

  return resizeCertificateField(
    field,
    {
      height: field.height + (delta.y / page.height) * 100,
      width: field.width + (delta.x / page.width) * 100,
    },
    options
  );
};

export const resizeCertificateFieldGeometry = (
  field: CertificateFieldGeometry,
  dimensions: CertificateResizeDimensions,
  options: CertificateResizeOptions = {}
): CertificateFieldGeometry =>
  resizeCertificateField(field, dimensions, {
    ...options,
    anchor: options.anchor ?? "center",
  });

export const fitCertificateFieldToContent = (
  field: CertificateFieldGeometry,
  content: CertificateContentSize,
  page: CertificatePageSize
): CertificateFieldGeometry => {
  if (
    page.width <= 0 ||
    page.height <= 0 ||
    content.width <= 0 ||
    content.height <= 0
  ) {
    return { ...field };
  }

  return resizeCertificateFieldGeometry(field, {
    height: (content.height / page.height) * 100,
    width: (content.width / page.width) * 100,
  });
};

export const resizeCertificateFieldWidth = (
  field: CertificateFieldGeometry,
  width: number,
  anchor: CertificateResizeAnchor = "center"
): CertificateFieldGeometry =>
  resizeCertificateField(field, { width }, { anchor });

export const snapCertificateFieldPosition = (
  field: CertificateFieldGeometry,
  position: Pick<CertificateFieldGeometry, "x" | "y">,
  tolerance = 1.2
): CertificateFieldGeometry => {
  const centeredX = (100 - field.width) / 2;
  const centeredY = (100 - field.height) / 2;
  const nextX =
    Math.abs(position.x - centeredX) <= tolerance ? centeredX : position.x;
  const nextY =
    Math.abs(position.y - centeredY) <= tolerance ? centeredY : position.y;

  return clampCertificateFieldPosition(field, { x: nextX, y: nextY });
};
