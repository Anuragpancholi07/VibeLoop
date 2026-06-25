import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image, Smile, ArrowLeft, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { EmptyState, PageLoader } from '@/components/common';
import { cn, getRelativeTime } from '@/lib/utils';
import type { ChatRoom, ChatMessage } from '@/types';

export function ChatListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadRooms();
  }, [user]);

  const loadRooms = async () => {
    try {
      const { data: memberData } = await supabase
        .from('chat_room_members').select('room_id').eq('user_id', user!.id);
      const roomIds = (memberData || []).map((m: any) => m.room_id);
      if (roomIds.length === 0) { setIsLoading(false); return; }

      const { data } = await supabase
        .from('chat_rooms').select('*')
        .in('id', roomIds).order('last_message_at', { ascending: false });
      setRooms((data || []) as ChatRoom[]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold mb-4">{t('chat.title')}</h1>
      {rooms.length > 0 ? (
        <div className="space-y-2">
          {rooms.map((room) => (
            <Link key={room.id} to={`/chat/${room.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:bg-secondary/30 transition-colors">
              <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{room.name || 'Chat Room'}</p>
                {room.last_message_preview && (
                  <p className="text-xs text-muted-foreground truncate">{room.last_message_preview}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                {room.last_message_at && (
                  <p className="text-[10px] text-muted-foreground">{getRelativeTime(room.last_message_at)}</p>
                )}
                {(room as any).unread_count > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold mt-1">
                    {(room as any).unread_count}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Send className="w-8 h-8 text-muted-foreground" />}
          title={t('chat.noMessages')}
          description={t('chat.noMessagesDescription')}
        />
      )}
    </div>
  );
}

export function ChatRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) loadRoom();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`room-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${id}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => [...prev, newMsg]);
          scrollToBottom();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const loadRoom = async () => {
    try {
      const { data: roomData } = await supabase.from('chat_rooms').select('*').eq('id', id).single();
      setRoom(roomData as ChatRoom);
      const { data: msgData } = await supabase
        .from('chat_messages').select('*, sender:profiles(*)').eq('room_id', id).order('created_at').limit(100);
      setMessages((msgData || []) as ChatMessage[]);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !id) return;
    const content = newMessage.trim();
    setNewMessage('');
    await supabase.from('chat_messages').insert({
      room_id: id, sender_id: user.id, content, message_type: 'text',
    });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <Link to="/chat" className="p-1"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
          <Users className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold">{room?.name || 'Chat'}</p>
          <p className="text-xs text-muted-foreground">{room?.members_count} members</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          return (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[75%] rounded-2xl px-3.5 py-2.5', isMine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card border border-border rounded-bl-md')}>
                {!isMine && (
                  <p className="text-xs font-semibold text-primary mb-1">{msg.sender?.full_name}</p>
                )}
                <p className="text-sm break-words">{msg.content}</p>
                <p className={cn('text-[10px] mt-1', isMine ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                  {getRelativeTime(msg.created_at)}
                </p>
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-xl hover:bg-secondary transition-colors"><Image className="w-5 h-5 text-muted-foreground" /></button>
          <button className="p-2 rounded-xl hover:bg-secondary transition-colors"><Smile className="w-5 h-5 text-muted-foreground" /></button>
          <input
            type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={t('chat.messagePlaceholder')}
            className="flex-1 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button onClick={sendMessage} disabled={!newMessage.trim()} className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 transition-opacity">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
