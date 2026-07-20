import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/cathug/Documents/quickimposter-main/outputs/019f7a65-bee0-7210-85b4-6f661cdcfff2/backlink_comment_opportunities.xlsx";
const workDir = path.dirname(new URL(import.meta.url).pathname);

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));

const overview = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 12000,
  tableMaxRows: 15,
  tableMaxCols: 16,
  tableMaxCellChars: 120,
});
console.log(overview.ndjson);

const sheetInfo = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 4000 });
console.log(sheetInfo.ndjson);

for (const [sheetIndex, sheet] of workbook.worksheets.items.entries()) {
  const used = sheet.getUsedRange();
  if (used) {
    const values = await workbook.inspect({
      kind: "table",
      sheetId: sheet.name,
      range: used.address,
      include: "values,formulas",
      tableMaxRows: 500,
      tableMaxCols: 20,
      tableMaxCellChars: 200,
      maxChars: 60000,
    });
    console.log(values.ndjson);

    const styles = await workbook.inspect({
      kind: "computedStyle",
      sheetId: sheet.name,
      range: used.address,
      maxChars: 12000,
    });
    console.log(styles.ndjson);
  }

  const preview = await workbook.render({
    sheetName: sheet.name,
    autoCrop: "all",
    scale: 1.5,
    format: "png",
  });
  await fs.writeFile(path.join(workDir, `before-${sheetIndex}-${sheet.name.replaceAll(/[^A-Za-z0-9_-]/g, "_")}.png`), new Uint8Array(await preview.arrayBuffer()));
}
