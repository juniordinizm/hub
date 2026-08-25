import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { analyzeDmarcReportFiles } from "./dmarc-report";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feedback>
  <report_metadata>
    <org_name>Example Receiver</org_name>
    <report_id>report-1</report_id>
    <date_range><begin>1787529600</begin><end>1787616000</end></date_range>
  </report_metadata>
  <policy_published><domain>neurocapacitar.com.br</domain><p>none</p></policy_published>
  <record>
    <row>
      <source_ip>192.0.2.1</source_ip><count>2</count>
      <policy_evaluated><disposition>none</disposition><dkim>pass</dkim><spf>pass</spf></policy_evaluated>
    </row>
    <identifiers><header_from>neurocapacitar.com.br</header_from></identifiers>
  </record>
</feedback>`;

const makeStoredZip = ({
  contents,
  declaredSize = contents.byteLength,
  name = "report.xml",
}: {
  contents: Uint8Array;
  declaredSize?: number;
  name?: string;
}): Uint8Array => {
  const encoder = new TextEncoder();
  const fileName = encoder.encode(name);
  const local = new Uint8Array(30 + fileName.length + contents.length);
  const localView = new DataView(local.buffer);
  localView.setUint32(0, 0x04_03_4b_50, true);
  localView.setUint16(4, 20, true);
  localView.setUint16(8, 0, true);
  localView.setUint32(18, contents.length, true);
  localView.setUint32(22, declaredSize, true);
  localView.setUint16(26, fileName.length, true);
  local.set(fileName, 30);
  local.set(contents, 30 + fileName.length);

  const central = new Uint8Array(46 + fileName.length);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02_01_4b_50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint16(10, 0, true);
  centralView.setUint32(20, contents.length, true);
  centralView.setUint32(24, declaredSize, true);
  centralView.setUint16(28, fileName.length, true);
  central.set(fileName, 46);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06_05_4b_50, true);
  endView.setUint16(8, 1, true);
  endView.setUint16(10, 1, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length, true);

  const archive = new Uint8Array(local.length + central.length + end.length);
  archive.set(local, 0);
  archive.set(central, local.length);
  archive.set(end, local.length + central.length);
  return archive;
};

describe("DMARC aggregate report analysis", () => {
  it("accepts XML, gzip and zip, deduplicates reports and aggregates records", async () => {
    const bytes = new TextEncoder().encode(xml);
    await expect(
      analyzeDmarcReportFiles([
        { data: bytes, name: "report.xml" },
        { data: gzipSync(bytes), name: "report.xml.gz" },
        { data: makeStoredZip({ contents: bytes }), name: "report.zip" },
      ])
    ).resolves.toEqual({
      records: [
        {
          count: 2,
          disposition: "none",
          dkim: "pass",
          sourceIp: "192.0.2.1",
          spf: "pass",
        },
      ],
      reports: [
        {
          begin: "2026-08-24T00:00:00.000Z",
          end: "2026-08-25T00:00:00.000Z",
          organization: "Example Receiver",
          reportId: "report-1",
        },
      ],
    });
  });

  it("rejects XXE and malformed XML before parsing", async () => {
    const encoder = new TextEncoder();
    await expect(
      analyzeDmarcReportFiles([
        {
          data: encoder.encode(
            '<!DOCTYPE feedback [<!ENTITY xxe SYSTEM "file:///secret">]><feedback>&xxe;</feedback>'
          ),
          name: "xxe.xml",
        },
      ])
    ).rejects.toThrow("DOCTYPE");
    await expect(
      analyzeDmarcReportFiles([
        { data: encoder.encode("<feedback>"), name: "broken.xml" },
      ])
    ).rejects.toThrow("malformed");
  });

  it("rejects excessive input and declared ZIP expansion before decompression", async () => {
    await expect(
      analyzeDmarcReportFiles([
        { data: new Uint8Array(2 * 1024 * 1024 + 1), name: "large.xml" },
      ])
    ).rejects.toThrow("size");
    await expect(
      analyzeDmarcReportFiles([
        {
          data: makeStoredZip({
            contents: new TextEncoder().encode(xml),
            declaredSize: 11 * 1024 * 1024,
          }),
          name: "bomb.zip",
        },
      ])
    ).rejects.toThrow("expansion");
  });
});
