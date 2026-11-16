package com.jkfamily.videocall;

import androidx.browser.customtabs.CustomTabsCallback;

/**
 * Opens the live site in Chrome. The library's default callback deliberately crashes the app when
 * Chrome reports a "quality" problem, such as the site's assetlinks.json not being found, which made
 * the app close the moment it opened. A plain callback keeps it open instead: if the site can't be
 * verified, Chrome just shows a small address bar.
 */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected CustomTabsCallback getCustomTabsCallback() {
        return new CustomTabsCallback();
    }
}
