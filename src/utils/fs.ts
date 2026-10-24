import RNFS from 'react-native-fs'
import {
  Dirs,
  FileSystem,
  AndroidScoped,
  type OpenDocumentOptions,
  type Encoding,
  type HashAlgorithm,
  getExternalStoragePaths as _getExternalStoragePaths,
} from 'react-native-file-system'

export type {
  FileType,
} from 'react-native-file-system'

// export const externalDirectoryPath = RNFS.ExternalDirectoryPath

export const extname = (name: string) => name.lastIndexOf('.') > 0 ? name.substring(name.lastIndexOf('.') + 1) : ''

export const temporaryDirectoryPath = Dirs.CacheDir
export const externalStorageDirectoryPath = Dirs.SDCardDir
export const privateStorageDirectoryPath = Dirs.DocumentDir

export const getExternalStoragePaths = async(is_removable?: boolean) => _getExternalStoragePaths(is_removable)

export const selectManagedFolder = async(isPersist: boolean = false) => AndroidScoped.openDocumentTree(isPersist)
export const selectFile = async(options: OpenDocumentOptions) => AndroidScoped.openDocument(options)
// iOS 专属的系统另存为面板（任务 9.16）；Android 导出保持选目录→写入，
// 本函数不会被调用
export const exportFile = async(_srcPath: string): Promise<{ data: string } | null> => {
  throw new Error('exportFile is iOS only')
}
// iOS 专属的暂存兜底（任务 9.14）：Android 侧 file:// / content:// 由 fs 层
// 直接可读，恒等透传
export const importOpenedFile = async(path: string): Promise<{ path: string, staged: boolean, attempts: number }> => {
  return { path, staged: false, attempts: 0 }
}
export const removeManagedFolder = async(path: string) => AndroidScoped.releasePersistableUriPermission(path)
export const getManagedFolders = async() => AndroidScoped.getPersistedUriPermissions()

export const getPersistedUriList = async() => AndroidScoped.getPersistedUriPermissions()


export const readDir = async(path: string) => FileSystem.ls(path)

export const unlink = async(path: string) => FileSystem.unlink(path)

/**
 * 递归删除文件或目录。
 *
 * `FileSystem.unlink` 在 Android 侧映射到 `FileSystem.deleteRecursive`，本身就会递归；
 * 这里只包一层，好处是**删不掉时抛错**（原生实现忽略 `File.delete()` 的返回值）。
 */
export const removeRecursive = async(path: string): Promise<void> => {
  await unlink(path)
  // 删完还读得到，说明有子项没删掉（原生实现不报错）
  const left = await readDir(path).catch(() => null)
  if (left) throw new Error('delete failed: ' + path)
}

export const mkdir = async(path: string) => FileSystem.mkdir(path)

export const stat = async(path: string) => FileSystem.stat(path)
export const hash = async(path: string, algorithm: HashAlgorithm) => FileSystem.hash(path, algorithm)

export const readFile = async(path: string, encoding?: Encoding) => FileSystem.readFile(path, encoding)

/**
 * 只读文件开头若干字节（按 ascii 取，得到的是原始字节）。
 *
 * 用来按文件头判断真实容器：下载产物常常「扩展名说 mp3、内容其实是 mp4」。
 * 不能用 `readFile` 全量读——那是几十 MB 的文件。
 */
export const readFileHead = async(path: string, length = 16) =>
  // RNFS 的 read(filepath, length, position, encoding) 支持分段读
  RNFS.read(path, length, 0, 'ascii')


// export const copyFile = async(fromPath: string, toPath: string) => FileSystem.cp(fromPath, toPath)

export const moveFile = async(fromPath: string, toPath: string) => FileSystem.mv(fromPath, toPath)
export const gzipFile = async(fromPath: string, toPath: string) => FileSystem.gzipFile(fromPath, toPath)
export const unGzipFile = async(fromPath: string, toPath: string) => FileSystem.unGzipFile(fromPath, toPath)
export const gzipString = async(data: string, encoding?: Encoding) => FileSystem.gzipString(data, encoding)
export const unGzipString = async(data: string, encoding?: Encoding) => FileSystem.unGzipString(data, encoding)

export const existsFile = async(path: string) => FileSystem.exists(path)

export const rename = async(path: string, name: string) => FileSystem.rename(path, name)

export const writeFile = async(path: string, data: string, encoding?: Encoding) => FileSystem.writeFile(path, data, encoding)

export const appendFile = async(path: string, data: string, encoding?: Encoding) => FileSystem.appendFile(path, data, encoding)

export const downloadFile = (url: string, path: string, options: Omit<RNFS.DownloadFileOptions, 'fromUrl' | 'toFile'> = {}) => {
  // 不就地修改调用方传入的 options：原实现会往调用方对象上写 headers，
  // 复用同一个 options 对象时会残留上一次的请求头
  const headers = options.headers ?? {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Mobile Safari/537.36',
  }
  return RNFS.downloadFile({
    fromUrl: url, // URL to download file from
    toFile: path, // Local filesystem path to save the file to
    ...options,
    headers,
    // headers: options.headers, // An object of headers to be passed to the server
    // // background?: boolean;     // Continue the download in the background after the app terminates (iOS only)
    // // discretionary?: boolean;  // Allow the OS to control the timing and speed of the download to improve perceived performance  (iOS only)
    // // cacheable?: boolean;      // Whether the download can be stored in the shared NSURLCache (iOS only, defaults to true)
    // progressInterval: options.progressInterval,
    // progressDivider: options.progressDivider,
    // begin: (res: DownloadBeginCallbackResult) => void;
    // progress?: (res: DownloadProgressCallbackResult) => void;
    // // resumable?: () => void;    // only supported on iOS yet
    // connectionTimeout?: number // only supported on Android yet
    // readTimeout?: number       // supported on Android and iOS
    // // backgroundTimeout?: number // Maximum time (in milliseconds) to download an entire resource (iOS only, useful for timing out background downloads)
  })
}

export const stopDownload = (jobId: number) => {
  RNFS.stopDownload(jobId)
}
