package de.pablo.duelingbook

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.webkit.JavascriptInterface
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {

    companion object {
        const val START_URL = "https://www.duelingbook.com/"

        // Desktop-User-Agent, damit Duelingbook die normale Seite ausliefert.
        const val DESKTOP_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    }

    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    // Für Deck-Import (Datei-Upload, z. B. .ydk)
    private val filePicker =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            fileCallback?.onReceiveValue(uris)
            fileCallback = null
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            isHapticFeedbackEnabled = true
        }
        setContentView(webView)
        goImmersive()

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            userAgentString = DESKTOP_UA
            // Seite auf Bildschirmbreite einpassen, Pinch-Zoom erlauben
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            textZoom = 100
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        }

        // Brücke für touch.js: Tastatur gezielt öffnen/schließen
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
        webView.addJavascriptInterface(KeyboardBridge(), "DBApp")

        setupPenButton()

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val host = request.url.host ?: return false
                // Duelingbook in der App lassen, fremde Links im Browser öffnen
                return if (host.endsWith("duelingbook.com")) {
                    false
                } else {
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                    true
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                view.evaluateJavascript(loadAsset("touch.js"), null)
                CookieManager.getInstance().flush() // Login dauerhaft speichern
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    filePicker.launch(params.createIntent())
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    false
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(START_URL)
        }
    }

    // ------------------------------------------------------------------
    // S-Pen-Seitenknopf = "Abbrechen" (offenes Menü schließen)
    //
    // Knopf gedrückt halten + mit dem Stift aufs Display tippen.
    // Funktioniert auch, wenn der Stift sich als "Radierer" meldet,
    // und beim Drücken des Knopfes, während der Stift über dem
    // Display schwebt (sofern Samsung den Klick nicht abfängt).
    // ------------------------------------------------------------------
    private var penGestureActive = false
    private var lastPenAction = 0L

    private fun isPenButton(ev: MotionEvent): Boolean {
        val tool = ev.getToolType(ev.actionIndex)
        if (tool == MotionEvent.TOOL_TYPE_ERASER) return true
        if (tool != MotionEvent.TOOL_TYPE_STYLUS) return false
        val mask = MotionEvent.BUTTON_STYLUS_PRIMARY or
            MotionEvent.BUTTON_STYLUS_SECONDARY or
            MotionEvent.BUTTON_SECONDARY
        return (ev.buttonState and mask) != 0
    }

    private fun penButtonAction() {
        val now = System.currentTimeMillis()
        if (now - lastPenAction < 300) return // doppeltes Auslösen vermeiden
        lastPenAction = now
        webView.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
        webView.evaluateJavascript("window.__dbPenButton && window.__dbPenButton()", null)
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupPenButton() {
        // Tippen mit gedrücktem Knopf: Ereignis abfangen, nicht an die Seite geben
        webView.setOnTouchListener { _, ev ->
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    penGestureActive = isPenButton(ev)
                    if (penGestureActive) penButtonAction()
                    penGestureActive
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    val consumed = penGestureActive
                    penGestureActive = false
                    consumed
                }
                else -> penGestureActive
            }
        }

        // Knopf drücken, während der Stift über dem Display schwebt
        webView.setOnGenericMotionListener { _, ev ->
            if (ev.actionMasked == MotionEvent.ACTION_BUTTON_PRESS &&
                ev.getToolType(0).let {
                    it == MotionEvent.TOOL_TYPE_STYLUS || it == MotionEvent.TOOL_TYPE_ERASER
                }
            ) {
                penButtonAction()
                true
            } else {
                false
            }
        }
    }

    inner class KeyboardBridge {
        private val imm get() = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager

        @JavascriptInterface
        fun showKeyboard() {
            webView.post {
                webView.requestFocus()
                imm.showSoftInput(webView, InputMethodManager.SHOW_IMPLICIT)
            }
        }

        @JavascriptInterface
        fun hideKeyboard() {
            webView.post {
                imm.hideSoftInputFromWindow(webView.windowToken, 0)
                goImmersive()
            }
        }
    }

    private fun loadAsset(name: String): String =
        assets.open(name).bufferedReader().use { it.readText() }

    private fun goImmersive() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) goImmersive()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
