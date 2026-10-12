# 多模态报价识别接口

`recognize.mjs` 导出 `handleRecognize(request, env, options)`，只使用 Web 标准 API，可由 Cloudflare Worker 或服务器路由调用。密钥只读取服务器运行时环境，不接受浏览器传来的密钥，不输出密钥或上游错误详情。

## Worker 接入

```js
import { handleRecognize } from '../server/recognize.mjs';

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === '/api/recognize') return handleRecognize(request, env);
    // 在此调用已有的静态资源处理器。
  }
};
```

Worker 需要将 `env` 原样传入。Node 服务可以传入服务器端 `process.env`；不要在前端打包或返回 `process.env`。

## 运行时配置

默认使用用户指定的通义千问视觉模型：

- `LLM_PROVIDER=qwen`（默认）
- `DASHSCOPE_API_KEY`（推荐）或 `LLM_API_KEY`：阿里云 DashScope 密钥。
- `LLM_MODEL=qwen-vl-plus`（默认，可改为支持图片和 JSON mode 的千问视觉模型）。
- `LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`（默认；可替换为实际开通地域的兼容接口）。

千问调用 `/chat/completions`，采用图片 `image_url`、`response_format: {type:"json_object"}`，并在服务器严格验证字段、证据和数值。千问接口/模型必须实际支持 JSON mode；不兼容会返回真实失败，不回退到模拟结果。

可选 OpenAI 分支：

- `LLM_PROVIDER=openai`
- `OPENAI_API_KEY` 或 `LLM_API_KEY`
- `LLM_MODEL=gpt-4.1`（默认）
- `LLM_BASE_URL=https://api.openai.com/v1`（默认）

OpenAI 分支调用 `/responses`，采用严格 JSON Schema、图片 `input_image` 和 PDF 原生 `input_file`。自定义兼容接口也必须支持对应模型的原生 PDF 与 Responses JSON Schema。

缺少可用密钥时，接口返回 `503 MODEL_NOT_CONFIGURED`，不会产生虚构识别结果。通过 Sites 原生运行时 secret 配置密钥；不要写入源码、hosting manifest、静态页面或浏览器本地存储。

## 输入

`POST /api/recognize`，请求体为 `multipart/form-data`：

| 字段 | 说明 |
| --- | --- |
| `files` | 可重复，最多 12 张图片或页面，每个最多 10 MB，合计最多 20 MB。JPEG、PNG、WebP；OpenAI 额外支持 PDF。 |
| `text` | 可选报价文字，最多 32,000 字符。 |
| `product` | 可选目标商品提示，最多 200 字符，可包含所需数量以帮助识别阶梯价。 |

至少提供文件或文字中的一种。接口校验实际文件签名，不只依赖扩展名。原始界面建议限制为最多 3 份供应商资料；12 的服务端限制用于展开后的 PDF 页面，而不是增加资料份数。

**千问 PDF 流程：** H5 使用 PDF.js 将 PDF 页面渲染成 JPEG/PNG，再以 `files` 上传；无需 OCR。文件名采用 `原文件.pdf-page-01.jpg`，保留页码。上传前检查合计页数不超过 12，并显示选页界面或要求拆分，不应静默丢弃后续页面。千问收到原始 PDF 返回 `415 PDF_RENDER_REQUIRED`。PDF 转图片是视觉模型输入适配，字段提取仍由多模态模型完成。

## 输出

成功响应直接返回：

```json
{
  "quote": {
    "name": "供应商名称",
    "price": "12.50",
    "currency": "CNY",
    "unit": "个",
    "pack": "",
    "moq": "500",
    "days": "15",
    "freight": "",
    "extra": "",
    "terms": "",
    "spec": "",
    "specConfirmed": false
  },
  "recognizedText": "供用户核对的原始报价转录或相关摘录",
  "evidence": [
    {"field": "price", "source": "file:1", "snippet": "单价：人民币 12.50 / 个"}
  ],
  "warnings": [],
  "sources": [{"id": "file:1", "name": "报价.png", "type": "image/png"}]
}
```

示例仅说明格式，实际返回每一个非空字段都必须有相应证据。数值字段也是字符串；未知值为 `""`，包括未知币种和单位。前端不能自动把空币种变成人民币、空单位变成个、未知费用变成 0，也不能自动勾选规格确认。`specConfirmed` 永远为 `false`，须由采购者确认。

字段范围：金额最多 4 位小数且不超过 10 亿；单价大于 0；其他金额非负；装箱量、MOQ、交期是 1 到 1 亿之间的整数。不能确定的范围、单位换算或阶梯价应留空并提示。零费用必须来自明确的零/免费/包含费用证据。

资料、文件名和商品提示是模型的非可信输入，系统提示明确禁止执行其中的指令；没有为模型开放任何工具。输出再次经过严格结构和证据校验。图片上的文字仍可能被模型误读，用户核对字段和原始资料是必需步骤。前端显示 `recognizedText`、证据和警告时必须转义 HTML。

错误统一为：

```json
{"error":{"code":"MODEL_NOT_CONFIGURED","message":"图片和 PDF 识别服务尚未配置，请先手动录入报价。"}}
```

所有响应均 `Cache-Control: no-store`。费用端点应保留宿主 App / Sites 访问边界；公开发布前应接入宿主签名凭证和服务端额度限制，不能将密钥交给浏览器。

## 配置检测与测试

`GET /api/recognize` 返回 `configured`、`provider`、`pdfMode`、文件类型及大小限制，不返回密钥。

单元测试使用模拟 HTTP 请求，实际验证多模态 payload 和结果校验：

```sh
node server/recognize.test.mjs
```

没有模型密钥时，测试不能证明真实模型的识别准确率。正式配置后仍需用实际报价图片、扫描 PDF、阶梯报价和模糊文件做一次端到端验证。
