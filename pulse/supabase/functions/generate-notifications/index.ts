import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const { pulseId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: pulse } = await supabase
      .from('pulses')
      .select('*, sender:profiles!sender_id(display_name)')
      .eq('id', pulseId)
      .single();

    if (!pulse) {
      return new Response(JSON.stringify({ error: 'Pulse not found' }), { status: 404 });
    }

    const senderName = pulse.sender?.display_name ?? 'Someone';

    await supabase.from('notifications').insert({
      user_id: pulse.receiver_id,
      title: `${senderName} is thinking of you`,
      body: 'Tap to send a pulse back.',
      related_pulse_id: pulseId,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
