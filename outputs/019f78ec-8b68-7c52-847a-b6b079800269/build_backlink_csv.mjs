import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/cathug/Documents/quickimposter-main/outputs/019f78ec-8b68-7c52-847a-b6b079800269";
const csvPath = `${outputDir}/seagames_blog_comment_backlink_screening.csv`;
const xlsxPath = `${outputDir}/seagames_blog_comment_backlink_screening.xlsx`;
const previewPath = `${outputDir}/seagames_blog_comment_backlink_screening_preview.png`;
const checkedDate = "2026-07-19";

const headers = [
  "行号",
  "域名",
  "原始页面URL",
  "HTTP状态",
  "网站或页面类型",
  "公开博客评论入口",
  "评论链接属性",
  "与SeaGames相关性",
  "外链农场风险",
  "保留为博客评论外链",
  "结论",
  "主要依据",
  "核查日期",
];

const rows = [
  [95,"eyerekon.com","http://www.eyerekon.com/tg-seo-link-order-seo-backlinks-homepage-links-3-4/","404","被黑的旧WordPress站","原始页无；站内垃圾文章也未发现可用表单","N/A","低","极高","否","排除","旧作品集站已被博彩/多语言垃圾文章持续灌入；给定SEO卖链页已404",checkedDate],
  [96,"findinfo.in","http://www.findinfo.in/page-215887438589a7976799a1c06a6044ce.html","503","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","与大量不同域名共用完全相同的随机page路径；当前503",checkedDate],
  [97,"gamerkun.com","http://www.gamerkun.com/page-215887438589a7976799a1c06a6044ce.html","连接失败","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径指纹；站点不可稳定访问",checkedDate],
  [98,"hebaqh.cv","http://www.hebaqh.cv/page-215887438589a7976799a1c06a6044ce.html","连接失败","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径指纹；站点不可稳定访问",checkedDate],
  [99,"japhub.com","http://www.japhub.com/ysearch/?s=%E7%B6%B2%E4%B8%8A%E9%81%8A%E6%88%B2","200","真实内容站的搜索结果页","无；抽查文章未发现公开评论表单","N/A","中","低","否","不适用","网站本身不是外链农场，但给定链接是站内搜索页，不能提交博客评论，也不是稳定编辑引用",checkedDate],
  [100,"jqpaintingandremodeling.net","http://www.jqpaintingandremodeling.net/tg-seo-link-order-seo-backlinks-homepage-links-3-4/","连接失败","疑似被黑企业站/SEO注入页","未发现","N/A","低","极高","否","排除","URL直接包含seo-link-order与backlinks关键词；站点不可稳定访问",checkedDate],
  [101,"keyadvocates.com","http://www.keyadvocates.com/tg-masslinker-software-to-publish-backlinks-3-5/","200","被黑或垃圾注入的企业站","无","N/A","低","极高","否","排除","页面标题直接宣传MASSLINKER批量发布外链；实测无公开评论表单",checkedDate],
  [102,"mp3fresh.net","http://www.mp3fresh.net/page-215887438589a7976799a1c06a6044ce.html","503","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径指纹；当前503",checkedDate],
  [103,"preparation.co.in","http://www.preparation.co.in/page-215887438589a7976799a1c06a6044ce.html","503","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径指纹；当前503",checkedDate],
  [104,"procycling.org","http://www.procycling.org/page-215887438589a7976799a1c06a6044ce.html","503","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","页面标题明确为购买老域名和外链；重复随机page路径",checkedDate],
  [105,"queries.co.in","http://www.queries.co.in/page-215887438589a7976799a1c06a6044ce.html","连接失败","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径指纹；站点不可稳定访问",checkedDate],
  [106,"securise-toit.fr","http://www.securise-toit.fr/tg-seo-link-order-seo-backlinks-homepage-links-4/","404","真实企业站上的垃圾注入URL","无","N/A","低","高","否","排除","主题为屋顶安全且与游戏无关；给定SEO卖链路径已404",checkedDate],
  [107,"seol.store","http://www.seol.store/domain/domain/part/208516","200","SEO域名研究/链接数据库","无；不是博客文章","nofollow（实测）","低","高","否","排除","页面是批量域名列表，外链带nofollow，不属于博客评论机会",checkedDate],
  [108,"spinac.co.za","http://www.spinac.co.za/tg-seo-link-order-seo-backlinks-homepage-links-6/","404","被黑WordPress/博彩垃圾内容站","原始页无；站内其他垃圾文章开放","nofollow/ugc（实测）","低","极高","否","排除","近期大量多语言赌场文章且评论开放，典型被黑或群发垃圾站；给定页已404",checkedDate],
  [109,"taxies.biz","http://www.taxies.biz/page-215887438589a7976799a1c06a6044ce.html","200","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径且页面体积异常大，符合批量外链页特征",checkedDate],
  [110,"theface.in","http://www.theface.in/page-215887438589a7976799a1c06a6044ce.html","503","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径指纹；当前503",checkedDate],
  [111,"themumbai.in","http://www.themumbai.in/page-215887438589a7976799a1c06a6044ce.html","503","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径指纹；当前503",checkedDate],
  [112,"thirty.co.in","http://www.thirty.co.in/page-215887438589a7976799a1c06a6044ce.html","503","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径指纹；当前503",checkedDate],
  [113,"topleveldomains.space","http://www.topleveldomains.space/page-215887438589a7976799a1c06a6044ce.html","连接失败","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","域名主题与路径均指向老域名/外链交易网络；站点不可稳定访问",checkedDate],
  [114,"tyre.pro","http://www.tyre.pro/page-215887438589a7976799a1c06a6044ce.html","503","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径指纹；当前503",checkedDate],
  [115,"tyres.pro","http://www.tyres.pro/page-215887438589a7976799a1c06a6044ce.html","503","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径指纹；当前503",checkedDate],
  [116,"uaewebdirectory.info","http://www.uaewebdirectory.info/page-215887438589a7976799a1c06a6044ce.html","200","薄内容目录/批量垃圾页面","未发现","N/A","低","极高","否","排除","重复随机page路径；页面仅约数百字节，缺少真实编辑内容",checkedDate],
  [117,"way2check.art","http://www.way2check.art/page-215887438589a7976799a1c06a6044ce.html","503","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径指纹；当前503",checkedDate],
  [118,"websitescrawl.art","http://www.websitescrawl.art/page-215887438589a7976799a1c06a6044ce.html","503","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径指纹；当前503",checkedDate],
  [119,"webworthchecker.cv","http://www.webworthchecker.cv/page-215887438589a7976799a1c06a6044ce.html","连接失败","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","自动网站估值式域名加重复随机page路径；不可稳定访问",checkedDate],
  [120,"yesdomains.space","http://www.yesdomains.space/page-215887438589a7976799a1c06a6044ce.html","连接失败","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","域名主题与重复随机page路径均符合域名/外链农场特征",checkedDate],
  [121,"2x9.co","https://2x9.co/page-215887438589a7976799a1c06a6044ce.html","连接失败","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","重复随机page路径指纹；站点不可稳定访问",checkedDate],
  [122,"4.bing.com","https://4.bing.com/images/search?FORM=IRBPRS&q=Dodge%20Bullet%20Game","200","搜索引擎图片结果页","无","N/A","中","低","否","不适用","Bing搜索结果不是可投稿博客，也不构成可控评论外链",checkedDate],
  [123,"500.tools","https://500.tools/c/communities","200","工具/产品目录","无；仅支持目录提交","当前SeaGames目录链接为dofollow（实测）","高","中","否","不符合本次类型","不是明显垃圾农场，现有品牌目录链接可保留；但它不是博客评论渠道，且公开宣传高权重外链，不建议当评论外链投放",checkedDate],
  [124,"5913231.cc","https://5913231.cc/page-215887438589a7976799a1c06a6044ce.html","200","批量垃圾页面/薄内容站","未发现","N/A","低","极高","否","排除","重复随机page路径且页面极薄，无真实博客内容",checkedDate],
  [125,"79ch.net","https://79ch.net/tg-seo-link-order-seo-backlinks-homepage-links-6/","404","被黑WordPress/赌场垃圾内容站","原始页无；当前文章评论关闭","N/A","低","极高","否","排除","近期每分钟级发布多语言赌场文章；给定SEO卖链页404，明显被黑或自动群发",checkedDate],
  [126,"8coint.com","https://8coint.com/list.php?part=2025%2F09%2F05%2F619","200","卖链服务页","无","N/A","低","极高","否","排除","页面标题直接写High-quality backlink service，属于明确卖链站",checkedDate],
  [127,"africawasteconsulting.com","https://africawasteconsulting.com/tg-seo-link-order-seo-backlinks-homepage-links-5/","404","被黑WordPress/博彩垃圾内容站","原始页无；站内其他垃圾文章开放","nofollow/ugc（实测）","低","极高","否","排除","真实企业主题已被赌场和批量SEO文章污染；评论虽开放但属于高风险垃圾环境",checkedDate],
  [128,"all-aged-domains.com","https://all-aged-domains.com/page-215887438589a7976799a1c06a6044ce.html","200","老域名/外链交易网络","未发现","N/A","低","极高","否","排除","页面标题明确宣传购买老域名和外链；重复随机page路径",checkedDate],
  [129,"allare.io","https://allare.io/businesses/seagames-com","200","自动生成的评论/企业目录","无博客评论；仅企业评价","nofollow（实测）","中","高","否","排除","新域名却声称拥有大规模已验证数据；SeaGames页面零评论且外链nofollow，疑似批量生成",checkedDate],
  [130,"alljobs.info","https://alljobs.info/f08f2f8e93472fe872990550914c10d8-l/","503","批量垃圾页面网络","未发现","N/A","低","极高","否","排除","页面标题宣传购买老域名和外链；当前503",checkedDate],
  [131,"allventurehub.com","https://allventurehub.com/discover-fun-ad-free-games-online-with-seagames/","200","泛主题内容农场/推广稿站","后台标记开放但前台未发现可提交表单","文章正文dofollow；评论链接N/A","高","高","否","排除","站点跨大量无关主题并残留Lorem Ipsum；SeaGames文章为明显推广稿，缺少真实编辑与评论生态",checkedDate],
];

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

const csvText = [headers, ...rows]
  .map((row) => row.map(csvEscape).join(","))
  .join("\r\n") + "\r\n";

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(csvPath, `\uFEFF${csvText}`, "utf8");

const workbook = await Workbook.fromCSV(csvText, { sheetName: "博客评论外链筛选" });
const sheet = workbook.worksheets.getItem("博客评论外链筛选");
sheet.showGridLines = false;
sheet.freezePanes.freezeRows(1);

const used = sheet.getRange(`A1:M${rows.length + 1}`);
used.format = {
  font: { name: "Arial", size: 10, color: "#172033" },
  verticalAlignment: "top",
};
sheet.getRange("A1:M1").format = {
  fill: "#17324D",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  rowHeight: 32,
  borders: { preset: "outside", style: "thin", color: "#17324D" },
};
sheet.getRange(`A2:M${rows.length + 1}`).format.wrapText = true;
sheet.getRange(`A2:A${rows.length + 1}`).format.horizontalAlignment = "center";
sheet.getRange(`D2:D${rows.length + 1}`).format.horizontalAlignment = "center";
sheet.getRange(`H2:K${rows.length + 1}`).format.horizontalAlignment = "center";
sheet.getRange(`M2:M${rows.length + 1}`).format.horizontalAlignment = "center";
sheet.getRange(`A2:M${rows.length + 1}`).format.borders = {
  insideHorizontal: { style: "thin", color: "#D9E2EC" },
};
sheet.getRange(`J2:J${rows.length + 1}`).conditionalFormats.add("containsText", {
  text: "否",
  format: { fill: "#FDE8E7", font: { color: "#A61B1B", bold: true } },
});
sheet.getRange(`I2:I${rows.length + 1}`).conditionalFormats.add("containsText", {
  text: "极高",
  format: { fill: "#FADBD8", font: { color: "#922B21", bold: true } },
});
sheet.getRange(`I2:I${rows.length + 1}`).conditionalFormats.add("containsText", {
  text: "高",
  format: { fill: "#FCE8D5", font: { color: "#9C4A00" } },
});

const widths = {
  A: 7, B: 25, C: 58, D: 12, E: 25, F: 32, G: 23,
  H: 16, I: 16, J: 20, K: 17, L: 60, M: 13,
};
for (const [col, width] of Object.entries(widths)) {
  sheet.getRange(`${col}:${col}`).format.columnWidth = width;
}
sheet.getRange(`A2:M${rows.length + 1}`).format.rowHeight = 42;

const table = sheet.tables.add(`A1:M${rows.length + 1}`, true, "BacklinkScreeningTable");
table.style = "TableStyleMedium2";
table.showFilterButton = true;

const inspect = await workbook.inspect({
  kind: "table",
  range: `博客评论外链筛选!A1:M${rows.length + 1}`,
  include: "values,formulas",
  tableMaxRows: 6,
  tableMaxCols: 13,
  maxChars: 7000,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "博客评论外链筛选",
  range: `A1:M${rows.length + 1}`,
  scale: 0.55,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(xlsxPath);

console.log(JSON.stringify({ csvPath, xlsxPath, previewPath, rowCount: rows.length }));
