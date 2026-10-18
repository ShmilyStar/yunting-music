/**
 * React Native CLI 配置（云听音乐）。
 *
 * 字体资源：`MaterialCommunityIcons.ttf`，由 `src/components/common/IconMC.tsx` 经
 * `react-native-vector-icons/MaterialCommunityIcons` 使用。
 *
 * Android 端 ReactFontManager 只按**文件名**在 `assets/fonts/` 下查找字体族
 * （见 `node_modules/react-native-vector-icons/lib/create-icon-set.js` 的 Android 分支），
 * 且本项目 `android/app/build.gradle` 没有 apply 该库的 `fonts.gradle`，
 * 所以字体直接放在 `android/app/src/main/assets/fonts/`。
 *
 * 本项目根目录没有 `assets/fonts/`（根 `assets/` 只有 `script/user-api-preload.js`，
 * 并以 asset srcDir 并入 Android 包），因此这里声明字体实际所在的路径，
 * 而不是模板默认的 `./assets/fonts/`。
 */
module.exports = {
  assets: ['./android/app/src/main/assets/fonts/'],
  // iOS：本次只对齐 Android 侧品牌与包名，字体未加入 Xcode 工程（UIAppFonts 未改动）。
  ios: {},
}
