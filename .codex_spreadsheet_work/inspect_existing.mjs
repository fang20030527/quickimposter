import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/cathug/Documents/quickimposter-main/outputs/019f7a65-bee0-7210-85b4-6f661cdcfff2/backlink_comment_opportunities.xlsx";
const previewPath = "/Users/cathug/Documents/quickimposter-main/.codex_spreadsheet_work/existing_preview.png";

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const overview = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 6000,
  tableMaxRows: 10,
  tableMaxCols: 15,
  tableMaxCellChars: 140,
});
console.log("OVERVIEW");
console.log(overview.ndjson);

const table = await workbook.inspect({
  kind: "table",
  range: "筛选结果!A1:O8",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 15,
  maxChars: 12000,
});
console.log("TABLE");
console.log(table.ndjson);

const styles = await workbook.inspect({
  kind: "computedStyle",
  sheetId: "筛选结果",
  range: "A1:O5",
  maxChars: 10000,
});
console.log("STYLES");
console.log(styles.ndjson);

const preview = await workbook.render({
  sheetName: "筛选结果",
  range: "A1:O5",
  scale: 1,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
console.log(`PREVIEW=${previewPath}`);
