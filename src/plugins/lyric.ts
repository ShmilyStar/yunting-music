import { useEffect, useState } from 'react'
import Lyric, { type Lines } from 'lrc-file-parser'
// import { getStore, subscribe } from '@/store'
export type Line = Lines[number]
type PlayHook = (line: number, text: string) => void
type SetLyricHook = (lines: Lines) => void

/**
 * 单调时钟（ms）。`performance.now` 在 React Native 里存在且不受系统时间
 * 校准影响；退回 `Date.now` 时至少与解析器内部用的是同一个来源
 * （`lrc-file-parser` 的 `getNow` 同样这样挑）
 */
const getNow = typeof performance == 'object' && typeof performance.now == 'function'
  ? performance.now.bind(performance)
  : Date.now

/**
 * 进度回校的漂移容限（ms）。
 *
 * 播放器 1s 轮询一次进度，正常刷新落在容限内（不该推动时间轴）；
 * 超过它说明发生了插件没订阅到的位置跳变（原生 seek、线控拖拽）。
 * 取 1.5s：大于一次轮询间隔，又小于「用户能察觉到的不同步」
 */
const SEEK_DRIFT_THRESHOLD = 1500

/**
 * 暂停中 seek 后、补发 `pause()` 前的等待（ms）。
 *
 * 解析器 `play()` 排下的第一帧回调会执行 `this.callback(diff)`，而
 * `pause()` 会把 `callback` 置空，紧接着的帧就会抛 TypeError。它的定时器
 * 在距目标 `thresholdTime`(200ms) 以内只续排不回调，等过这一轮再停即可
 */
const PAUSE_AFTER_SEEK_REPAUSE = 300

const lrcTools = {
  isInited: false,
  lrc: null as Lyric | null,
  currentLineData: { line: 0, text: '' },
  currentLines: [] as Lines,
  playHooks: [] as PlayHook[],
  setLyricHooks: [] as SetLyricHook[],
  isPlay: false,
  isShowTranslation: false,
  isShowRoma: false,
  lyricText: '',
  translationText: '' as string | null | undefined,
  romaText: '' as string | null | undefined,
  /**
   * 外部（真实播放器）权威时间轴。
   *
   * 0.1.5 的播放器是网页 `<audio>`，进度完全由定时器推进；换成
   * react-native-track-player 之后 seek 只有 `setProgress` → `seekTo`
   * 一条路，**不再触发 play / pause 事件**。原来的 `lrc.play(time)` /
   * `lrc.pause()` 只在 play / pause 事件里调用，于是：
   * - 拖动进度条、点歌词行跳转、线控/通知栏 seek 之后，歌词内部
   *   `_startTime` 还是 seek 之前的值，引擎按旧起点继续走，当前行不再变
   *   （这就是「拖动进度条后歌词不同步」「歌词滑动改变播放位置后不同步」）；
   * - 暂停后 seek、再恢复播放时 `_currentTime()` 仍在推进，行号会跳到
   *   暂停期间「走过」的那一行。
   *
   * 因此这里记住权威时间轴：`play(time)` 记录基准时间与打点，`sync()` 用
   * 「基准时间 + 打点以来的真实流逝 × 倍速」重算，暂停期间流逝为 0。
   * `setProgress` / 播放进度刷新 / 播放速率变化都走 `sync()`。
   *
   * 基准时间可能晚于真实播放进度：iOS 上 `seekTo` 的 `RemoteSeek` 事件
   * 是异步回来的（服务端先告诉原生层 seek 完、再 emit），拿它盖掉同步写入
   * 的基准会让歌词落后一次鉴权/加载的耗时（播放一个 URL 走在线取链，
   * 起步就是几百毫秒）。所以更早的基准胜出，只有晚于基准的点才算作
   * 「同步发生了漂移」，覆盖它。
   */
  baseTime: 0,
  /** 基准时间对应的打点时刻（`getNow()`） */
  baseAt: 0,
  /** 当前倍速，与 `lrc.setPlaybackRate` 同步 */
  playbackRate: 1,
  init() {
    if (this.isInited) return
    this.isInited = true
    this.lrc = new Lyric({
      onPlay: this.onPlay.bind(this),
      onSetLyric: this.onSetLyric.bind(this),
      offset: 100, // offset time(ms), default is 150 ms
    })
  },
  onPlay(line: number, text: string) {
    this.currentLineData.line = line
    this.currentLineData.text = text
    for (const hook of this.playHooks) hook(line, text)
  },
  onSetLyric(lines: Lines) {
    this.currentLines = lines
    this.currentLineData.line = 0
    this.currentLineData.text = ''
    for (const hook of this.playHooks) hook(-1, '')
    for (const hook of this.setLyricHooks) hook(lines)
  },
  addPlayHook(hook: PlayHook) {
    this.playHooks.push(hook)
    hook(this.currentLineData.line, this.currentLineData.text)
  },
  removePlayHook(hook: PlayHook) {
    this.playHooks.splice(this.playHooks.indexOf(hook), 1)
  },
  addSetLyricHook(hook: SetLyricHook) {
    this.setLyricHooks.push(hook)
    hook(this.currentLines)
  },
  removeSetLyricHook(hook: SetLyricHook) {
    this.setLyricHooks.splice(this.setLyricHooks.indexOf(hook), 1)
  },
  setLyric() {
    const extendedLyrics = [] as string[]
    if (this.isShowTranslation && this.translationText) extendedLyrics.push(this.translationText)
    if (this.isShowRoma && this.romaText) extendedLyrics.push(this.romaText)
    this.lrc!.setLyric(this.lyricText, extendedLyrics)
  },
  /** 当前权威时间（ms），暂停时为 `baseTime` 本身 */
  currentTime() {
    return this.isPlay ? this.baseTime + (getNow() - this.baseAt) * this.playbackRate : this.baseTime
  },
  /** 记忆权威时间轴（`baseTime` 直接设为 `time`） */
  markTime(time: number) {
    this.baseTime = time
    // 打点随之刷新：`currentTime()` 用打点外推，打点不刷新就被重复计算
    this.baseAt = getNow()
  },
  /**
   * 已知播放器真实进度时校正时间轴。
   *
   * 只在时间**向前**跳、且跳幅超过误差容限时把基准推过去：回到旧位置
   * 属于用户主动 seek（走 `seek()`），不该被这里覆盖。
   *
   * 不改打点、只把「本应流逝的时间」补进基准。原生 seek 的回执经
   * `RemoteSeek` 异步回来，那时打点已经走了一段，重设打点会让这段
   * 时间被重复计算。
   */
  advanceTime(time: number) {
    const drift = time - this.currentTime()
    if (drift <= 0 || drift < SEEK_DRIFT_THRESHOLD) return
    this.baseTime = time
  },
  /**
   * 按记忆的时间轴重新定位歌词，并让解析器的走停状态与插件一致。
   *
   * 定位只能借 `play(time)`：它会从目标行重新 `_refresh()`，把行号一次性
   * 落到正确位置（且跳过的行不产生回调）。`pause()` 不行——它按**内部
   * 时钟**重算行号，而 seek 刚把内部时钟改到别处，一冻结就会把结果回退。
   *
   * `play(time)` 会把解析器切到「在播」，所以暂停中 seek 之后要再补一次
   * `pause()` 冻住它，否则暂停期间歌词会自己往后走。但**不能立刻补**：
   * `play()` 排下的第一帧回调里会 `this.callback(diff)`，而 `pause()`
   * 刚把 `callback` 清成 null，那一帧会抛 TypeError。于是留出解析器自己
   * 一轮 rAF（`threshold=200` 以内只续排、不回调）的时间再停。
   */
  sync() {
    if (!this.lrc?.lines.length) return
    this.lrc.play(this.currentTime())
    if (!this.isPlay) {
      setTimeout(() => {
        // 期间用户可能又点了播放：此时 `isPlay` 已翻回 true，不能再停
        if (!this.isPlay && this.lrc?.isPlay) this.lrc.pause()
      }, PAUSE_AFTER_SEEK_REPAUSE)
    }
  },
  /** 让行号跳回从进度推算的位置，不做逐行回调（seek 后不必逐行滚动） */
  relocate() {
    if (!this.lrc?.lines.length) return
    const time = this.currentTime()
    const lrc = this.lrc
    // `_findCurLineNum` 是 private（类型层面），seek 后要让行号直接落到
    // 目标位置上必须用它：`play()` 会从目标行重新 `_refresh()`，
    // 中间被跳过的行不会产生 onPlay 回调
    const find = (lrc as unknown as { _findCurLineNum: (time: number) => number })._findCurLineNum
    lrc.curLineNum = typeof find == 'function' ? find.call(lrc, time) - 1 : -1
    this.sync()
  },
  /**
   * 跳转播放位置：`global.app_event.setProgress` 的歌词侧入口。
   *
   * 与 `sync()` 分开是因为调用点在进度更新之前（`setProgress` 已经是
   * 「设进度 + seek」），歌词行必须按目标位置的时钟立刻改，不能等
   * 原生 seek 完成或下一次进度刷新（最长 1s）——否则用户会看到「拖到
   * 某一句，松手后歌词还停在原来那句」。
   */
  seek(time: number) {
    if (!Number.isFinite(time)) return
    this.markTime(Math.max(0, time))
    this.relocate()
  },
  /** 单调校正：播放中已知的真实进度 */
  progress(time: number) {
    if (!Number.isFinite(time) || !this.isPlay) return
    // 解析器播到最后一句会自行 pause，此时它已不跟时间轴走，不再打扰；
    // 用户在最后一句上 seek 会重新走 seek() → relocate()
    if (this.lrc?.isPlay === false) return
    this.advanceTime(time)
    this.sync()
  },
}


export const init = async() => {
  lrcTools.init()
}

export const setLyric = (lyric: string, translation?: string, romalrc?: string) => {
  // 先记下「换歌词前是否在播」：`isPlay` 下面会被重置
  const wasPlaying = lrcTools.isPlay
  lrcTools.isPlay = false
  lrcTools.markTime(0)
  lrcTools.lyricText = lyric
  lrcTools.translationText = translation
  lrcTools.romaText = romalrc
  lrcTools.setLyric()
  // 解析器重建后行号被重置为 0。播放中（换歌词、开关翻译）立刻按当前
  // 时间轴回位并续走，否则歌词会停在第一句，直到下一次 play 事件
  if (wasPlaying) {
    lrcTools.isPlay = true
    lrcTools.relocate()
  }
}
export const setPlaybackRate = (playbackRate: number) => {
  lrcTools.playbackRate = playbackRate
  lrcTools.lrc!.setPlaybackRate(playbackRate)
}
export const toggleTranslation = (isShow: boolean) => {
  lrcTools.isShowTranslation = isShow
  if (!lrcTools.lyricText) return
  lrcTools.setLyric()
}
export const toggleRoma = (isShow: boolean) => {
  lrcTools.isShowRoma = isShow
  if (!lrcTools.lyricText) return
  lrcTools.setLyric()
}
export const play = (time: number) => {
  // 播放入口拿到的是播放器真实进度：无条件重设基准，恢复播放时
  // 行号会按「真实位置」而不是暂停期间推进过的假时间落位
  lrcTools.isPlay = true
  lrcTools.markTime(time)
  lrcTools.lrc!.play(time)
}
export const pause = () => {
  // 先把暂停瞬间的真实进度钉进基准，再让解析器冻结
  lrcTools.markTime(lrcTools.currentTime())
  lrcTools.isPlay = false
  // 解析器本就没在走（重复的 pause / 停止后的事件）时不要再调它的
  // pause()：那会把 `callback` 置空，而排队的帧仍会回来调用它
  if (lrcTools.lrc!.isPlay) lrcTools.lrc!.pause()
}

/**
 * 跳转播放位置（拖动进度条、点歌词行、线控 / 通知栏 seek）。
 *
 * `global.app_event.setProgress` 只负责「写状态 + seekTo」，原生 seek 不会
 * 触发 play / pause 事件，所以歌词必须由这里主动跟着走。
 * @param time 目标位置（ms）
 */
export const seek = (time: number) => {
  lrcTools.seek(time)
}

/**
 * 播放进度刷新（每秒一次）/ 原生 seek 回执：把歌词时间轴校正到真实进度。
 *
 * 只在播放中使用：暂停后进度不再变化，用暂停前的旧读数校正会把 seek
 * 的结果冲掉（暂停中 seek 时歌词应当停在新位置的对应行）。
 * @param time 播放器当前进度（ms）
 */
export const syncProgress = (time: number) => {
  if (!lrcTools.isPlay) return
  lrcTools.progress(time)
}

/**
 * 播放速率变化后重新校准：`lrc.setPlaybackRate` 内部按旧时间续走，
 * 这里再用基准时间轴重算一次，保证倍速切换前后行号连续
 * @param playbackRate 新的倍速
 */
export const resumeAtRate = (playbackRate: number) => {
  lrcTools.playbackRate = playbackRate
  if (!lrcTools.isPlay) return
  lrcTools.sync()
}

// on lyric play hook
export const useLrcPlay = (autoUpdate = true) => {
  const [lrcInfo, setLrcInfo] = useState(lrcTools.currentLineData)
  useEffect(() => {
    if (!autoUpdate) return
    const setLrcCallback: SetLyricHook = () => {
      setLrcInfo({ line: 0, text: '' })
    }
    const playCallback: PlayHook = (line, text) => {
      setLrcInfo({ line, text })
    }
    lrcTools.addSetLyricHook(setLrcCallback)
    lrcTools.addPlayHook(playCallback)
    setLrcInfo(lrcTools.currentLineData)
    return () => {
      lrcTools.removeSetLyricHook(setLrcCallback)
      lrcTools.removePlayHook(playCallback)
    }
  }, [autoUpdate])

  return lrcInfo
}

// on lyric set hook
// 当前解析结果的只读快照。useLrcSet 是 hook，非组件环境（CI 自测）
// 拿不到订阅；用它核验 toggleTranslation 是否把翻译行并进 extendedLyrics
export const getCurrentLines = () => lrcTools.currentLines

/**
 * 当前播放行的只读快照（`{ line, text }`，与 `useLrcPlay` 的返回值同源）。
 *
 * 供非组件环境核验「seek 后行号是否跟上」，与 `getCurrentLines` 同理
 */
export const getCurrentLine = () => ({ ...lrcTools.currentLineData })

/**
 * 当前歌词时间轴（ms，已含 `playerInfo` 基准与倍速）。
 * 供测试核验 seek / 暂停后时间轴是否随之移动
 */
export const getCurrentTime = () => lrcTools.currentTime()

export const useLrcSet = () => {
  const [lines, setLines] = useState<Lines>(lrcTools.currentLines)
  useEffect(() => {
    const callback = (lines: Lines) => {
      setLines(lines)
    }
    lrcTools.addSetLyricHook(callback)
    return () => { lrcTools.removeSetLyricHook(callback) }
  }, [])

  return lines
}

