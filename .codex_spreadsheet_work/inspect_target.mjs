import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/cathug/Documents/quickimposter-main/outputs/019f7a65-bee0-7210-85b4-6f661cdcfff2/backlink_comment_opportunities.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sheet = workbook.worksheets.getItem("原有网站（恢复）");
console.log(JSON.stringify(sheet.tables.items.map((t) => ({ name: t.name, address: t.address, style: t.style, banded: t.showBandedRows, filters: t.showFilterButton }))));
console.log("VALUES");
console.log(JSON.stringify(sheet.getRange("A1:O7").values));
console.log("FORMULAS");
console.log(JSON.stringify(sheet.getRange("A1:O7").formulas));
