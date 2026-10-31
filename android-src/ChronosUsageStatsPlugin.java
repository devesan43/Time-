package com.chronos.screentime;

import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;
import java.util.Calendar;
import java.util.List;

/**
 * ChronosUsageStatsPlugin
 * Real-time Android System UsageStatsManager Bridge for Chronos Screen
 * Reads foreground app screen time across Instagram, WhatsApp, Facebook, Chrome, etc.
 */
@CapacitorPlugin(name = "ChronosUsageStats")
public class ChronosUsageStatsPlugin extends Plugin {

    @PluginMethod
    public void checkUsagePermission(PluginCall call) {
        UsageStatsManager usm = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        long now = System.currentTimeMillis();
        List<UsageStats> stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - 1000 * 60, now);
        boolean granted = (stats != null && !stats.isEmpty());

        JSObject ret = new JSObject();
        ret.put("isGranted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openUsageSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void queryDailyAppUsage(PluginCall call) {
        UsageStatsManager usm = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        Calendar calendar = Calendar.getInstance();
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        long startOfDay = calendar.getTimeInMillis();
        long now = System.currentTimeMillis();

        List<UsageStats> stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startOfDay, now);
        JSObject packages = new JSObject();

        if (stats != null) {
            for (UsageStats stat : stats) {
                long totalMillis = stat.getTotalTimeInForeground();
                if (totalMillis > 0) {
                    packages.put(stat.getPackageName(), totalMillis / (1000 * 60)); // Minutes in foreground
                }
            }
        }

        JSObject result = new JSObject();
        result.put("packages", packages);
        call.resolve(result);
    }
}
