import { memo, useMemo } from 'react'

import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useI18n } from '@/lang'
import { setFontSize, getAppliedFontSize } from '@/core/common'
import { useFontSize } from '@/store/common/hook'
import Text from '@/components/common/Text'
import { getTextSize } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

const LIST = [
  {
    size: 0.8,
    name: 'setting_basic_font_size_80',
  },
  {
    size: 0.9,
    name: 'setting_basic_font_size_90',
  },
  {
    size: 1,
    name: 'setting_basic_font_size_100',
  },
  {
    size: 1.1,
    name: 'setting_basic_font_size_110',
  },
  {
    size: 1.2,
    name: 'setting_basic_font_size_120',
  },
  {
    size: 1.3,
    name: 'setting_basic_font_size_130',
  },
] as const

type SIZE_TYPE = typeof LIST[number]['size']

const useActive = (size: SIZE_TYPE) => {
  const _size = useFontSize()
  const isActive = useMemo(() => _size == size, [_size, size])
  return isActive
}

/**
 * 预览：按**已保存**的倍率画，而不是按本次运行生效的倍率。
 *
 * 设置是重启后生效的，如果预览跟着运行时走，用户选了「更大」会看到预览
 * 纹丝不动，反而以为没选上。这里用持久值算，选完立刻能看到目标大小。
 * 单位换算（dp 倍率、系统倍率）仍与 `setSpText` 同一口径，只是把运行时倍率换成持久值。
 */
const SizeText = () => {
  const savedSize = useFontSize()
  const t = useI18n()
  const theme = useTheme()

  const size = useMemo(() => {
    const base = getTextSize(14) / (getAppliedFontSize() || 1)
    return Math.round(base * savedSize)
  }, [savedSize])

  return <Text style={{ fontSize: size }} color={theme['c-primary']}>{t('setting_basic_font_size_preview')}</Text>
}

/** 提示「已保存，重启后生效」，避免用户以为设置没生效 */
const RestartTip = () => {
  const savedSize = useFontSize()
  const t = useI18n()
  const theme = useTheme()

  if (savedSize == getAppliedFontSize()) return null
  return (
    <Text size={12} color={theme['c-font-label']} style={styles.restartTip}>
      {t('setting_basic_font_size_restart_tip')}
    </Text>
  )
}

const Item = ({ size, label }: {
  size: SIZE_TYPE
  label: string
}) => {
  const isActive = useActive(size)
  // const [toggleCheckBox, setToggleCheckBox] = useState(false)
  return <CheckBox marginRight={8} check={isActive} label={label} onChange={() => { setFontSize(size) }} need />
}

export default memo(() => {
  const t = useI18n()

  const list = useMemo(() => {
    return LIST.map((item) => ({ size: item.size, name: t(item.name) }))
  }, [t])

  return (
    <SubTitle title={t('setting_basic_font_size')}>
      <View style={styles.preview}>
        <SizeText />
      </View>
      <View style={styles.list}>
        {
          list.map(({ size, name }) => <Item key={size} size={size} label={name} />)
        }
      </View>
      <RestartTip />
    </SubTitle>
  )
})

const styles = createStyle({
  preview: {
    justifyContent: 'center',
    // paddingTop: 3,
    paddingBottom: 10,
    height: 45,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  restartTip: {
    marginTop: 6,
  },
})
