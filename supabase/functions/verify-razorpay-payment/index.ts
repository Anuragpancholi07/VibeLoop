// Supabase Edge Function: Verify Razorpay Payment
// Deploy: supabase functions deploy verify-razorpay-payment

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateTicketNumber(): string {
  const prefix = 'VL';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      payment_id,
      event_id,
    } = await req.json();

    // Verify signature
    const expectedSignature = await generateHMAC(
      `${razorpay_order_id}|${razorpay_payment_id}`,
      RAZORPAY_KEY_SECRET
    );

    if (expectedSignature !== razorpay_signature) {
      // Update payment as failed
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment_id);

      return new Response(JSON.stringify({ error: 'Invalid payment signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update payment as completed
    await supabase
      .from('payments')
      .update({
        status: 'completed',
        gateway_payment_id: razorpay_payment_id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', payment_id);

    // Create event attendee
    await supabase
      .from('event_attendees')
      .upsert({
        event_id,
        user_id: user.id,
        status: 'approved',
        payment_id,
      });

    // Generate ticket
    const ticketNumber = generateTicketNumber();
    const qrCodeData = JSON.stringify({
      ticket: ticketNumber,
      event: event_id,
      user: user.id,
      ts: Date.now(),
    });

    const { data: ticket, error: ticketError } = await supabase
      .from('event_tickets')
      .insert({
        event_id,
        user_id: user.id,
        payment_id,
        ticket_number: ticketNumber,
        qr_code_data: qrCodeData,
        status: 'active',
      })
      .select()
      .single();

    if (ticketError) {
      return new Response(JSON.stringify({ error: 'Failed to create ticket' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment attendee count
    await supabase.rpc('increment_attendees', { p_event_id: event_id });

    // Create notification
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'payment_success',
      title: 'Payment Successful! 🎉',
      body: `Your ticket ${ticketNumber} has been generated.`,
      data: { event_id, ticket_id: ticket.id },
    });

    return new Response(JSON.stringify({
      success: true,
      ticket_id: ticket.id,
      ticket_number: ticketNumber,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateHMAC(data: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
