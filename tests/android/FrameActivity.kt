package com.helloworld

import android.util.Log
import android.view.MotionEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/** Only the benchmark screen samples input. The regular gallery runs without measurement callbacks. */
class FrameActivity : ReactActivity() {
  private var earliestPendingEvent = 0L

  private fun firstSampleNanos(event: MotionEvent): Long =
    if (event.historySize > 0) event.getHistoricalEventTimeNanos(0) else event.eventTimeNanos

  // Check the OS batching contract before the driver warms or measures this test-only activity.
  init {
    val probe = MotionEvent.obtain(10, 10, MotionEvent.ACTION_MOVE, 0f, 0f, 0)
    try {
      val first = probe.eventTimeNanos
      check(firstSampleNanos(probe) == first)
      probe.addBatch(26, 1f, 1f, 1f, 1f, 0)
      check(probe.eventTimeNanos > first && probe.historySize == 1 && firstSampleNanos(probe) == first) {
        "Frame probe did not use the first sample in a batched Android move"
      }
    } finally {
      probe.recycle()
    }
  }

  override fun getMainComponentName() = "AndroidFrameFixture"
  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    // Coalesced moves share a frame. Retain the oldest event to avoid understating latency.
    if (earliestPendingEvent == 0L &&
        (event.actionMasked == MotionEvent.ACTION_DOWN || event.actionMasked == MotionEvent.ACTION_MOVE)) {
      earliestPendingEvent = firstSampleNanos(event)
      window.decorView.viewTreeObserver.registerFrameCommitCallback {
        val latencyNanos = System.nanoTime() - earliestPendingEvent
        earliestPendingEvent = 0L
        Log.i("UldFrameProbe", "inputToFrameCommitNs=" + latencyNanos)
      }
    }
    return super.dispatchTouchEvent(event)
  }
}
