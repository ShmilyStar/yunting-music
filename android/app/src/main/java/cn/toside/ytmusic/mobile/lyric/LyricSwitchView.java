package cn.toside.ytmusic.mobile.lyric;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Color;
import android.text.TextPaint;
import android.text.TextUtils;
import android.view.View;
import android.view.animation.Animation;
import android.view.animation.AnimationSet;
import android.view.animation.TranslateAnimation;
import android.widget.TextSwitcher;
import android.widget.TextView;

import androidx.annotation.Nullable;

import java.util.ArrayList;

// https://github.com/Block-Network/StatusBarLyric/blob/main/app/src/main/java/statusbar/lyric/view/LyricSwitchView.kt
@SuppressLint({"ViewConstructor"})
public final class LyricSwitchView extends TextSwitcher {
  private final TextView textView;
  private final TextView textView2;
  private final ArrayList<TextView> viewArray;
  // private final boolean isSingleLine;
  private boolean isShowAnima;

  private boolean isSingleLine;
  /** 切换动画的位移距离：多行歌词要用整个歌词区高度，否则新旧两屏会叠在一起 */
  private float animaDistance = 0f;
  /** 换行滚动时长：略快于 300ms，和网易云的滚动手感接近 */
  private static final long ANIMA_DURATION = 280L;

  public LyricSwitchView(Context context, boolean isSingleLine, boolean isShowAnima) {
    super(context);
    // this.isSingleLine = isSingleLine;
    this.isShowAnima = isShowAnima;
    this.isSingleLine = isSingleLine;

    if (isSingleLine) {
      viewArray = new ArrayList<>(2);
      textView = new LyricTextView(context);
      textView2 = new LyricTextView(context);
      viewArray.add(textView);
      viewArray.add(textView2);
      textView.setIncludeFontPadding(false);
      textView2.setIncludeFontPadding(false);
//      for (TextView v : viewArray) {
//        v.setShadowLayer(0.1f, 0, 0, Color.BLACK);
//      }
    } else {
      viewArray = new ArrayList<>(2);
      textView = new TextView(context);
      textView2 = new TextView(context);
      viewArray.add(textView);
      viewArray.add(textView2);
      for (TextView v : viewArray) {
        v.setIncludeFontPadding(false);
//        v.setShadowLayer(0.2f, 0, 0, Color.BLACK);
        v.setEllipsize(TextUtils.TruncateAt.END);
      }
    }
    setAnima();
    this.addView(textView);
    this.addView(textView2);
    // 只绘制容器自身的矩形区域：滚动时旧内容上移、新内容下移，
    // 两者超出边界部分必须裁掉，否则会在边界外和新内容叠出重影
    setClipChildren(true);
    setClipToPadding(true);
  }

  @Nullable
  public Animation inAnim(String str, float height) {
    AnimationSet animationSet = new AnimationSet(true);
    if (str == null) return null;

    TranslateAnimation translateAnimation;
    switch (str) {
      case "top":
        // 新内容从下方「一行」的位置滑到 0，正好接住旧内容上移后露出的空位
        translateAnimation = new TranslateAnimation(0.0F, 0.0F, height, 0.0F);
        break;
      case "bottom":
        translateAnimation = new TranslateAnimation(0.0F, 0.0F, -height, 0.0F);
        break;
      case "left":
        translateAnimation = new TranslateAnimation(100.0F, 0.0F, 0.0F, 0.0F);
        break;
      case "right":
        translateAnimation = new TranslateAnimation(-100.0F, 0.0F, 0.0F, 0.0F);
        break;
      default: return null;
    }

    translateAnimation.setDuration(ANIMA_DURATION);
    // 新内容从下方接上来，只位移、不淡入，和旧内容的上移拼成一次连续滚动
    animationSet.addAnimation(translateAnimation);
    return animationSet;
  }

  @Nullable
  public Animation outAnim(String str, float height) {
    AnimationSet animationSet = new AnimationSet(true);
    if (str == null) return null;

    TranslateAnimation translateAnimation;
    switch (str) {
      case "top":
        translateAnimation = new TranslateAnimation(0.0F, 0.0F, 0.0F, -height);
        break;
      case "bottom":
        translateAnimation = new TranslateAnimation(0.0F, 0.0F, 0.0F, height);
        break;
      case "left":
        translateAnimation = new TranslateAnimation(0.0F, -100.0F, 0.0F, 0.0F);
        break;
      case "right":
        translateAnimation = new TranslateAnimation(0.0F, 100.0F, 0.0F, 0.0F);
        break;
      default: return null;
    }
    // 只做位移，不做淡入淡出：加透明度会让旧内容先「消失」再出新的，
    // 观感是闪一下，而不是连续地向上滚
    translateAnimation.setDuration(ANIMA_DURATION);
    animationSet.addAnimation(translateAnimation);
    return animationSet;
  }
  private void setAnima() {
    if (textView == null) return;
    if (isShowAnima) {
      float size = animaDistance > 0f ? animaDistance : lineHeight();
      setInAnimation(inAnim("top", size));
      setOutAnimation(outAnim("top", size));
    } else {
      setInAnimation(null);
      setOutAnimation(null);
    }
  }

  /**
   * 单行行高：换行时整体只上移一行，和网易云一致。
   * 早先这里用的是整个歌词区高度，效果是新一屏从最底部整屏涌上来，不是逐行滚动。
   */
  private float lineHeight() {
    TextView v = (TextView) this.getCurrentView();
    if (v == null) v = textView;
    if (v == null) return 0f;
    TextPaint paint = v.getPaint();
    if (paint == null) return v.getTextSize();
    int lineHeight = paint.getFontMetricsInt(null);
    if (lineHeight <= 0) return Math.max(1f, v.getTextSize());
    return lineHeight;
  }

  /**
   * 由 LyricView 决定换行时整体滚动的距离：传单行行高即逐行上滚。
   * 传歌词区高度则是整屏滚动（旧行为）。
   */
  public void setAnimaDistance(float distance) {
    float next = distance > 0f ? distance : lineHeight();
    if (animaDistance == next) return;
    animaDistance = next;
    setAnima();
  }

  public void setShowAnima(boolean showAnima) {
    isShowAnima = showAnima;
    setAnima();
  }

  public TextPaint getPaint() {
    TextView v = (TextView)this.getCurrentView();
    if (v == null) return null;
    return v.getPaint();
  }

  /**
   * 当前显示内容的真实排版高度（含内边距）。
   * 多行歌词要按这个值撑开歌词区，自己按字高估算会在行数多时把最后一行裁掉。
   */
  public int getContentHeight() {
    TextView v = (TextView)this.getCurrentView();
    if (v == null) return 0;
    android.text.Layout layout = v.getLayout();
    if (layout == null) return 0;
    return layout.getHeight() + v.getPaddingTop() + v.getPaddingBottom();
  }

  /**
   * 当前排版出来的行数。
   * 用于避免「上一帧的排版高度」在当前行数上限被调小时继续兜底、把窗口撑住不收。
   */
  public int getLineCount() {
    TextView v = (TextView) this.getCurrentView();
    if (v == null) return 0;
    android.text.Layout layout = v.getLayout();
    return layout == null ? 0 : layout.getLineCount();
  }

  public void setWidth(int i) {
    for (TextView v : viewArray) v.setWidth(i);
  }

  /**
   * 换行：先用单块内容替换文字，再让整块从「下方一行」滑回原位。
   *
   * 不走 TextSwitcher 的双缓冲交叉：两个 TextView 都铺满视区，交叉时新旧内容的
   * 第 2~N 行会同时出现在同一位置，必然重影。单块内容直接替换后整体上滑一行，
   * 视觉上就是逐行往上滚，且任何时刻只有一份文字。
   */
  @Override
  public void setText(CharSequence text) {
    // 先关掉双缓冲动画，避免 TextSwitcher 自己再叠一层交叉
    Animation in = getInAnimation();
    Animation out = getOutAnimation();
    setInAnimation(null);
    setOutAnimation(null);
    // 直接给当前 TextView 换内容（两块都换，保证下次切换时内容一致）
    for (TextView v : viewArray) v.setText(text);
    setInAnimation(in);
    setOutAnimation(out);

    if (!isShowAnima) return;
    View current = getCurrentView();
    if (current == null) return;
    float line = animaDistance > 0f ? animaDistance : lineHeight();
    TranslateAnimation roll = new TranslateAnimation(0f, 0f, line, 0f);
    roll.setDuration(ANIMA_DURATION);
    current.clearAnimation();
    current.startAnimation(roll);
  }

  public void setTextColor(int i) {
    for (TextView v : viewArray) v.setTextColor(i);
  }

  public void setShadowColor(int i) {
    // float radius;
    // if (isSingleLine) {
    //   radius = 1.2f;
    // } else {
    //   radius = 2f;
    // }
    // https://stackoverflow.com/a/28367917
    for (TextView v : viewArray) v.setShadowLayer(1.6f, 1.5f, 1.3f, i);
  }

  public void setSourceText(CharSequence str) {
    // 走 TextSwitcher.setText：它会把内容切到另一个 TextView 并播放 out/in 动画。
    // 直接给两个 TextView 都 setText 相当于「瞬间替换」，动画根本不会触发。
    setText(str);
  }

  public void setHeight(int i) {
    for (TextView v : viewArray) v.setHeight(i);
  }

  public void setPadding(int left, int top, int right, int bottom) {
    for (TextView v : viewArray) v.setPadding(left, top, right, bottom);
  }

  public void setSingleLine(boolean bool) {
    for (TextView v : viewArray) v.setSingleLine(bool);
  }

  public void setMaxLines(int i) {
    for (TextView v : viewArray) v.setMaxLines(i);
  }

  public void setTextSize(float f) {
    for (TextView v : viewArray) v.setTextSize(f);
    setAnima();
  }

  public void setGravity(int i) {
    for (TextView v : viewArray) v.setGravity(i);
  }

}
