// Supabase Edge Function: Send Notifications
// Deploy: supabase functions deploy send-notification

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') || '';
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { user_id, type, title, body, data } = await req.json();

    // Store in-app notification
    await supabase.from('notifications').insert({
      user_id,
      type,
      title,
      body,
      data: data || {},
    });

    // Check user preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('notification_preferences, push_token')
      .eq('id', user_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ success: true, push: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prefs = profile.notification_preferences || {};
    const shouldPush =
      (type.includes('event') && prefs.push_events !== false) ||
      (type.includes('message') && prefs.push_messages !== false) ||
      (type.includes('reminder') && prefs.push_reminders !== false) ||
      (type === 'payment_success') ||
      (type === 'follow_notification');

    // Send push via OneSignal if configured
    if (shouldPush && ONESIGNAL_APP_ID && ONESIGNAL_API_KEY && profile.push_token) {
      await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_player_ids: [profile.push_token],
          headings: { en: title },
          contents: { en: body },
          data: data || {},
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, push: shouldPush }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
