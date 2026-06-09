-- Create quiz questions table
CREATE TABLE public.quiz_questions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of strings
    correct_option_index INTEGER NOT NULL,
    difficulty INTEGER NOT NULL DEFAULT 1, -- 1 to 5
    category TEXT DEFAULT 'geral',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage questions" ON public.quiz_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Everyone can view questions" ON public.quiz_questions FOR SELECT TO authenticated USING (true);

-- Create quiz attempts/history table
CREATE TABLE public.quiz_attempts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    score INTEGER NOT NULL DEFAULT 0,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own attempts" ON public.quiz_attempts FOR ALL USING (auth.uid() = user_id);

-- Create modules table for the hub
CREATE TABLE public.modules (
    id TEXT PRIMARY KEY, -- 'crm', 'quiz'
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- Lucide icon name
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view active modules" ON public.modules FOR SELECT TO authenticated USING (is_active = true);

-- User module permissions
CREATE TABLE public.user_modules (
    user_id UUID NOT NULL REFERENCES auth.users(id),
    module_id TEXT NOT NULL REFERENCES public.modules(id),
    PRIMARY KEY (user_id, module_id)
);

GRANT SELECT ON public.user_modules TO authenticated;
GRANT ALL ON public.user_modules TO service_role;
ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own module permissions" ON public.user_modules FOR SELECT USING (auth.uid() = user_id);

-- Insert initial modules
INSERT INTO public.modules (id, name, description, icon, is_active) VALUES
('crm', 'CRM Taeco', 'Gestão de relacionamento com clientes e funil de vendas.', 'LayoutDashboard', true),
('quiz', 'Show das Tintas', 'Desafie seus conhecimentos sobre tintas e ganhe prêmios.', 'Sparkles', true)
ON CONFLICT (id) DO NOTHING;

-- Function to handle new user registration and grant default modules
CREATE OR REPLACE FUNCTION public.handle_new_user_modules()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_modules (user_id, module_id)
    VALUES (NEW.id, 'crm'), (NEW.id, 'quiz');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_modules
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_modules();

-- Grant for existing users
INSERT INTO public.user_modules (user_id, module_id)
SELECT id, 'crm' FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO public.user_modules (user_id, module_id)
SELECT id, 'quiz' FROM auth.users ON CONFLICT DO NOTHING;
