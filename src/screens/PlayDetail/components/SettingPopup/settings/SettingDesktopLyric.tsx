import { memo, useRef } from 'react'
import { View } from 'react-native'

import CheckBox from '@/components/common/CheckBox'
import DesktopLyricEnable, { type DesktopLyricEnableType } from '@/components/DesktopLyricEnable'
import { useSettingValue } from '@/store/setting/hook'
import { toggleDesktopLyricLock } from '@/core/desktopLyric'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import styles from './style'

/** 桌面歌词：显示开关 + 锁定（上游是顶栏的独立按钮，现合并进播放器设置二级菜单） */
export default memo(() => {
  const t = useI18n()
  const isEnable = useSettingValue('desktopLyric.enable')
  const isLock = useSettingValue('desktopLyric.isLock')
  const desktopLyricEnableRef = useRef<DesktopLyricEnableType>(null)

  const setEnable = (enable: boolean) => {
    desktopLyricEnableRef.current?.setEnabled(enable)
  }
  const setLock = (lock: boolean) => {
    void toggleDesktopLyricLock(lock).then(() => {
      updateSetting({ 'desktopLyric.isLock': lock })
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.list}>
          <CheckBox
            marginBottom={3}
            check={isEnable}
            label={t('play_detail_setting_show_desktop_lyric')}
            onChange={setEnable}
          />
          <CheckBox
            marginBottom={3}
            check={isLock}
            label={t('setting_lyric_desktop_lock')}
            onChange={setLock}
          />
        </View>
      </View>
      <DesktopLyricEnable ref={desktopLyricEnableRef} />
    </View>
  )
})
