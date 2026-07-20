import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/cathug/Documents/quickimposter-main/outputs/019f7a65-bee0-7210-85b4-6f661cdcfff2/backlink_comment_opportunities.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sheets = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 5000 });
console.log(sheets.ndjson);
for (const sheet of workbook.worksheets.items) {
  console.log(`SHEET=${sheet.name} USED=${sheet.getUsedRange()?.address ?? ""}`);
  const range = sheet.getUsedRange()?.address || "A1:A1";
  const preview = await workbook.render({ sheetName: sheet.name, range, scale: 0.7, format: "png" });
  const safe = sheet.name.replaceAll(/[\\/:*?"<>|]/g, "_");
  await fs.writeFile(`/Users/cathug/Documents/quickimposter-main/.codex_spreadsheet_work/${safe}.png`, new Uint8Array(await preview.arrayBuffer()));
}
