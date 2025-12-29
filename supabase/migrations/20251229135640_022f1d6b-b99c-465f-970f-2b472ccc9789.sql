-- Create public room messages table for realtime sync
CREATE TABLE public.public_room_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id TEXT NOT NULL,
    sender_username TEXT NOT NULL,
    content TEXT,
    image_data TEXT,
    message_type TEXT NOT NULL DEFAULT 'TEXT',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.public_room_messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read messages (public room)
CREATE POLICY "Anyone can view public room messages"
ON public.public_room_messages
FOR SELECT
USING (true);

-- Allow anyone to insert messages (public room)
CREATE POLICY "Anyone can send public room messages"
ON public.public_room_messages
FOR INSERT
WITH CHECK (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_room_messages;