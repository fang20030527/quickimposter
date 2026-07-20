import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/cathug/Documents/quickimposter-main/outputs/019f7a65-bee0-7210-85b4-6f661cdcfff2/backlink_comment_opportunities.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
console.log(workbook.help("*", { search: "getDataRows|rows.add|table row", include: "index,examples,notes", maxChars: 8000 }).ndjson);
