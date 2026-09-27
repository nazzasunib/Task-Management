package com.niduslab.taskmanagement;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // app-only plugin that saves the website's downloads (PDFs etc.) to Downloads/Task Management
        registerPlugin(DownloaderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
