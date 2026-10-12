# 采购比价 · Arco Design Mobile / iOS H5

第三版使用实际的 `@arco-design/mobile-react@2.39.1`，整体 `ContextProvider system="ios"`。
没有注册、登录或账户中心。为现有 App WebView 提供手机页面。

## 页面与操作

- 根页面：大标题与 iOS inset grouped 分组列表；商品、数量、币种、交期逐行填写。
- 添加报价：Arco ActionSheet 选择拍照、相册、PDF、文字或手动填写。
- 编辑：Arco NavBar 顶部取消/完成；Arco Input/Textarea 单列分组；Arco Picker 选择币种、单位；iOS Switch 确认规格。
- 文件选择：真实 Arco Uploader，支持相机 capture，并验证文件大小和份数。
- 结果：分组摘要和供应商列表，点击进入费用与采购条件详情。
- 来源和补问：Arco Popup，长内容可滚动；生成的消息可编辑、切换语言与复制。
- 根导航：Arco TabBar，比价/记录；内页使用返回层级，无步骤条。
- 反馈：Arco Toast、iOS Dialog。

采用系统字体、17px 主要文字、13px 分组说明、#F2F2F7 背景、白色分组、#007AFF 操作色与 0.5px 分隔线。没有宣传横幅、桌面导航、虚线上传区或模拟手机外框。

## 真实组件依赖

React 18.3.1、ReactDOM 18.3.1、React Transition Group 4.4.5、Arco Mobile 2.39.1。
版本固定在 package.json，当前浏览器通过官方包的 CDN UMD/CSS 分发加载；未复制或仿造组件。

官方依据：

- https://github.com/arco-design/arco-design-mobile/blob/main/packages/arcodesign/README.en-US.md
- https://github.com/arco-design/arco-design-mobile/blob/main/packages/arcodesign/rollup.lib.js
- https://github.com/arco-design/arco-design-mobile/tree/main/packages/arcodesign/components

当前环境不能通过 npm 下载依赖，CDN加载保留为浏览器运行时步骤。恢复联网后应进行实际组件与手机浏览器验收，再决定是否将依赖本地打包，减少运行时 CDN 依赖。

## 业务与识别

保留确定性金额计算、报价比较、设备本地历史、CSV导出和完整打印报告。
历史查看不会覆盖未完成草稿；从历史打开结果后返回历史；报价原始金额明确展示个/箱单位。

默认 Qwen-VL：图片直接输入；PDF 用本地 PDF.js 逐页转 JPEG，再提交视觉模型。服务端读取 `DASHSCOPE_API_KEY`；不向浏览器暴露密钥。

当前真实模型密钥未配置，缺少配置会返回 `503 MODEL_NOT_CONFIGURED`，不产生模拟识别。
接口说明及46项模拟调用测试见 server/README.md。AI未知字段保留为空，规格核对不自动勾选。

## 源码与构建

- web/arco-app.js：React和真实Arco组件界面。
- web/quote-flow.js：报价业务与导出。
- web/core.js：定点金额与比较规则。
- web/vendor/：PDF.js 与许可证。
- server/recognize.mjs：Qwen/OpenAI 多模态接口。

```sh
node scripts/build.mjs
node scripts/validate-artifact.mjs
```

构建沿用原站点身份，生成 server-enabled Worker 与静态资源。部署包包含 `.openai/hosting.json` 和 `server/index.js`。

宿主可提供 `window.YicaiHost.close()`，或监听可取消的 `yicai:close` 事件。
`window.YicaiCompare.handleBack()` 可接原生返回键；`getSnapshot()`、`exportCSV()` 用于只读导出。

世界义乌的文件分享、用户身份和生产接口仍需按平台文档对接。Sites私有访问边界独立于本H5自身的无登录设计。

## 验证与待办

组件API来自官方源码。应用组件连接、字段编辑、金额单位、比价、历史草稿保护和返回路径已通过状态测试（组件使用测试替身）。Worker产物检查通过。
当前执行环境限制了浏览器启动和网络上传；尚未完成第三版实际浏览器视觉验收，线上仍为最初版本。
