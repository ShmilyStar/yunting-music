import { memo, useState, useEffect } from 'react'
import { View } from 'react-native'

import Section from '../components/Section'
import SubTitle from '../components/SubTitle'
import Button from '../components/Button'
import { sizeFormate } from '@/utils'

import { useI18n } from '@/lang'
import { useVersionDownloadProgressUpdated, useVersionInfo } from '@/store/version/hook'
import Text from '@/components/common/Text'
import { checkUpdate } from '@/core/version'
import { createStyle, toast } from '@/utils/tools'

const currentVer = process.versions.app
export default memo(() => {
  const t = useI18n()
  const versionInfo = useVersionInfo()
  const [title, setTitle] = useState('')
  const [tip, setTip] = useState('')
  const progress = useVersionDownloadProgressUpdated()

  /**
   * 「检查更新」。
   *
   * 这是除「启动时自动检查」之外**唯一**的检查入口（用户 2026-10-25 指定）：
   * 直接发起检查、不打开任何中间窗口；发现新版本时由 checkUpdate 弹出
   * 强制更新窗口（点「否」退出 App）。本页只做展示，版本号右侧不再有
   * 「更新」按钮。
   */
  const handleCheckUpdate = () => {
    if (versionInfo.status == 'checking' || versionInfo.status == 'downloading') return
    void checkUpdate().catch(() => {
      toast(t('version_tip_unknown'), 'long')
    })
  }

  useEffect(() => {
    if (versionInfo.isLatest) {
      setTitle(t('version_tip_latest'))
      setTip('')
    } else if (versionInfo.isUnknown) {
      setTitle(t('version_title_unknown'))
      setTip(t('version_tip_unknown'))
    } else {
      switch (versionInfo.status) {
        case 'downloading':
          setTitle(t('version_title_new'))
          setTip(t('version_btn_downloading', {
            total: sizeFormate(progress.total),
            current: sizeFormate(progress.current),
            progress: progress.total ? (progress.current / progress.total * 100).toFixed(2) : '0',
          }))
          break
        case 'downloaded':
          setTitle(t('version_title_update'))
          setTip('')
          break
        case 'checking':
          setTitle(t('version_title_checking'))
          setTip('')
          break
        case 'error':
          setTitle(t('version_title_failed'))
          setTip(t('version_tip_failed'))
          break
        // case 'idle':
        //   break
        default:
          setTitle(t('version_title_new'))
          setTip('')
          break
      }
    }
  }, [t, versionInfo, progress])

  return (
    <Section title={t('setting_version')}>
      <SubTitle title={title}>
        <View style={styles.desc}>
          <Text size={14}>{t('version_label_latest_ver')}{versionInfo.newVersion?.version}</Text>
          <Text size={14}>{t('version_label_current_ver')}{currentVer}</Text>
          {
            tip ? <Text size={14}>{tip}</Text> : null
          }
        </View>
        <View style={styles.btn}>
          <Button
            disabled={versionInfo.status == 'checking' || versionInfo.status == 'downloading'}
            onPress={handleCheckUpdate}>
            {t('setting_version_check')}
          </Button>
        </View>
      </SubTitle>
    </Section>
  )
})

const styles = createStyle({
  desc: {
    marginBottom: 8,
  },
  btn: {
    flexDirection: 'row',
  },
})
