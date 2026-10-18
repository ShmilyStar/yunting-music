import { memo, useCallback, useRef } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import TimeoutExitEditModal, { type TimeoutExitEditModalType, useTimeInfo } from '@/components/TimeoutExitEditModal'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'

const BTN_SIZE = 36

/**
 * 宽屏浮动按钮：定时关闭。
 *
 * 07 §3.4：`topControls` 横跨整行、水平居中（不是靠右）。
 * 播放页不再单独放桌面歌词键。
 */
export default memo(() => {
  const theme = useTheme()
  const modalRef = useRef<TimeoutExitEditModalType>(null)
  const timeInfo = useTimeInfo()

  const handleShow = useCallback(() => {
    modalRef.current?.show()
  }, [])

  return (
    <>
      <View style={{ ...styles.wrap, top: scaleSizeH(6) }} pointerEvents="box-none">
        <TouchableOpacity activeOpacity={0.5} onPress={handleShow} style={styles.btn}>
          <Icon
            name="music_time"
            size={22}
            color={timeInfo.active ? theme['c-primary-font-active'] : theme['c-primary']}
          />
        </TouchableOpacity>
      </View>
      <TimeoutExitEditModal ref={modalRef} timeInfo={timeInfo} />
    </>
  )
})

const styles = createStyle({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  btn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
