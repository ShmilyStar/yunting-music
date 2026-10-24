import '@/utils/errorHandle'
import { AppState, Platform, type AppStateStatus } from 'react-native'
import { init as initLog } from '@/utils/log'
import { bootLog, getBootLog } from '@/utils/bootLog'
import '@/config/globalData'
import { getFontSize } from '@/utils/data'
import commonActions from '@/store/common/action'
import { exitApp } from './utils/nativeModules/utils'
import { windowSizeTools } from './utils/windowSizeTools'
import { listenLaunchEvent } from './navigation/regLaunchedEvent'
import { tipDialog } from './utils/tools'
import { setDesktopLyricTouchable } from '@/core/desktopLyric'

console.log('starting app...')
listenLaunchEvent()

/**
 * 桌面歌词悬浮窗：App 在前台时不接收触摸。
 *
 * 悬浮窗默认是可 touches 的（为了能拖动），但它在窗口层级里盖在 App 之上，
 * 只要它的矩形压在某个控件上，那个控件就点不动——实测（Android 14）
 * 窗口 `frame=[0,0][1080,367]` 正好盖住「我的」页四宫格，四个入口全部失效。
 * 这里让 App 处于前台时统一关掉悬浮窗触摸（点透过去），
 * 切到后台 / 其他 App 时再恢复，桌面歌词照旧可以拖着走。
 */
const syncDesktopLyricTouchable = (state: AppStateStatus) => {
  void setDesktopLyricTouchable(state !== 'active')
}
AppState.addEventListener('change', syncDesktopLyricTouchable)

/**
 * Android：回到前台时重新对一次下载根目录。
 *
 * 典型路径是用户在系统设置里开了「所有文件访问」再切回来——那时才拿得到权限，
 * 停在启动时判断就会一直落在应用专属目录。加 2 秒节流，避免频繁切换应用时
 * 每次都去 walk 一遍旧目录。
 */
let lastRootSyncAt = 0
const syncDownloadRootOnActive = (state: AppStateStatus) => {
  if (Platform.OS !== 'android' || state !== 'active') return
  const now = Date.now()
  if (now - lastRootSyncAt < 2000) return
  lastRootSyncAt = now
  void (async() => {
    try {
      const { syncAndroidDownloadRoot } = await import('@/core/download/androidRoot')
      await syncAndroidDownloadRoot()
    } catch { /* 忽略 */ }
  })()
}
AppState.addEventListener('change', syncDownloadRootOnActive)

void Promise.all([getFontSize(), windowSizeTools.init()]).then(async([fontSize]) => {
  global.lx.fontSize = fontSize
  /**
   * store 里也同步成持久值。
   *
   * `store/common/state.ts` 在模块导入时就取了 `global.lx.fontSize`，那时它还是
   * 默认值 1（持久值是异步读出来的）。不同步的话，设置页的勾选状态永远显示
   * 「标准」——即便实际倍率已经是 1.2（用户 2026-10-21 反馈「重启后字体变了但
   * 选框重置回标准」）。两者都表示「已保存的倍率」，必须一致。
   */
  commonActions.setFontSize(fontSize)
  bootLog('Font size setting loaded.')
  // 启动即在前台：先把悬浮窗触摸关掉，避免它盖住界面上的控件
  syncDesktopLyricTouchable(AppState.currentState)

  let isInited = false
  let handlePushedHomeScreen: () => void | Promise<void>

  const tryGetBootLog = () => {
    try {
      return getBootLog()
    } catch (err) {
      return 'Get boot log failed.'
    }
  }

  const handleInit = async() => {
    if (isInited) return
    void initLog()
    /**
     * iOS：启动就把 App Documents 里的固定目录建出来
     * （`云听音乐/Music`、`云听音乐/Download/{Music,Lrc}`）。
     *
     * 这些目录原本只在「开始下载」时才创建，于是全新安装后用户打开
     * 「文件 → 我的 iPhone → 云听音乐」是空的，没法把歌拖进去，
     * 本地歌曲页的「已下载 / 我的导入」也读不到任何东西
     * （用户 2026-10-21 要求这两个目录必须能从 iOS 自带文件 App 访问）。
     * 建目录失败不阻塞启动。
     */
    if (Platform.OS === 'ios') {
      void (async() => {
        try {
          const { ensureDownloadDirs } = await import('@/core/download/ensureDir')
          await ensureDownloadDirs()
        } catch { /* 建目录失败不阻塞启动 */ }
      })()
    } else {
      /**
       * Android：按「所有文件访问」权限实际状态决定下载落点
       * （有权限 → 公共 `Download/yuntingmusic`，用户能在系统下载目录里找到；
       * 没权限 → 应用专属目录），并把旧目录里已下好的歌迁移过去。
       * 用户可能在系统设置里刚授权完就回到 App，所以回前台也要再同步一次。
       */
      void (async() => {
        try {
          const { syncAndroidDownloadRoot } = await import('@/core/download/androidRoot')
          await syncAndroidDownloadRoot()
        } catch { /* 权限/目录异常不阻塞启动 */ }
      })()
    }
    const { default: init } = await import('@/core/init')
    try {
      handlePushedHomeScreen = await init()
    } catch (err: any) {
      void tipDialog({
        title: '初始化失败 (Init Failed)',
        message: `Boot Log:\n${tryGetBootLog()}\n\n${(err.stack ?? err.message) as string}`,
        btnText: 'Exit',
        bgClose: false,
      }).then(() => {
        exitApp()
      })
      return
    }
    isInited ||= true
  }
  const { init: initNavigation, navigations } = await import('@/navigation')

  initNavigation(async() => {
    await handleInit()
    if (!isInited) return
    // import('@/utils/nativeModules/cryptoTest')

    await navigations.pushHomeScreen().then(() => {
      void handlePushedHomeScreen()
    }).catch((err: any) => {
      void tipDialog({
        title: 'Error',
        message: err.message,
        btnText: 'Exit',
        bgClose: false,
      }).then(() => {
        exitApp()
      })
    })
  })
}).catch((err) => {
  void tipDialog({
    title: '初始化失败 (Init Failed)',
    message: `Boot Log:\n\n${(err.stack ?? err.message) as string}`,
    btnText: 'Exit',
    bgClose: false,
  }).then(() => {
    exitApp()
  })
})
