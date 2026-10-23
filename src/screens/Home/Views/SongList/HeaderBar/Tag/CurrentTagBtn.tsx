import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { forwardRef, useImperativeHandle, useState } from 'react'


export interface CurrentTagBtnProps {
  onShowList: () => void
}

export interface CurrentTagBtnType {
  setCurrentTagInfo: (name: string) => void
}

export default forwardRef<CurrentTagBtnType, CurrentTagBtnProps>(({ onShowList }, ref) => {
  const t = useI18n()
  const [name, setName] = useState('')

  useImperativeHandle(ref, () => ({
    setCurrentTagInfo(name) {
      if (!name) name = t('songlist_tag_default')
      setName(name)
    },
  }))

  return (
    <Button style={styles.btn} onPress={onShowList}>
      <Text style={styles.sourceMenu}>{name}</Text>
    </Button>
  )
})


/** 「标签」按钮左右内边距 */
const TAG_BTN_PADDING = 10

const styles = createStyle({
  btn: {
    paddingLeft: TAG_BTN_PADDING,
    paddingRight: TAG_BTN_PADDING,
    justifyContent: 'center',
  },
  sourceMenu: {
    // height: 38,
    // lineHeight: 38,
    textAlign: 'center',
    // minWidth: 70,
    // paddingTop: 10,
    // paddingBottom: 10,
  },
})
