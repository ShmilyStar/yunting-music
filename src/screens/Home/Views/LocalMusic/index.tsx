import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ActivityIndicator, FlatList, Platform, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import SongRow from '../../components/SongRow'
import ModuleSearchBar from '../../components/ModuleSearchBar'
import SwipeRow, { type SwipeAction } from '@/components/common/SwipeRow'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import DorpDownMenu from '@/components/common/DorpDownMenu'
import { REF_ACCENT, REF_COLOR } from '@/config/uiPalette'
import { LIST_IDS, type NAV_ID_Type } from '@/config/constant'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId } from '@/store/common/hook'
import { useIsTabletLayout, useWindowSize, useUnmounted } from '@/utils/hooks'
import { countAudioFilesDeep, readAudioDir, readMetadata } from '@/utils/localMediaMetadata'
import { usePageLayout } from '../../components/pageLayout'
import { privateStorageDirectoryPath, removeRecursive, unlink } from '@/utils/fs'
import { downloadMusicDirPath, getDownloadRootVersion, subscribeDownloadRootChange } from '@/core/download/path'
import { log } from '@/utils/log'
import { getLocalMusicDirs, saveLocalMusicDirs } from '@/utils/data'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { buildLocalMusicInfo, buildLocalMusicInfoByFileName, METADATA_FALLBACK_EXTS } from '../Mylist/MyList/listAction'
import { hasAllFilesAccess, requestAllFilesAccess } from '@/utils/nativeModules/utils'
import { setLocalMusicScanning, useLocalMusicScanning } from './scanState'
import SpinCircle from '@/components/common/SpinCircle'

const PAGE_ID: NAV_ID_Type = 'nav_local_music'
/** 写进临时列表时用的列表标识（只作为 meta，实际数据落在 LIST_IDS.TEMP） */
const TEMP_LIST_ID = 'local_music__play'

/**
 * 本页的两个固定目录。
 *
 * - **已下载**：当前下载根目录下的 `music` 子目录
 *   （iOS 是 `Documents/Download/Music`，`Download` 必须大写，与原生
 *   `LxDownloadManager.m` 的落盘白名单一致，否则下载会被判非法路径直接失败；
 *   Android 会按权限在「应用专属目录」与「公共 Download」之间切换）。
 * - **我的导入**：`Documents/Music`，用户自己从「文件」App 放进来的歌。
 *
 * iOS 只能读沙箱内、或用户通过「文件」App 放进本应用目录的内容；
 * `Info.plist` 已开 `UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace`，
 * 用户在「文件」App 里可直接看到并拖拽文件进出。
 */
/**
 * 「已下载」目录 = 当前下载根目录下的 music 子目录。
 *
 * **不能存成模块级常量**：Android 启动 / 回前台时会按权限把根目录在
 * 「应用专属目录」和「公共 Download」之间切换，模块级常量会停在切换前的旧值，
 * 于是「已下载」去读一个已经被搬空的目录、整页全空。所以这里用函数取实时值，
 * 并订阅 `path.ts` 的根目录版本号，切换后重算（见 `pinnedEntries`）。
 */
const getDownloadedDir = () => downloadMusicDirPath
const IOS_IMPORT_DIR = `${privateStorageDirectoryPath}/Music`
const isIOS = Platform.OS === 'ios'

/** 元数据解析并发度（与「我的列表 → 添加本地音乐」保持一致） */
const READ_BATCH = 5
/** 搜索输入防抖时长 */
const SEARCH_DEBOUNCE = 200
/** 曲目数最多数到这么多就不再往下数（只用于显示数量） */
const MAX_FOLDER_COUNT = 5000

/**
 * 本会话内最近一次「扫描」得到的各目录曲目数。
 *
 * 页面嵌在「我的」页里、切走就会卸载，`useState` 留不住；而用户明确要求
 * 「不自动扫描」，所以扫过的结果放在模块级缓存里：切回来直接显示上次的数字，
 * 想更新就再点一次「扫描」。
 */
const countsCache: Record<string, number> = {}

/** 固定行（不可删除、不可卸载） */
interface PinnedEntry {
  kind: 'pinned'
  path: string
  title: string
}

interface FolderEntry {
  kind: 'folder'
  path: string
  title: string
  /** 副标题只显示曲目数，不显示路径 */
  subtitle: string
}

/** 列表项里的歌曲：带上它在当前目录歌曲表里的下标（列表里混着文件夹行） */
interface SongEntry {
  kind: 'song'
  music: LX.Music.MusicInfoLocal
  index: number
}

type ListEntry = PinnedEntry | FolderEntry | SongEntry

/** 取路径最后一段当显示名 */
const baseName = (path: string) => path.replace(/\/+$/, '').split('/').pop() ?? path

/**
 * 本地音乐页（03 §10）：**目录列表 + 目录浏览**两段式。
 *
 * 1. 首屏只列目录：Android 固定「已下载」（下载目录），iOS 固定「我的导入」
 *    （`Documents/Music`）。固定行不可删、不可卸载。
 * 2. 用户添加的目录可左滑：**卸载**只把它从本页移除、文件保留；**删除**彻底删掉目录与文件。
 * 3. 点目录进入浏览：只列该目录下的直接歌曲，子目录作为文件夹入口；子树里没有歌的
 *    文件夹不显示；子文件夹同样可左滑「卸载 / 删除」。
 * 4. 入口图标在页面标题栏右侧，弹「添加 / 扫描」（iOS 只有一个扫描图标）。
 *    **只有用户点「扫描」才读盘数曲目数**：进页面、添加目录、删除目录、
 *    从子目录返回，都不会偷偷去扫（用户 2026-10-22：「只有用户点击了才扫描，
 *    不自动扫描」）。进入某个目录属于「浏览内容」，会读这一层来显示歌曲。
 * 5. 结果只用于本页展示与播放，通过 `setTempList` 落到临时播放列表，不写进「我的列表」。
 */
export interface LocalMusicProps {
  /**
   * 是否处于激活状态。
   *
   * 独立页面用默认值（跟随导航栈）；嵌在「我的」页里时分段切换不会改导航栈，
   * 由「我的」页显式传 `true`，否则目录不会加载。
   */
  active?: boolean
  /**
   * 嵌在「我的」页分段里：搜索框上下留白改成对称（4 / 10），
   * 与上方小标题栏的 6dp 一起构成 10dp / 10dp。
   */
  embedded?: boolean
  /**
   * 标题栏右侧的菜单动作接到页面里：`Main.tsx` 的标题栏图标无法直接调页面内部函数，
   * 用回调把「点了哪个菜单项」传下来。
   */
  headerAction?: { action: 'addDir' | 'scan', seq: number } | null
  /**
   * 把这一页的层级状态报给标题栏：标题显示「本地歌曲 › 已下载 › 子目录」，
   * 返回键在标题栏上，页面里不再有自己的横条。
   */
  onNavChange?: (nav: { title: string, canGoBack: boolean }) => void
  /** 标题栏返回键发下来的「上一层」请求 */
  backSeq?: number
  /**
   * 「回到初始目录列表」请求（自增序号）。
   *
   * 「我的」页在已经停在本段时再点一次「本地歌曲」就会自增它：用户要求
   * 「在已下载 / 本地添加的目录的内部任何子目录中，点本地歌曲都回到初始界面」。
   * 同段内 `active` 不会从 false 变 true，页面自身的 isActive 复位够不着这一层。
   */
  resetSeq?: number
}

export default memo(({ active, embedded, headerAction, onNavChange, backSeq, resetSeq }: LocalMusicProps) => {
  const t = useI18n()
  const theme = useTheme()
  const activeId = useNavActiveId()
  const isActive = active ?? activeId == PAGE_ID
  const isUnmounted = useUnmounted()
  const choosePathRef = useRef<ChoosePathType>(null)
  /** 用户添加的目录（不含固定行） */
  const [dirs, setDirs] = useState<string[]>([])
  /** 各目录的曲目数；`null` 表示还没数过（未扫描）。初值取本会话上一次的扫描结果 */
  const [dirCounts, setDirCounts] = useState<Record<string, number | null>>({ ...countsCache })
  /** 浏览路径栈：空数组表示「目录列表」，否则最后一项是当前浏览的目录 */
  const [stack, setStack] = useState<string[]>([])
  const [songs, setSongs] = useState<LX.Music.MusicInfoLocal[]>([])
  const [folders, setFolders] = useState<FolderEntry[]>([])
  const [loading, setLoading] = useState(false)
  /** 首屏「数各目录曲目数」的扫描中（与 load 的 loading 一起驱动标题栏转圈） */
  const [counting, setCounting] = useState(false)
  /** 是否已经读过一次：用来区分「还没读」与「读完了但这一层没歌」 */
  const [loaded, setLoaded] = useState(false)
  const [keyword, setKeyword] = useState('')
  /** 防抖后的查询词：列表只跟着它过滤，输入本身不触发重算 */
  const [query, setQuery] = useState('')

  const currentDir = stack.length ? stack[stack.length - 1] : null

  /**
   * 把「正在扫描 / 读盘」的状态报给标题栏右侧按钮（iOS 上它要把图标换成转圈）。
   * 两个来源：`load()` 在读某一层目录、`refreshCounts()` 在数各目录曲目数。
   */
  const scanning = loading || counting
  useEffect(() => {
    setLocalMusicScanning(scanning)
  }, [scanning])
  useEffect(() => {
    return () => { setLocalMusicScanning(false) }
  }, [])

  /**
   * 固定在首屏的目录行：
   * - Android：只有「已下载」一行（其余目录由用户自己「添加目录」）
   * - iOS：两行 —— 「已下载」在上、「我的导入」在下（用户指定）
   *
   * `rootVersion` 是下载根目录的版本号：Android 切换「公共 Download / 应用专属目录」
   * 后它自增，「已下载」立刻指向新目录（否则读的还是已经搬空的旧目录）。
   */
  const rootVersion = useSyncExternalStore(subscribeDownloadRootChange, getDownloadRootVersion, getDownloadRootVersion)
  const pinnedEntries = useMemo<PinnedEntry[]>(() => {
    const list: PinnedEntry[] = [
      { kind: 'pinned', path: getDownloadedDir(), title: t('local_music_downloaded_dir') },
    ]
    if (isIOS) {
      list.push({ kind: 'pinned', path: IOS_IMPORT_DIR, title: t('local_music_import_dir') })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rootVersion 只用来在根目录切换后重算
  }, [t, rootVersion])

  /** 固定目录路径集合：用于「不可卸载 / 不可删除 / 不重复列出」等判断 */
  const pinnedPathSet = useMemo(
    () => new Set(pinnedEntries.map(entry => entry.path)),
    [pinnedEntries],
  )

  /** 当前歌曲列表的最新引用：播放回调保持稳定，renderItem 不必依赖 songs */
  const songsRef = useRef(songs)
  useEffect(() => { songsRef.current = songs }, [songs])

  /**
   * 每次激活「本地歌曲」都回到初始目录列表。
   *
   * 页面在 PagerView 里常驻，不重置的话再切回来还停在上次看的目录里，
   * 而标题栏已经显示成「本地歌曲」。`isActive` 从 false 变 true 时清空浏览栈。
   *
   * **不清空 `dirCounts`**：那是上一次「扫描」的结果，清掉就等于逼用户重新扫一遍
   * （用户 2026-10-22 要求「不自动扫描」，扫过的数字就该留着）。
   */
  useEffect(() => {
    if (!isActive) return
    setStack([])
    setSongs([])
    setFolders([])
    setLoaded(false)
    setKeyword('')
    setQuery('')
  }, [isActive])

  /**
   * 已经停在本段的「本地歌曲」里时再点一次入口 → 回到初始目录列表。
   *
   * 与上面的 `isActive` 复位互补：同段内 `active` 恒为 true，够不着这一层
   * （用户 2026-10-22：「在已下载或本地添加的目录的内部任何子目录中，
   * 点本地歌曲后都回到初始目录界面」）。
   * `resetSeq` 从 0 开始，首次挂载不触发，避免和 isActive 的复位重复。
   */
  useEffect(() => {
    if (!resetSeq) return
    setStack([])
    setSongs([])
    setFolders([])
    setLoaded(false)
    setKeyword('')
    setQuery('')
  }, [resetSeq])

  /** 读目录序号：快速点进点出时只认最后一次的结果（递增即作废在途结果） */
  const loadSeqRef = useRef(0)
  /** 临时列表 id：换目录后播放队列要跟着换 */
  const tempListIdRef = useRef(TEMP_LIST_ID)

  useEffect(() => {
    if (!isActive) return
    if (isIOS) {
      // iOS 的「我的导入」本身就是固定行，没有可添加的目录
      setDirs([])
      return
    }
    // 每次进页面都从存储里重新取一份，避免这一页的本地副本覆盖掉别处（或上次）的新增
    void getLocalMusicDirs().then(saved => {
      if (isUnmounted.current) return
      setDirs([...saved])
    })
  }, [isActive, isUnmounted])

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(keyword) }, SEARCH_DEBOUNCE)
    return () => { clearTimeout(timer) }
  }, [keyword])

  /** 首屏目录列表：固定行在前，其后为用户添加的目录 */
  const rootEntries = useMemo<Array<PinnedEntry | FolderEntry>>(() => {
    const list: Array<PinnedEntry | FolderEntry> = [...pinnedEntries]
    for (const dir of dirs) {
      // 旧版本把固定目录当成普通目录存进过已添加列表，这里不再重复列出
      if (pinnedPathSet.has(dir)) continue
      list.push({
        kind: 'folder',
        path: dir,
        title: baseName(dir),
        subtitle: countText(t, dirCounts[dir] ?? null),
      })
    }
    return list
  }, [dirCounts, dirs, pinnedEntries, pinnedPathSet, t])

  /** 读一层目录：直接子目录（过滤掉没歌的）+ 当前层的歌曲 */
  const load = useCallback(async(dir: string) => {
    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      const listing = await readAudioDir(dir)
      // 先解析歌曲（列表主体），再统计子目录曲目数（可能要递归，慢一些）
      const parsed: LX.Music.MusicInfoLocal[] = []
      for (let i = 0; i < listing.files.length; i += READ_BATCH) {
        const batch = listing.files.slice(i, i + READ_BATCH)
        const infos = await Promise.all(batch.map(async file => {
          // 单文件解析失败（损坏 / 容器与扩展名不符）只跳过，不中断
          const metadata = await readMetadata(file.path).catch(() => null)
          if (metadata) return buildLocalMusicInfo(file.path, metadata)
          // aac 这类原生标签解析不了的格式：用文件名兜底，别让文件从列表里消失
          const ext = (file.name.slice(file.name.lastIndexOf('.') + 1) || '').toLowerCase()
          return METADATA_FALLBACK_EXTS.includes(ext) ? buildLocalMusicInfoByFileName(file.path) : null
        }))
        for (const info of infos) {
          if (info) parsed.push(info)
        }
        if (seq != loadSeqRef.current || isUnmounted.current) return
        setSongs([...parsed])
      }
      if (seq != loadSeqRef.current || isUnmounted.current) return
      setSongs(parsed)

      const entries: FolderEntry[] = []
      for (const dirEntry of listing.dirs) {
        const count = await countAudioFilesDeep(dirEntry.path)
        if (seq != loadSeqRef.current || isUnmounted.current) return
        // 子树里没有歌的文件夹不显示
        if (count > 0) {
          entries.push({
            kind: 'folder',
            path: dirEntry.path,
            title: dirEntry.name,
            subtitle: countText(t, count),
          })
        }
      }
      if (seq != loadSeqRef.current || isUnmounted.current) return
      setFolders(entries)
      setLoaded(true)
    } catch (err: any) {
      log.error('read local dir failed: ' + (err?.message ?? err))
      if (seq != loadSeqRef.current || isUnmounted.current) return
      setSongs([])
      setFolders([])
      setLoaded(true)
      toast(t('local_music_scan_failed'), 'long')
    } finally {
      if (seq == loadSeqRef.current && !isUnmounted.current) setLoading(false)
    }
  }, [isUnmounted, t])

  /**
   * 只数各目录的曲目数（不读元数据），用于首屏副标题；返回总曲目数。
   *
   * **只有「扫描」按钮调它**（见 `handleScan`）：进页面、添加目录、删除目录、
   * 从子目录返回都不会偷偷读盘（用户 2026-10-22 明确要求）。
   */
  const refreshCounts = useCallback(async(): Promise<number> => {
    const targets = [...pinnedEntries.map(e => e.path), ...dirs]
    const results = await Promise.all(targets.map(async(path) => {
      const count = await countAudioFilesDeep(path, MAX_FOLDER_COUNT).catch(() => 0)
      return [path, count] as const
    }))
    if (isUnmounted.current) return 0
    const next: Record<string, number | null> = {}
    let total = 0
    for (const [path, count] of results) {
      next[path] = count
      total += count
    }
    // 结果同步进模块级缓存：切走再回来（页面会被卸载）仍能显示上次扫到的数字
    for (const key in countsCache) delete countsCache[key]
    for (const [path, count] of results) countsCache[path] = count
    setDirCounts(next)
    return total
  }, [dirs, isUnmounted, pinnedEntries])

  /** 磁盘内容变了但用户没点「扫描」：把旧数字清掉，不自动重扫 */
  const resetCounts = useCallback(() => {
    for (const key in countsCache) delete countsCache[key]
    setDirCounts({})
  }, [])

  /**
   * 「扫描」：在目录列表刷新曲目数；在某个目录里就重读这一层。
   * **这是本页唯一会主动读盘的入口。**
   *
   * 首屏扫完给一条 toast（「扫描完成，共 N 首」）—— iOS 现在是单按钮直连，
   * 没有菜单弹层，不给反馈的话用户会怀疑「点了没反应」。
   */
  const handleScan = useCallback(() => {
    if (currentDir) {
      void load(currentDir)
      return
    }
    setCounting(true)
    void refreshCounts().then((total) => {
      if (isUnmounted.current) return
      toast(t('local_music_count', { num: total }))
    }).finally(() => {
      if (!isUnmounted.current) setCounting(false)
    })
  }, [currentDir, isUnmounted, load, refreshCounts, t])

  /**
   * 「添加 / 扫描」之前先确认「所有文件访问」。
   *
   * Android 11+ 分区存储下，`READ_MEDIA_AUDIO` 只覆盖 MediaStore 登记过的音频，
   * 用 readdir 遍历 `/sdcard` 会 `Permission denied`（实测 Android 14：目录选择器
   * 一片空白、提示 Read dir error）。这里先查权限，没授予就拉起系统设置页，
   * 用户返回后重新查询——只有真的拿到权限才继续，避免弹出空目录让人以为没歌。
   */
  const ensureAllFilesAccess = useCallback(async(): Promise<boolean> => {
    if (await hasAllFilesAccess()) return true
    const granted = await requestAllFilesAccess()
    if (!granted) toast(t('local_music_need_storage_access'), 'long')
    return granted
  }, [t])

  const handleMenu = useCallback(({ action }: { action: string }) => {
    if (action == 'addDir') {
      void ensureAllFilesAccess().then((granted) => {
        if (!granted) return
        choosePathRef.current?.show({ title: t('local_music_add_dir'), dirOnly: true })
      })
      return
    }
    if (action == 'scan') {
      void ensureAllFilesAccess().then((granted) => {
        if (granted) handleScan()
      })
    }
  }, [ensureAllFilesAccess, handleScan, t])

  /** 标题栏图标发下来的动作：每次点都会换一个 `seq`，避免重复点同一项不触发 */
  const lastActionSeq = useRef(0)
  useEffect(() => {
    if (!headerAction || headerAction.seq == lastActionSeq.current) return
    lastActionSeq.current = headerAction.seq
    handleMenu({ action: headerAction.action })
  }, [handleMenu, headerAction])

  /**
   * 添加一个目录：只登记，**不顺手去数曲目数**。
   *
   * 以前加完立刻 `countAudioFilesDeep`，大目录会转好一会儿，看起来像「自动扫描」
   * （用户 2026-10-22 反馈）。现在新目录的副标题显示「未扫描」，点「扫描」才有数字。
   */
  const handleDirConfirm = useCallback((path: string) => {
    if (!path || dirs.includes(path) || pinnedPathSet.has(path)) return
    const next = [...dirs, path]
    setDirs(next)
    void saveLocalMusicDirs(next)
  }, [dirs, pinnedPathSet])

  /** 卸载目录：只把登记去掉，不删磁盘内容 */
  const handleUnmountDir = useCallback((path: string) => {
    if (pinnedPathSet.has(path)) return
    const nextDirs = dirs.filter(dir => dir != path)
    setDirs(nextDirs)
    void saveLocalMusicDirs(nextDirs).catch((err: any) => {
      log.warn('save local music dirs failed: ' + (err?.message ?? err))
    })
    setDirCounts(prev => {
      if (!(path in prev)) return prev
      const merged = { ...prev }
      delete merged[path]
      return merged
    })
    delete countsCache[path]
    if (!stack.includes(path)) return
    setStack([])
    setSongs([])
    setFolders([])
    setLoaded(false)
  }, [dirs, pinnedPathSet, stack])

  /**
   * 彻底删除目录（含子目录里的文件）。
   *
   * `dirPath` 必须是**当前浏览目录的直接子目录**，这样只会删掉这一棵子树。
   */
  const handleDeleteDir = useCallback((dirPath: string) => {
    // 固定目录（「已下载」/「我的导入」）本身禁止删除；它们下面的二级目录可以删除
    if (pinnedPathSet.has(dirPath)) return
    void removeRecursive(dirPath).then(() => {
      // 已添加目录被删掉后，登记也一并去掉（否则会留下一条指向空路径的条目）
      const nextDirs = dirs.filter(dir => dir != dirPath)
      if (nextDirs.length != dirs.length) {
        setDirs(nextDirs)
        void saveLocalMusicDirs(nextDirs).catch(() => {})
      }
      setFolders(prev => prev.filter(entry => entry.path != dirPath))
      // 磁盘内容已经变了，旧数字不再可信：清掉但**不自动重扫**，等用户点「扫描」
      resetCounts()
      if (!stack.includes(dirPath)) return
      const nextStack = stack.slice(0, stack.indexOf(dirPath))
      setStack(nextStack)
      setSongs([])
      setFolders([])
      setLoaded(false)
      // 当前目录本身被删掉：必须读上一层来显示内容（这是浏览，不是统计扫描）
      if (nextStack.length) void load(nextStack[nextStack.length - 1])
    }).catch((err: any) => {
      log.warn('remove local dir failed: ' + (err?.message ?? err))
      toast(t('local_music_remove_failed'), 'long')
    })
  }, [dirs, load, pinnedPathSet, resetCounts, stack, t])

  /** 首屏已添加目录的左滑动作 */
  const buildDirActions = useCallback((path: string, title: string): SwipeAction[] => {
    const unmount = () => { handleUnmountDir(path) }
    const remove = () => {
      void confirmDialog({
        message: t('local_music_delete_dir_tip', { name: title }),
        confirmButtonText: t('local_music_remove'),
      }).then((confirm) => {
        if (confirm) handleDeleteDir(path)
      })
    }
    return [
      { text: t('local_music_remove'), color: REF_ACCENT.red.color, onPress: remove },
      { text: t('local_music_unmount'), color: REF_ACCENT.orange.color, onPress: unmount },
    ]
  }, [handleDeleteDir, handleUnmountDir, t])

  /** 子文件夹的左滑动作：删除与卸载的语义跟目录一致 */
  const buildFolderActions = useCallback((path: string, title: string): SwipeAction[] => {
    // 子文件夹的「卸载」只从当前列表里隐藏，磁盘内容保留
    const unmount = () => { setFolders(prev => prev.filter(entry => entry.path != path)) }
    const remove = () => {
      void confirmDialog({
        message: t('local_music_delete_dir_tip', { name: title }),
        confirmButtonText: t('local_music_remove'),
      }).then((confirm) => {
        if (confirm) handleDeleteDir(path)
      })
    }
    // 「我的导入」本身不可删，但它下面的二级目录允许删除 / 卸载
    return [
      { text: t('local_music_remove'), color: REF_ACCENT.red.color, onPress: remove },
      { text: t('local_music_unmount'), color: REF_ACCENT.orange.color, onPress: unmount },
    ]
  }, [handleDeleteDir, t])

  const handleOpenFolder = useCallback((entry: PinnedEntry | FolderEntry) => {
    setStack(prev => [...prev, entry.path])
    setSongs([])
    setFolders([])
    setLoaded(false)
    // 不同目录各自一份临时列表，避免上一目录的队列串到这一目录
    tempListIdRef.current = `${TEMP_LIST_ID}__${entry.path}`
    void load(entry.path)
  }, [load])

  /**
   * 回到上一层。
   *
   * 回到目录列表时**不重数曲目数**（以前这里会 `refreshCounts()`，等于每退一层
   * 就自动扫一遍，用户 2026-10-22 反馈「不要自动扫描」）；数字沿用上次扫描的结果。
   */
  const handleGoBack = useCallback(() => {
    const next = stack.slice(0, -1)
    setStack(next)
    setSongs([])
    setFolders([])
    setLoaded(false)
    tempListIdRef.current = next.length ? `${TEMP_LIST_ID}__${next[next.length - 1]}` : TEMP_LIST_ID
    if (next.length) void load(next[next.length - 1])
  }, [load, stack])

  /**
   * 标题栏文字：只显示当前目录名。
   *
   * 用户明确不要「本地歌曲 › 已下载」这种面包屑，所以进目录后标题就是目录名本身；
   * 在目录列表时显示「本地歌曲」。
   */
  const breadcrumb = useMemo(() => {
    if (!currentDir) return t('hall_local_music')
    // 固定目录进到里面时，标题用它的名字（「已下载」/「我的导入」），而不是目录名
    const pinned = pinnedEntries.find(entry => entry.path == currentDir)
    if (pinned) return pinned.title
    return baseName(currentDir)
  }, [currentDir, pinnedEntries, t])

  useEffect(() => {
    onNavChange?.({ title: breadcrumb, canGoBack: stack.length > 0 })
  }, [breadcrumb, onNavChange, stack.length])

  /** 标题栏返回键：从子目录回到上一层（在目录列表时由标题栏自己回到音乐馆） */
  const lastBackSeq = useRef(0)
  useEffect(() => {
    if (!backSeq || backSeq == lastBackSeq.current) return
    lastBackSeq.current = backSeq
    if (stack.length) handleGoBack()
  }, [backSeq, handleGoBack, stack.length])

  const handlePlay = useCallback((musicInfo: LX.Music.MusicInfoLocal) => {
    const current = songsRef.current
    if (!current.length) return
    // 队列用当前目录的完整歌曲表（搜索只是过滤显示，不改变播放范围），
    // 起始位置按 id 回查，避免过滤后行下标与真实下标错位
    const index = current.findIndex(item => item.id == musicInfo.id)
    void setTempList(tempListIdRef.current, [...current]).then(() => {
      void playList(LIST_IDS.TEMP, index < 0 ? 0 : index)
    })
  }, [])

  /** 右侧删除：删的是设备上的文件，删前二次确认 */
  const handleRemoveMusic = useCallback((musicInfo: LX.Music.MusicInfoLocal) => {
    void confirmDialog({
      message: t('local_music_remove_file_tip', { name: musicInfo.name }),
      confirmButtonText: t('local_music_remove'),
    }).then((confirm) => {
      if (!confirm) return
      void unlink(musicInfo.meta.filePath).catch((err: any) => {
        log.warn('remove local file failed: ' + (err?.message ?? err))
        toast(t('local_music_remove_failed'), 'long')
      })
      setSongs(prev => prev.filter(item => item.id != musicInfo.id))
    })
  }, [t])

  const queryLower = query.trim().toLowerCase()
  const filteredSongs = useMemo(() => {
    if (!queryLower) return songs
    return songs.filter(item =>
      item.name.toLowerCase().includes(queryLower) ||
      (item.singer || '').toLowerCase().includes(queryLower) ||
      (item.meta.albumName || '').toLowerCase().includes(queryLower))
  }, [queryLower, songs])

  const filteredFolders = useMemo(() => {
    if (!queryLower) return folders
    return folders.filter(entry => entry.title.toLowerCase().includes(queryLower))
  }, [folders, queryLower])

  const filteredRoot = useMemo(() => {
    if (!queryLower) return rootEntries
    return rootEntries.filter(entry =>
      entry.title.toLowerCase().includes(queryLower) || entry.path.toLowerCase().includes(queryLower))
  }, [queryLower, rootEntries])
  /**
   * 固定目录行的图标（2026-10-22 用户第二次要求改「我的导入」的图标）。
   * - 已下载（= 当前下载目录）：下载图标 `download-circle-outline`，绿色 —— 与普通目录区分；
   * - 我的导入（`Documents/Music`）：**和 Android「添加的目录」完全一致**
   *   —— `folder-music-outline` + 橙色，和用户自己添加的目录看起来是同一类东西；
   *   两者靠绿色/橙色与副标题文案区分。
   */
  const pinnedIcon = useCallback((path: string) => path === getDownloadedDir()
    ? { name: 'download-circle-outline', color: REF_ACCENT.green.color }
    : { name: 'folder-music-outline', color: REF_ACCENT.orange.color }, [])

  /** 文件夹行的内容（固定行与普通目录共用） */
  const renderFolderRow = useCallback((item: PinnedEntry | FolderEntry, actions?: SwipeAction[]) => {
    const icon = item.kind === 'pinned'
      ? pinnedIcon(item.path)
      : { name: 'folder-music-outline', color: REF_ACCENT.orange.color }
    const row = (
      <TouchableOpacity
        style={styles.folderRow}
        activeOpacity={0.7}
        onPress={() => { handleOpenFolder(item) }}
      >
        <View style={styles.folderIcon}>
          <IconMC name={icon.name} size={24} color={icon.color} />
        </View>
        <View style={styles.folderInfo}>
          <Text size={14} numberOfLines={1} color={REF_COLOR.text}>{item.title}</Text>
          <Text size={11} numberOfLines={1} color={REF_COLOR.textHint} style={styles.folderSub}>
            {/* 固定行没扫过就给一条「去哪点」的引导；已添加的目录只写「未扫描」 */}
            {item.kind === 'pinned'
              ? (countText(t, dirCounts[item.path] ?? null) || t('local_music_not_scanned'))
              : (item.subtitle || t('local_music_unscanned'))}
          </Text>
        </View>
        <IconMC name="chevron-right" size={18} color={REF_COLOR.textHint} />
      </TouchableOpacity>
    )
    // 固定行不可删、不可卸载：不套左滑（否则滑到一半没有操作区）
    if (!actions) return row
    return <SwipeRow actions={actions}>{row}</SwipeRow>
  }, [dirCounts, handleOpenFolder, pinnedIcon, t])

  const renderSong = useCallback(({ item }: { item: SongEntry }) => (
    <View style={styles.itemWrap}>
      <SongRow
        index={item.index + 1}
        name={item.music.name}
        singer={item.music.singer}
        album={item.music.meta.albumName}
        duration={item.music.interval ?? undefined}
        musicInfo={item.music}
        musicId={item.music.id}
        onPress={() => { handlePlay(item.music) }}
      />
      <TouchableOpacity
        style={styles.removeBtn}
        activeOpacity={0.6}
        onPress={() => { handleRemoveMusic(item.music) }}
      >
        <IconMC name="delete-outline" size={20} color={REF_COLOR.textHint} />
      </TouchableOpacity>
    </View>
  ), [handlePlay, handleRemoveMusic])

  // 平板 / 横屏双列，与榜单歌曲页、歌单页保持一致
  const isTablet = useIsTabletLayout()
  const windowSize = useWindowSize()
  const rowNum = isTablet ? 2 : 1

  const listData = useMemo<ListEntry[]>(() => {
    if (stack.length === 0) return filteredRoot
    return [
      ...filteredFolders,
      ...filteredSongs.map((music, index): ListEntry => ({ kind: 'song', music, index })),
    ]
  }, [filteredFolders, filteredRoot, filteredSongs, stack.length])

  const emptyText = useMemo(() => {
    if (stack.length === 0) return t('local_music_no_dir')
    if (!loaded) return t('local_music_not_scanned')
    return t('local_music_empty')
  }, [loaded, stack.length, t])

  /**
   * 行数变化计数：行数变了就让 `FlatList` 换一次 `key` 重新挂载。
   *
   * 实测（模拟器 Android 14）：列表数据从 1 行变 3 行、或删到只剩 1 行时，
   * `FlatList` 会沿用上一帧的行布局，新增/删除的行不画出来（`recordInteraction()`
   * 也无效），换 key 重建后正常。只有行数变化才换，搜索过滤这种同结构变化不动。
   */
  const [listEpoch, setListEpoch] = useState(0)
  const rowCountRef = useRef(0)
  useEffect(() => {
    const next = listData.length
    if (rowCountRef.current == next) return
    rowCountRef.current = next
    setListEpoch(epoch => epoch + 1)
  }, [listData.length])

  const renderEntry = useCallback(({ item }: { item: ListEntry }) => {
    if (item.kind === 'song') return renderSong({ item })
    if (item.kind === 'pinned') return renderFolderRow(item)
    // 首屏的已添加目录与下钻后的子文件夹：动作都是「卸载 / 删除」
    return renderFolderRow(item, stack.length === 0
      ? buildDirActions(item.path, item.title)
      : buildFolderActions(item.path, item.title))
  }, [buildDirActions, buildFolderActions, renderFolderRow, renderSong, stack.length])

  /**
   * 列表单元格：`numColumns > 1` 时 RN **不会**给每个条目分配宽度
   * （`columnWrapperStyle` 只是行容器），条目各按自己的样式撑开 ——
   * 固定目录行会缩到图标宽、`SwipeRow` 又直接吃满整行，于是两列重叠在一起
   * （用户 2026-10-22 截图：安卓平板「已下载」和目录名叠成一团）。
   * 这里统一套一层等宽单元格，条目本身不用再关心自己被放进几列。
   */
  const renderCell = useCallback((info: ListRenderItemInfo<ListEntry>) => {
    const content = renderEntry({ item: info.item })
    if (rowNum <= 1) return content
    return <View style={styles.cell}>{content}</View>
  }, [renderEntry, rowNum])

  // 宽屏（平板 / 长条大屏手机）收窄居中，手机上 `width` 为 undefined，行为不变
  const pageLayout = usePageLayout(windowSize.width)

  return (
    <View style={styles.container}>
      <View style={[
        styles.body,
        pageLayout.width != null && { width: pageLayout.width },
        pageLayout.padding > 0 && { paddingHorizontal: pageLayout.padding },
      ]}>
        <ModuleSearchBar
          placeholder={t('local_music_search_placeholder')}
          value={keyword}
          onChangeText={setKeyword}
          style={embedded ? styles.searchWrapEmbedded : undefined}
        />

        {loading && !listData.length
          ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme['c-primary-font']} />
                <Text size={12} color={REF_COLOR.textHint} style={styles.scanningTip}>{t('local_music_scanning')}</Text>
              </View>
            )
          : (
              <FlatList
              // 列数与行数变化都重建列表，原因见上面 `listEpoch` 的说明
                key={`${rowNum}__${listEpoch}`}
                style={styles.list}
                data={listData}
                numColumns={rowNum}
                columnWrapperStyle={rowNum > 1 ? styles.column : undefined}
                renderItem={renderCell}
                keyExtractor={(item, index) => (item.kind === 'song' ? `song__${item.music.id}__${index}` : `dir__${item.path}__${index}`)}
                ListEmptyComponent={<Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{emptyText}</Text>}
                initialNumToRender={12}
                maxToRenderPerBatch={6}
                windowSize={7}
              />
            )}

        {/* 读目录中仍有内容时，在列表底部提示进度 */}
        {loading && listData.length
          ? <Text size={11} color={REF_COLOR.textHint} style={styles.scanningBar}>{t('local_music_scanning')}</Text>
          : null}
      </View>

      <ChoosePath ref={choosePathRef} onConfirm={handleDirConfirm} />
    </View>
  )
})

export interface LocalMusicHandle {
  /** 打开菜单对应的动作：添加 / 扫描 */
  run: (action: 'addDir' | 'scan') => void
}

/**
 * 页面标题栏右侧的入口图标，放到 `SubPageHeader` 的 `right`：
 * 和「本地歌曲」标题、返回键在同一行，也就是用户看到的标题栏右侧。
 *
 * iOS 只有一个动作（扫描），再套一层下拉菜单纯属多余：
 * 用户 2026-10-22 要求「不要弹二级菜单，图标换成扫描歌曲的图标」，
 * 随后又指定「换成类似 AirDrop 的图标、适配 UI 配色，扫描时变成未封闭的圆转圈」：
 * - 图标：`access-point`（圆点 + 扩散弧线，即 AirDrop 那种「发射/发现」语义）；
 * - 配色：用 `REF_COLOR.text`，跟同一条标题栏上的齿轮、返回键一致，深浅色主题都自动适配；
 * - 扫描中：换成 `SpinCircle`（缺口圆环匀速旋转），并禁用重复点击。
 * Android 仍保留下拉（它有「添加」+「扫描」两项，且目录访问要权限）。
 */
export const LocalMusicHeaderBtn = memo(({ onPress, compact }: {
  onPress: (action: 'addDir' | 'scan') => void
  /** 嵌在「我的」页小标题栏时压矮，避免把搜索框整体往下推 */
  compact?: boolean
}) => {
  const t = useI18n()
  const scanning = useLocalMusicScanning()
  const iconSize = compact ? 20 : 22

  if (isIOS) {
    return (
      <TouchableOpacity
        style={compact ? styles.menuBtnCompact : styles.menuBtn}
        onPress={() => {
          // 扫描中再点一次没有意义（读盘不会并发加速），直接忽略
          if (scanning) return
          onPress('scan')
        }}
        disabled={scanning}
        accessibilityRole="button"
        accessibilityLabel={t('local_music_scan')}
      >
        {scanning
          ? <SpinCircle size={iconSize - 3} color={REF_COLOR.textSub} thickness={2} />
          : <IconMC name="access-point" size={iconSize} color={REF_COLOR.text} />}
      </TouchableOpacity>
    )
  }

  const menus = [
    // 用户 2026-10-22 要求菜单文案从「添加目录 / 扫描歌曲」收短成「添加 / 扫描」
    // （选择目录弹窗的标题仍是完整的「添加目录」）
    { action: 'addDir' as const, label: t('local_music_add') },
    { action: 'scan' as const, label: t('local_music_scan') },
  ]

  return (
    <DorpDownMenu
      menus={menus}
      onPress={({ action }) => { onPress(action as 'addDir' | 'scan') }}
      btnStyle={compact ? styles.menuBtnCompact : styles.menuBtn}
      fontSize={14}
    >
      <IconMC name="folder-music-outline" size={iconSize} color={REF_COLOR.text} />
    </DorpDownMenu>
  )
})

/** 曲目数文案；没数过返回空串 */
const countText = (t: ReturnType<typeof useI18n>, count: number | null) =>
  count == null ? '' : t('local_music_folder_song_count', { num: count })

const styles = createStyle({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
  },
  menuBtn: {
    width: 40,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtnCompact: {
    width: 34,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  /** 嵌入「我的」页：搜索框上方 6dp（小标题栏 4 + 2），下方 12dp */
  searchWrapEmbedded: {
    paddingTop: 2,
    paddingBottom: 12,
  },
  column: {
    gap: 8,
    paddingHorizontal: 0,
  },
  /** 双列时的等宽单元格：条目在里面自己撑满，不再影响相邻列 */
  cell: {
    flex: 1,
    // 一行只剩一个条目时（目录数为奇数）也保持半宽，否则会被拉成整行、看着不像两列
    maxWidth: '50%',
    minWidth: 0,
    overflow: 'hidden',
  },
  itemWrap: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  folderRow: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: REF_COLOR.divider,
  },
  folderIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: REF_ACCENT.orange.bg,
  },
  folderInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 10,
  },
  folderSub: {
    marginTop: 3,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningTip: {
    marginTop: 8,
  },
  scanningBar: {
    textAlign: 'center',
    paddingVertical: 6,
  },
  empty: {
    textAlign: 'center',
    paddingTop: 30,
    paddingBottom: 30,
  },
})
