import { memo } from 'react'
import { View } from 'react-native'

import { DownloadBtn, MusicAddBtn, PlayerSettingBtn, type ActionIconType } from '@/components/player/ActionBtns'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

/** 操作行图标字号（02 §7.5） */
const ICON_SIZE = 22

export interface ActionBarProps {
  /** 操作行固定用 icomoon（染主色绿，02 §5.1）；控制行才是手机 mc / 宽屏 icomoon */
  iconType?: ActionIconType
  /** 播放器设置二级菜单的弹出方向；宽屏为 `horizontal` + `left`（03 §12.2） */
  settingDirection?: 'vertical' | 'horizontal'
  settingPosition?: 'left' | 'right'
}

/** 操作行：下载 / 添加到列表 / 播放器设置。挂在 PagerView 之外，不随双屏滑动 */
export default memo(({
  iconType = 'icomoon',
  settingDirection = 'vertical',
  settingPosition,
}: ActionBarProps) => {
  const theme = useTheme()
  const color = theme['c-primary']

  return (
    <View style={styles.container}>
      <DownloadBtn iconType={iconType} size={ICON_SIZE} color={color} />
      <MusicAddBtn iconType={iconType} size={ICON_SIZE} color={color} />
      <PlayerSettingBtn
        iconType={iconType}
        size={ICON_SIZE}
        color={color}
        direction={settingDirection}
        position={settingPosition}
      />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 14,
    // 上 3 / 下 10：与 DetailPage 的下留白（16）调平到 20dp（02 §6.3）
    paddingTop: 3,
    paddingBottom: 10,
  },
})
