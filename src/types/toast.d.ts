/**
 * `@/utils/toast` 的模块声明。
 *
 * 实际实现按平台拆成 `toast.android.ts` / `toast.ios.tsx`，Metro 在打包时按
 * 平台后缀解析，但 TypeScript 不认识这种约定，从 `utils/tools.ts` 里
 * `import { toast } from './toast'` 会报 TS2307「找不到模块」。
 *
 * 这里按两个实现的实际签名补一份声明，让类型检查与运行时一致。
 * 签名改动时请同步更新本文件。
 */
declare module '@/utils/toast' {
  export type ToastType = 'default' | 'long'
  export const toast: (message: string, type?: ToastType) => void
}

declare module '*/toast' {
  export type ToastType = 'default' | 'long'
  export const toast: (message: string, type?: ToastType) => void
}
