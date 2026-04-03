
# AI 附件发送协议说明

本文档用于指导 AI 在当前 OpenClaw New UI 环境中,向用户发送图片或文件。

---

## 1. 当前附件服务器地址

当前项目前端配置的附件服务器地址为:

```text
https://lt.xianan.xin:1563
```

附件上传接口完整地址:

```text
POST https://lt.xianan.xin:1563/api/chat/attachments
```

---

## 2. AI 发送附件的标准流程

当你需要向用户发送图片、音频、视频或普通文件时,必须按以下流程操作:

1. 先准备好要发送的文件
2. 将文件上传到附件服务器
3. 取得服务器返回的 `attachment` 对象
4. 在最终回复中,把该对象放入消息的 `attachments` 字段
5. 不要只说"我已生成文件",必须返回实际可访问的附件

---

## 3. 上传接口说明

### 请求地址

```text
POST https://lt.xianan.xin:1563/api/chat/attachments
```

### Content-Type

```text
multipart/form-data
```

### 表单字段

- `file`:文件本体,必填
- `sessionKey`:当前会话 ID,必填
- `kind`:附件类型,建议填写,取值如下:
  - `image`
  - `audio`
  - `video`
  - `file`
- `durationMs`:可选,仅音频时可填写

---

## 4. 上传成功后的返回格式

服务端会返回如下 JSON:

```json
{
  "attachment": {
    "id": "xxx",
    "kind": "image",
    "name": "result.png",
    "mimeType": "image/png",
    "size": 12345,
    "url": "https://lt.xianan.xin:1563/api/chat/attachments/s-123/xxx.png"
  }
}
```

其中:

- `id`:附件唯一 ID
- `kind`:附件类型
- `name`:文件名
- `mimeType`:MIME 类型
- `size`:文件大小
- `url`:可访问的附件地址

---

## 5. AI 最终回复格式要求

上传成功后,只需要在回复正文中包含附件的 URL 链接即可,前端会自动识别并渲染。

推荐格式如下:

```
这是你要的图片。
https://lt.xianan.xin:1563/api/chat/attachments/main/xxx.png
```

不需要额外的 `attachments` 字段,也不需要构造特殊的 JSON 格式。

---

## 6. 重要规则

### 必须遵守

1. 当要发送附件时，必须先上传，再回复
2. 回复中只需包含附件的 URL 链接
3. 不要只在正文里描述"已生成文件"
4. 不要只返回本地路径
5. 链接必须是用户可访问的完整 URL

### 推荐做法

- 图片使用 `kind: "image"`
- 音频使用 `kind: "audio"`
- 视频使用 `kind: "video"`
- 其他文件使用 `kind: "file"`

---

## 7. 可直接给 AI 的执行指令

你可以直接将以下内容发给 AI:

```text
当你需要向用户发送图片、音频、视频或普通文件时,必须先将文件上传到附件服务器,然后把服务器返回的 attachment 对象放入最终消息的 attachments 字段中。

附件服务器地址:
https://lt.xianan.xin:1563

上传接口:
POST https://lt.xianan.xin:1563/api/chat/attachments

请求格式:
multipart/form-data

表单字段:
- file: 文件本体
- sessionKey: 当前会话 ID
- kind: image | audio | video | file
- durationMs: 可选

上传成功后,服务端会返回:
{
  "attachment": {
    "id": "...",
    "kind": "...",
    "name": "...",
    "mimeType": "...",
    "size": 12345,
    "url": "https://..."
  }
}

你的最终回复必须包含:
- content
- attachments

不要只说"我已经生成文件",必须返回真实可访问的附件对象。
```

---

## 8. 补充说明

当前前端页面已经支持:

1. 优先显示 `message.attachments`
2. 兼容 `message.files`
3. 兼容正文中的部分附件链接

因此,最推荐的方式始终是:

```text
上传文件 -> 获取 attachment -> 放入 attachments -> 返回给前端
```
