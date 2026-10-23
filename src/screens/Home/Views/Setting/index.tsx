import { useCallback, useMemo, useRef, useState } from 'react'
import { FlatList, ScrollView, TouchableOpacity, View, type ScrollView as ScrollViewType } from 'react-native'

import Main, { SETTING_GROUPS, SettingGroupBody, type SettingGroup } from './Main'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useWindowSize } from '@/utils/hooks'
import { createStyle, isTabletMode } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import commonState from '@/store/common/state'
import { setNavActiveId } from '@/core/common'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'

export type { SettingScreenIds } from './Main'

/** 左栏条目高（07 §3.5） */
const NAV_ITEM_HEIGHT = scaleSizeH(40)

/**
 * 设置页。
 *
 * - 手机 / 竖屏平板：单列长滚动（上游的左右分栏导航已删除）
 * - **横屏平板：分栏**（07 §3.5）——左栏 22% 的分组列表 + 右侧内容；
 *   切换分组后右侧内容**回到最上方**
 */
export default () => {
  const theme = useTheme()
  const t = useI18n()
  const { width, height } = useWindowSize()
  const [activeId, setActiveId] = useState(SETTING_GROUPS[0].id)
  const scrollRef = useRef<ScrollViewType>(null)
  // 仅横屏平板分栏：竖屏平板是单列（07 §3.5）
  const isHorizontal = isTabletMode(width, height) && width / height > 1.2
  /** 左栏宽：规格 07 §3.5 的 22% */
  const navWidth = Math.round(width * 0.22)

  useBackHandler(useCallback(() => {
    if (Object.keys(commonState.componentIds).length == 1 && commonState.navActiveId == 'nav_setting') {
      setNavActiveId(commonState.lastNavActiveId)
      return true
    }
    return false
  }, []))

  const activeGroup = useMemo(
    () => SETTING_GROUPS.find(group => group.id == activeId) ?? SETTING_GROUPS[0],
    [activeId],
  )

  const handleSelect = useCallback((group: SettingGroup) => {
    if (group.id == activeId) return
    setActiveId(group.id)
    // 切换分组后内容回到最上方
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [activeId])

  if (!isHorizontal) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps={'always'}
      >
        <Main />
      </ScrollView>
    )
  }

  return (
    <View style={{ ...styles.splitContainer, borderTopColor: theme['c-border-background'] }}>
      <FlatList
        // 宽度用显式 dp（规格 07 §3.5：22%，1280dp 下 281dp）。
        // 不用百分比 + 必须 flexGrow:0：FlatList 自带 flexGrow 会把它顶宽，
        // 之前左栏实际占了约 61% 就是这么来的。
        style={{ ...styles.nav, width: navWidth, borderRightColor: theme['c-border-background'] }}
        data={SETTING_GROUPS}
        keyExtractor={group => group.id}
        maxToRenderPerBatch={9}
        windowSize={9}
        initialNumToRender={18}
        removeClippedSubviews
        renderItem={({ item }) => {
          const active = item.id == activeId
          return (
            <TouchableOpacity
              style={styles.navItem}
              activeOpacity={0.7}
              onPress={() => { handleSelect(item) }}
            >
              {active
                ? <IconMC name="chevron-right" size={12} color={theme['c-primary-font']} />
                : null}
              <Text
                size={15}
                numberOfLines={1}
                color={active ? theme['c-primary-font'] : theme['c-font']}
                style={styles.navText}
              >{t(item.labelKey)}</Text>
            </TouchableOpacity>
          )
        }}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps={'always'}
      >
        <SettingGroupBody group={activeGroup} />
      </ScrollView>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    paddingLeft: 15,
    paddingRight: 15,
    paddingBottom: 20,
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  nav: {
    // width 由组件按窗口宽算（见 navWidth），这里只固定不参与伸缩
    flexGrow: 0,
    flexShrink: 0,
    borderRightWidth: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: NAV_ITEM_HEIGHT,
    paddingLeft: 10,
    paddingRight: 6,
  },
  navText: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 4,
  },
})
