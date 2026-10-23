import { Platform, BackHandler, Linking, Dimensions, Alert, Appearance, PermissionsAndroid, AppState, StyleSheet, type ScaledSize } from 'react-native'
// import ExtraDimensions from 'react-native-extra-dimensions-android'
import Clipboard from '@react-native-clipboard/clipboard'
import { storageDataPrefix } from '@/config/constant'
import { gzipFile, readFile, temporaryDirectoryPath, unGzipFile, unlink, writeFile } from '@/utils/fs'
import { backHome, getSystemLocales, isIgnoringBatteryOptimization, isNotificationsEnabled, requestNotificationPermission, requestIgnoreBatteryOptimization } from '@/utils/nativeModules/utils'
import { getData, removeData, saveData } from '@/plugins/storage'
import BackgroundTimer from 'react-native-background-timer'
import { refreshScale, scaleSizeH, scaleSizeW, setSpText } from './pixelRatio'
import { stringMd5 } from 'react-native-quick-md5'
import { windowSizeTools } from '@/utils/windowSizeTools'
import { isTabletLayout } from '@/utils/layoutBreakpoints'
// toast 按平台实现：Android 走 ToastAndroid（./toast.android.ts），iOS 走 RNN overlay（./toast.ios.tsx）。
// 注意：基名必须一致且基名文件不能同时存在（否则无平台后缀的 .ts
// 会在 Metro 解析中先命中，遮蔽 .ios 变体——CI 自测实证）
import { toast } from './toast'


// https://stackoverflow.com/a/47349998
export const getDeviceLanguage = async() => {
  // let deviceLanguage = Platform.OS === 'ios'
  //   ? NativeModules.SettingsManager.settings.AppleLocale ||
  //     NativeModules.SettingsManager.settings.AppleLanguages[0] // iOS 13
  //   : await getSystemLocales()
  // deviceLanguage = typeof deviceLanguage === 'string' ? deviceLanguage.substring(0, 5).toLocaleLowerCase() : ''
  return getSystemLocales()
}


export const isAndroid = Platform.OS === 'android'
// @ts-expect-error
export const osVer = Platform.constants.Release as string

export const isActive = () => AppState.currentState == 'active'

export const TEMP_FILE_PATH = temporaryDirectoryPath + '/tempFile'

// fix https://github.com/facebook/react-native/issues/4934
// export const getWindowSise = (windowDimensions?: ReturnType<(typeof Dimensions)['get']>) => {
//   return windowSizeTools.getSize()
//   // windowDimensions ??= Dimensions.get('window')
//   // if (Platform.OS === 'ios') return windowDimensions
//   // return windowDimensions
//   // const windowSize = {
//   //   width: ExtraDimensions.getRealWindowWidth(),
//   //   height: ExtraDimensions.getRealWindowHeight(),
//   // }
//   // if (
//   //   (windowDimensions.height > windowDimensions.width && windowSize.height < windowSize.width) ||
//   //   (windowDimensions.width > windowDimensions.height && windowSize.width < windowSize.height)
//   // ) {
//   //   windowSize.height = windowSize.width
//   // }
//   // windowSize.width = windowDimensions.width

//   // if (ExtraDimensions.isSoftMenuBarEnabled()) {
//   //   windowSize.height -= ExtraDimensions.getSoftMenuBarHeight()
//   // }
//   // return windowSize
// }

// iOS 无运行时存储权限概念（沙箱内直接可读写），恒为已授权
/**
 * Android 13（API 33）起存储权限换成了细分媒体权限：
 * `WRITE_EXTERNAL_STORAGE` / `READ_EXTERNAL_STORAGE` 不再可授予（check 恒 false、
 * request 恒 denied），要读音乐文件必须申请 **`READ_MEDIA_AUDIO`**。
 *
 * 之前这里从 33 起「一律视为已授权」，结果是本地目录选择器弹出后
 * 读取 `/sdcard` 直接 `Permission denied`、列表空白——「添加本地音乐」整体不可用。
 * 现在按版本申请各自真实存在的那个权限；Android 9 及以下仍是 WRITE 即含 READ。
 */
const androidApiLevel = Platform.OS === 'android' ? Number(Platform.Version) : 0
/** 该版本下「读取本地音频」对应的运行时权限（null = 不需要） */
const audioReadPermission = (): string | null => {
  if (Platform.OS !== 'android') return null
  if (androidApiLevel >= 33) return PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
  if (androidApiLevel >= 29) return PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
  return PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
}

export const checkStoragePermissions = async() => {
  const permission = audioReadPermission()
  if (permission == null) return true
  return PermissionsAndroid.check(permission as Parameters<typeof PermissionsAndroid.check>[0])
}

export const requestStoragePermission = async() => {
  const permission = audioReadPermission()
  if (permission == null) return true
  const isGranted = await checkStoragePermissions()
  if (isGranted) return isGranted

  try {
    const granted = await PermissionsAndroid.request(permission as Parameters<typeof PermissionsAndroid.request>[0])
    // console.log(granted)
    // console.log(PermissionsAndroid.RESULTS)
    return granted === PermissionsAndroid.RESULTS.GRANTED
      ? true
      : granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ? null
        : false
    // if (granted === PermissionsAndroid.RESULTS.GRANTED) {
    //   console.log('You can use the storage')
    // } else {
    //   console.log('Storage permission denied')
    // }
  } catch (err: any) {
    // console.warn(err)
    return false
  }
}


export { toast }

export const openUrl = async(url: string): Promise<void> => {
  // canOpenURL 的结果要真的用上：false 时直接提示，别再去 openURL
  const supported = await Linking.canOpenURL(url).catch(() => false)
  if (!supported) {
    toast(global.i18n.t('open_url_failed'))
    return
  }
  await Linking.openURL(url)
}

export const assertApiSupport = (source: LX.Source): boolean => {
  return source == 'local' || global.lx.qualityList[source] != null
}

// const handleRemoveDataMultiple = async keys => {
//   await removeDataMultiple(keys.splice(0, 500))
//   if (keys.length) return handleRemoveDataMultiple(keys)
// }

export const exitApp = () => {
  if (isAndroid) {
    BackHandler.exitApp()
    return
  }
  // iOS：BackHandler.exitApp 是 Android 专属空操作，点了无任何效果（任务
  // 9.17 真机反馈「显示返回桌面按钮」无效）；收敛为挂起到后台，播放器与
  // 后台播放不受影响，与 Android 的 moveTaskToBack 语义对齐
  backHome()
}

export const handleSaveFile = async(path: string, data: any) => {
  // if (!path.endsWith('.json')) path += '.json'
  // const buffer = gzip(data)
  const tempFilePath = `${temporaryDirectoryPath}/tempFile.json`
  await writeFile(tempFilePath, JSON.stringify(data))
  await gzipFile(tempFilePath, path)
  await unlink(tempFilePath)
}
export const handleReadFile = async<T = unknown>(path: string): Promise<T> => {
  let isJSON = path.endsWith('.json')
  let data
  if (isJSON) {
    data = await readFile(path)
  } else {
    const tempFilePath = `${temporaryDirectoryPath}/tempFile.json`
    await unGzipFile(path, tempFilePath)
    data = await readFile(tempFilePath)
    await unlink(tempFilePath)
  }
  data = JSON.parse(data)

  // 修复PC v1.14.0出现的导出数据被序列化两次的问题
  if (typeof data != 'object') {
    try {
      data = JSON.parse(data as string)
    } catch (err) {
      return data
    }
  }

  return data
}

export const confirmDialog = async({
  title = '',
  message = '',
  cancelButtonText = global.i18n.t('dialog_cancel'),
  confirmButtonText = global.i18n.t('dialog_confirm'),
  bgClose = true,
}) => {
  return new Promise<boolean>(resolve => {
    Alert.alert(title, message, [
      {
        text: cancelButtonText,
        onPress() {
          resolve(false)
        },
      },
      {
        text: confirmButtonText,
        onPress() {
          resolve(true)
        },
      },
    ], {
      cancelable: bgClose,
      onDismiss() {
        resolve(false)
      },
    })
  })
}

export const tipDialog = async({
  title = '',
  message = '',
  btnText = global.i18n.t('dialog_confirm'),
  bgClose = true,
}) => {
  return new Promise<void>(resolve => {
    Alert.alert(title, message, [
      {
        text: btnText,
        onPress() {
          resolve()
        },
      },
    ], {
      cancelable: bgClose,
      onDismiss() {
        resolve()
      },
    })
  })
}

export const clipboardWriteText = (str: string) => {
  Clipboard.setString(str)
}


export const checkNotificationPermission = async() => {
  const isHide = await getData(storageDataPrefix.notificationTipEnable)
  if (isHide != null) return
  const enabled = await isNotificationsEnabled()
  if (enabled) return
  return new Promise<void>((resolve) => {
    Alert.alert(
      global.i18n.t('notifications_check_title'),
      global.i18n.t('notifications_check_tip'),
      [
        {
          text: global.i18n.t('never_show'),
          onPress: () => {
            void saveData(storageDataPrefix.notificationTipEnable, '1')
            toast(global.i18n.t('disagree_tip'))
            resolve()
          },
        },
        {
          text: global.i18n.t('disagree'),
          onPress: () => {
            toast(global.i18n.t('disagree_tip'))
            resolve()
          },
        },
        {
          text: global.i18n.t('agree_go'),
          onPress: () => {
            requestAnimationFrame(() => {
              void requestNotificationPermission().then((result) => {
                if (!result) toast(global.i18n.t('disagree_tip'))
                resolve()
              })
            })
          },
        },
      ],
    )
  })
}


export const checkIgnoringBatteryOptimization = async() => {
  const isHide = await getData(storageDataPrefix.ignoringBatteryOptimizationTipEnable)
  if (isHide != null) return
  const enabled = await isIgnoringBatteryOptimization()
  if (enabled) return
  return new Promise<void>((resolve) => {
    Alert.alert(
      global.i18n.t('ignoring_battery_optimization_check_title'),
      global.i18n.t('ignoring_battery_optimization_check_tip'),
      [
        {
          text: global.i18n.t('never_show'),
          onPress: () => {
            void saveData(storageDataPrefix.ignoringBatteryOptimizationTipEnable, '1')
            toast(global.i18n.t('disagree_tip'))
            resolve()
          },
        },
        {
          text: global.i18n.t('disagree'),
          onPress: () => {
            toast(global.i18n.t('disagree_tip'))
            resolve()
          },
        },
        {
          text: global.i18n.t('agree_to'),
          onPress: () => {
            requestAnimationFrame(() => {
              void requestIgnoreBatteryOptimization().then((result) => {
                if (!result) toast(global.i18n.t('disagree_tip'))
                resolve()
              })
            })
          },
        },
      ],
    )
  })
}
export const resetNotificationPermissionCheck = async() => {
  return removeData(storageDataPrefix.notificationTipEnable)
}
export const resetIgnoringBatteryOptimizationCheck = async() => {
  return removeData(storageDataPrefix.ignoringBatteryOptimizationTipEnable)
}

export const formatMusicName = (format: string, name: string, singer: string) => {
  return format.replace('歌手', singer).replace('歌名', name)
}

export const onDimensionChange = (handler: (info: { window: ScaledSize, screen: ScaledSize }) => void) => {
  return Dimensions.addEventListener('change', handler)
}


export const getAppearance = () => {
  return Appearance.getColorScheme() ?? 'light'
}

export const onAppearanceChange = (callback: (colorScheme: Parameters<Parameters<typeof Appearance['addChangeListener']>[0]>[0]['colorScheme']) => void) => {
  return Appearance.addChangeListener(({ colorScheme }) => {
    callback(colorScheme)
  })
}

let isSupportedAutoTheme: boolean | null = null
export const getIsSupportedAutoTheme = () => {
  if (isSupportedAutoTheme == null) {
    // Platform.constants.Release 为 Android 独有（iOS 上 undefined，
    // parseInt 得 NaN 会让本函数在 iOS 恒为 false）；
    // iOS 用 Platform.Version（形如 "18.5"，parseInt 取主版本）
    isSupportedAutoTheme = isAndroid ? parseInt(osVer) >= 5 : parseInt(String(Platform.Version), 10) >= 13
  }
  return isSupportedAutoTheme
}


export const showImportTip = (type: string) => {
  let message
  switch (type) {
    case 'defautlList':
    case 'playList':
    case 'playList_v2':
      message = global.i18n.t('list_import_tip__playlist')
      break
    case 'setting':
    case 'setting_v2':
      message = global.i18n.t('list_import_tip__setting')
      break
    case 'allData':
    case 'allData_v2':
      message = global.i18n.t('list_import_tip__alldata')
      break
    case 'playListPart':
    case 'playListPart_v2':
      message = global.i18n.t('list_import_tip__playlist_part')
      break

    default:
      message = global.i18n.t('list_import_tip__unknown')
      break
  }
  void tipDialog({
    title: global.i18n.t('list_import_tip__failed'),
    message,
    btnText: global.i18n.t('ok'),
  })
}


/**
 * 生成节流函数
 * @param fn 回调
 * @param delay 延迟
 * @returns
 */
export function throttleBackgroundTimer<Args extends any[]>(fn: (...args: Args) => void | Promise<void>, delay = 100) {
  let timer: number | null = null
  let _args: Args
  return (...args: Args) => {
    _args = args
    if (timer) return
    timer = BackgroundTimer.setTimeout(() => {
      timer = null
      void fn(..._args)
    }, delay)
  }
}

/**
 * 生成防抖函数
 * @param fn 回调
 * @param delay 延迟
 * @returns
 */
export function debounceBackgroundTimer<Args extends any[]>(fn: (...args: Args) => void | Promise<void>, delay = 100) {
  let timer: number | null = null
  let _args: Args
  return (...args: Args) => {
    _args = args
    if (timer) BackgroundTimer.clearTimeout(timer)
    timer = BackgroundTimer.setTimeout(() => {
      timer = null
      void fn(..._args)
    }, delay)
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
type Styles = StyleSheet.NamedStyles<Record<string, {}>>
type Style = Styles[keyof Styles]
export const trasformeStyle = <T extends Style>(styles: T): T => {
  const newStyle: T = { ...styles }

  for (const [p, v] of Object.entries(newStyle) as Array<[string, Style[keyof Style]]>) {
    if (typeof v != 'number') continue
    switch (p) {
      case 'height':
      case 'minHeight':
      case 'marginTop':
      case 'marginBottom':
      case 'paddingTop':
      case 'paddingBottom':
      case 'paddingVertical':
        newStyle[p] = scaleSizeH(v)
        break
      case 'width':
      case 'minWidth':
      case 'marginLeft':
      case 'marginRight':
      case 'paddingLeft':
      case 'paddingRight':
      case 'paddingHorizontal':
      case 'gap':
        newStyle[p] = scaleSizeW(v)
        break
      case 'padding':
        newStyle.paddingRight = newStyle.paddingLeft = scaleSizeW(v)
        newStyle.paddingBottom = newStyle.paddingTop = scaleSizeH(v)
        delete (newStyle as Record<string, unknown>).padding
        break
      case 'margin':
        newStyle.marginRight = newStyle.marginLeft = scaleSizeW(v)
        newStyle.marginBottom = newStyle.marginTop = scaleSizeH(v)
        delete (newStyle as Record<string, unknown>).margin
        break
      // 定位偏移按屏幕缩放（不是文字缩放）：同一 style 里通常还混着按 scaleSize
      // 换算的宽高，混用文字缩放会在「字体大小」调大后整块错位
      case 'left':
      case 'right':
        newStyle[p] = scaleSizeW(v)
        break
      case 'top':
      case 'bottom':
        newStyle[p] = scaleSizeH(v)
        break
      // `fontSize` / `lineHeight` 是**设计值**，统一走 `setSpText`（dp 倍率 ×
      // 字号设置 × 系统倍率），与 `<Text size={n}>` 完全同一口径。
      // 以前这里是在 `default` 分支里命中的，写法相同但更绕；单独列出来是为了
      // 说明：样式里直接写 `fontSize: 14` 与写 `<Text size={14}>` 等价，
      // 高分辨率手机上会被放大，不再是「直接当 pt 用的固定值」。
      case 'fontSize':
      case 'lineHeight':
        // @ts-expect-error 泛型下标在 NamedStyles 下推成 unknown
        newStyle[p] = setSpText(v)
        break
      default:
        break
    }
  }
  return newStyle
}

/**
 * 已创建的样式表重建函数：窗口尺寸变化时逐个重算，见 `refreshAllStyles()`。
 *
 * 重算是**就地改写**已有样式对象（先删旧键再写入），这样组件即使已经持有
 * `styles.foo` 的引用，也能在下次渲染时拿到新数值。
 */
const styleSheetRebuilders: Array<() => void> = []

export const createStyle = <T extends StyleSheet.NamedStyles<T>>(styles: T | StyleSheet.NamedStyles<T>): T => {
  const newStyle: Record<string, Style> = {}
  const rebuild = () => {
    for (const [n, s] of Object.entries(styles)) {
      // 上游的 `trasformeStyle` 泛型在 `NamedStyles` 下推成 unknown，这里显式收窄
      const next = trasformeStyle(s as Style)
      const prev = newStyle[n]
      /**
       * `StyleSheet.create` 在 `__DEV__` 下会 `Object.freeze` 每个样式对象，
       * 而重建时要原地改（`delete` + `Object.assign`）就会抛
       * 「Cannot assign to read-only property」。冻结的旧对象直接换新对象：
       * 返回值就是 `newStyle` 本身，重渲染时读到的自然是新值。
       */
      if (prev != null && typeof prev == 'object' && !Object.isFrozen(prev)) {
        for (const k of Object.keys(prev)) delete (prev as Record<string, unknown>)[k]
        Object.assign(prev, next)
      } else {
        newStyle[n] = next
      }
    }
  }
  rebuild()
  styleSheetRebuilders.push(rebuild)
  // @ts-expect-error
  return StyleSheet.create(newStyle as StyleSheet.NamedStyles<T>)
}

/**
 * 窗口尺寸变化后重算缩放系数并重建所有样式表。
 *
 * 由 `registerScreens` 里的窗口尺寸监听统一调用。注意：数值会立即更新，
 * 但**已经在屏幕上的组件**要等下一次渲染才会应用新尺寸，所以调用方通常
 * 还要顺带触发一次重渲染（`useWindowSize()` / `useIsTabletLayout()` 的
 * 订阅者本身就会重渲染）。
 */
export const refreshAllStyles = () => {
  refreshScale()
  for (const rebuild of styleSheetRebuilders) rebuild()
}

export const isHorizontalMode = (width: number, height: number): boolean => {
  return width / height > 1.2
}

/**
 * 平板：规则在 `utils/layoutBreakpoints.ts`（横屏宽 ≥ 700dp 且比例 < 2.0；
 * 竖屏最短边 ≥ 600dp 且比例 < 1.7）。
 *
 * 竖屏 16:9 的大屏手机（如 2160×3840@560 → 617×1097dp）以前会因为
 * 「最短边 ≥ 600dp」被当成平板：播放页被切成左右分栏、列表变双列却按单列
 * 排版，表现为错位 / 重叠。现在这类屏一律走手机档。
 */
export const isTabletMode = (width: number, height: number): boolean => isTabletLayout(width, height)

/** 宽屏（横屏或平板）：播放页左右分栏的判据 */
export const isWideLayout = (width: number, height: number): boolean => isHorizontalMode(width, height) || isTabletMode(width, height)


export interface RowInfo {
  rowNum: number | undefined
  rowWidth: `${number}%`
}

export type RowInfoType = 'full' | 'medium'

export const getRowInfo = (type: RowInfoType = 'full', win: { width: number, height: number } = windowSizeTools.getSize()): RowInfo => {
  // 平板：即使竖屏也走双列，与参考图一致（横屏/平板都属于大屏列表）
  let isMultiRow = isHorizontalMode(win.width, win.height) || isTabletMode(win.width, win.height)
  if (type == 'medium' && win.width / win.height < 1.8) isMultiRow = false
  // console.log('getRowInfo')
  return {
    rowNum: isMultiRow ? 2 : undefined,
    rowWidth: isMultiRow ? '50%' : '100%',
  }
}

export const toMD5 = stringMd5


export const cheatTip = async() => {
  const isRead = await getData<boolean>(storageDataPrefix.cheatTip)
  if (isRead) return

  return tipDialog({
    title: '谨防被骗提示',
    message: `1. 本项目无微信公众号之类的所谓「官方账号」，也未在小米、华为、vivo 等应用商店发布应用，商店内的「云听音乐」相关的应用全部属于假冒应用，谨防被骗！\n
2. 本软件完全无广告且无引流（如需要加群、关注公众号之类才能使用或者升级）的行为，若你使用过程中遇到广告或者引流的信息，则表明你当前运行的软件是第三方修改版。\n
3. 目前本项目的原始发布地址只有 GitHub，其他渠道均为第三方转载发布，可信度请自行鉴别。`,
    btnText: '我知道了 (Close)',
    bgClose: true,
  }).then(() => {
    void saveData(storageDataPrefix.cheatTip, true)
  })
}

export const remoteLyricTip = async() => {
  const isRead = await getData<boolean>(storageDataPrefix.remoteLyricTip)
  if (isRead) return

  return tipDialog({
    title: '有点温馨的提示',
    message: '若你将本功能用于汽车，请记住这个：\n道路千万条，安全第一条！\n道路千万条，安全第一条！！\n道路千万条，安全第一条！！！',
    btnText: '我知道了 (Close)',
    bgClose: true,
  }).then(() => {
    void saveData(storageDataPrefix.remoteLyricTip, true)
  })
}
