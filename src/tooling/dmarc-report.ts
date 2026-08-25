import { Readable } from "node:stream";
import { createGunzip, createInflateRaw } from "node:zlib";
import { XMLParser, XMLValidator } from "fast-xml-parser";

export interface DmarcReportFile {
  data: Uint8Array;
  name: string;
}

export interface DmarcAnalysis {
  records: Array<{
    count: number;
    disposition: "none" | "quarantine" | "reject";
    dkim: "fail" | "pass";
    sourceIp: string;
    spf: "fail" | "pass";
  }>;
  reports: Array<{
    begin: string;
    end: string;
    organization: string;
    reportId: string;
  }>;
}

const MAXIMUM_INPUT_BYTES = 2 * 1024 * 1024;
const MAXIMUM_EXPANDED_BYTES = 10 * 1024 * 1024;
const MAXIMUM_EXPANSION_RATIO = 100;
const XML_DECLARATION_PATTERN = /<!\s*(?:DOCTYPE|ENTITY)\b/i;
const ZIP_LOCAL_SIGNATURE = 0x04_03_4b_50;
const ZIP_CENTRAL_SIGNATURE = 0x02_01_4b_50;
const ZIP_END_SIGNATURE = 0x06_05_4b_50;

const collectBounded = async (
  stream: NodeJS.ReadableStream
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const bytes =
      chunk instanceof Uint8Array ? chunk : Buffer.from(chunk as string);
    total += bytes.byteLength;
    if (total > MAXIMUM_EXPANDED_BYTES) {
      if ("destroy" in stream && typeof stream.destroy === "function") {
        stream.destroy();
      }
      throw new Error("DMARC report expansion exceeds the size limit.");
    }
    chunks.push(bytes);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
};

const gunzipBounded = async (data: Uint8Array): Promise<Uint8Array> =>
  await collectBounded(Readable.from(data).pipe(createGunzip()));

const findZipEnd = (data: Uint8Array): number => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let offset = data.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END_SIGNATURE) {
      return offset;
    }
  }
  throw new Error("DMARC ZIP is malformed.");
};

const inflateRawBounded = async (data: Uint8Array): Promise<Uint8Array> =>
  await collectBounded(Readable.from(data).pipe(createInflateRaw()));

const expandZipEntry = async (
  method: number,
  compressed: Uint8Array
): Promise<Uint8Array | null> => {
  if (method === 0) {
    return Uint8Array.from(compressed);
  }
  if (method === 8) {
    return await inflateRawBounded(compressed);
  }
  return null;
};

const unzipSingleXml = async (data: Uint8Array): Promise<Uint8Array> => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const endOffset = findZipEnd(data);
  const entries = view.getUint16(endOffset + 10, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  if (
    entries !== 1 ||
    centralOffset + 46 > data.byteLength ||
    view.getUint32(centralOffset, true) !== ZIP_CENTRAL_SIGNATURE
  ) {
    throw new Error("DMARC ZIP must contain exactly one XML report.");
  }
  const flags = view.getUint16(centralOffset + 8, true);
  const method = view.getUint16(centralOffset + 10, true);
  const compressedSize = view.getUint32(centralOffset + 20, true);
  const expandedSize = view.getUint32(centralOffset + 24, true);
  const nameLength = view.getUint16(centralOffset + 28, true);
  const localOffset = view.getUint32(centralOffset + 42, true);
  const name = new TextDecoder().decode(
    data.subarray(centralOffset + 46, centralOffset + 46 + nameLength)
  );
  const isEncrypted = flags % 2 === 1;
  if (
    isEncrypted ||
    !name.toLowerCase().endsWith(".xml") ||
    expandedSize > MAXIMUM_EXPANDED_BYTES ||
    (compressedSize > 0 &&
      expandedSize / compressedSize > MAXIMUM_EXPANSION_RATIO)
  ) {
    throw new Error("DMARC ZIP expansion is unsafe.");
  }
  if (
    localOffset + 30 > data.byteLength ||
    view.getUint32(localOffset, true) !== ZIP_LOCAL_SIGNATURE
  ) {
    throw new Error("DMARC ZIP local entry is malformed.");
  }
  const localNameLength = view.getUint16(localOffset + 26, true);
  const localExtraLength = view.getUint16(localOffset + 28, true);
  const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
  const compressed = data.subarray(dataOffset, dataOffset + compressedSize);
  if (compressed.byteLength !== compressedSize) {
    throw new Error("DMARC ZIP entry is truncated.");
  }
  const expanded = await expandZipEntry(method, compressed);
  if (!expanded || expanded.byteLength !== expandedSize) {
    throw new Error("DMARC ZIP expansion does not match its declaration.");
  }
  return expanded;
};

const decodeReport = async ({ data }: DmarcReportFile): Promise<string> => {
  if (data.byteLength > MAXIMUM_INPUT_BYTES) {
    throw new Error("DMARC report input exceeds the size limit.");
  }
  let expanded = data;
  if (data[0] === 0x1f && data[1] === 0x8b) {
    expanded = await gunzipBounded(data);
  } else if (
    data.byteLength >= 4 &&
    new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(
      0,
      true
    ) === ZIP_LOCAL_SIGNATURE
  ) {
    expanded = await unzipSingleXml(data);
  }
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(expanded);
  if (XML_DECLARATION_PATTERN.test(xml)) {
    throw new Error("DMARC XML DOCTYPE and ENTITY declarations are forbidden.");
  }
  if (XMLValidator.validate(xml) !== true) {
    throw new Error("DMARC XML is malformed.");
  }
  return xml;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requiredString = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`DMARC report ${name} is invalid.`);
  }
  return value.trim();
};

const requiredInteger = (value: unknown, name: string): number => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`DMARC report ${name} is invalid.`);
  }
  return number;
};

const parseReport = (xml: string) => {
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    processEntities: false,
    trimValues: true,
  });
  const parsed = parser.parse(xml) as unknown;
  if (!(isRecord(parsed) && isRecord(parsed.feedback))) {
    throw new Error("DMARC report feedback is invalid.");
  }
  const feedback = parsed.feedback;
  if (!isRecord(feedback.report_metadata)) {
    throw new Error("DMARC report metadata is invalid.");
  }
  const metadata = feedback.report_metadata;
  if (!isRecord(metadata.date_range)) {
    throw new Error("DMARC report metadata is invalid.");
  }
  const dateRange = metadata.date_range;
  const beginSeconds = requiredInteger(dateRange.begin, "begin");
  const endSeconds = requiredInteger(dateRange.end, "end");
  const reports = {
    begin: new Date(beginSeconds * 1000).toISOString(),
    end: new Date(endSeconds * 1000).toISOString(),
    organization: requiredString(metadata.org_name, "organization"),
    reportId: requiredString(metadata.report_id, "ID"),
  };
  const rawRecords = Array.isArray(feedback.record)
    ? feedback.record
    : [feedback.record];
  const records = rawRecords.map((rawRecord) => {
    if (!(isRecord(rawRecord) && isRecord(rawRecord.row))) {
      throw new Error("DMARC report row is invalid.");
    }
    const row = rawRecord.row;
    if (!isRecord(row.policy_evaluated)) {
      throw new Error("DMARC policy evaluation is invalid.");
    }
    const policy = row.policy_evaluated;
    const disposition = requiredString(policy.disposition, "disposition");
    const dkim = requiredString(policy.dkim, "DKIM");
    const spf = requiredString(policy.spf, "SPF");
    if (
      !(
        ["none", "quarantine", "reject"].includes(disposition) &&
        ["fail", "pass"].includes(dkim) &&
        ["fail", "pass"].includes(spf)
      )
    ) {
      throw new Error("DMARC alignment result is invalid.");
    }
    return {
      count: requiredInteger(row.count, "count"),
      disposition: disposition as "none" | "quarantine" | "reject",
      dkim: dkim as "fail" | "pass",
      sourceIp: requiredString(row.source_ip, "source IP"),
      spf: spf as "fail" | "pass",
    };
  });
  return { records, report: reports };
};

export const analyzeDmarcReportFiles = async (
  files: readonly DmarcReportFile[]
): Promise<DmarcAnalysis> => {
  const uniqueReports = new Map<string, ReturnType<typeof parseReport>>();
  for (const file of files) {
    const report = parseReport(await decodeReport(file));
    uniqueReports.set(
      `${report.report.organization}\0${report.report.reportId}`,
      report
    );
  }
  const aggregated = new Map<string, DmarcAnalysis["records"][number]>();
  for (const report of uniqueReports.values()) {
    for (const record of report.records) {
      const key = [
        record.sourceIp,
        record.disposition,
        record.dkim,
        record.spf,
      ].join("\0");
      const existing = aggregated.get(key);
      aggregated.set(key, {
        ...record,
        count: record.count + (existing?.count ?? 0),
      });
    }
  }
  return {
    records: [...aggregated.values()].sort((left, right) =>
      left.sourceIp.localeCompare(right.sourceIp)
    ),
    reports: [...uniqueReports.values()]
      .map(({ report }) => report)
      .sort((left, right) => left.reportId.localeCompare(right.reportId)),
  };
};
