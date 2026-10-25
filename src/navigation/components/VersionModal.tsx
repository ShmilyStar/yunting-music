import { useEffect, useState, memo } from 'react'
import { View, ScrollView } from 'react-native'

import Button from '@/components/common/Button'
import { sizeFormate } from '@/utils'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useVersionDownloadProgressUpdated, useVersionInfo } from '@/store/version/hook'
import { downloadUpdate } from '@/core/version'
import { updateApp } from '@/utils/version'
import { exitApp } from '@/utils/nativeModules/utils'
import ModalContent from './ModalContent'

const currentVer = process.versions.app

/**
 * 「发现新版本」强制更新弹窗。
 *
 * 用户 2026-10-25 指定：
 *   - 只在「启动自动检查」和「设置里点检查更新」两处触发；
 *   - 发现新版本弹本窗口，内容为「发现新版本 xxx，是否更新」；
 *   - 点「否」直接退出 App，不更新不能继续使用；
 *   - 点「是」后自动下载并拉起系统安装器替换安装。
 *
 * 因此这里**没有**「忽略 / 稍后 / 关闭」这类出口：取消按钮的唯一动作就是
 * 退出应用。沿用 v1.0.3 的 overlay 弹窗载体（ModalContent），但去掉了原来
 * 的「忽略版本」按钮与关闭语义。
 */
const VersionModal = ({ componentId: _componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const versionInfo = useVersionInfo()
  const progress = useVersionDownloadProgressUpdated()
  const [tip, setTip] = useState('')

  const newVersion = versionInfo.newVersion?.version
  const isDownloading = versionInfo.status == 'downloading'
  const isDownloaded = versionInfo.status == 'downloaded'

  useEffect(() => {
    switch (versionInfo.status) {
      case 'downloading':
        setTip(t('version_btn_downloading', {
          total: sizeFormate(progress.total),
          current: sizeFormate(progress.current),
          progress: progress.total ? (progress.current / progress.total * 100).toFixed(2) : '0',
        }))
        break
      case 'downloaded':
        setTip(t('version_title_update'))
        break
      case 'error':
        setTip(t('version_tip_failed'))
        break
      default:
        setTip('')
        break
    }
  }, [t, versionInfo.status, progress])

  /** 点「否」：不更新就不能使用，直接退出应用 */
  const handleNo = () => {
    // UtilsModule.exitApp 在 Android 上是杀掉进程并结束 Activity，
    // iOS 侧同样实现了退出；失败也不应卡住用户，兜底再调一次
    try {
      exitApp()
    } catch (e) {
      exitApp()
    }
  }

  /** 点「是」：下载 → 下载完自动拉起安装器 */
  const handleYes = () => {
    if (isDownloading) return
    if (isDownloaded) {
      void updateApp()
      return
    }
    downloadUpdate()
  }

  const confirmText = isDownloaded ? t('version_btn_update') : t('version_force_yes')

  return (
    <ModalContent>
      <View style={styles.main}>
        <Text style={styles.title}>{t('version_force_title', { version: newVersion ?? '' })}</Text>
        <ScrollView style={styles.content} keyboardShouldPersistTaps={'always'}>
          <Text style={styles.label}>{t('version_label_latest_ver')}{newVersion}</Text>
          <Text style={styles.label}>{t('version_label_current_ver')}{currentVer}</Text>
          <View style={{ marginTop: 10 }}>
            <Text style={styles.desc}>{t('version_force_tip')}</Text>
          </View>
          {tip ? <Text style={{ ...styles.desc, marginTop: 8 }}>{tip}</Text> : null}
        </ScrollView>
      </View>
      <View style={styles.btns}>
        <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleNo}>
          <Text color={theme['c-button-font']}>{t('version_force_no')}</Text>
        </Button>
        <Button
          disabled={isDownloading}
          style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }}
          onPress={handleYes}>
          <Text color={theme['c-button-font']}>{confirmText}</Text>
        </Button>
      </View>
    </ModalContent>
  )
}

const styles = createStyle({
  main: {
    flexShrink: 1,
    marginTop: 15,
    marginLeft: 15,
    marginRight: 15,
    marginBottom: 20,
  },
  content: {
    flexGrow: 0,
  },
  title: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    marginBottom: 2,
  },
  desc: {
    fontSize: 13,
    lineHeight: 19,
  },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 15,
    paddingLeft: 15,
  },
  btn: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: 10,
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 15,
  },
})

export default memo(VersionModal)
