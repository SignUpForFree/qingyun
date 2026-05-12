// 探针：抓取单卦详情页看结构
import { fetchPage } from "./fetcher.js";

async function main() {
  console.log("=== 乾为天 详情页 ===");
  const html = await fetchPage("https://www.buyiju.com/zhouyi/yijing/64gua-1.html");
  console.log(html.substring(0, 8000));
  console.log("\n\n=== 总长度 ===", html.length);
}

main().catch(console.error);
