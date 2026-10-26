-- ====================================================================
-- VYORA AI — Supabase PostgreSQL Schema & Row Level Security (RLS)
-- ====================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    gemini_api_key_encrypted TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Video Projects Table
CREATE TABLE IF NOT EXISTS public.video_projects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    media_type TEXT NOT NULL CHECK (media_type IN ('video', 'audio')),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    duration_seconds REAL DEFAULT 0,
    duration_formatted TEXT DEFAULT '00:00',
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own projects" ON public.video_projects FOR ALL USING (auth.uid() = user_id);

-- 3. Processing Jobs Table
CREATE TABLE IF NOT EXISTS public.processing_jobs (
    job_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK (stage IN ('QUEUED', 'UPLOADING', 'EXTRACTING_AUDIO', 'TRANSCRIBING', 'IDENTIFYING_CHAPTERS', 'INDEXING', 'FINALIZING', 'COMPLETED', 'FAILED')),
    progress_percent REAL DEFAULT 0,
    message TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own processing jobs" ON public.processing_jobs FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.video_projects WHERE id = processing_jobs.project_id AND user_id = auth.uid()));

-- 4. Chapters Table
CREATE TABLE IF NOT EXISTS public.video_chapters (
    id BIGSERIAL PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
    start_time REAL NOT NULL,
    start_time_formatted TEXT NOT NULL,
    end_time REAL NOT NULL,
    end_time_formatted TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    key_moments JSONB DEFAULT '[]'::jsonb
);

ALTER TABLE public.video_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view chapters of their projects" ON public.video_chapters FOR ALL 
USING (EXISTS (SELECT 1 FROM public.video_projects WHERE id = video_chapters.project_id AND user_id = auth.uid()));

-- 5. Transcript Segments Table
CREATE TABLE IF NOT EXISTS public.transcript_segments (
    id BIGSERIAL PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
    start_time REAL NOT NULL,
    start_time_formatted TEXT NOT NULL,
    end_time REAL NOT NULL,
    end_time_formatted TEXT NOT NULL,
    speaker TEXT DEFAULT 'Speaker',
    text TEXT NOT NULL
);

ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view transcripts of their projects" ON public.transcript_segments FOR ALL 
USING (EXISTS (SELECT 1 FROM public.video_projects WHERE id = transcript_segments.project_id AND user_id = auth.uid()));

-- 6. Summaries Table
CREATE TABLE IF NOT EXISTS public.summaries (
    project_id TEXT PRIMARY KEY REFERENCES public.video_projects(id) ON DELETE CASCADE,
    overview TEXT NOT NULL,
    executive_summary TEXT NOT NULL,
    key_takeaways JSONB DEFAULT '[]'::jsonb,
    action_items JSONB DEFAULT '[]'::jsonb,
    sentiment_and_tone JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view summaries of their projects" ON public.summaries FOR ALL 
USING (EXISTS (SELECT 1 FROM public.video_projects WHERE id = summaries.project_id AND user_id = auth.uid()));

-- 7. User Notes Table
CREATE TABLE IF NOT EXISTS public.user_notes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    timestamp_seconds REAL,
    timestamp_formatted TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own notes" ON public.user_notes FOR ALL USING (auth.uid() = user_id);

-- 8. Bookmarks Table
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    timestamp_seconds REAL NOT NULL,
    timestamp_formatted TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own bookmarks" ON public.bookmarks FOR ALL USING (auth.uid() = user_id);

-- 9. Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own chat history" ON public.chat_messages FOR ALL USING (auth.uid() = user_id);
