# 硬件面试题库网页

一个离线可打开的硬件面试题库单页网页，目前整理 277 道题，按大厂/小厂侧重点、技术方向、难度和关键词筛选。

## 求职训练功能

- 默认逐题训练：先填写思路，再主动展开参考答案；也可切换到原有卡片浏览布局。
- 自评「不会 / 不熟 / 已掌握」；不会和不熟自动进入错题本，掌握后自动移出。也可手动加入或移出错题本。
- 思路、自评、错题标记、筛选条件和逐题位置自动保存在当前浏览器的 localStorage；刷新后答案会重新收起。
- 展示全题库已自评、已掌握、错题数量和掌握进度。仅查看答案或写思路不会计为已掌握。
- 新增电源设计、量产测试、可靠性测试专项筛选，与原有条件取交集；15 道重点题增加回答步骤和自查要点。
- 可导出 JSON 学习记录。此版本只提供导出，尚未提供页面内导入或跨设备同步。

## 运行与记录保存

可直接双击 `index.html` 使用。为了让保存位置稳定，推荐在本目录运行：

```bash
python -m http.server 8080
```

然后打开 `http://localhost:8080`。运行网页无需安装 Node 或任何依赖。

记录只属于当前浏览器与来源（协议、域名和端口）；更换浏览器、端口或从本地文件切到 HTTP 时不会自动迁移。清理网站数据会清除进度；隐私模式和部分浏览器的本地文件策略可能限制持久保存。读取或保存失败时，页面会显示提示，本次会话仍可训练并导出。不要在多个标签页同时修改同一份记录，当前采用最后一次保存的记录。

掌握度来自自评，没有自动评分。JSON 导出包含个人答题思路，请自行妥善保管。

## 开发与验证

```bash
npm install
npm test
```

14 组 jsdom 回归场景覆盖数据 ID、答案隐藏、草稿与刷新恢复、自评、错题流转、训练位置、筛选交集、排序、专项、导出及异常存储。DOM 测试不包含真实浏览器布局、键盘可达性和设备兼容性验收；本次执行环境无法启动 Chromium，这部分仍需在桌面与手机浏览器确认。

题目记录以 `encodeURIComponent(domain + "::" + title)` 作为稳定 ID；排序、插题和修改答案不影响旧记录。修改已有题目的方向或标题时，需要同时迁移旧 ID 下的学习记录。存储键为 `hardware-interview-learning-v1`，数据格式版本为 1。

## 文件

- `index.html`：页面结构
- `styles.css`：响应式界面样式
- `app.js`：原有 277 道题的数据与稳定 ID
- `learning.js`：筛选、逐题训练、自评、错题本和本地保存
- `coaching.js`：15 道重点题的补充训练指导
- `tests/learning.test.cjs`：DOM 功能回归测试
- `assets/hardware-banner.png`：本地生成的电路板视觉图

## 来源

题目整理参考 GitHub 开源仓库和公开题库：

- https://github.com/mikinty/Hardware-Engineer-Interview-Questions
- https://github.com/pengwubj/hw_interview_questions
- https://github.com/GaetanoLongo/PowerElectronics
- https://github.com/IAS-Uni-Siegen/PE_course
- https://github.com/topics/power-electronics-systems
- https://www.hardware-interview.com/study

界面风格参考 GitHub 开源后台 UI：

- https://github.com/tabler/tabler
- https://github.com/ColorlibHQ/AdminLTE

## 打开方式

直接双击 `index.html` 即可在浏览器中打开。

## 新增训练指导参考

训练指导为面试练习提纲，不替代产品测试规范。温度、应力、限值、持续时间与测量配置须按具体器件和产品要求确定。

- [Tektronix：电源电压测量与探头接法](https://www.tek.com/en/documents/application-note/probing-techniques-accurate-voltage-measurements-power-converters-oscillos)
- [TI：反激输出反馈方式](https://www.ti.com/document-viewer/lit/html/SLVAFK6)
- [Analog Devices：开关电源纹波测量](https://www.analog.com/en/resources/analog-dialogue/articles/lab-skills-for-switch-mode-power-supply-eval-part-1.html)
- [Keysight：功能测试与 ICT 的区别](https://www.keysight.com/ca/en/products/in-circuit-test-for-manufacturing/functional-test-systems.html)
- [Keysight：负载瞬态响应测试实例](https://www.keysight.com/us/en/assets/9018-01458/service-manuals/9018-01458.pdf)

