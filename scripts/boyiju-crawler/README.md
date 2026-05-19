# 卜易居数据爬取工具

从 [卜易居](https://www.buyiju.com/) 爬取周易 64 卦原文数据，补全福小运 项目中 `db/seed/hexagrams.ts` 的占位字段。

## 用途

福小运 梅花易数功能需要 64 卦的卦辞、彖辞、象传、爻辞作为 AI prompt 输入。当前 `hexagrams.ts` 中 `image`（象辞）和 `lines`（爻辞）是占位数据，需爬取补全。

## 数据来源

- 网站：卜易居 (buyiju.com)
- 数据为传统典籍原文（周易/易传属公共领域）
- 本工具仅供学习研究，不对数据进行商业分发

## 使用

```bash
cd scripts/boyiju-crawler
npm install

# 1. 爬取 64 卦数据 → src/output/gua64-raw.json
npm run crawl:gua64

# 2. 转换为 seed 格式 → src/output/gua64-seed.ts
npm run transform
```

爬取完成后，将 `output/gua64-seed.ts` 中的数据合并回 `db/seed/hexagrams.ts`。

## 限速

每次请求间隔 1.5s，尊重网站资源。整个爬取过程约 2 分钟。
