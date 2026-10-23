<h1 align="center">云听音乐 (YunTing Music) 移动版</h1>

<p align="center">
  <a href="https://github.com/ShmilyStar/yunting-music/releases"><img src="https://img.shields.io/github/v/release/ShmilyStar/yunting-music?display_name=tag" alt="Release"></a>
  <a href="https://github.com/ShmilyStar/yunting-music/releases"><img src="https://img.shields.io/github/downloads/ShmilyStar/yunting-music/latest/total" alt="Downloads"></a>
  <img src="https://img.shields.io/github/license/ShmilyStar/yunting-music" alt="License">
  <img src="https://img.shields.io/badge/React%20Native-0.73-61dafb" alt="React Native">
  <img src="https://img.shields.io/badge/platforms-Android%20%7C%20iOS-3ddc84" alt="Platforms">
</p>

<p align="center">基于 React Native 开发的跨平台音乐播放器 · Android + iOS</p>

---

## 本仓库声明

- **仓库**：[ShmilyStar/yunting-music](https://github.com/ShmilyStar/yunting-music)，应用包名 `cn.toside.ytmusic.mobile`，应用名「云听音乐」。
- **来源与授权**：本项目在 [lyswhut/lx-music-mobile](https://github.com/lyswhut/lx-music-mobile)（Apache License 2.0）基础上二次开发，遵循 Apache License 2.0。原始版权归属上游作者，本仓库与上游作者无官方隶属或背书关系。上游版权与许可声明见 [NOTICE](NOTICE) 与 [LICENSE](LICENSE)。
- **独立发布**：本仓库的签名、版本号、更新通道与上游彼此独立，均不代表上游立场。安装包**只从本仓库的 [GitHub Releases](https://github.com/ShmilyStar/yunting-music/releases) 获取**，其他渠道流传的安装包与本项目无关，请自行鉴别。
- **仓库内容**：本仓库仅包含**软件本体可编译 / 发布所需的代码**（`android/`、`ios/`、`src/`、`rust/`、`assets/`、`publish/`、`patches/` 及构建配置）。开发过程文档、规格工件、测试夹具等辅助内容不随本仓库分发。

## 下载与安装

- **Android**：前往 [Releases](https://github.com/ShmilyStar/yunting-music/releases) 下载 APK。按 ABI 提供多种包，**绝大多数设备选 `arm64-v8a`**；拿不准就选 `universal`。签名与上游不同，从上游版本覆盖安装需先卸载。
- **iOS**：Releases 提供**未签名 IPA**（`*-unsigned.ipa`），需自行重签后侧载（如 AltStore / SideStore，用个人免费 Apple ID 重签）。免费签名有效期 7 天、同时最多 3 个应用，需定期刷新。

> 本软件为技术学习与交流用途，完全免费、无广告、无商业合作。请尊重版权、支持正版。

## 功能特性

- 多平台音乐搜索、榜单、歌单、歌手、专辑浏览与播放
- 本地音乐扫描与管理（含内嵌封面 / 标签读取）
- 自定义音源（在线导入 / 本地导入），支持**脚本自报更新地址 → 发现新版本 → 一键更新**
- 歌词滚动显示、播放队列、最近播放、收藏、下载管理
- 数据同步服务接入（多端歌单 / 收藏同步）
- 深浅色主题、字号缩放、手机 / 平板 / 横屏多分辨率自适应

## 技术栈

- [React Native](https://reactnative.dev/) 0.73
- [Redux](https://redux.js.org/)（自研轻量 store）
- 加密核心：[Rust](https://www.rust-lang.org/)（`rust/lxcore`，iOS 交叉编译为静态库；Android 走原生 Java 实现）
- 原生桥：Android（Java）、iOS（Objective-C）

## 支持的平台

- **Android 5 及以上**（按 ABI 分包：arm64-v8a / armeabi-v7a / x86 / x86_64 / universal）
- **iOS**（未签名 IPA，需重签侧载；不上架 App Store）

*HarmonyOS NEXT 暂无支持计划。*

## 从源码构建

### 环境

- Node.js ≥ 18（见 `.nvmrc`）
- JDK 17 + Android SDK（构建 Android）
- Xcode 16 + CocoaPods + Rust 工具链（构建 iOS，需 macOS）

### Android

```bash
npm ci
cd android
./gradlew assembleRelease      # Windows: gradlew.bat assembleRelease
```

产物：`android/app/build/outputs/apk/release/`。

### iOS（未签名 IPA，需 macOS，或交给 CI）

```bash
npm ci
cd ios && pod install && cd ..
bash rust/build-ios-libs.sh    # 编译 Rust 加密核心静态库
cd ios
xcodebuild -workspace LxMusicMobile.xcworkspace -scheme LxMusicMobile \
  -configuration Release -sdk iphoneos -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO build
```

CI 可在无 macOS 的开发机上产出 IPA：推送改动到 `main` 触发 **iOS Unsigned IPA** 工作流（`.github/workflows/ios-unsigned-ipa.yml`，macOS Runner 全自动），产物为 Artifact。

## 发布流程

- `release.yml`（手动触发）：Android + iOS 全量构建，打 tag、创建 GitHub Release 并挂载 APK / IPA。Android 需在仓库 Secrets 配置 `KEYSTORE_*` 四项。
- `ios-unsigned-ipa.yml`：仅构建未签名 IPA 并上传 Artifact，不创建 Release（内部验证 / 手动取包）。
- App 内「检查更新」读取 `publish/version.json`（`main` 分支），作为更新公告与版本信息来源。

## 贡献

本项目欢迎 PR，但为了顺利合并，请：

- 新功能 PR 先建 Issue 说明，确认该功能是否确有必要；
- bug 修复 PR 附上修复前后说明与复现方式；
- 其他类型 PR 适当附上说明。

## 项目协议

本项目遵循 [Apache License 2.0](LICENSE)，并以下列补充协议为准（如与 Apache 2.0 冲突，以补充协议为准）。

*词语约定：本协议中的“本项目”指云听音乐移动版项目；“使用者”指签署本协议的使用者；“官方音乐平台”指对本项目内置的包括酷我、酷狗、咪咕等音乐源的官方平台统称；“版权数据”指包括但不限于图像、音频、名字等在内的他人拥有所属版权的数据。*

### 一、数据来源

1.1 本项目的各官方平台在线数据来源原理是从其公开服务器中拉取数据（与未登录状态在官方平台 APP 获取的数据相同），经过筛选与合并后展示，本项目不对数据的合法性、准确性负责。

1.2 本项目本身没有获取某个音频数据的能力，在线音频数据来源来自软件设置内「自定义源」所选「源」返回的在线链接。例如播放某首歌，本项目所做的只是将歌曲名、艺术家等信息传递给「源」，若「源」返回链接，则本项目认为这就是该歌曲的音频数据而进行使用；至于是否正确，本项目无法校验，使用中可能出现希望播放的音频与实际播放的音频不对应或无法播放的问题。

1.3 本项目的非官方平台数据（如「我的列表」内列表）来自使用者本地系统或使用者连接的同步服务，本项目不对其合法性、准确性负责。

### 二、版权数据

2.1 使用本项目的过程中可能会产生版权数据。对于这些版权数据，本项目不拥有其所有权。为避免侵权，使用者务必在 **24 小时内** 清除使用本项目过程中产生的版权数据。

### 三、音乐平台别名

3.1 本项目内的官方音乐平台别名为本项目内对官方音乐平台的一个称呼，不包含恶意。如官方音乐平台认为不妥，可联系本项目更改或移除。

### 四、资源使用

4.1 本项目内使用的部分包括但不限于字体、图片等资源来源于互联网。如出现侵权可联系本项目移除。

### 五、免责声明

5.1 由于使用本项目产生的任何性质的任何直接、间接、特殊、偶然或结果性损害（包括但不限于因商誉损失、停工、计算机故障引起的损害赔偿，或任何其他商业损害或损失）均由使用者负责。

### 六、使用限制

6.1 本项目完全免费，开源发布于 GitHub，面向全世界用作对技术的学习交流。本项目不对项目内技术可能存在的违反当地法律法规的行为作保证。

6.2 **禁止在违反当地法律法规的情况下使用本项目。** 对于使用者在明知或不知当地法律法规不允许的情况下使用本项目所造成的任何违法违规行为，由使用者承担，本项目不承担任何直接、间接、特殊、偶然或结果性责任。

### 七、版权保护

7.1 音乐平台不易，请尊重版权，支持正版。

### 八、非商业性质

8.1 本项目仅用于对技术可行性的探索及研究，不接受任何商业（包括但不限于广告等）合作及捐赠。

### 九、接受协议

9.1 若你使用了本项目，即代表你接受本协议。
