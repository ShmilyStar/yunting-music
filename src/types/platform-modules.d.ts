/**
 * `@/utils/toast` 的平台分叉声明。
 *
 * 该模块只有两个平台实现文件（`toast.android.ts`、`toast.ios.tsx`），
 * 没有无后缀的默认实现。Metro 会按平台自动选择，运行时没问题；
 * 但 `tsc` 不认识 `.android` / `.ios` 后缀，会报
 * 「Cannot find module './toast'」。这里补一份与实现签名一致的声明来消除噪音。
 *
 * 注意：这里**只放类型声明**，不产生运行时模块。
 */
declare module '@/utils/toast' {
  export const toast: (
    message: string,
    duration?: 'long' | 'short',
    position?: 'top' | 'center' | 'bottom',
  ) => void
}
