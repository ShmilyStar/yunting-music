import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import Popup, { type PopupType, type PopupProps } from '@/components/common/Popup'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { useWindowSize } from '@/utils/hooks'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT } from '@/config/constant'
import { measureCoverBottom } from '@/screens/PlayDetail/coverMetrics'

import SettingLyricProgress from './settings/SettingLyricProgress'
import SettingVolume from './settings/SettingVolume'
import SettingPlaybackRate from './settings/SettingPlaybackRate'
import SettingLrcFontSize from './settings/SettingLrcFontSize'
import SettingDesktopLyric from './settings/SettingDesktopLyric'
import { isDesktopLyricSupported } from '@/config/platform'

export interface SettingPopupProps extends Omit<PopupProps, 'children'> {
  direction: 'vertical' | 'horizontal'
  /**
   * 宽屏横排时面板的固定宽度（dp）。
   *
   * 播放页会传「半屏」，让面板右缘正好落在屏幕中线上
   * （用户 2026-10-24 要求：设置弹窗右缘与屏幕中心齐平）。
   */
  panelWidth?: number
}

export interface SettingPopupType {
  show: () => void
}

export default forwardRef<SettingPopupType, SettingPopupProps>(({ direction, panelWidth, ...props }, ref) => {
  const [visible, setVisible] = useState(false)
  const popupRef = useRef<PopupType>(null)
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const { height: windowHeight } = useWindowSize()

  /**
   * 手机竖屏：设置面板改成「顶栏下方下拉」，而不是从底部盖上来。
   *
   * 起点是最顶栏（「发现 / 音乐馆 / 我的」那条标题栏）的下框线，
   * 即 状态栏 + 1 × HEADER_HEIGHT——用户要求贴在《发现》下面，不要再多让一行。
   * 底边最多到封面底部：再往下就压住封面下方的歌词预览了，调字号 / 歌词进度
   * 时看不到实时效果（用户 2026-10-21 反馈）。
   */
  const topOffset = statusBarHeight + scaleSizeH(_HEADER_HEIGHT)

  /**
   * 弹窗可用高度 = 封面底边 − 顶栏下框线，使面板底边**与封面底部齐平**
   * （用户 2026-10-23 明确要求，不再留空、也不越过封面）。
   *
   * 两端都是 dp：`measureCoverBottom()` 已经统一成「屏幕绝对坐标 dp」
   * （Android 的 measureInWindow 本身就是 dp，只是扣掉了状态栏，由
   * `utils/windowMeasure.ts` 补回）。**不要**再按 PixelRatio 换算，
   * 那会把封面底边缩小 3 倍，导致退回 48% 窗口高的兜底值、压住歌词。
   */
  const computeMaxHeight = (coverBottomDp: number) => {
    // 还没量到封面（无封面 / 量失败）时退回窗口高度的 48%
    const usable = coverBottomDp - topOffset
    const limit = usable > scaleSizeH(80) ? usable : windowHeight * 0.48
    const mh = Math.max(scaleSizeH(120), Math.min(limit, windowHeight * 0.78))
    return mh
  }
  const [maxHeight, setMaxHeight] = useState(0)

  useImperativeHandle(ref, () => ({
    async show() {
      // 先现量一次封面底边（重排后缓存可能过期），再决定面板高度
      setMaxHeight(computeMaxHeight(await measureCoverBottom()))
      if (visible) popupRef.current?.setVisible(true)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          popupRef.current?.setVisible(true)
        })
      }
    },
  }))

  const isVertical = direction == 'vertical'

  return (
    visible
      ? (
        <Popup
          ref={popupRef}
          title={t('play_detail_setting_title')}
          {...props}
          {...(isVertical
            ? { position: 'top', topOffset, maxHeight, panelHeight: maxHeight }
            // 横排（宽屏左栏）：宽度取半屏，右缘贴屏幕中线
            : (panelWidth != null && panelWidth > 0 ? { panelWidth } : {}))}
        >
          {/* ScrollView 必须 flexShrink:1：父级 modalView 只有 maxHeight 约束，
              不参与收缩的 ScrollView 会按内容高度撑出面板、视觉上越过封面。
              收缩后内容超出即内部滚动，面板底边被严格限制在 maxHeight 内。 */}
          <ScrollView style={{ flexShrink: 1 }}>
            <View onStartShouldSetResponder={() => true}>
              {/* 桌面歌词只有 Android 有：iOS 上整组隐藏，否则是个点了没反应、
                  还会把 desktopLyric.enable 写脏的假开关 */}
              {isDesktopLyricSupported ? <SettingDesktopLyric /> : null}
              <SettingLyricProgress />
              <SettingVolume />
              <SettingPlaybackRate />
              <SettingLrcFontSize direction={direction} />
            </View>
          </ScrollView>
        </Popup>
        )
      : null
  )
})
