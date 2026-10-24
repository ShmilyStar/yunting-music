import { useEffect, useRef } from 'react'
import { filterList, getHotComment } from './utils'
import music from '@/utils/musicSdk'
import List, { type ListType } from './components/List'
const limit = 15

export default ({ musicInfo, onUpdateTotal }: {
  musicInfo: LX.Music.MusicInfoOnline
  onUpdateTotal: (total: number) => void
}) => {
  // const [isLoading, setIsLoading] = useState(false)
  const listRef = useRef<ListType>(null)
  const listInfo = useRef({ page: 1, total: 0, maxPage: 1, isEnd: false, isLoading: false, isLoadError: false })
  /** 最新歌曲信息：回调里用来判断「这条结果还是当前这首歌的吗」 */
  const musicInfoRef = useRef(musicInfo)
  musicInfoRef.current = musicInfo
  /** 两层延时（占位 300ms + 状态刷新 300ms）的句柄，卸载与切歌时都要清 */
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleGetComment = async(musicInfo: LX.Music.MusicInfoOnline, page: number) => {
    // setIsLoading(true)
    listInfo.current.isLoading = true
    return getHotComment(musicInfo, page, limit).then(commentInfo => {
      listInfo.current.page = page
      listInfo.current.isLoading = false
      // setIsLoading(false)
      if (listInfo.current.isLoadError) {
        listInfo.current.isLoadError = false
      }
      return commentInfo
    }).catch(async err => {
      console.log(err)
      if (err.message != '取消请求') {
        listInfo.current.isLoading = false
        // setIsLoading(false)
        listInfo.current.isLoadError = true
      }
      throw err
    })
  }
  const updateStatus = () => {
    if (listInfo.current.isLoadError) {
      listRef.current?.setStatus('error')
    } else if (listInfo.current.isEnd) {
      listRef.current?.setStatus('end')
    } else if (!listInfo.current.isLoading) {
      listRef.current?.setStatus('idle')
    }
  }
  const handleListLoadMore = () => {
    if (listInfo.current.isLoading || listInfo.current.isEnd) return
    const list = listRef.current?.getList() ?? []
    const page = list.length ? listInfo.current.page + 1 : 1
    listRef.current?.setStatus('loading')
    void handleGetComment(musicInfo, page).then(({ comments }) => {
      let isEnd = page >= listInfo.current.maxPage
      if (listInfo.current.isEnd != isEnd) listInfo.current.isEnd = isEnd
      listRef.current?.setList(filterList([...listRef.current.getList(), ...comments]))
    }).finally(updateStatus)
  }

  const handleListRefresh = () => {
    listRef.current?.setStatus('refreshing')
    void handleGetComment(musicInfo, 1).then(({ comments, maxPage, total }) => {
      listInfo.current.total = total
      listInfo.current.maxPage = maxPage
      onUpdateTotal(total)
      let isEnd = maxPage === 1
      if (listInfo.current.isEnd != isEnd) listInfo.current.isEnd = isEnd
      listRef.current?.setList(filterList(comments))
    }).finally(updateStatus)
  }

  const handleShowComment = (musicInfo: LX.Music.MusicInfoOnline) => {
    if (!musicInfo.id || !music[musicInfo.source].comment) return
    listInfo.current.page = 1
    listInfo.current.total = 0
    listInfo.current.maxPage = 1
    listInfo.current.isEnd = false
    listInfo.current.isLoading = false
    listInfo.current.isLoadError = false
    listRef.current?.setList([])
    listRef.current?.setStatus('loading')
    void handleGetComment(musicInfo, 1).then(({ comments, maxPage, total }) => {
      // 与 CommentNew 同款：请求返回时歌曲可能已切走（组件在切歌时复用），
      // 过期结果直接丢弃，避免「评论串到别的歌」。
      if (musicInfo.id !== musicInfoRef.current.id) return
      listInfo.current.total = total
      listInfo.current.maxPage = maxPage
      onUpdateTotal(total)
      let isEnd = maxPage === 1
      if (listInfo.current.isEnd != isEnd) listInfo.current.isEnd = isEnd
      commitTimerRef.current = setTimeout(() => {
        listRef.current?.setList(filterList(comments))
        statusTimerRef.current = setTimeout(updateStatus, 300)
      }, 300)
    })
  }

  useEffect(() => {
    // 切歌：先清上一首遗留的两层延时，避免旧评论盖到新歌列表上
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    commitTimerRef.current = null
    statusTimerRef.current = null
    handleShowComment(musicInfo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicInfo.id])

  useEffect(() => () => {
    // 卸载：清掉待执行的定时器（原先卸载后仍会 setState）
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
  }, [])


  return (
    <List
      ref={listRef}
      onLoadMore={handleListLoadMore}
      onRefresh={handleListRefresh}
    />
  )
}
