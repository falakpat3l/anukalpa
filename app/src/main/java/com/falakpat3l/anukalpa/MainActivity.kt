package com.falakpat3l.anukalpa

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import java.io.ByteArrayInputStream

/**
 * The whole app is the web page in docs/, shown full screen.
 * Files are served from inside the APK, so nothing is downloaded and no data leaves the phone.
 * Saved data uses the page's own storage, kept inside the app.
 */
class MainActivity : ComponentActivity() {

    private lateinit var web: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            // Security: the page only needs its own files from the APK, never other files on the phone.
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClientCompat() {
                // Only the app's own files are loaded. Anything else gets an empty "not found".
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    loader.shouldInterceptRequest(request.url)
                        ?: WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))

                // Links to other sites (http or https only) open in the phone's browser, never inside the app.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val url = request.url
                    if (url.scheme == "https" && url.host == "appassets.androidplatform.net") return false
                    if (url.scheme == "https" || url.scheme == "http") {
                        runCatching { startActivity(Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE)) }
                    }
                    return true
                }
            }
        }

        // Keep the page clear of the status bar and navigation bar.
        val frame = FrameLayout(this).apply { setBackgroundColor(Color.BLACK); addView(web) }
        ViewCompat.setOnApplyWindowInsetsListener(frame) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        setContentView(frame)

        if (savedInstanceState == null) web.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        else web.restoreState(savedInstanceState)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (web.canGoBack()) web.goBack() else finish() }
        })
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }
}
