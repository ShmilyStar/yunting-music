import { forwardRef, memo, useEffect, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'
import ButtonBar from './ActionBar'
import { useNavigationComponentDidAppear } from '@/navigation'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import Text, { AnimatedText } from '@/components/common/Text'
import { REF_COLOR } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import Image from '@/components/common/Image'
import { useListInfo } from './state'
import { useAnimateOnecNumber } from '@/utils/hooks/useAnimateNumber'
import songlistState from '@/store/songlist/state'
import { useI18n } from '@/lang'

/** 封面边长（设计值，规格 03 §15 的头部大封面） */
const IMAGE_WIDTH = 105

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

const Pic = ({ componentId, playCount, imgUrl }: {
  componentId: string
  playCount: string
  imgUrl?: string
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
    <View style={{ ...styles.listItemImg, width: IMAGE_WIDTH, height: IMAGE_WIDTH }}>
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
 * 歌单详情页头部（03 §15）：封面（右下角播放量角标）+ 歌单名（2 行）
 * + 「N 首 · 播放量」+ 两个胶囊按钮。
 *
 * 顶部的「‹ 歌单」标题栏由屏幕层用 `SubPageHeader` 渲染，与「歌单」二级页一致。
 */
export default forwardRef<HeaderType, HeaderProps>(({ componentId }: { componentId: string }, ref) => {
  const t = useI18n()
  const info = useListInfo()
  const [detailInfo, setDetailInfo] = useState<DetailInfo>({ name: '', desc: '', playCount: '', imgUrl: info.img })
  // 曲目总数与「N 首 · 播放量」里的播放量都从榜单/歌单 store 取
  const total = songlistState.listDetailInfo.total

  useImperativeHandle(ref, () => ({
    setInfo(info) {
      setDetailInfo(info)
    },
  }), [])

  return (
    // 顶部的「‹ 歌单」标题栏由屏幕层渲染（与「歌单」二级页同一条 SubPageHeader），
    // 这里只负责封面 + 歌单信息 + 按钮
    <View style={styles.container}>
      <View style={styles.headRow}>
        <Pic componentId={componentId} playCount={detailInfo.playCount} imgUrl={detailInfo.imgUrl} />
        <View style={styles.headInfo} nativeID={NAV_SHEAR_NATIVE_IDS.songlistDetail_title}>
          <Text size={18} numberOfLines={ 2 } color={REF_COLOR.text}>{detailInfo.name}</Text>
          <Text size={13} color={REF_COLOR.textSub} style={styles.count} numberOfLines={ 1 }>
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
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  headInfo: {
    flexDirection: 'column',
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 12,
  },
  count: {
    marginTop: 6,
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
