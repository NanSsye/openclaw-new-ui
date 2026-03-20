package com.openclaw.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Let the system handle insets - content will be below status bar
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
