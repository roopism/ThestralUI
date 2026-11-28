package com.helloworld

import android.view.View
import android.view.ViewGroup
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import java.io.FileDescriptor
import java.io.PrintWriter
import org.json.JSONObject

class MainActivity : ReactActivity() {
  override fun getMainComponentName() = "HelloWorld"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  // The driver XML omits the role description from the platform accessibility node.
  override fun dump(prefix: String, fd: FileDescriptor?, writer: PrintWriter, args: Array<out String>?) {
    if (args?.singleOrNull() != "uld-alert-roles") {
      super.dump(prefix, fd, writer, args)
      return
    }
    fun visit(view: View) {
      if ((view.tag as? String)?.startsWith("scenario.alert.") == true && view.isShown) {
        val node = view.createAccessibilityNodeInfo()
        val row = JSONObject()
          .put("resource-id", node.viewIdResourceName)
          .put("class", node.className?.toString())
          .put("text", node.text?.toString())
          .put("content-desc", node.contentDescription?.toString())
          .put("roleDescription", AccessibilityNodeInfoCompat.wrap(node).roleDescription?.toString())
        writer.println(prefix + "ULD_ALERT " + row)
      }
      if (view is ViewGroup) for (i in 0 until view.childCount) visit(view.getChildAt(i))
    }
    visit(window.decorView)
  }
}
