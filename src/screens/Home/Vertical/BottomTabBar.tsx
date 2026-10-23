import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import { HOME_TABS, type HOME_TAB_ID } from '@/config/homeTabs'
import { REF_COLOR } from '@/config/uiPalette'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useNavStack } from '@/store/common/hook'
import { switchHomeTab } from '@/core/common'
import useBottomInset from '@/utils/hooks/useBottomInset'
import { BorderWidths } from '@/theme'

/** 底部三个 Tab 的实际高度（dp），播放页据此决定面板划出的起点 */
export const BAR_HEIGHT = scaleSizeH(56)
const ICON_SIZE = 23

/** 含安全区的总占位高度 —— 凡是「面板底边对齐三 bar 上框线」的地方都用这个 */
export const useBottomBarHeight = () => BAR_HEIGHT + useBottomInset()

export interface BottomTabBarProps {
  onSelect?: (id: HOME_TAB_ID) => void
}

export default memo(({ onSelect }: BottomTabBarProps) => {
  const theme = useTheme()
  const t = useI18n()
  const navStack = useNavStack()
  const bottomInset = useBottomInset()
  // 二级页面时高亮「栈底」所属的主 Tab
  const activeId = navStack[0]

  return (
    <View style={{
      ...styles.container,
      height: BAR_HEIGHT + bottomInset,
      paddingBottom: bottomInset,
      backgroundColor: theme['c-content-background'],
      borderTopColor: theme['c-border-background'],
    }}>
      {HOME_TABS.map(tab => {
        const active = activeId == tab.id
        const color = active ? theme['c-primary'] : theme['c-font-label']
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => { onSelect ? onSelect(tab.id) : switchHomeTab(tab.id) }}
          >
            <View style={{
              ...styles.pill,
              backgroundColor: active ? REF_COLOR.pillActive : 'transparent',
            }}>
              <IconMC name={tab.icon} size={ICON_SIZE} color={color} />
            </View>
            <Text style={styles.label} size={11}
              color={active ? color : REF_COLOR.textHint} numberOfLines={1}>
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
})

const styles = createStyle({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: BorderWidths.normal2,
    elevation: 12,
  },
  item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  pill: {
    width: 58,
    height: 30,
    borderRadius: scaleSizeW(15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: 1, textAlign: 'center' },
})
