import { memo, useEffect, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import { REF_ACCENT } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { handleCollect, handlePlay } from './listAction'
import songlistState from '@/store/songlist/state'
import listState from '@/store/list/state'
import { useListInfo } from './state'

/**
 * 该歌单是否已在「我的列表」里（收藏过）。
 *
 * 口径与 `handleCollect` 一致：`sourceListId == <源>__<歌单id>`。
 * 历史数据里有只存歌单 id 的条目，这里两种都认。
 */
const checkCollected = (sourceKey: string) =>
  listState.userList.some(list =>
    list.sourceListId == sourceKey ||
    (!list.sourceListId?.includes('__') && list.sourceListId == sourceKey.split('__').slice(1).join('__')),
  )

/**
 * 胶囊的尺寸常量：`Header` 要用它算头部行高（封面边长 = 行高），
 * 这里导出未使用的名字也没关系，避免两处各写一份而慢慢走偏。
 */
export const PILLS_TOP_GAP = 8
const PILL_DESIGN_HEIGHT = 32
const PILL_HEIGHT = scaleSizeH(PILL_DESIGN_HEIGHT)
export { PILL_HEIGHT }

/**
 * 歌单详情页的两个胶囊按钮：▶ 播放（主色实心）/ ♡ 收藏（浅绿描边）。
 * 规格 03 §15。
 *
 * 文案用 `collect`（「收藏」）而不是 `collect_songlist`（「收藏歌单」）：
 * 两个胶囊共用 `styles.pill`（同高、同内边距、同图标尺寸），
 * 文案同是两个字，宽度就完全一致 —— 否则「收藏歌单」比「播放」宽一大截。
 * `minWidth` 只是兜底，避免某些语言下文字过短导致两个胶囊仍不齐。
 *
 * 收藏态直接读 `listState.userList`，由 `mylistUpdated` 驱动刷新；
 * 图标随收藏态在空心 / 实心之间切换。
 */
export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const info = useListInfo()
  /** 当前歌单在「我的列表」里的来源标记，与 `handleCollect` 的判定口径一致 */
  const sourceKey = `${info.source}__${info.id}`
  /** 收藏态：直接读 `listState.userList`，由 `mylistUpdated` 事件驱动刷新 */
  const [collected, setCollected] = useState(() => checkCollected(sourceKey))
  useEffect(() => {
    const refresh = () => { setCollected(checkCollected(sourceKey)) }
    refresh()
    global.state_event.on('mylistUpdated', refresh)
    return () => { global.state_event.off('mylistUpdated', refresh) }
  }, [sourceKey])

  const handlePlayAll = () => {
    if (!songlistState.listDetailInfo.info.name) return
    void handlePlay(info.id, info.source, songlistState.listDetailInfo.list)
  }

  const handleCollection = () => {
    if (!songlistState.listDetailInfo.info.name) return
    void handleCollect(info.id, info.source, songlistState.listDetailInfo.info.name || info.name)
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={{ ...styles.pill, backgroundColor: theme['c-primary'] }}
        activeOpacity={0.8}
        onPress={handlePlayAll}
      >
        <IconMC name="play" size={15} color="#FFFFFF" />
        <Text size={14} color="#FFFFFF" style={styles.pillText}>{t('play')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{
          ...styles.pill,
          marginRight: 0,
          backgroundColor: REF_ACCENT.green.bg,
          borderWidth: 1,
          borderColor: REF_ACCENT.green.color,
        }}
        activeOpacity={0.8}
        onPress={handleCollection}
      >
        <IconMC name={collected ? 'heart' : 'heart-outline'} size={15} color={REF_ACCENT.green.color} />
        <Text size={14} color={REF_ACCENT.green.color} style={styles.pillText}>{t('collect')}</Text>
      </TouchableOpacity>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingTop: PILLS_TOP_GAP,
  },
  /**
   * 两个胶囊**等分整行**（`flex: 1` + `flexBasis: 0`）。
   *
   * 之前是「按内容宽度从左排」：两个胶囊只占到头信息列的一半多一点，
   * 右边空出 ~60dp 的空白（用户 2026-10-22 反馈「右边的空白太多，播放/收藏要向右移」）。
   * 改成等分后，右侧胶囊自然贴到右边界，两个胶囊宽度依旧完全一致、只是各自变宽。
   *
   * 2026-10-22 中午再收一档：胶囊原来 40dp 高、15dp 字，在头部里显得又胖又占地方
   * （用户反馈「搜索和播放的胶囊太大了，占位太多」）。改为 32dp 高 / 14dp 字 /
   * 15dp 图标，整块头部因此矮下来，封面也能和右侧文字+胶囊齐平。
   *
   * 高 / 圆角 / 内边距全部走 `scaleSizeW/H`：分辨率或字号变化时胶囊跟着等比缩放，
   * `flexBasis: 0` 保证不同语言文案长度不同也严格等宽。
   */
  pill: {
    flex: 1,
    flexBasis: 0,
    height: PILL_HEIGHT,
    borderRadius: scaleSizeW(PILL_DESIGN_HEIGHT / 2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleSizeW(10),
    marginRight: scaleSizeW(10),
  },
  pillText: {
    marginLeft: 5,
  },
})
