package com.jkfamily.videocall;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.google.androidbrowserhelper.trusted.DelegationService;

/**
 * Shows the site's notifications as this app's. An incoming call is shown on a "Calls" channel that
 * plays the phone's own ringtone at ringer volume and keeps ringing (FLAG_INSISTENT) until the call is
 * answered, declined, the caller gives up, or a minute passes. Messages stay ordinary notifications.
 */
public class CallRingService extends DelegationService {
    private static final String CALLS = "jk_calls_ringing";
    private static final long[] BUZZ = {0, 800, 400, 800, 400, 800, 1200};

    @Override
    public boolean onNotifyNotificationWithChannel(String tag, int id, Notification n, String channelName) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !isCall(n)) {
            return super.onNotifyNotificationWithChannel(tag, id, n, channelName);
        }
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) return false;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CALLS) == null) {
            NotificationChannel ch = new NotificationChannel(CALLS, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Rings with your ringtone until you answer");
            ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE), new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            ch.enableVibration(true);
            ch.setVibrationPattern(BUZZ);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            ch.setBypassDnd(false);
            nm.createNotificationChannel(ch);
        }
        Notification out = Notification.Builder.recoverBuilder(this, n)
                .setChannelId(CALLS)
                .setCategory(Notification.CATEGORY_CALL)
                .setTimeoutAfter(60_000)
                .build();
        out.flags |= Notification.FLAG_INSISTENT;   // repeat the ringtone until it is dealt with
        nm.notify(tag, id, out);
        return true;
    }

    /** the site titles call notifications "📞 Name is calling" and "👨‍👩‍👧‍👦 Family call" */
    private static boolean isCall(Notification n) {
        CharSequence t = n.extras == null ? null : n.extras.getCharSequence(Notification.EXTRA_TITLE);
        if (t == null) return false;
        String s = t.toString();
        return s.contains("is calling") || s.contains("Family call") || s.contains("Test call");
    }
}
