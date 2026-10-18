// import { useLrcPlay } from '@/plugins/lyric'
import { useStatusText } from '@/store/player/hook'
// import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'


export default () => {
  // const { text } = useLrcPlay()
  const statusText = useStatusText()
  // console.log('render status')

  // const status = playerStatus.isPlay ? text : playerStatus.statusText

  // 没有状态文案时不占位：宽屏左栏是纵向排布，空 Text 会白白撑高一行
  if (!statusText) return null

  return <Text numberOfLines={1} size={13}>{statusText}</Text>
}

// const styles = createStyle({
//   text: {
//     fontSize: 10,
//   },
// })
