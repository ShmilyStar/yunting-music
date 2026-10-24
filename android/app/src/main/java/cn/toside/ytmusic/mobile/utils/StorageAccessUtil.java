package cn.toside.ytmusic.mobile.utils;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.util.Log;

/**
 * 「所有文件访问」权限（分区存储下的全盘读写）。
 *
 * Android 11 起 `READ_EXTERNAL_STORAGE` / `READ_MEDIA_AUDIO` 只覆盖 MediaStore
 * 里登记过的媒体，用 `readdir` 遍历 `/sdcard` 会直接 `Permission denied`。
 * 本应用的「本地音乐」是按目录浏览 / 递归统计歌曲数的，必须持有
 * `MANAGE_EXTERNAL_STORAGE`，而它只能由用户在系统设置里手动开启。
 */
public class StorageAccessUtil {

  private static final String TAG = "StorageAccessUtil";

  /** 是否已持有「所有文件访问」。Android 10 及以下不需要（走 requestLegacyExternalStorage） */
  public static boolean hasAllFilesAccess() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return true;
    try {
      return Environment.isExternalStorageManager();
    } catch (Exception e) {
      Log.e(TAG, "isExternalStorageManager failed", e);
      return false;
    }
  }

  /**
   * 打开系统设置里的「所有文件访问」授权页。
   *
   * @return true 表示成功拉起系统页面；false 表示系统不支持或调用失败
   */
  public static boolean openAllFilesAccessSettings(Context context, String packageName) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return true;
    if (hasAllFilesAccess()) return true;

    try {
      Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
      intent.setData(Uri.parse("package:" + packageName));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      context.startActivity(intent);
      return true;
    } catch (Exception e) {
      Log.w(TAG, "per-app all-files page unavailable, falling back to the list page", e);
    }

    try {
      // 部分 ROM 没有「按应用」的入口，退回权限列表页
      Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      context.startActivity(intent);
      return true;
    } catch (Exception e) {
      Log.e(TAG, "Failed to open all-files access settings", e);
      return false;
    }
  }
}
