import { createStyle } from '@/utils/tools'

export default createStyle({
  container: {
    // 每项上下留白收紧（原 5 / 15）：播放器设置弹窗整体高度随之变小，
    // 保证底边不超过歌曲封面（用户要求缩小各项间距、压低弹窗总高）。
    paddingTop: 2,
    paddingLeft: 15,
    paddingRight: 15,
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  // title: {

  // },
  label: {
    width: 50,
    textAlign: 'center',
  },
  content: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 5,
  },
})
