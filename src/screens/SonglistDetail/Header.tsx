import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import ButtonBar, { PILL_HEIGHT, PILLS_TOP_GAP } from './ActionBar'
import { useNavigationComponentDidAppear } from '@/navigation'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import Text, { AnimatedText } from '@/components/common/Text'
import { REF_COLOR } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import Image from '@/components/common/Image'
import { setSpText } from '@/utils/pixelRatio'
import { useListInfo } from './state'
import { useAnimateOnecNumber } from '@/utils/hooks/useAnimateNumber'
import songlistState from '@/store/songlist/state'
import { useI18n } from '@/lang'

/** `styles.count` 的 marginTop */
const NAME_COUNT_GAP = 4
/** 头部上下内边距（设计值） */
const HEAD_PADDING_V = 12
/** 歌单名最多显示 2 行（用户要求：长标题不要单行省略，允许换行） */
const MAX_TITLE_LINES = 2

const titleLineHeight = () => Math.round(setSpText(18) * 1.35)
const countLineHeight = () => Math.round(setSpText(13) * 1.4)

/**
 * 右侧信息块的**基础**高度：歌单名 1 行 + 「N 首 · 播放量」1 行 + 间距 + 胶囊。
 * 只用于**首帧**的占位（测量回来之前），真实高度以 `onLayout` 为准。
 * `setSpText` 依赖运行时的字号设置，所以必须放在函数里，不能模块加载时固化。
 */
const computeBaseRowHeight = () => titleLineHeight() +
  NAME_COUNT_GAP +
  countLineHeight() +
  PILLS_TOP_GAP +
  PILL_HEIGHT

const CountText = memo(({ count }: { count: string }) => {
  const [animFade] = useAnimateOnecNumber(0, 1, 250, false)
  const [animTranslateY] = useAnimateOnecNumber(10, 0, 250, false)
  return (
    <AnimatedText style={{
      ...styles.playCount,
      opacity: animFade,
      transform: [
        { translateY: animTranslateY },
      ],
    }} numberOfLines={ 1 }>{count}</AnimatedText>
  )
}, (prevProps, nextProps) => {
  return true
})

const Pic = ({ componentId, playCount, imgUrl, size }: {
  componentId: string
  playCount: string
  imgUrl?: string
  /** 边长：等于右侧「歌单名 + 首数 + 胶囊」的高度（见 Header 里的 `handleInfoLayout`） */
  size: number
}) => {
  const [pic, setPic] = useState(imgUrl)
  const [animated, setAnimated] = useState(false)
  const info = useListInfo()
  useEffect(() => {
    if (animated) setPic(imgUrl)
  }, [imgUrl, animated])

  useNavigationComponentDidAppear(componentId, () => {
    setAnimated(true)
  })

  return (
    <View style={{ ...styles.listItemImg, width: size, height: size }}>
      <Image nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`} url={pic} style={{ flex: 1, borderRadius: 6 }} />
      {
        playCount && animated ? <CountText count={playCount} /> : null
      }
    </View>
  )
}

export interface HeaderProps {
  componentId: string
}

export interface HeaderType {
  setInfo: (info: DetailInfo) => void
}
export interface DetailInfo {
  name: string
  desc: string
  playCount: string
  imgUrl?: string
}

/**
 * 歌单详情页头部（03 §15）：封面（右下角播放量角标）+ 歌单名（最多 2 行，超出省略）
 * + 「N 首 · 播放量」+ 两个胶囊按钮。
 *
 * 顶部的「‹ 歌单」标题栏由屏幕层用 `SubPageHeader` 渲染，与「歌单」二级页一致。
 *
 * **封面边长的取法（2026-10-22 修 bug 后定型）**：始终等于右侧信息块的真实高度，
 * 而右侧高度靠 `onLayout` 测出来 —— 关键是让「测量 → 定封面 → 再测量」这条路**收敛**：
 * - 「封面变大 → 右侧变窄 → 歌单名多占一行 → 右侧再变高」本身是正反馈，
 *   第一版没有行数上限，于是无限涨，用户看到的 bug 是歌单名两行叠在一起、
 *   「N 首 · 播放量」被胶囊压住；
 * - 现在把歌单名**硬性限制在 2 行**：右侧高度只有「1 行档」「2 行档」两个取值，
 *   而「更窄只会让行数变多、不会变少」，所以两个状态之间不会来回跳 ——
 *   一次布局就能稳定，不需要任何 clamp 常数（clamp 反而会因公式与实测差几像素而不齐）；
 * - 两行文字都写了显式 `lineHeight`（1.35em / 1.4em），实测值稳定，不会有半像素抖动。
 */
export default forwardRef<HeaderType, HeaderProps>(({ componentId }: { componentId: string }, ref) => {
  const t = useI18n()
  const info = useListInfo()
  const [detailInfo, setDetailInfo] = useState<DetailInfo>({ name: '', desc: '', playCount: '', imgUrl: info.img })
  // 曲目总数与「N 首 · 播放量」里的播放量都从榜单/歌单 store 取
  const total = songlistState.listDetailInfo.total
  /** 封面边长 = 右侧信息块高度，见上方注释 */
  const [rowHeight, setRowHeight] = useState(computeBaseRowHeight)

  const handleInfoLayout = useCallback((e: LayoutChangeEvent) => {
    const height = Math.round(e.nativeEvent.layout.height)
    // 差 1px 以内不改：避免半像素抖动来回触发重排
    setRowHeight(prev => Math.abs(prev - height) < 1 ? prev : height)
  }, [])

  useImperativeHandle(ref, () => ({
    setInfo(info) {
      setDetailInfo(info)
    },
  }), [])

  return (
    // 顶部的「‹ 歌单」标题栏由屏幕层渲染（与「歌单」二级页同一条 SubPageHeader），
    // 这里只负责封面 + 歌单信息 + 按钮
    <View style={styles.container}>
      <View style={{ ...styles.headRow, minHeight: rowHeight + HEAD_PADDING_V * 2 }}>
        <Pic componentId={componentId} playCount={detailInfo.playCount} imgUrl={detailInfo.imgUrl} size={rowHeight} />
        <View style={styles.headInfo} onLayout={handleInfoLayout} nativeID={NAV_SHEAR_NATIVE_IDS.songlistDetail_title}>
          <Text
            size={18}
            numberOfLines={MAX_TITLE_LINES}
            ellipsizeMode="tail"
            color={REF_COLOR.text}
            style={{ lineHeight: titleLineHeight() }}
          >{detailInfo.name}</Text>
          <Text size={13} color={REF_COLOR.textSub} style={{ ...styles.count, lineHeight: countLineHeight() }} numberOfLines={ 1 }>
            {`${total} ${t('mine_count_unit')}${detailInfo.playCount ? ` · ${detailInfo.playCount}` : ''}`}
          </Text>
          <ButtonBar />
        </View>
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
  },
  headRow: {
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    /** 封面靠上对齐：它是「与右侧同高」的正方形，顶部对齐才不显得悬空 */
    alignItems: 'flex-start',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: HEAD_PADDING_V,
    paddingBottom: HEAD_PADDING_V,
  },
  headInfo: {
    flexDirection: 'column',
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 10,
  },
  count: {
    marginTop: NAME_COUNT_GAP,
  },
  listItemImg: {
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: 6,
    elevation: 2,
  },
  playCount: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    fontSize: 11,
    paddingLeft: 4,
    paddingRight: 4,
    paddingTop: 1,
    paddingBottom: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#fff',
  },
})
