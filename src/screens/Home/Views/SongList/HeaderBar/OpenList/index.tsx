import { useRef, forwardRef, useImperativeHandle } from 'react'
// import { Icon } from '@/components/common/Icon'
import Button from '@/components/common/Button'
// import { navigations } from '@/navigation'
import Modal, { type ModalType } from './Modal'
import { type Source } from '@/store/songlist/state'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'

// export interface OpenListProps {
//   onTagChange: (name: string, id: string) => void
// }

export interface OpenListType {
  setInfo: (source: Source) => void
}

/**
 * 从「打开」输入框内容里取出歌单链接。
 *
 * 用户多半是直接粘贴分享文案（「xxx 邀请你收听…https://t1.kugou.com/xxxx 点击链接」），
 * 原样丢给 SDK 必然解析失败，所以先把第一个 http(s) 链接挑出来。
 */
const pickLink = (raw: string): string | undefined =>
  /https?:\/\/[^\s"'<>，。；、）】]+/i.exec(raw)?.[0]

/** 按链接域名推断歌单源，识别不出来时返回 undefined（沿用当前源） */
const detectSource = (link: string): Source | undefined => {
  const host = /^https?:\/\/([^/?#]+)/i.exec(link)?.[1]?.toLowerCase()
  if (!host) return undefined
  if (host.includes('163.com') || host.includes('163cn.tv')) return 'wy'
  if (host.includes('qq.com')) return 'tx'
  if (host.includes('kugou.com')) return 'kg'
  if (host.includes('kuwo.cn')) return 'kw'
  if (host.includes('migu.cn')) return 'mg'
  return undefined
}

/** 没有链接时：优先取长数字串（链接里的 id / 酷狗码），否则用原文 */
const pickId = (raw: string): string => /\d{5,}/.exec(raw)?.[0] ?? raw.trim()

export default forwardRef<OpenListType, {}>((props, ref) => {
  const t = useI18n()
  const modalRef = useRef<ModalType>(null)
  const songlistInfoRef = useRef<{ source: Source }>({ source: 'kw' })

  useImperativeHandle(ref, () => ({
    setInfo(source) {
      songlistInfoRef.current.source = source
    },
  }))

  const handleOpenSonglist = (raw: string) => {
    const link = pickLink(raw)
    const id = link ?? pickId(raw)
    // 分享链接里带源信息时直接按链接的源打开（不再要求用户先手动切源）
    const source = (link ? detectSource(link) : undefined) ?? songlistInfoRef.current.source
    // console.log(id, source)
    navigations.pushSonglistDetailScreen(commonState.componentIds.home!, {
      play_count: undefined,
      id,
      author: '',
      name: '',
      img: undefined,
      desc: undefined,
      source,
    })
  }

  // const handleSourceChange: ModalProps['onSourceChange'] = (source) => {
  //   songlistInfoRef.current.source = source
  // }


  return (
    <>
      <Button style={styles.button} onPress={() => modalRef.current?.show(songlistInfoRef.current.source)}>
        <Text>{t('songlist_open')}</Text>
      </Button>
      <Modal ref={modalRef} onOpenId={handleOpenSonglist} />
    </>
  )
})

/** 「打开」按钮左右内边距 */
const OPEN_BTN_PADDING = 9

const styles = createStyle({
  button: {
    // backgroundColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: OPEN_BTN_PADDING,
    paddingRight: OPEN_BTN_PADDING,
  },
})
