import { memo, useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import Text from '@/components/common/Text'
import SongRow from '../../components/SongRow'
import { usePageLayout } from '../../components/pageLayout'
import { REF_COLOR } from '@/config/uiPalette'
import { LIST_IDS } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useRecentPlay } from '@/store/recentPlay/hook'
import { useWindowSize, useIsTabletLayout } from '@/utils/hooks'
import { initRecentPlay } from '@/core/recentPlay'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'

/** 写进临时列表时用的列表标识（只作为 meta，实际数据落在 LIST_IDS.TEMP） */
const RECENT_TEMP_LIST_ID = 'recent__play'

/**
 * 最近播放（03 §8）。
 *
 * 数据源是独立的 `store/recentPlay`（持久化键 `@recent_play`，见 `core/recentPlay.ts`），
 * 不用播放器的临时/已播放列表——最近播放要跨会话保留。
 */
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const recentList = useRecentPlay()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void initRecentPlay().catch((err: unknown) => {
      console.log(err)
    }).then(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const handlePress = useCallback((index: number) => {
    if (!recentList.length) return
    // 先落临时列表，再按下标播放 —— 保证播放队列就是当前看到的这一份
    void setTempList(RECENT_TEMP_LIST_ID, [...recentList]).then(() => {
      void playList(LIST_IDS.TEMP, index)
    })
  }, [recentList])

  const renderItem = useCallback(({ item, index }: { item: LX.Music.MusicInfoOnline, index: number }) => (
    <SongRow
      index={index + 1}
      rowIndex={index}
      name={item.name}
      singer={item.singer}
      album={item.meta.albumName}
      pic={item.meta.picUrl}
      musicInfo={item}
      musicId={item.id}
      onPressItem={handlePress}
    />
  ), [handlePress])

  /** 宽屏（平板 / 长条大屏手机）收窄居中；手机上 `width` 为 undefined，行为不变 */
  const pageLayout = usePageLayout(useWindowSize().width)
  const isTablet = useIsTabletLayout()

  return (
    <View style={styles.container}>
      <View style={[
        styles.body,
        pageLayout.width != null && { width: pageLayout.width },
        pageLayout.padding > 0 && { paddingHorizontal: pageLayout.padding },
      ]}>
        {loading
          ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme['c-primary-font']} />
              </View>
            )
          : (
              /**
               * 用 `ScrollView` + 全量渲染，不用 `FlatList`。
               *
               * 实测（模拟器）「最近播放」15 首时 `FlatList` 只画出 1/2/3/6/13/14/15
               * 七行，中间整段缺失；换 key 重建也无效（数据本身是完整的 15 条）。
               * 最近播放上限只有 100 条，全量渲染的开销可以接受。
               */
              <ScrollView style={styles.list}>
                {recentList.length
                  ? (
                      <View style={isTablet ? styles.grid : undefined}>
                        {recentList.map((item, index) => (
                          <View key={`${item.id}__${index}`} style={isTablet ? styles.cell : undefined}>
                            {renderItem({ item, index })}
                          </View>
                        ))}
                      </View>
                    )
                  : <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('recent_empty')}</Text>}
              </ScrollView>
            )}
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
  },
  list: {
    flex: 1,
  },
  /** 平板双列：一行两首 */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingTop: 30,
    paddingBottom: 30,
  },
})
