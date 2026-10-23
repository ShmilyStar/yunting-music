import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TouchableOpacity, View, type LayoutChangeEvent } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { useWindowSize } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useI18n } from '@/lang'
import { navigations } from '@/navigation'
import { registerCoverMeasure, setCoverBottom } from '@/screens/PlayDetail/coverMetrics'
import { measureNodeBottom } from '@/utils/windowMeasure'
import { lrcFontSizeFromSetting } from '@/screens/PlayDetail/lrcFontSize'

/** 大封面最多占可用宽度（02 §6.1）——调小以给加大的歌词腾位置 */
const PIC_WIDTH_RATIO = 0.82
/** 大封面最多占封面区高度 */
const PIC_HEIGHT_RATIO = 0.92

/**
 * 第 1 屏：大封面 + 歌词预览 + 歌名块。
 *
 * 封面区用 `flexGrow` 吃掉「歌名块以上」的全部剩余高度，封面在区内居中；
 * 这样 16:9 / 18:9 / 20:9 的手机都不会在歌名块下面留一大块空白，
 * 也不会把封面压到行动条上（20:9 上封面会按宽度上限放大）。
 */
export default memo(({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const musicInfo = usePlayerMusicInfo()
  const { width: winWidth, height: winHeight } = useWindowSize()
  const { line } = useLrcPlay()
  const lines = useLrcSet()
  const [area, setArea] = useState({ width: 0, height: 0 })
  const picRef = useRef<View>(null)

  const handleLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout
    setArea(prev => (prev.width === width && prev.height === height ? prev : { width, height }))
  }, [])

  /**
   * 封面在窗口里的底边：歌词设置下拉面板用它当高度上限。
   *
   * 统一走 `measureNodeBottom`（dp，且补回 Android 被扣掉的状态栏高度）：
   * 直接 `measureInWindow` 得到的 y 在 Android 上比屏幕位置高一个状态栏，
   * 之前还额外除以过 PixelRatio，面板高度于是算成窗口的 48%，底边越过封面 65dp。
   */
  const measureCoverBottom = useCallback(async(): Promise<number | null> =>
    measureNodeBottom(picRef.current), [])

  const handlePicLayout = useCallback(() => {
    void measureNodeBottom(picRef.current).then(bottom => {
      if (bottom != null) setCoverBottom(bottom)
    })
  }, [])

  // 登记「现量」函数：弹窗打开前会重新量一次，避免用到重排前的过期坐标
  useEffect(() => registerCoverMeasure(measureCoverBottom), [measureCoverBottom])

  const picSize = useMemo(() => {
    // 首帧还没有 onLayout：先按窗口宽度的 74% 估一个，避免闪一下 0 尺寸
    const areaWidth = area.width || winWidth * 0.74
    const areaHeight = area.height || winHeight * 0.42
    return Math.max(0, Math.floor(Math.min(
      areaWidth * PIC_WIDTH_RATIO,
      areaHeight * PIC_HEIGHT_RATIO,
    )))
  }, [area, winWidth, winHeight])

  /**
   * 歌词预览字号：跟随「歌词设置 → 字号」（`playDetail.vertical.style.lrcFontSize`）。
   *
   * 以前这里是写死的 22 / 17，滑设置里的字号条完全没反应（用户 2026-10-21 反馈
   * 「红框位置的歌词大小，通过歌词设置调整不起作用」）。
   * 换算走与歌词页同一个 `lrcFontSizeFromSetting`，两处永远一致。
   */
  const lrcFontSize = useSettingValue('playDetail.vertical.style.lrcFontSize')
  const currentSize = lrcFontSizeFromSetting(lrcFontSize)
  const nextSize = Math.max(10, Math.round(currentSize * 0.78))

  // 歌词预览：当前行 + 下一行
  const currentText = line > -1 ? (lines[line]?.text ?? '') : ''
  const nextText = lines[line + 1]?.text ?? ''

  return (
    <View style={styles.container}>
      <View style={styles.picWrap} onLayout={handleLayout}>
        {picSize > 0
          ? <View
              ref={picRef}
              collapsable={false}
              onLayout={handlePicLayout}
              style={{ width: picSize, height: picSize }}
            >
              <Image
                url={musicInfo.pic}
                nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
                style={{ width: picSize, height: picSize, borderRadius: 6 }}
              />
            </View>
          : null}
      </View>
      <View style={styles.lyric}>
        {/* 当前唱到的那句染主题色，随播放进度逐句变化；下一句仍用灰字。
            字号取自「歌词设置」里的字号条（见上方 currentSize），不再写死 */}
        <Text size={currentSize} numberOfLines={1} color={theme['c-primary']} style={styles.lyricText}>{currentText}</Text>
        <Text size={nextSize} numberOfLines={1} color={theme['c-font-label']} style={styles.lyricText}>{nextText}</Text>
      </View>
      {/* 评论入口：规格 01 §2.5 把评论从独立按钮移进歌曲详情屏，
          这里挂在歌曲信息块上（截图 09 里该处没有额外可见控件） */}
      <TouchableOpacity
        style={styles.info}
        activeOpacity={0.7}
        onPress={() => { navigations.pushCommentScreen(componentId) }}
      >
        <Text size={19} numberOfLines={1}>{musicInfo.name}</Text>
        <Text size={12} numberOfLines={1} color={theme['c-font-label']} style={styles.singer}>
          {musicInfo.singer || t('play_detail_unknown_singer')}
        </Text>
      </TouchableOpacity>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    paddingLeft: 16,
    paddingRight: 16,
  },
  picWrap: {
    flexGrow: 1,
    flexShrink: 1,
    // 显式 flexBasis:0：封面区只吃「歌名块以上」的剩余高度，不按内容撑开
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 6,
  },
  lyric: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  lyricText: {
    textAlign: 'center',
  },
  info: {
    paddingTop: 10,
    paddingBottom: 14,
  },
  singer: {
    marginTop: 4,
  },
})
