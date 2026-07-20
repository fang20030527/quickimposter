import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/cathug/Documents/quickimposter-main/outputs/019f7a65-bee0-7210-85b4-6f661cdcfff2/backlink_comment_opportunities.xlsx";
const tempPath = "/Users/cathug/Documents/quickimposter-main/outputs/019f7a65-bee0-7210-85b4-6f661cdcfff2/backlink_comment_opportunities.tmp.xlsx";
const workDir = path.dirname(new URL(import.meta.url).pathname);

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const keepSheet = workbook.worksheets.getItem("保留清单");
const keepTable = keepSheet.tables.items[0];
const keepValues = keepSheet.getUsedRange().values;
const headers = keepValues[2];
const currentRows = keepValues.slice(3);
const domainCol = headers.indexOf("域名");

if (domainCol < 0) throw new Error("未找到域名列，停止写入。");

const radioRow = [
    "pokerogue.net 补充核验",
    null,
    "radioink.com",
    "https://radioink.com/2026/07/17/radio-ink-july-2026-issue-promo/#respond",
    "OUT MONDAY: Meet The 40 Most Powerful People In Radio",
    "pokerogue.net",
    "英语 / 广播行业与领导力（与游戏主题弱相关）",
    null,
    null,
    8,
    16,
    0,
    "已确认开放；公开 WordPress 评论表单当前直接可见",
    "有独立 Website 字段（input name=url）",
    "Post Comment 可用且未禁用；表单含反垃圾验证",
    "预计 Nofollow + UGC（WordPress 评论链接常见属性；未实际发帖）",
    "Radio Ink 是长期运营的广播行业专业媒体，有明确编辑团队与原创报道，不是 PBN、自动目录或站群；当前文章尚无评论，但主题与游戏站相关性较低",
    "C+（仅高质量自然评论）",
    "仅在能用自然英文回应文章中对领导力、行业影响力或媒体经营的具体观点时使用；Website 填品牌主页，姓名用自然人名或品牌名，不在正文重复放链接。",
    null,
    "审计项目重新抓取期间（浏览器中已打开候选页）",
    new Date("2026-07-20T00:00:00+08:00"),
    "https://sem.3ue.co/backlink_audit/30487650/about；候选页直接核验"
];

let radioIndex = currentRows.findIndex(row => String(row[domainCol] || "").toLowerCase() === "radioink.com");
let added = false;
let updatedRowCount = currentRows.length;

if (radioIndex < 0) {
  const lastIndex = currentRows.length - 1;
  const duplicateTail = lastIndex > 0
    && String(currentRows[lastIndex][domainCol] || "").toLowerCase() === String(currentRows[lastIndex - 1][domainCol] || "").toLowerCase()
    && String(currentRows[lastIndex][3] || "") === String(currentRows[lastIndex - 1][3] || "");

  if (duplicateTail) {
    radioIndex = lastIndex;
    radioRow[1] = radioIndex + 1;
    keepSheet.getRangeByIndexes(3 + radioIndex, 0, 1, 23).values = [radioRow];
  } else {
    radioIndex = currentRows.length;
    updatedRowCount += 1;
    radioRow[1] = updatedRowCount;
    keepTable.rows.add(null, [radioRow]);
  }
  added = true;
} else {
  radioRow[1] = radioIndex + 1;
  keepSheet.getRangeByIndexes(3 + radioIndex, 0, 1, 23).values = [radioRow];
}

const appendedRowNumber = radioIndex + 4;
const appendedRowRange = keepSheet.getRange(`A${appendedRowNumber}:W${appendedRowNumber}`);
appendedRowRange.format.rowHeight = 72;
appendedRowRange.format.wrapText = true;
appendedRowRange.format.verticalAlignment = "center";
keepSheet.getRange("A2").values = [[
  `本表已合并：pips-game.com 严格筛选 4 条 + ageofwargame.io 严格筛选 3 条 + pokerogue.net 已确认 1 条 + 原工作簿恢复网站 4 条。现有网站均保留；请用“来源批次”区分。`
]];

const notesSheet = workbook.worksheets.getItem("筛选说明");
notesSheet.getRange("B5").values = [[updatedRowCount]];
notesSheet.getRange("A33").values = [[
  "除 Wiki/托管平台外，本次还直接核验了浏览器中已打开的 Radio Ink 文章页：评论表单当前开放，存在独立 Website 字段，站点为真实行业媒体，因此新增保留 1 条。"
]];
notesSheet.getRange("A34").values = [[
  "审计项目正在重新抓取，Backlink Analytics 又达到免费请求上限，未能读取完整 UGC 列表；本批次只追加实际可见且逐页核验通过的机会，不虚构站点。"
]];

for (const [index, sheet] of workbook.worksheets.items.entries()) {
  const preview = await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 1.5, format: "png" });
  await fs.writeFile(path.join(workDir, `after-${index}.png`), new Uint8Array(await preview.arrayBuffer()));
}
const appendedRowPreview = await workbook.render({ sheetName: "保留清单", range: "A13:W15", scale: 2.5, format: "png" });
await fs.writeFile(path.join(workDir, "after-0-focus.png"), new Uint8Array(await appendedRowPreview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(tempPath);
await fs.rename(tempPath, inputPath);

const verified = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const keepCheck = await verified.inspect({
  kind: "table",
  sheetId: "保留清单",
  range: `A1:W${updatedRowCount + 3}`,
  include: "values,formulas",
  tableMaxRows: updatedRowCount + 3,
  tableMaxCols: 23,
  tableMaxCellChars: 180,
  maxChars: 50000,
});
console.log(keepCheck.ndjson);

const formulaErrors = await verified.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
  maxChars: 8000,
});
console.log(formulaErrors.ndjson);

console.log(JSON.stringify({
  added,
  totalRows: updatedRowCount,
  output: inputPath,
  previewFiles: workbook.worksheets.items.map((_, i) => path.join(workDir, `after-${i}.png`)),
}));
