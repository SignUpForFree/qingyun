// 快速探针：抓取卜易居周易页面看结构
import { fetchPage } from "./fetcher.js";

async function main() {
  console.log("=== 抓取列表页 ===");
  const html = await fetchPage("https://www.buyiju.com/zhouyi/");
  // 输出前 5000 字符
  console.log(html.substring(0, 5000));
  console.log("\n\n=== 总长度 ===", html.length);
}

main().catch(console.error);
