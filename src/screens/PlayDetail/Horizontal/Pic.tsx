import { memo, useCallback, useMemo, useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'

import Image from '@/components/common/Image'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useWindowSize } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'

/** 封面最多占左栏内容宽的 92% */
const MAX_WIDTH_RATIO = 0.92
/** 封面最多占可用高度的 95% */
const MAX_HEIGHT_RATIO = 0.95
/**
 * 封面最多占窗口高的 31.5%（07 §3.4 实测值）。
 *
 * 横屏平板（1280×720dp）可用高度只有 641dp，若只按左栏宽算，封面会被拉到
 * 400dp 以上、把播放器块挤出可视区；按窗口高封顶后横屏 226dp / 竖屏 277dp，
 * 与参考实现两张平板截图一致。
 */
const MAX_WINDOW_HEIGHT_RATIO = 0.315

/** 宽屏大封面：在左栏上半区居中，随可用空间收缩，圆角 6（02 §6.1） */
export default memo(() => {
  const musicInfo = usePlayerMusicInfo()
  const { width: winWidth, height: winHeight } = useWindowSize()
  const [area, setArea] = useState({ width: 0, height: 0 })

  const handleLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout
    setArea(prev => (prev.width === width && prev.height === height ? prev : { width, height }))
  }, [])

  const size = useMemo(() => {
    // 首帧还没有 onLayout 结果：按左栏（45%）宽度的估算值先落位，避免闪一下空白
    const areaWidth = area.width || winWidth * 0.45 - 24
    const areaHeight = area.height || winHeight * 0.45
    return Math.max(0, Math.floor(Math.min(
      areaWidth * MAX_WIDTH_RATIO,
      areaHeight * MAX_HEIGHT_RATIO,
      winHeight * MAX_WINDOW_HEIGHT_RATIO,
    )))
  }, [area, winWidth, winHeight])

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {size > 0
        ? <Image
            url={musicInfo.pic}
            nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
            style={{ width: size, height: size, borderRadius: 6 }}
          />
        : null}
    </View>
  )
})

const styles = createStyle({
  container: {
    /**
     * 封面区：**恢复 76542765 原始参数**（用户 2026-10-24 要求）。
     *
     * 曾经为了绕开「左栏改半屏后封面塌成 13dp」改成 `height: '42%'`，但那只是
     * 特定父级高度下才成立的补丁；左栏回到原始的 45% 行内排布后，封面区应重新
     * 按父级**剩余高度**分配（`flexGrow: 1` + 显式 `flexBasis: 0`），封面 / 歌名 /
     * 操作行 / 进度条 / 控制行的相对位置才与原始版本一致。
     */
    flexGrow: 1,
    flexShrink: 1,
    // 显式 flexBasis:0：避免首次量到封面尺寸后基准变大、把播放器块挤下去
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 10,
  },
})
