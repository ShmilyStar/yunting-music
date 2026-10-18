import { memo, useCallback, useRef } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import IconMC from '@/components/common/IconMC'
import StatusBar from '@/components/common/StatusBar'
import TimeoutExitEditModal, { type TimeoutExitEditModalType, useTimeInfo } from '@/components/TimeoutExitEditModal'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'

export const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)

/** 页面指示点（绝对居中，不受左右按钮影响） */
const PageIndicator = ({ pageIndex, pageCount, onSelectPage }: {
  pageIndex: number
  pageCount: number
  onSelectPage: (index: number) => void
}) => {
  const theme = useTheme()
  const dots = []
  for (let i = 0; i < pageCount; i++) {
    const active = i == pageIndex
    dots.push(
      <TouchableOpacity key={i} style={styles.dotHit} activeOpacity={0.6} onPress={() => { onSelectPage(i) }}>
        <View style={{
          width: active ? scaleSizeW(9) : scaleSizeW(5),
          height: scaleSizeH(5),
          borderRadius: scaleSizeW(2.5),
          backgroundColor: active ? theme['c-primary'] : theme['c-350'],
        }} />
      </TouchableOpacity>,
    )
  }
  // box-none：这一层绝对定位盖在整条顶栏上，只有指示点自己接收触摸
  return <View style={styles.dots} pointerEvents="box-none">{dots}</View>
}

export interface HeaderProps {
  pageIndex: number
  pageCount: number
  onBack: () => void
  onSelectPage: (index: number) => void
}

export default memo(({ pageIndex, pageCount, onBack, onSelectPage }: HeaderProps) => {
  const theme = useTheme()
  const modalRef = useRef<TimeoutExitEditModalType>(null)
  const timeInfo = useTimeInfo()

  const handleShowTimeout = useCallback(() => {
    modalRef.current?.show()
  }, [])

  return (
    // 播放页面板从顶部标题栏下框线开始（标题栏由下层主界面显示），
    // 这一行只占自己的 HEADER_HEIGHT，不再叠加状态栏高度
    <View
      style={{ height: HEADER_HEIGHT }}
      nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_header}
    >
      <StatusBar />
      <View style={styles.row}>
        <TouchableOpacity style={{ ...styles.btn, width: HEADER_HEIGHT }} activeOpacity={0.5} onPress={onBack}>
          <IconMC name="chevron-down" size={24} color={theme['c-font']} />
        </TouchableOpacity>
        <TouchableOpacity style={{ ...styles.btn, width: HEADER_HEIGHT }} activeOpacity={0.5} onPress={handleShowTimeout}>
          <Icon
            name="music_time"
            size={22}
            color={timeInfo.active ? theme['c-primary-font-active'] : theme['c-primary']}
          />
        </TouchableOpacity>
      </View>
      <PageIndicator pageIndex={pageIndex} pageCount={pageCount} onSelectPage={onSelectPage} />
      <TimeoutExitEditModal ref={modalRef} timeInfo={timeInfo} />
    </View>
  )
})

const styles = createStyle({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btn: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotHit: {
    paddingHorizontal: 4,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
